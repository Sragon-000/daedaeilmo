import { env } from 'cloudflare:workers';
import { randomUUID } from 'node:crypto';
import { getDb } from '@/db';
import { authenticatedSchool, ensureMember, ownOrigin, reply } from '@/lib/member-server';
function bucket() { const value = (env as unknown as { PHOTOS: R2Bucket }).PHOTOS; if (!value) throw new Error('STORAGE_UNAVAILABLE'); return value; }
export async function GET(request: Request) {
 const session = authenticatedSchool(request); if (!session) return reply({},401);
 const id = new URL(request.url).searchParams.get('id'); if (!id || id.length > 64) return reply({},400);
 try {
  const row = await getDb().prepare('SELECT photo_key FROM members WHERE id = ? AND school = ?').bind(id,session.school).first<{photo_key:string|null}>();
  if (!row?.photo_key) return reply({},404);
  const file = await bucket().get(row.photo_key); if (!file) return reply({},404);
  return new Response(file.body,{headers:{'Content-Type':file.httpMetadata?.contentType || 'image/jpeg','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'"}});
 } catch { return reply({},503); }
}
export async function POST(request: Request) {
 if (!ownOrigin(request)) return reply({},403);
 const session = authenticatedSchool(request); if (!session) return reply({},401);
 const type=request.headers.get('content-type');
 if (!['image/jpeg','image/png'].includes(type || '')) return reply({message:'JPG 또는 PNG 사진을 선택해 주세요.'},400);
 const reader=request.body?.getReader(); if (!reader) return reply({},400);
 const chunks:Uint8Array[]=[]; let size=0;
 while(true) { const {done,value}=await reader.read(); if(done) break; size+=value.length; if(size>256*1024) {await reader.cancel();return reply({message:'사진 용량이 너무 커요.'},413);} chunks.push(value); }
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 const valid=type==='image/jpeg' ? bytes[0]===255 && bytes[1]===216 && bytes[2]===255 : [137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v);
 if(!valid) return reply({message:'올바른 이미지 파일이 아니에요.'},400);
 try {
  const member=await ensureMember(session), db=getDb(), store=bucket();
  const old=await db.prepare('SELECT photo_key FROM members WHERE id = ?').bind(member.id).first<{photo_key:string|null}>();
  const key='avatars/'+member.id+'/'+randomUUID();
  await store.put(key,bytes,{httpMetadata:{contentType:type!}});
  try { await db.prepare('UPDATE members SET photo_key = ?, updated_at = ? WHERE id = ?').bind(key,Date.now(),member.id).run(); }
  catch(error) {await store.delete(key);throw error;}
  if(old?.photo_key) await store.delete(old.photo_key).catch(()=>{});
  return reply({member:await ensureMember(session)});
 } catch {return reply({message:'사진을 저장하지 못했어요. 다시 시도해 주세요.'},503);}
}
export async function DELETE(request: Request) {
 if (!ownOrigin(request)) return reply({},403);
 const session=authenticatedSchool(request);if(!session)return reply({},401);
 try {
  const member=await ensureMember(session),db=getDb();
  const old=await db.prepare('SELECT photo_key FROM members WHERE id = ?').bind(member.id).first<{photo_key:string|null}>();
  await db.prepare('UPDATE members SET photo_key = NULL, updated_at = ? WHERE id = ?').bind(Date.now(),member.id).run();
  if(old?.photo_key) await bucket().delete(old.photo_key).catch(()=>{});
  return reply({member:await ensureMember(session)});
 } catch {return reply({message:'사진을 삭제하지 못했어요.'},503);}
}
