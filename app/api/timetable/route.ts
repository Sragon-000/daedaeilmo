import { randomUUID } from 'node:crypto';
import { getDb } from '@/db';
import { authenticatedSchool, ensureMember, ownOrigin, reply, smallJson } from '@/lib/member-server';
function validTerm(year: unknown, semester: unknown) { return Number.isInteger(year) && Number(year) >= 2000 && Number(year) <= 2100 && [1,2].includes(Number(semester)); }
export async function GET(request: Request) {
  const session = authenticatedSchool(request); if (!session) return reply({}, 401);
  const url = new URL(request.url), year = Number(url.searchParams.get('year')), semester = Number(url.searchParams.get('semester'));
  if (!validTerm(year, semester)) return reply({}, 400);
  try {
    const member = await ensureMember(session);
    const result = await getDb().prepare('SELECT id, name, day, start, end FROM member_courses WHERE member_id = ? AND year = ? AND semester = ? ORDER BY day, start').bind(member.id, year, semester).all();
    return reply({ year, semester, courses: result.results });
  } catch { return reply({ message: '시간표를 불러오지 못했어요.' }, 503); }
}
export async function POST(request: Request) {
  if (!ownOrigin(request)) return reply({}, 403);
  const session = authenticatedSchool(request); if (!session) return reply({}, 401);
  let input: Record<string, unknown>;
  try { input = await smallJson(request) as Record<string, unknown>; } catch { return reply({}, 400); }
  if (!input || !validTerm(input.year, input.semester) || typeof input.name !== 'string' || input.name.trim().length < 1 || input.name.trim().length > 30
    || !Number.isInteger(input.day) || Number(input.day) < 0 || Number(input.day) > 4
    || !Number.isInteger(input.start) || !Number.isInteger(input.end) || Number(input.start) < 540 || Number(input.end) > 1080 || Number(input.end) <= Number(input.start)
    || (input.id !== undefined && (typeof input.id !== 'string' || input.id.length > 64))) return reply({ message: '수업 이름과 월~금 09:00–18:00 사이의 시간을 확인해 주세요.' }, 400);
  try {
    const member = await ensureMember(session);
    if (member.needsSetup) return reply({ message: '프로필을 먼저 설정해 주세요.' }, 409);
    const db = getDb();
    const params = [member.id, input.year, input.semester, input.day, input.end, input.start];
    if (input.id) {
      const result = await db.prepare(`UPDATE member_courses SET name = ?, day = ?, start = ?, end = ? WHERE id = ? AND member_id = ? AND year = ? AND semester = ?
        AND NOT EXISTS (SELECT 1 FROM member_courses WHERE member_id = ? AND year = ? AND semester = ? AND day = ? AND start < ? AND end > ? AND id != ?)`)
        .bind(input.name.trim(), input.day, input.start, input.end, input.id, member.id, input.year, input.semester, ...params, input.id).run();
      if (!result.meta.changes) return reply({ message: '수업이 겹치거나 수정할 수업을 찾을 수 없어요.' }, 409);
    } else {
      const result = await db.prepare(`INSERT INTO member_courses (id, member_id, year, semester, name, day, start, end)
        SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM member_courses WHERE member_id = ? AND year = ? AND semester = ? AND day = ? AND start < ? AND end > ?)`)
        .bind(randomUUID(), member.id, input.year, input.semester, input.name.trim(), input.day, input.start, input.end, ...params).run();
      if (!result.meta.changes) return reply({ message: '이미 등록한 수업과 시간이 겹쳐요.' }, 409);
    }
    return reply({ saved: true });
  } catch { return reply({ message: '시간표를 저장하지 못했어요.' }, 503); }
}
export async function DELETE(request: Request) {
  if (!ownOrigin(request)) return reply({}, 403);
  const session = authenticatedSchool(request); if (!session) return reply({}, 401);
  const id = new URL(request.url).searchParams.get('id'); if (!id || id.length > 64) return reply({}, 400);
  try { const member = await ensureMember(session);
    const result = await getDb().prepare('DELETE FROM member_courses WHERE id = ? AND member_id = ?').bind(id, member.id).run();
    return result.meta.changes ? reply({ deleted: true }) : reply({}, 404);
  } catch { return reply({}, 503); }
}
