import { randomUUID } from 'node:crypto';
import { getDb } from '@/db';
import { institutionSession } from '@/lib/institution-auth';
import { ownOrigin, reply, smallJson } from '@/lib/member-server';

export async function GET(request: Request) {
  const owner=institutionSession(request); if (!owner) return reply({},401);
  const programId=new URL(request.url).searchParams.get('programId');
  if (!programId || !/^[a-f0-9-]{36}$/.test(programId)) return reply({},400);
  try {
    const rows=await getDb().prepare(`SELECT a.id,a.status,a.created_at,a.updated_at,a.acknowledged_at,m.name,m.nickname
      FROM program_applications a JOIN institution_programs p ON p.id=a.program_id JOIN members m ON m.id=a.member_id
      WHERE p.id=? AND p.institution_id=? ORDER BY a.created_at DESC LIMIT 500`).bind(programId,owner).all();
    return reply({ applications:rows.results, identityNotice:'이름은 학생이 프로필에 직접 입력한 값입니다. 학교 인증은 계정 로그인 성공만 확인했습니다.' });
  } catch { return reply({message:'신청 현황을 불러오지 못했어요.'},503); }
}

export async function PATCH(request: Request) {
  if (!ownOrigin(request)) return reply({},403);
  const owner=institutionSession(request); if (!owner) return reply({},401);
  let input: { id?:unknown; action?:unknown }; try { input=await smallJson(request) as typeof input; } catch { return reply({},400); }
  if (typeof input?.id!=='string' || !/^[a-f0-9-]{36}$/.test(input.id) || !['accept','decline','cancel'].includes(String(input.action))) return reply({},400);
  try {
    const db=getDb(),row=await db.prepare(`SELECT a.id,a.program_id,a.status,p.capacity FROM program_applications a JOIN institution_programs p ON p.id=a.program_id WHERE a.id=? AND p.institution_id=?`).bind(input.id,owner).first<{id:string;program_id:string;status:string;capacity:number}>();
    if (!row) return reply({},404);
    if ((input.action==='accept' || input.action==='decline') && row.status!=='applied' || input.action==='cancel' && row.status!=='accepted') return reply({message:'현재 상태에서는 처리할 수 없어요.'},409);
    const next=input.action==='accept'?'accepted':input.action==='decline'?'declined':'cancelled_by_institution',now=Date.now();
    const result=input.action==='accept'
      ? await db.prepare(`UPDATE program_applications SET status='accepted',updated_at=? WHERE id=? AND status='applied'
          AND (SELECT COUNT(*) FROM program_applications WHERE program_id=? AND status='accepted')
          < (SELECT capacity FROM institution_programs WHERE id=?)`).bind(now,row.id,row.program_id,row.program_id).run()
      : await db.prepare('UPDATE program_applications SET status=?,updated_at=?,acknowledged_at=NULL WHERE id=? AND status=?').bind(next,now,row.id,row.status).run();
    if (!result.meta.changes) return reply({message:'정원이 찼거나 신청 상태가 변경됐어요.'},409);
    await db.prepare('INSERT INTO program_audit (id,program_id,application_id,actor,action,created_at) VALUES (?,?,?,?,?,?)').bind(randomUUID(),row.program_id,row.id,'institution',next,now).run();
    return reply({status:next});
  } catch { return reply({message:'처리 결과를 저장하지 못했어요.'},503); }
}
