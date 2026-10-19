import { getDb } from '@/db';
import { institutionActor } from '@/lib/institution-auth';
import { reply } from '@/lib/member-server';

export async function GET(request:Request) {
  const actor=await institutionActor(request);if (!actor) return reply({},401);
  const programId=new URL(request.url).searchParams.get('programId');
  if (!programId || !/^[a-f0-9-]{36}$/.test(programId)) return reply({},400);
  try {
    const owned=await getDb().prepare('SELECT id FROM institution_programs WHERE id=? AND institution_id=?').bind(programId,actor.institutionId).first();
    if (!owned) return reply({},404);
    const rows=await getDb().prepare(`SELECT a.application_id,a.action,a.created_at,
      CASE WHEN a.actor='student' THEN '학생' WHEN a.actor='institution' THEN '관리자' ELSE COALESCE(s.label,'담당자') END AS actor_label
      FROM program_audit a LEFT JOIN institution_staff s ON a.actor='staff:' || s.id
      WHERE a.program_id=? ORDER BY a.created_at DESC LIMIT 200`).bind(programId).all();
    return reply({events:rows.results});
  } catch {return reply({message:'변경 이력을 불러오지 못했어요.'},503);}
}
