import { env } from 'cloudflare:workers';
import { randomUUID } from 'node:crypto';
import { getDb } from '@/db';
import { readSchoolSession, type SchoolSession } from './school-session';
import { avatars, type Member, type Avatar } from './member-types';
export function authenticatedSchool(request: Request): SchoolSession | null {
  const secret = (env as unknown as { SCHOOL_SESSION_SECRET?: string }).SCHOOL_SESSION_SECRET;
  const token = request.headers.get('cookie')?.split(';').map(x => x.trim()).find(x => x.startsWith('school_session='))?.slice(15);
  return secret && token ? readSchoolSession(token, secret) : null;
}
export function ownOrigin(request: Request) { return request.headers.get('origin') === new URL(request.url).origin; }
export function reply(data: unknown, status = 200) { return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } }); }
export async function smallJson(request: Request): Promise<unknown> {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new Error('INVALID_INPUT');
  const reader = request.body?.getReader(); if (!reader) throw new Error('INVALID_INPUT');
  let size = 0, result = ''; const decoder = new TextDecoder();
  while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length;
    if (size > 4096) { await reader.cancel(); throw new Error('INVALID_INPUT'); } result += decoder.decode(value, { stream: true }); }
  return JSON.parse(result + decoder.decode());
}
export async function ensureMember(session: SchoolSession): Promise<Member> {
  const db = getDb();
  const lookup = () => db.prepare('SELECT id, school, name, nickname, avatar, photo_key AS photoKey FROM members WHERE school = ? AND subject = ?').bind(session.school, session.subject).first<Omit<Member, 'needsSetup'> & { photoKey: string | null }>();
  let member = await lookup();
  if (!member) {
    const id = randomUUID(), now = Date.now();
    const options = Object.keys(avatars) as Avatar[];
    const avatar = options[parseInt(id.slice(0, 2), 16) % options.length];
    await db.prepare('INSERT INTO members (id, school, subject, name, nickname, avatar, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(school, subject) DO NOTHING')
      .bind(id, session.school, session.subject, '', `새싹${id.replaceAll('-', '').slice(0, 12)}`, avatar, now, now).run();
    member = await lookup();
  }
  if (!member) throw new Error('MEMBER_UNAVAILABLE');
  const { photoKey, ...profile } = member;
  return { ...profile, photoUrl: photoKey ? '/api/avatar?id=' + member.id + '&v=' + photoKey.split('/').pop() : null, needsSetup: !member.name };
}
