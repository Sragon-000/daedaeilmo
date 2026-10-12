import { randomUUID } from 'node:crypto';
import { getDb } from '@/db';
import { ownOrigin, smallJson } from '@/lib/member-server';
import { currentExperimentInvite, experimentReply, inviteWindow } from '@/lib/experiment-session';

export async function POST(request: Request) {
  if (!ownOrigin(request)) return experimentReply({}, 403);
  let input: unknown;
  try { input = await smallJson(request); } catch { return experimentReply({}, 400); }
  const action = (input as { action?: unknown })?.action;
  if (action !== 'feed_viewed' && action !== 'supply_empty') return experimentReply({}, 400);
  try {
    const invite = await currentExperimentInvite(request);
    if (!invite) return experimentReply({}, 401);
    if (!invite.consented_at || !inviteWindow(invite)) return experimentReply({}, 403);
    await getDb().prepare('INSERT INTO experiment_actions (id,invite_id,action,created_at) VALUES (?,?,?,?)')
      .bind(randomUUID(), invite.id, action, Date.now()).run();
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
  } catch { return experimentReply({}, 503); }
}
