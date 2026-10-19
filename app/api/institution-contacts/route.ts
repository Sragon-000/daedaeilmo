import { randomUUID } from 'node:crypto';
import { getDb } from '@/db';
import { auditActor, canOperate, institutionActor } from '@/lib/institution-auth';
import { ownOrigin, reply, smallJson } from '@/lib/member-server';

const validId=(value:unknown):value is string=>typeof value==='string' && /^[a-f0-9-]{36}$/.test(value);

async function ownedProgram(applicationId:string,institutionId:string) {
  return getDb().prepare('SELECT a.program_id FROM program_applications a JOIN institution_programs p ON p.id=a.program_id WHERE a.id=? AND p.institution_id=?').bind(applicationId,institutionId).first<{program_id:string}>();
}

export async function GET(request:Request) {
  const actor=await institutionActor(request);if (!actor) return reply({},401);
  const applicationId=new URL(request.url).searchParams.get('applicationId');if (!validId(applicationId)) return reply({},400);
  try {
    if (!await ownedProgram(applicationId,actor.institutionId)) return reply({},404);
    const rows=await getDb().prepare(`SELECT c.id,c.channel,c.note,c.created_at,COALESCE(s.label,'관리자') AS staff_label
      FROM application_contacts c LEFT JOIN institution_staff s ON s.id=c.staff_id
      WHERE c.application_id=? ORDER BY c.created_at DESC LIMIT 100`).bind(applicationId).all();
    return reply({contacts:rows.results});
  } catch {return reply({message:'연락 기록을 불러오지 못했어요.'},503);}
}

export async function POST(request:Request) {
  if (!ownOrigin(request)) return reply({},403);
  const actor=await institutionActor(request);if (!actor) return reply({},401);if (!canOperate(actor)) return reply({},403);
  let input:{applicationId?:unknown;channel?:unknown;note?:unknown};try{input=await smallJson(request) as typeof input;}catch{return reply({},400);}
  if (!validId(input?.applicationId) || !['phone','email','messenger','in_person','other'].includes(String(input.channel))) return reply({},400);
  const note=typeof input.note==='string'?input.note.trim():'';
  if (!note || note.length>500) return reply({message:'연락 결과를 500자 이내로 적어 주세요.'},400);
  try {
    const owner=await ownedProgram(input.applicationId,actor.institutionId);if (!owner) return reply({},404);
    const id=randomUUID(),now=Date.now();
    await getDb().prepare('INSERT INTO application_contacts (id,application_id,staff_id,channel,note,created_at) VALUES (?,?,?,?,?,?)').bind(id,input.applicationId,actor.staffId,input.channel,note,now).run();
    await getDb().prepare('INSERT INTO program_audit (id,program_id,application_id,actor,action,created_at) VALUES (?,?,?,?,?,?)').bind(randomUUID(),owner.program_id,input.applicationId,auditActor(actor),'contact:'+input.channel,now).run();
    return reply({id},201);
  } catch {return reply({message:'연락 기록을 저장하지 못했어요.'},503);}
}
