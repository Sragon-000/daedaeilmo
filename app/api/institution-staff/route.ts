import { randomBytes, randomUUID } from 'node:crypto';
import { getDb } from '@/db';
import { institutionActor, isAdmin, staffKeyHash } from '@/lib/institution-auth';
import { ownOrigin, reply, smallJson } from '@/lib/member-server';

export async function GET(request:Request) {
  const actor=await institutionActor(request);if (!actor) return reply({},401);if (!isAdmin(actor)) return reply({},403);
  try {
    const rows=await getDb().prepare('SELECT id,label,role,created_at,last_login_at,revoked_at FROM institution_staff WHERE institution_id=? ORDER BY created_at DESC LIMIT 100').bind(actor.institutionId).all();
    return reply({staff:rows.results});
  } catch {return reply({message:'담당자 목록을 불러오지 못했어요.'},503);}
}

export async function POST(request:Request) {
  if (!ownOrigin(request)) return reply({},403);
  const actor=await institutionActor(request);if (!actor) return reply({},401);if (!isAdmin(actor)) return reply({},403);
  let input:{label?:unknown;role?:unknown};try{input=await smallJson(request) as typeof input;}catch{return reply({},400);}
  const label=typeof input?.label==='string'?input.label.trim():'';
  if (!label || label.length>60 || !['admin','operator','viewer'].includes(String(input.role))) return reply({message:'담당자 이름과 권한을 확인해 주세요.'},400);
  try {
    const id=randomUUID(),accessKey='staff_'+randomBytes(32).toString('base64url'),now=Date.now();
    await getDb().prepare('INSERT INTO institution_staff (id,institution_id,label,role,key_hash,session_version,created_at) VALUES (?,?,?,?,?,1,?)').bind(id,actor.institutionId,label,input.role,staffKeyHash(accessKey),now).run();
    return reply({id,accessKey},201);
  } catch {return reply({message:'담당자 코드를 만들지 못했어요.'},503);}
}

export async function DELETE(request:Request) {
  if (!ownOrigin(request)) return reply({},403);
  const actor=await institutionActor(request);if (!actor) return reply({},401);if (!isAdmin(actor)) return reply({},403);
  let input:{id?:unknown};try{input=await smallJson(request) as typeof input;}catch{return reply({},400);}
  if (typeof input?.id!=='string' || !/^[a-f0-9-]{36}$/.test(input.id) || input.id===actor.staffId) return reply({},400);
  try {
    const result=await getDb().prepare('UPDATE institution_staff SET revoked_at=?,session_version=session_version+1 WHERE id=? AND institution_id=? AND revoked_at IS NULL').bind(Date.now(),input.id,actor.institutionId).run();
    return result.meta.changes?reply({revoked:true}):reply({},404);
  } catch {return reply({message:'담당자 접근을 회수하지 못했어요.'},503);}
}
