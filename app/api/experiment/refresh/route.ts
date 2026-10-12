import { env } from 'cloudflare:workers';
import { timingSafeEqual } from 'node:crypto';
import { campusEventSnapshot } from '@/lib/campus-event-collector';
import { ownOrigin } from '@/lib/member-server';
import { experimentReply } from '@/lib/experiment-session';

export async function POST(request: Request) {
  const url = new URL(request.url);
  if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') return experimentReply({}, 403);
  if (!ownOrigin(request)) return experimentReply({}, 403);
  const key = (env as unknown as { EXPERIMENT_OPERATOR_SECRET?: string }).EXPERIMENT_OPERATOR_SECRET;
  const provided = request.headers.get('x-experiment-operator-secret') || '';
  const providedBytes = Buffer.from(provided), expectedBytes = Buffer.from(key || '');
  if (!key || key.length < 43 || providedBytes.length !== expectedBytes.length
      || !timingSafeEqual(providedBytes, expectedBytes)) return experimentReply({}, 403);
  try {
    const snapshot = await campusEventSnapshot(true);
    return experimentReply({ fetchedAt: snapshot.fetchedAt, candidates: snapshot.ids.length, partial: snapshot.partial });
  } catch { return experimentReply({ message: '학교 공개 공지를 새로 수집하지 못했어요.' }, 503); }
}
