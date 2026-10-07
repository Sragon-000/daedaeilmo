import { randomUUID } from 'node:crypto';
import { getDb } from '@/db';
import { authenticatedSchool, ensureMember, ownOrigin, reply, smallJson } from '@/lib/member-server';

export async function POST(request: Request) {
  if (!ownOrigin(request)) return reply({}, 403);
  const session = authenticatedSchool(request); if (!session || session.school !== 'pcu') return reply({}, 401);
  let input: unknown;
  try { input = await smallJson(request); } catch { return reply({}, 400); }
  const id = (input as {id?:unknown})?.id;
  if (typeof id !== 'string' || !/^(Notify_1|Event_1):\d{1,20}$/.test(id)) return reply({}, 400);
  try {
    const member = await ensureMember(session), db = getDb();
    await db.prepare(`INSERT INTO member_event_opens (id,member_id,event_id,opened_at)
      SELECT ?,?,?,? WHERE EXISTS (SELECT 1 FROM campus_events WHERE id = ? AND school = 'pcu' AND review_status != 'hidden')`)
      .bind(randomUUID(),member.id,id,Date.now(),id).run();
    return reply({recorded:true});
  } catch { return reply({recorded:false}, 503); }
}
