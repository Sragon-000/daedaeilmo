import { randomUUID } from 'node:crypto';
import { getDb } from '@/db';
import { authenticatedSchool, ensureMember, ownOrigin, reply, smallJson } from '@/lib/member-server';

async function inputId(request: Request) {
  const input = await smallJson(request) as { programId?: unknown; action?: unknown };
  if (!input || typeof input.programId !== 'string' || !/^[a-f0-9-]{36}$/.test(input.programId)) throw new Error();
  return input;
}

export async function POST(request: Request) {
  if (!ownOrigin(request)) return reply({},403);
  const session = authenticatedSchool(request); if (!session || session.school !== 'pcu') return reply({},401);
  let input: Awaited<ReturnType<typeof inputId>>; try { input=await inputId(request); } catch { return reply({},400); }
  if ((input as typeof input & { shareProfile?: unknown }).shareProfile !== true) return reply({message:'기관에 프로필 이름·닉네임을 제공하는 내용을 확인해 주세요.'},400);
  try {
    const member=await ensureMember(session);
    if (member.needsSetup) return reply({message:'신청 전에 프로필 이름을 입력해 주세요. 현재 이름은 학교 확인 정보가 아닙니다.'},409);
    const db=getDb(), now=Date.now(), programId=input.programId;
    const program=await db.prepare(`SELECT id,event_date,end_minute,capacity,
      (SELECT COUNT(*) FROM program_applications WHERE program_id=? AND status='accepted') AS accepted_count
      FROM institution_programs WHERE id=? AND school='pcu' AND status='published'`).bind(programId,programId).first<{id:string;event_date:string|null;end_minute:number|null;capacity:number;accepted_count:number}>();
    if (!program) return reply({message:'현재 신청할 수 없는 프로그램입니다.'},404);
    const kst=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date());
    const part=(name:string)=>kst.find(x=>x.type===name)?.value||'';
    const today=`${part('year')}-${part('month')}-${part('day')}`,minute=Number(part('hour'))*60+Number(part('minute'));
    if (program.event_date && (program.event_date<today || program.event_date===today && program.end_minute!==null && minute>=program.end_minute)) return reply({message:'종료된 프로그램입니다.'},409);
    if (program.accepted_count>=program.capacity) return reply({message:'정원이 찼습니다.'},409);
    await db.prepare(`INSERT INTO program_applications (id,program_id,member_id,status,created_at,updated_at) VALUES (?,?,?,'applied',?,?)
      ON CONFLICT(member_id,program_id) DO UPDATE SET status='applied',updated_at=excluded.updated_at,acknowledged_at=NULL WHERE program_applications.status='cancelled_by_student'`)
      .bind(randomUUID(),programId,member.id,now,now).run();
    const row=await db.prepare('SELECT id,status FROM program_applications WHERE program_id=? AND member_id=?').bind(programId,member.id).first<{id:string;status:string}>();
    if (row?.status==='applied') await db.prepare('INSERT INTO program_audit (id,program_id,application_id,actor,action,created_at) VALUES (?,?,?,?,?,?)').bind(randomUUID(),programId,row.id,'student','applied',now).run();
    return reply({status:row?.status});
  } catch { return reply({message:'신청을 저장하지 못했어요.'},503); }
}

export async function PATCH(request: Request) {
  if (!ownOrigin(request)) return reply({},403);
  const session=authenticatedSchool(request); if (!session || session.school!=='pcu') return reply({},401);
  let input: Awaited<ReturnType<typeof inputId>>; try { input=await inputId(request); } catch { return reply({},400); }
  if (input.action!=='cancel' && input.action!=='acknowledge') return reply({},400);
  try {
    const member=await ensureMember(session),db=getDb(),now=Date.now();
    const row=await db.prepare('SELECT id,status FROM program_applications WHERE program_id=? AND member_id=?').bind(input.programId,member.id).first<{id:string;status:string}>();
    if (!row) return reply({},404);
    const allowed=input.action==='cancel' ? ['applied','accepted'].includes(row.status) : row.status==='accepted';
    if (!allowed) return reply({message:'현재 상태에서는 변경할 수 없어요.'},409);
    const result=input.action==='cancel'
      ? await db.prepare("UPDATE program_applications SET status='cancelled_by_student',updated_at=?,acknowledged_at=NULL WHERE id=? AND status IN ('applied','accepted')").bind(now,row.id).run()
      : await db.prepare("UPDATE program_applications SET acknowledged_at=?,updated_at=? WHERE id=? AND status='accepted' AND acknowledged_at IS NULL").bind(now,now,row.id).run();
    if (!result.meta.changes) return reply({message:'상태가 이미 변경됐어요. 새로고침해 주세요.'},409);
    await db.prepare('INSERT INTO program_audit (id,program_id,application_id,actor,action,created_at) VALUES (?,?,?,?,?,?)').bind(randomUUID(),input.programId,row.id,'student',input.action,now).run();
    return reply({status:input.action==='cancel'?'cancelled_by_student':'accepted',acknowledged:input.action==='acknowledge'});
  } catch { return reply({message:'상태를 저장하지 못했어요.'},503); }
}
