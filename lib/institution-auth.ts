import { env } from 'cloudflare:workers';
import { createHmac, timingSafeEqual } from 'node:crypto';

const cookieName = 'institution_session';
const institutionId = 'pcu-pilot';
const lifetime = 8 * 60 * 60;
type Secrets = { INSTITUTION_ACCESS_KEY?: string; INSTITUTION_SESSION_SECRET?: string };
const secrets = () => env as unknown as Secrets;

export function institutionConfigured() {
  const { INSTITUTION_ACCESS_KEY, INSTITUTION_SESSION_SECRET } = secrets();
  return !!INSTITUTION_ACCESS_KEY && INSTITUTION_ACCESS_KEY.length >= 32 && !!INSTITUTION_SESSION_SECRET && INSTITUTION_SESSION_SECRET.length >= 43;
}

export function validInstitutionKey(value: unknown) {
  if (!institutionConfigured() || typeof value !== 'string' || value.length > 256) return false;
  const expected = createHmac('sha256', secrets().INSTITUTION_SESSION_SECRET!).update(secrets().INSTITUTION_ACCESS_KEY!).digest();
  const actual = createHmac('sha256', secrets().INSTITUTION_SESSION_SECRET!).update(value).digest();
  return timingSafeEqual(expected, actual);
}

export function issueInstitutionCookie(request: Request, clear = false) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  if (clear) return `${cookieName}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`;
  const payload = Buffer.from(JSON.stringify({ id: institutionId, expiresAt: Math.floor(Date.now() / 1000) + lifetime })).toString('base64url');
  const signature = createHmac('sha256', secrets().INSTITUTION_SESSION_SECRET!).update(payload).digest('base64url');
  return `${cookieName}=${payload}.${signature}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${lifetime}${secure}`;
}

export function institutionSession(request: Request): string | null {
  if (!institutionConfigured()) return null;
  try {
    const token = request.headers.get('cookie')?.split(';').map(x => x.trim()).find(x => x.startsWith(cookieName + '='))?.slice(cookieName.length + 1);
    if (!token || token.length > 1024) return null;
    const [payload, signature, extra] = token.split('.');
    if (!payload || !signature || extra) return null;
    const expected = createHmac('sha256', secrets().INSTITUTION_SESSION_SECRET!).update(payload).digest();
    const actual = Buffer.from(signature, 'base64url');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { id?: string; expiresAt?: number };
    if (claims.id !== institutionId || !Number.isInteger(claims.expiresAt) || claims.expiresAt! <= Date.now() / 1000 || claims.expiresAt! > Date.now() / 1000 + lifetime) return null;
    return institutionId;
  } catch { return null; }
}
