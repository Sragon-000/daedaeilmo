import { getDb } from '@/db';
import { ownOrigin, smallJson } from '@/lib/member-server';
import { currentExperimentInvite, experimentReply } from '@/lib/experiment-session';

export async function POST(request: Request) {
  if (!ownOrigin(request)) return experimentReply({}, 403);
  let input: unknown;
  try { input = await smallJson(request); } catch { return experimentReply({}, 400); }
  if ((input as { agreed?: unknown })?.agreed !== true) return experimentReply({}, 400);
  try {
    const invite = await currentExperimentInvite(request);
    if (!invite) return experimentReply({}, 401);
    await getDb().prepare('UPDATE experiment_invites SET consented_at=COALESCE(consented_at,?) WHERE id=?')
      .bind(Date.now(), invite.id).run();
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
  } catch { return experimentReply({}, 503); }
}
