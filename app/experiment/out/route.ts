import { randomUUID } from 'node:crypto';
import { getDb } from '@/db';
import { experimentCatalog } from '@/lib/experiment-catalog';
import { currentExperimentInvite, experimentReply, inviteWindow } from '@/lib/experiment-session';
import { ownOrigin } from '@/lib/member-server';

export async function POST(request: Request) {
  if (!ownOrigin(request)) return experimentReply({}, 403);
  if (!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')) return experimentReply({}, 400);
  const reader = request.body?.getReader();
  if (!reader) return experimentReply({}, 400);
  let size = 0, body = '';
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 256) { await reader.cancel(); return experimentReply({}, 400); }
    body += decoder.decode(value, { stream: true });
  }
  body += decoder.decode();
  const eventId = new URLSearchParams(body).get('eventId');
  if (!eventId || !/^(Notify_1|Event_1):\d{1,20}$/.test(eventId)) return experimentReply({}, 400);
  try {
    const invite = await currentExperimentInvite(request);
    if (!invite) return experimentReply({}, 401);
    const window = inviteWindow(invite);
    if (!invite.consented_at || !window) return experimentReply({}, 403);
    const { events } = await experimentCatalog(window);
    const event = events.find(item => item.public.id === eventId);
    if (!event) return experimentReply({ message: '이 행사는 현재 확인할 수 없어요.' }, 410);
    await getDb().prepare(`INSERT INTO experiment_actions
      (id,invite_id,action,event_id,fit_at_action,source_hash_at_action,created_at)
      VALUES (?,?,'original_open_attempt',?,?,?,?)`)
      .bind(randomUUID(), invite.id, eventId, event.public.fit, event.sourceHash, Date.now()).run();
    return new Response(null, { status: 303, headers: { Location: event.url,
      'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
  } catch { return experimentReply({ message: '원문을 열지 못했어요.' }, 503); }
}
