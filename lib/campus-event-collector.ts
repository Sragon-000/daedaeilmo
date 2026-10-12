import { createHash } from 'node:crypto';
import { enrichPoster } from './poster-ocr';
import { parseNotices } from './school-notices';
import { articleBody, eventCandidate, parseEvent, type CampusEvent } from './campus-events';
import { storeEvents } from './event-catalog';

type Snapshot = { ids: string[]; fetchedAt: string; partial: boolean };
let cached: Snapshot | undefined;
let pending: Promise<Snapshot> | undefined;

async function read(url: string) {
  const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(10000),
    headers: { 'User-Agent': 'DaedaeilmoPrototype/0.1 public-campus-notice-reader', Accept: 'text/html' } });
  if (!response.ok) throw new Error('UPSTREAM');
  const html = await response.text();
  if (html.length > 2000000) throw new Error('SIZE');
  return html;
}
async function collect(): Promise<Snapshot> {
  const fetchedAt = new Date().toISOString();
  const pages = [['Notify_1', 1], ['Notify_1', 2], ['Notify_1', 3], ['Event_1', 1]] as const;
  const recent = new Date(Date.now() - 120 * 86400000).toISOString().slice(0, 10);
  const boards = await Promise.allSettled(pages.map(async ([board, page]) => {
    const html = await read('https://www.pcu.ac.kr/kor/article/' + board + '?pageIndex=' + page);
    return parseNotices(html, 'pcu', 60).filter(notice => eventCandidate(notice.title) && (!notice.postedAt || notice.postedAt >= recent))
      .map(notice => ({ ...notice, id: `${board}:${notice.id}`, sourceBoard: board,
        url: `https://www.pcu.ac.kr/kor/article/${board}/${notice.id}` }));
  }));
  const notices = [...new Map(boards.flatMap(board => board.status === 'fulfilled' ? board.value : [])
    .map(notice => [notice.id, notice])).values()].slice(0, 20);
  if (!notices.length) throw new Error('EMPTY');
  const items: CampusEvent[] = [];
  let partial = boards.some(board => board.status === 'rejected');
  for (let index = 0; index < notices.length; index += 2) {
    const group = await Promise.all(notices.slice(index, index + 2).map(async notice => {
      try {
        const html = await read(notice.url), body = articleBody(html), event = parseEvent(html, notice, fetchedAt);
        if (!body) { partial = true; return { ...event, sourceUnavailable: true }; }
        event.contentHash = createHash('sha256').update(body.replace(/<!--[\s\S]*?-->/g, '').replace(/\s+/g, ' ')).digest('hex');
        return await enrichPoster(event);
      } catch { partial = true; return { ...parseEvent('', notice, fetchedAt), sourceUnavailable: true }; }
    }));
    items.push(...group);
  }
  await storeEvents(items);
  cached = { ids: items.map(item => item.id), fetchedAt, partial };
  return cached;
}
export async function campusEventSnapshot(force = false): Promise<Snapshot> {
  if (force || !cached || Date.now() - Date.parse(cached.fetchedAt) > 600000) {
    pending ??= collect().finally(() => { pending = undefined; });
    await pending;
  }
  if (!cached) throw new Error('EMPTY');
  return cached;
}
export function previousCampusEventSnapshot(): Snapshot | undefined { return cached; }
