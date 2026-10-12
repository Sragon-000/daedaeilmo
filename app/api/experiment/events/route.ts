import { experimentCatalog } from '@/lib/experiment-catalog';
import { FIT_RULE_VERSION } from '@/lib/experiment-fit';
import { currentExperimentInvite, experimentReply, inviteWindow } from '@/lib/experiment-session';

export async function GET(request: Request) {
  try {
    const invite = await currentExperimentInvite(request);
    if (!invite) return experimentReply({}, 401);
    if (!invite.consented_at) return experimentReply({ state: 'consent_required' }, 403);
    const window = inviteWindow(invite);
    if (!window) return experimentReply({ state: 'availability_required' }, 403);
    const catalog = await experimentCatalog(window);
    return experimentReply({ items: catalog.events.map(event => event.public),
      asOf: catalog.asOf, supplyStatus: catalog.supplyStatus, fitRuleVersion: FIT_RULE_VERSION,
      availability: window });
  } catch { return experimentReply({ message: '행사를 불러오지 못했어요.' }, 503); }
}
