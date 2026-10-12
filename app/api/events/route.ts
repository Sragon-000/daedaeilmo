import { campusEventSnapshot, previousCampusEventSnapshot } from '@/lib/campus-event-collector';
import { storedEvents } from '@/lib/event-catalog';
import { authenticatedSchool, reply } from '@/lib/member-server';

export async function GET(request: Request) {
  const session = authenticatedSchool(request);
  if (!session || session.school !== 'pcu') return reply({}, 401);
  try {
    const snapshot = await campusEventSnapshot();
    return Response.json({ items: await storedEvents(snapshot.ids), fetchedAt: snapshot.fetchedAt,
      partial: snapshot.partial, mode: 'live' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    const snapshot = previousCampusEventSnapshot();
    if (snapshot) {
      try {
        return Response.json({ items: await storedEvents(snapshot.ids), fetchedAt: snapshot.fetchedAt,
          partial: snapshot.partial, mode: 'stale' }, { headers: { 'Cache-Control': 'no-store' } });
      } catch { /* Missing catalog cannot supply stale data. */ }
    }
    return Response.json({ message: '학교 행사 정보를 가져오지 못했어요. 잠시 후 다시 시도해 주세요.' }, { status: 503 });
  }
}
