import { env } from 'cloudflare:workers';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getDb } from '@/db';
import type { AvailableWindow } from './experiment-fit';
import { validAvailableWindow } from './experiment-fit';

export type ExperimentInvite = {
  id: string; participant_code: string; session_version: number; expires_at: number;
  revoked_at: number | null; consented_at: number | null;
  available_day: number | null; available_start: number | null; available_end: number | null;
};
const cookieName = 'experiment_session';
const maxAgeSeconds = 15 * 86400;

function secret(): string | null {
  const value = (env as unknown as { EXPERIMENT_SESSION_SECRET?: string }).EXPERIMENT_SESSION_SECRET;
  return value && value.length >= 43 ? value : null;
}
export function experimentConfigured(): boolean { return !!secret(); }
export function signedSession(invite: ExperimentInvite, key: string, now = Date.now()): string {
  const exp = Math.min(invite.expires_at, now + maxAgeSeconds * 1000);
  const payload = Buffer.from(JSON.stringify({ id: invite.id, version: invite.session_version, exp })).toString('base64url');
  const signature = createHmac('sha256', key).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}
function sessionClaims(token: string, key: string, now = Date.now()): { id: string; version: number } | null {
  try {
    if (token.length > 2048) return null;
    const [payload, signature, extra] = token.split('.');
    if (!payload || !signature || extra !== undefined) return null;
    const expected = createHmac('sha256', key).update(payload).digest();
    const actual = Buffer.from(signature, 'base64url');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { id: unknown; version: unknown; exp: unknown };
    if (typeof claims.id !== 'string' || !/^[0-9a-f-]{36}$/.test(claims.id)
        || !Number.isInteger(claims.version) || !Number.isInteger(claims.exp)
        || (claims.exp as number) <= now || (claims.exp as number) > now + maxAgeSeconds * 1000) return null;
    return { id: claims.id, version: claims.version as number };
  } catch { return null; }
}
export function sessionCookie(request: Request, value: string, ageSeconds: number): string {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${cookieName}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.max(0, ageSeconds)}${secure}`;
}
export function issueExperimentCookie(request: Request, invite: ExperimentInvite): string | null {
  const key = secret(); if (!key) return null;
  const age = Math.max(0, Math.min(maxAgeSeconds, Math.ceil((invite.expires_at - Date.now()) / 1000)));
  return sessionCookie(request, signedSession(invite, key), age);
}
export async function currentExperimentInvite(request: Request): Promise<ExperimentInvite | null> {
  const key = secret(); if (!key) return null;
  const token = request.headers.get('cookie')?.split(';').map(value => value.trim())
    .find(value => value.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
  const claims = token ? sessionClaims(token, key) : null;
  if (!claims) return null;
  const invite = await getDb().prepare(`SELECT id,participant_code,session_version,expires_at,revoked_at,consented_at,
    available_day,available_start,available_end FROM experiment_invites WHERE id=?`)
    .bind(claims.id).first<ExperimentInvite>();
  return invite && invite.session_version === claims.version && !invite.revoked_at && invite.expires_at > Date.now()
    ? invite : null;
}
export function inviteWindow(invite: ExperimentInvite): AvailableWindow | null {
  const value = { day: invite.available_day, start: invite.available_start, end: invite.available_end };
  return validAvailableWindow(value) ? value : null;
}
export function experimentReply(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', ...headers } });
}
