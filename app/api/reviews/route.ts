import { randomUUID } from 'node:crypto';
import { getDb } from '@/db';
import { authenticatedSchool, ensureMember, ownOrigin, reply, smallJson } from '@/lib/member-server';
export async function GET(request: Request) {
  const session = authenticatedSchool(request); if (!session) return reply({ message: '학교 로그인이 필요합니다.' }, 401);
  try {
    const member = await ensureMember(session);
    // Only the selected display name leaves the server. Never return both names or the school identifier.
    const result = await getDb().prepare(`SELECT r.id, r.school, r.place, r.score, r.body AS text, r.display_mode AS displayMode,
      CASE WHEN r.display_mode = 'name' THEN m.name ELSE m.nickname END AS author, m.avatar,
      CASE WHEN m.photo_key IS NOT NULL THEN '/api/avatar?id=' || m.id || '&v=' || r.updated_at ELSE NULL END AS photoUrl,
      CASE WHEN r.member_id = ? THEN 1 ELSE 0 END AS mine
      FROM member_reviews r JOIN members m ON m.id = r.member_id WHERE r.school = ? ORDER BY r.created_at DESC LIMIT 200`)
      .bind(member.id, session.school).all();
    return reply({ reviews: result.results.map(r => ({ ...r, mine: !!r.mine, live: true })) });
  } catch { return reply({ message: '리뷰를 불러오지 못했어요.' }, 503); }
}
export async function POST(request: Request) {
  if (!ownOrigin(request)) return reply({}, 403);
  const session = authenticatedSchool(request); if (!session) return reply({ message: '학교 로그인이 필요합니다.' }, 401);
  let input: Record<string, unknown>;
  try { input = await smallJson(request) as Record<string, unknown>; } catch { return reply({}, 400); }
  if (!input || !Number.isInteger(input.place) || ![1,2,3].includes(Number(input.place))
    || !Number.isInteger(input.score) || Number(input.score) < 1 || Number(input.score) > 5
    || typeof input.text !== 'string' || input.text.trim().length < 5 || input.text.trim().length > 300
    || !['name','nickname'].includes(String(input.displayMode))) return reply({ message: '리뷰 입력 내용을 확인해 주세요.' }, 400);
  try {
    const member = await ensureMember(session); if (member.needsSetup) return reply({ message: '프로필 설정을 먼저 완료해 주세요.' }, 409);
    const now = Date.now();
    await getDb().prepare(`INSERT INTO member_reviews (id, member_id, school, place, score, body, display_mode, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(member_id, place) DO UPDATE SET score = excluded.score, body = excluded.body, display_mode = excluded.display_mode, updated_at = excluded.updated_at`)
      .bind(randomUUID(), member.id, session.school, input.place, input.score, input.text.trim(), input.displayMode, now, now).run();
    return reply({ saved: true });
  } catch { return reply({ message: '리뷰를 저장하지 못했어요.' }, 503); }
}
export async function DELETE(request: Request) {
  if (!ownOrigin(request)) return reply({}, 403);
  const session = authenticatedSchool(request); if (!session) return reply({}, 401);
  const id = new URL(request.url).searchParams.get('id'); if (!id || id.length > 64) return reply({}, 400);
  try {
    const member = await ensureMember(session);
    const result = await getDb().prepare('DELETE FROM member_reviews WHERE id = ? AND member_id = ? AND school = ?').bind(id, member.id, session.school).run();
    return result.meta.changes ? reply({ deleted: true }) : reply({}, 404);
  } catch { return reply({}, 503); }
}
