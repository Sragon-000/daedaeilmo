import { randomUUID } from 'node:crypto';
import { getDb } from '@/db';
import { ownOrigin, smallJson } from '@/lib/member-server';
import { validAvailableWindow, FIT_RULE_VERSION } from '@/lib/experiment-fit';
import { currentExperimentInvite, experimentReply } from '@/lib/experiment-session';

export async function POST(request: Request) {
  if (!ownOrigin(request)) return experimentReply({}, 403);
  let input: unknown;
  try { input = await smallJson(request); } catch { return experimentReply({}, 400); }
  if (!validAvailableWindow(input)) return experimentReply({ message: '가능한 요일과 시간을 확인해 주세요.' }, 400);
  try {
    const invite = await currentExperimentInvite(request);
    if (!invite) return experimentReply({}, 401);
    if (!invite.consented_at) return experimentReply({}, 403);
    const now = Date.now(), db = getDb();
    await db.batch([
      db.prepare(`UPDATE experiment_invites SET available_day=?,available_start=?,available_end=?,availability_updated_at=? WHERE id=?`)
        .bind(input.day, input.start, input.end, now, invite.id),
      db.prepare(`INSERT INTO experiment_actions (id,invite_id,action,created_at) VALUES (?,?,'availability_submitted',?)`)
        .bind(randomUUID(), invite.id, now),
    ]);
    return experimentReply({ fitRuleVersion: FIT_RULE_VERSION });
  } catch { return experimentReply({}, 503); }
}
