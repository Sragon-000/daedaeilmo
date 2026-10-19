import { randomUUID } from 'node:crypto';
import { getDb } from '@/db';
import { auditActor, canOperate, institutionActor } from '@/lib/institution-auth';
import { ownOrigin, reply, smallJson } from '@/lib/member-server';
import type { CampusEvent } from '@/lib/campus-events';

type Input = Record<string, unknown>;
const trimmed = (value: unknown, max: number) => typeof value === 'string' && value.trim().length <= max ? value.trim() : null;
const minute = (value: unknown) => value === null || value === '' ? null : Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 1440 ? value as number : NaN;
const date = (value: unknown) => {
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || !/^20\d{2}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [y,m,d]=value.split('-').map(Number), parsed=new Date(Date.UTC(y,m-1,d));
  return parsed.getUTCFullYear()===y && parsed.getUTCMonth()===m-1 && parsed.getUTCDate()===d ? value : undefined;
};

export async function GET(request: Request) {
  const actor = await institutionActor(request); if (!actor) return reply({}, 401);
  try {
    const db = getDb();
    const [programs, notices] = await Promise.all([
      db.prepare(`SELECT p.*, e.url AS source_url,
        (SELECT COUNT(*) FROM program_applications a WHERE a.program_id=p.id AND a.status='applied') AS pending_count,
        (SELECT COUNT(*) FROM program_applications a WHERE a.program_id=p.id AND a.status='accepted') AS accepted_count,
        (SELECT COUNT(*) FROM program_applications a WHERE a.program_id=p.id AND a.status='waitlisted') AS waitlisted_count,
        (SELECT COUNT(*) FROM program_applications a WHERE a.program_id=p.id AND a.status='accepted' AND a.acknowledged_at IS NULL) AS awaiting_count,
        (SELECT COUNT(*) FROM program_applications a WHERE a.program_id=p.id AND a.status='accepted' AND a.acknowledged_at IS NULL AND a.response_due_at<?) AS overdue_count
        FROM institution_programs p LEFT JOIN campus_events e ON e.id=p.source_event_id
        WHERE p.institution_id=? ORDER BY p.updated_at DESC LIMIT 100`).bind(Date.now(),actor.institutionId).all(),
      db.prepare(`SELECT id,title,payload,review_status FROM campus_events WHERE school='pcu' AND review_status!='hidden' ORDER BY last_seen_at DESC LIMIT 60`).all<{id:string;title:string;payload:string;review_status:string}>(),
    ]);
    return reply({ programs: programs.results, notices: notices.results.map(n => {
      let event: Partial<CampusEvent> = {}; try { event = JSON.parse(n.payload) as CampusEvent; } catch {}
      return { id:n.id, title:n.title, url:event.url, schedule:event.schedule, audience:event.audience, place:event.place, date:event.date, start:event.start, end:event.end, reviewStatus:n.review_status };
    }) });
  } catch { return reply({ message:'기관 자료를 불러오지 못했어요.' }, 503); }
}

