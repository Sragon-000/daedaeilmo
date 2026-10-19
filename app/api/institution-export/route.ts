import { getDb } from '@/db';
import { canOperate, institutionActor } from '@/lib/institution-auth';
import { reply } from '@/lib/member-server';

function csvCell(value:unknown) {
  let text=typeof value==='string'?value:typeof value==='number'||typeof value==='boolean'?String(value):'';
  if (/^\s*[=+@-]/.test(text)) text="'"+text;
  return '"'+text.replaceAll('"','""')+'"';
}
const dateCell=(value:unknown)=>typeof value==='number'?new Date(value).toISOString():'';

export async function GET(request:Request) {
  const actor=await institutionActor(request);if (!actor) return reply({},401);if (!canOperate(actor)) return reply({},403);
  const programId=new URL(request.url).searchParams.get('programId');
  if (!programId || !/^[a-f0-9-]{36}$/.test(programId)) return reply({},400);
  try {
    const db=getDb(),owned=await db.prepare('SELECT id FROM institution_programs WHERE id=? AND institution_id=?').bind(programId,actor.institutionId).first();
    if (!owned) return reply({},404);
    const rows=await db.prepare(`SELECT a.status,a.created_at,a.updated_at,a.acknowledged_at,a.response_due_at,m.name,m.nickname,
      (SELECT COUNT(*) FROM application_contacts c WHERE c.application_id=a.id) AS contact_count
      FROM program_applications a JOIN members m ON m.id=a.member_id WHERE a.program_id=? ORDER BY a.created_at ASC LIMIT 5001`).bind(programId).all<Record<string,unknown>>();
    if (rows.results.length>5000) return reply({message:'한 번에 내보낼 수 있는 신청 건수는 5000건입니다.'},413);
    const lines=[['직접입력 이름','닉네임','상태','신청 시각','변경 시각','학생 확인 시각','확인 기한','연락 기록 수'],...rows.results.map(r=>[r.name,r.nickname,r.status,dateCell(r.created_at),dateCell(r.updated_at),dateCell(r.acknowledged_at),dateCell(r.response_due_at),r.contact_count])];
    const csv='\uFEFF'+lines.map(line=>line.map(csvCell).join(',')).join('\r\n')+'\r\n';
    return new Response(csv,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="applications-${programId}.csv"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  } catch {return reply({message:'신청 명단을 내보내지 못했어요.'},503);}
}
