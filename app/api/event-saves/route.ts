import { getDb } from '@/db';
import { storedEvents } from '@/lib/event-catalog';
import { authenticatedSchool, ensureMember, ownOrigin, reply, smallJson } from '@/lib/member-server';

const validId = (value: unknown): value is string => typeof value === 'string' && /^(Notify_1|Event_1):\d{1,20}$/.test(value);

export async function GET(request: Request) {
  const session = authenticatedSchool(request); if (!session || session.school !== 'pcu') return reply({}, 401);
  try {
    const member = await ensureMember(session);
    const rows = await getDb().prepare('SELECT event_id FROM member_event_saves WHERE member_id = ? ORDER BY saved_at DESC LIMIT 200')
      .bind(member.id).all<{event_id:string}>();
    const ids = rows.results.map(row => row.event_id);
    return reply({ ids, items: await storedEvents(ids) });
  } catch { return reply({message:'저장한 행사를 불러오지 못했어요.'}, 503); }
}
export async function POST(request: Request) {
  if (!ownOrigin(request)) return reply({}, 403);
  const session = authenticatedSchool(request); if (!session || session.school !== 'pcu') return reply({}, 401);
  let input: unknown;
  try { input = await smallJson(request); } catch { return reply({}, 400); }
  const id = (input as {id?:unknown})?.id;
  if (!validId(id)) return reply({}, 400);
  try {
    const member = await ensureMember(session), db = getDb();
    const event = await db.prepare("SELECT id FROM campus_events WHERE id = ? AND school = 'pcu' AND review_status != 'hidden'").bind(id).first();
    if (!event) return reply({message:'행사를 찾지 못했어요.'}, 404);
    await db.prepare('INSERT INTO member_event_saves (member_id,event_id,saved_at) VALUES (?,?,?) ON CONFLICT(member_id,event_id) DO NOTHING')
      .bind(member.id,id,Date.now()).run();
    return reply({saved:true});
  } catch { return reply({message:'행사를 저장하지 못했어요.'}, 503); }
}
export async function DELETE(request: Request) {
  if (!ownOrigin(request)) return reply({}, 403);
  const session = authenticatedSchool(request); if (!session || session.school !== 'pcu') return reply({}, 401);
  const id = new URL(request.url).searchParams.get('id'); if (!validId(id)) return reply({}, 400);
  try {
    const member = await ensureMember(session);
    await getDb().prepare('DELETE FROM member_event_saves WHERE member_id = ? AND event_id = ?').bind(member.id,id).run();
    return reply({saved:false});
  } catch { return reply({message:'저장을 해제하지 못했어요.'}, 503); }
}
