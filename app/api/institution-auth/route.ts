import { institutionConfigured, institutionSession, issueInstitutionCookie, validInstitutionKey } from '@/lib/institution-auth';
import { ownOrigin, reply, smallJson } from '@/lib/member-server';

export function GET(request: Request) { return reply({ authenticated: !!institutionSession(request), available: institutionConfigured() }); }
export async function POST(request: Request) {
  if (!ownOrigin(request)) return reply({}, 403);
  let body: unknown; try { body = await smallJson(request); } catch { return reply({}, 400); }
  if (!validInstitutionKey((body as { accessKey?: unknown })?.accessKey)) return reply({ message: '기관 접속 코드를 확인해 주세요.' }, 401);
  const response = reply({ authenticated: true }); response.headers.set('Set-Cookie', issueInstitutionCookie(request)); return response;
}
export function DELETE(request: Request) {
  if (!ownOrigin(request)) return reply({}, 403);
  const response = reply({ authenticated: false }); response.headers.set('Set-Cookie', issueInstitutionCookie(request, true)); return response;
}
