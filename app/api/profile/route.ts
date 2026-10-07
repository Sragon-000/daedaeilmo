import { getDb } from '@/db';
import { authenticatedSchool, ensureMember, ownOrigin, reply, smallJson } from '@/lib/member-server';
import { validProfile } from '@/lib/member-types';
export async function GET(request: Request) {
  const session = authenticatedSchool(request); if (!session) return reply({ message: '학교 로그인이 필요합니다.' }, 401);
  try { return reply({ member: await ensureMember(session) }); }
  catch { return reply({ message: '회원정보를 불러오지 못했어요.' }, 503); }
}
export async function POST(request: Request) {
  if (!ownOrigin(request)) return reply({ message: '요청 출처를 확인할 수 없습니다.' }, 403);
  const session = authenticatedSchool(request); if (!session) return reply({ message: '학교 로그인이 필요합니다.' }, 401);
  let input: unknown; try { input = await smallJson(request); } catch { return reply({ message: '입력 내용을 확인해 주세요.' }, 400); }
  if (!validProfile(input)) return reply({ message: '이름·닉네임은 2~24자로 입력하고 아바타를 선택해 주세요.' }, 400);
  try {
    const member = await ensureMember(session);
    const taken = await getDb().prepare('SELECT id FROM members WHERE nickname = ? AND id != ?').bind(input.nickname.trim(), member.id).first();
    if (taken) return reply({ message: '이미 사용 중인 닉네임입니다.' }, 409);
    await getDb().prepare('UPDATE members SET name = ?, nickname = ?, avatar = ?, updated_at = ? WHERE id = ?')
      .bind(input.name.trim(), input.nickname.trim(), input.avatar, Date.now(), member.id).run();
    return reply({ member: await ensureMember(session) });
  } catch { return reply({ message: '프로필을 저장하지 못했어요. 닉네임을 확인하고 다시 시도해 주세요.' }, 503); }
}
