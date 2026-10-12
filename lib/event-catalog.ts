import { createHash } from 'node:crypto';
import { getDb } from '@/db';
import type { CampusEvent } from './campus-events';

type StoredEvent = {
  id: string; payload: string; review_status: 'unreviewed'|'verified'|'hidden';
  reviewed_at: number | null; override_json: string | null; last_seen_at: number;
};

const editable = new Set(['schedule','application','audience','place','date','start','end','deadline','activityMode','activityEndDate']);
function sourceHash(event: CampusEvent) {
  const { id, title, url, sourceBoard, postedAt, schedule, application, audience, place, posters, needsAttachment, contentHash } = event;
  // Hash stable source fields. OCR availability and derived date values can fluctuate.
  const source = { id, title, url, sourceBoard, postedAt, schedule, application, audience, place, posters, needsAttachment, contentHash };
  return createHash('sha256').update(JSON.stringify(source)).digest('hex');
}
export function applyStoredEvent(row: StoredEvent): CampusEvent {
  const source = JSON.parse(row.payload) as CampusEvent;
  let overrides: Record<string, unknown> = {};
  try { overrides = row.override_json ? JSON.parse(row.override_json) as Record<string, unknown> : {}; } catch { /* Ignore corrupt corrections. */ }
  const safe = Object.fromEntries(Object.entries(overrides).filter(([key]) => editable.has(key)));
  return { ...source, ...safe, fetchedAt: new Date(row.last_seen_at).toISOString(),
    reviewStatus: row.review_status, reviewedAt: row.reviewed_at };
}
export async function storeEvents(events: CampusEvent[]): Promise<CampusEvent[]> {
  const db = getDb(), now = Date.now();
  if (!events.length) return [];
  const reliable=events.filter(event=>!event.sourceUnavailable);
  if(reliable.length)await db.batch(reliable.map(event => db.prepare(`INSERT INTO campus_events
    (id,school,source_board,url,title,payload,source_hash,first_seen_at,last_seen_at,review_status)
    VALUES (?,?,?,?,?,?,?,?,?,'unreviewed')
    ON CONFLICT(id) DO UPDATE SET url=excluded.url,title=excluded.title,payload=excluded.payload,
    last_seen_at=excluded.last_seen_at,review_status=CASE WHEN campus_events.source_hash=excluded.source_hash THEN campus_events.review_status ELSE 'unreviewed' END,
    reviewed_at=CASE WHEN campus_events.source_hash=excluded.source_hash THEN campus_events.reviewed_at ELSE NULL END,
    override_json=CASE WHEN campus_events.source_hash=excluded.source_hash THEN campus_events.override_json ELSE NULL END,
    source_hash=excluded.source_hash`)
    .bind(event.id,'pcu',event.sourceBoard || 'unknown',event.url,event.title,JSON.stringify(event),sourceHash(event),now,now)));
  const placeholders = events.map(() => '?').join(',');
  const found = await db.prepare(`SELECT id,payload,review_status,reviewed_at,override_json,last_seen_at FROM campus_events WHERE id IN (${placeholders})`)
    .bind(...events.map(event => event.id)).all<StoredEvent>();
  const byId = new Map(found.results.map(row => [row.id, row]));
  return events.flatMap(event => {
    const row = byId.get(event.id);
    if (!row || row.review_status === 'hidden') return [];
    return [applyStoredEvent(row)];
  });
}
export async function storedEvents(ids: string[]): Promise<CampusEvent[]> {
  if (!ids.length) return [];
  const placeholders = ids.map(() => '?').join(',');
  const found = await getDb().prepare(`SELECT id,payload,review_status,reviewed_at,override_json,last_seen_at FROM campus_events WHERE id IN (${placeholders})`)
    .bind(...ids).all<StoredEvent>();
  const byId = new Map(found.results.map(row => [row.id, row]));
  return ids.flatMap(id => {
    const row = byId.get(id);
    return row && row.review_status !== 'hidden' ? [applyStoredEvent(row)] : [];
  });
}
