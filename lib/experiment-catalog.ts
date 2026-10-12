import { getDb } from '@/db';
import { applyStoredEvent } from './event-catalog';
import type { CampusEvent } from './campus-events';
import { assessAvailableWindow, koreaDate, validDate, type AvailableWindow, type ExperimentFit } from './experiment-fit';

type CatalogRow = {
  id: string; payload: string; review_status: 'verified'; reviewed_at: number | null;
  override_json: string | null; last_seen_at: number; source_hash: string;
};
export type ExperimentEvent = {
  id: string; title: string; category: string; date: string | null; start: number | null;
  end: number | null; schedule: string | null; place: string | null; audience: string | null;
  application: string | null; deadline: string | null; officialUrl: string;
  posterUrl: string | null; reviewedAt: number | null; lastSeenAt: number; fit: ExperimentFit;
  activityMode: 'single'|'series'|'flexible'|'unknown';
  activityEndDate: string | null;
};
type InternalEvent = { public: ExperimentEvent; sourceHash: string; url: string };
const dayMs = 86400000;

export function officialNoticeUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'www.pcu.ac.kr' && !url.port && !url.username && !url.password
      && !url.search && !url.hash && /^\/kor\/article\/(Notify_1|Event_1)\/\d{1,20}$/.test(url.pathname)
      ? url.href : null;
  } catch { return null; }
}
function posterUrl(event: CampusEvent): string | null {
  for (const value of event.posters || []) {
    try {
      const url = new URL(value);
      if (url.protocol === 'https:' && url.hostname === 'www.pcu.ac.kr' && !url.port
          && !url.username && !url.password && url.pathname.startsWith('/upload/')) return url.href;
    } catch { /* Ignore bad source data. */ }
  }
  return null;
}
function readRow(row: CatalogRow, window: AvailableWindow, now: Date): InternalEvent | null {
  try {
    const event = applyStoredEvent(row);
    if (event.sourceUnavailable || !/^(Notify_1|Event_1):\d{1,20}$/.test(event.id)) return null;
    const url = officialNoticeUrl(event.url);
    if (!url) return null;
    const today = koreaDate(now);
    const horizon = koreaDate(new Date(now.getTime() + 21 * dayMs));
    if (event.date && (!validDate(event.date) || event.date < today || event.date > horizon)) return null;
    if (!event.date && (!event.postedAt || !validDate(event.postedAt)
        || event.postedAt < koreaDate(new Date(now.getTime() - 120 * dayMs))
        || !row.reviewed_at || row.reviewed_at < now.getTime() - 7 * dayMs)) return null;
    const fit = assessAvailableWindow(event, window, now);
    if (fit === 'closed') return null;
    return {
      public: { id: event.id, title: event.title, category: event.category, date: event.date,
        start: event.start, end: event.end, schedule: event.schedule, place: event.place, audience: event.audience,
        application: event.application, deadline: event.deadline, officialUrl: url,
        posterUrl: posterUrl(event), reviewedAt: row.reviewed_at, lastSeenAt: row.last_seen_at, fit,
        activityMode: event.activityMode || 'unknown', activityEndDate: event.activityEndDate || null },
      sourceHash: row.source_hash, url,
    };
  } catch { return null; }
}

export async function experimentCatalog(window: AvailableWindow, now = new Date()) {
  const db = getDb();
  const freshAfter = now.getTime() - dayMs;
  const rows = await db.prepare(`SELECT id,payload,review_status,reviewed_at,override_json,last_seen_at,source_hash
    FROM campus_events WHERE school='pcu' AND review_status='verified' AND last_seen_at>=?
    ORDER BY last_seen_at DESC LIMIT 150`).bind(freshAfter).all<CatalogRow>();
  const events = rows.results.flatMap(row => {
    const event = readRow(row, window, now); return event ? [event] : [];
  });
  const priority: Record<ExperimentFit, number> = { time_match: 0, schedule_unknown: 1, different_time: 2, closed: 3 };
  events.sort((a, b) => priority[a.public.fit] - priority[b.public.fit]
    || (a.public.date || '9999').localeCompare(b.public.date || '9999')
    || a.public.title.localeCompare(b.public.title));
  let supplyStatus: 'ready' | 'empty' | 'stale' = events.length ? 'ready' : 'empty';
  if (!events.length) {
    const stale = await db.prepare(`SELECT id FROM campus_events WHERE school='pcu' AND review_status='verified' AND last_seen_at<? LIMIT 1`)
      .bind(freshAfter).first();
    if (stale) supplyStatus = 'stale';
  }
  return { events, supplyStatus, asOf: events.length ? Math.max(...events.map(item => item.public.lastSeenAt)) : null };
}
