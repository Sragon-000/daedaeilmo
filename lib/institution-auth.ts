import { env } from 'cloudflare:workers';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getDb } from '@/db';

const cookieName = 'institution_session';
const institutionId = 'pcu-pilot';
const lifetime = 8 * 60 * 60;
type Secrets = { INSTITUTION_ACCESS_KEY?: string; INSTITUTION_SESSION_SECRET?: string };
type StaffRow = { id:string; label:string; role:string; session_version:number; revoked_at:number|null };
export type InstitutionActor = { institutionId:string; staffId:string|null; label:string; role:'admin'|'operator'|'viewer'; sessionVersion:number };
const secrets = () => env as unknown as Secrets;

export function institutionConfigured() {
  const { INSTITUTION_ACCESS_KEY, INSTITUTION_SESSION_SECRET } = secrets();
  return !!INSTITUTION_ACCESS_KEY && INSTITUTION_ACCESS_KEY.length >= 32 && !!INSTITUTION_SESSION_SECRET && INSTITUTION_SESSION_SECRET.length >= 43;
}

export function staffKeyHash(value:string) {
  return createHmac('sha256', secrets().INSTITUTION_SESSION_SECRET!).update('staff-key:'+value).digest('hex');
}

function validMasterKey(value:unknown) {
  if (!institutionConfigured() || typeof value !== 'string' || value.length > 256) return false;
  const expected = createHmac('sha256', secrets().INSTITUTION_SESSION_SECRET!).update(secrets().INSTITUTION_ACCESS_KEY!).digest();
  const actual = createHmac('sha256', secrets().INSTITUTION_SESSION_SECRET!).update(value).digest();
  return timingSafeEqual(expected, actual);
}

export async function authenticateInstitutionKey(value:unknown):Promise<InstitutionActor|null> {
  if (!institutionConfigured() || typeof value !== 'string' || value.length > 256) return null;
  if (validMasterKey(value)) return {institutionId,staffId:null,label:'관리자',role:'admin',sessionVersion:1};
  if (!/^staff_[A-Za-z0-9_-]{40,}$/.test(value)) return null;
  const staff=await getDb().prepare('SELECT id,label,role,session_version,revoked_at FROM institution_staff WHERE institution_id=? AND key_hash=?').bind(institutionId,staffKeyHash(value)).first<StaffRow>();
  if (!staff || staff.revoked_at || !['admin','operator','viewer'].includes(staff.role)) return null;
  await getDb().prepare('UPDATE institution_staff SET last_login_at=? WHERE id=?').bind(Date.now(),staff.id).run();
  return {institutionId,staffId:staff.id,label:staff.label,role:staff.role as InstitutionActor['role'],sessionVersion:staff.session_version};
}

export function issueInstitutionCookie(request:Request, actor:InstitutionActor|null = null) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  if (!actor) return `${cookieName}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`;
  const payload = Buffer.from(JSON.stringify({ id:institutionId, staffId:actor.staffId, version:actor.sessionVersion, expiresAt:Math.floor(Date.now()/1000)+lifetime })).toString('base64url');
  const signature = createHmac('sha256', secrets().INSTITUTION_SESSION_SECRET!).update(payload).digest('base64url');
  return `${cookieName}=${payload}.${signature}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${lifetime}${secure}`;
}

export async function institutionActor(request:Request):Promise<InstitutionActor|null> {
  if (!institutionConfigured()) return null;
  try {
    const token=request.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1);
    if (!token || token.length>1024) return null;
    const [payload,signature,extra]=token.split('.');
    if (!payload || !signature || extra) return null;
    const expected=createHmac('sha256',secrets().INSTITUTION_SESSION_SECRET!).update(payload).digest();
    const actual=Buffer.from(signature,'base64url');
    if (expected.length!==actual.length || !timingSafeEqual(expected,actual)) return null;
    const claims=JSON.parse(Buffer.from(payload,'base64url').toString()) as {id?:string;staffId?:string|null;version?:number;expiresAt?:number};
    const now=Date.now()/1000;
    if (claims.id!==institutionId || !Number.isInteger(claims.expiresAt) || claims.expiresAt!<=now || claims.expiresAt!>now+lifetime || !Number.isInteger(claims.version)) return null;
    if (!claims.staffId) return {institutionId,staffId:null,label:'관리자',role:'admin',sessionVersion:1};
    if (!/^[a-f0-9-]{36}$/.test(claims.staffId)) return null;
    const staff=await getDb().prepare('SELECT id,label,role,session_version,revoked_at FROM institution_staff WHERE id=? AND institution_id=?').bind(claims.staffId,institutionId).first<StaffRow>();
    if (!staff || staff.revoked_at || staff.session_version!==claims.version || !['admin','operator','viewer'].includes(staff.role)) return null;
    return {institutionId,staffId:staff.id,label:staff.label,role:staff.role as InstitutionActor['role'],sessionVersion:staff.session_version};
  } catch { return null; }
}

export const canOperate=(actor:InstitutionActor|null)=>!!actor && actor.role!=='viewer';
export const isAdmin=(actor:InstitutionActor|null)=>actor?.role==='admin';
export const auditActor=(actor:InstitutionActor)=>actor.staffId?`staff:${actor.staffId}`:'institution';