export async function POST(request: Request) {
  if (!ownOrigin(request)) return reply({}, 403);
  const actor = await institutionActor(request); if (!actor) return reply({}, 401);if (!canOperate(actor)) return reply({},403);
  let input: Input; try { input = await smallJson(request) as Input; if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error(); } catch { return reply({}, 400); }
  const sourceEventId = input.sourceEventId === null || input.sourceEventId === '' ? null : input.sourceEventId;
  if (sourceEventId !== null && (typeof sourceEventId !== 'string' || !/^(Notify_1|Event_1):\d{1,20}$/.test(sourceEventId))) return reply({}, 400);
  try {
    const db = getDb(); let source: CampusEvent | null = null;
    if (sourceEventId) {
      const row = await db.prepare("SELECT payload FROM campus_events WHERE id=? AND school='pcu' AND review_status!='hidden'").bind(sourceEventId).first<{payload:string}>();
      if (!row) return reply({message:'공식 공지를 찾지 못했어요.'},404);
      source = JSON.parse(row.payload) as CampusEvent;
    }
    const title = trimmed(input.title ?? source?.title, 160), description = trimmed(input.description ?? source?.schedule ?? '', 1500),
      eligibility = trimmed(input.eligibility ?? source?.audience ?? '', 500), place = trimmed(input.place ?? source?.place ?? '', 160);
    const eventDate = date(input.eventDate ?? source?.date ?? null), start = minute(input.startMinute ?? source?.start ?? null), end = minute(input.endMinute ?? source?.end ?? null);
    const capacity = input.capacity === undefined ? 30 : input.capacity,responseHours=input.responseHours===undefined?48:input.responseHours;
    if (!title || !description || !eligibility || place === null || eventDate === undefined || Number.isNaN(start) || Number.isNaN(end) || (start !== null || end !== null) && (start === null || end === null || end <= start) || !Number.isInteger(capacity) || (capacity as number) < 1 || (capacity as number) > 10000 || !Number.isInteger(responseHours) || (responseHours as number)<1 || (responseHours as number)>168) return reply({message:'제목·내용·대상·일정·정원·응답 기한을 확인해 주세요.'},400);
    const now = Date.now(), id = randomUUID();
    await db.prepare(`INSERT INTO institution_programs (id,institution_id,school,source_event_id,title,description,eligibility,place,event_date,start_minute,end_minute,capacity,absence_confirmed,absence_evidence,status,response_hours,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0,'','draft',?,?,?)`).bind(id,actor.institutionId,'pcu',sourceEventId,title,description,eligibility,place,eventDate,start,end,capacity,responseHours,now,now).run();
    await db.prepare('INSERT INTO program_audit (id,program_id,actor,action,created_at) VALUES (?,?,?,?,?)').bind(randomUUID(),id,auditActor(actor),'program_created',now).run();
    return reply({ id }, 201);
  } catch { return reply({message:'저장하지 못했어요. 이미 가져온 공지인지 확인해 주세요.'},503); }
}

export async function PATCH(request: Request) {
  if (!ownOrigin(request)) return reply({}, 403);
  const actor = await institutionActor(request); if (!actor) return reply({}, 401);if (!canOperate(actor)) return reply({},403);
  let input: Input; try { input = await smallJson(request) as Input; if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error(); } catch { return reply({},400); }
  const id = input.id;
  if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id)) return reply({},400);
  const title = trimmed(input.title,160), description = trimmed(input.description,1500), eligibility = trimmed(input.eligibility,500), place = trimmed(input.place,160),
    eventDate = date(input.eventDate), start = minute(input.startMinute), end = minute(input.endMinute), evidence = trimmed(input.absenceEvidence,500);
  const capacity = input.capacity, status = input.status, absence = input.absenceConfirmed,responseHours=input.responseHours;
  if (!title || !description || !eligibility || place === null || eventDate === undefined || Number.isNaN(start) || Number.isNaN(end) || ((start !== null || end !== null) && (start === null || end === null || end <= start)) || !Number.isInteger(capacity) || (capacity as number) < 1 || (capacity as number) > 10000 || !Number.isInteger(responseHours) || (responseHours as number)<1 || (responseHours as number)>168 || !['draft','published','closed'].includes(String(status)) || typeof absence !== 'boolean' || evidence === null || (absence && (!evidence || evidence.length < 8))) return reply({message:'필수 내용과 공결 확인 근거를 확인해 주세요.'},400);
  try {
    const db = getDb();
    const result = await db.prepare(`UPDATE institution_programs SET title=?,description=?,eligibility=?,place=?,event_date=?,start_minute=?,end_minute=?,capacity=?,absence_confirmed=?,absence_evidence=?,status=?,response_hours=?,updated_at=? WHERE id=? AND institution_id=?
      AND ? >= (SELECT COUNT(*) FROM program_applications WHERE program_id=? AND status='accepted')`)
      .bind(title,description,eligibility,place,eventDate,start,end,capacity,absence?1:0,absence?evidence:'',status,responseHours,Date.now(),id,actor.institutionId,capacity,id).run();
    if (!result.meta.changes) return reply({message:'프로그램이 없거나 정원이 이미 수락한 인원보다 적습니다.'},409);
    await db.prepare('INSERT INTO program_audit (id,program_id,actor,action,created_at) VALUES (?,?,?,?,?)').bind(randomUUID(),id,auditActor(actor),'program_updated:'+status,Date.now()).run();
    return reply({ updated:true });
  } catch { return reply({message:'수정하지 못했어요.'},503); }
}
