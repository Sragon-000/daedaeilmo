import { getDb } from '@/db';
import { authenticatedSchool } from '@/lib/member-server';
import { env } from 'cloudflare:workers';
import { createHmac } from 'node:crypto';
import { SchoolAuthError, verifyPcuAccount } from '@/lib/pcu-auth';
import { issueSchoolSession, readSchoolSession } from '@/lib/school-session';

const cookieName = 'school_session';
const noStore = { 'Cache-Control': 'no-store', Pragma: 'no-cache' };
const attempts = new Map<
  string,
  { count: number; reset: number; active: boolean }
>();
function secret() {
  const value = (env as unknown as { SCHOOL_SESSION_SECRET?: string })
    .SCHOOL_SESSION_SECRET;
  return value && value.length >= 43 ? value : null;
}
function json(
  data: unknown,
  status = 200,
  headers: Record<string, string> = {},
) {
  return Response.json(data, { status, headers: { ...noStore, ...headers } });
}
function sameOrigin(request: Request) {
  return request.headers.get('origin') === new URL(request.url).origin;
}
function cookie(request: Request, token: string, age: number) {
  return `${cookieName}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`;
}
export async function GET(request: Request) {
  const key = secret();
  const token = request.headers
    .get('cookie')
    ?.split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1);
  const session = key && token ? readSchoolSession(token, key) : null;
  return json({
    authenticated: !!session,
    school: session?.school ?? null,
    expiresAt: session?.expiresAt ?? null,
    available: !!key,
  });
}
export async function DELETE(request: Request) {
  if (!sameOrigin(request))
    return json(
      { authenticated: false, message: '요청 출처를 확인할 수 없습니다.' },
      403,
    );
  const session = authenticatedSchool(request);
  if (session) { try { await getDb().prepare('UPDATE school_login_events SET logged_out_at = ? WHERE id = ?').bind(Date.now(), session.nonce).run(); } catch {} }
  return json({ authenticated: false }, 200, {
    'Set-Cookie': cookie(request, '', 0),
  });
}
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return json(
      { authenticated: false, message: '요청 출처를 확인할 수 없습니다.' },
      403,
    );
  const key = secret();
  if (!key)
    return json(
      { authenticated: false, message: '인증 서버 설정을 준비하고 있습니다.' },
      503,
    );
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    return json({ authenticated: false }, 415);
  let input: { school?: unknown; username?: unknown; password?: unknown };
  try {
    const reader = request.body?.getReader();
    if (!reader) throw new Error();
    let text = '',
      size = 0;
    const decoder = new TextDecoder();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 4096) {
        await reader.cancel();
        throw new Error();
      }
      text += decoder.decode(value, { stream: true });
    }
    input = JSON.parse(text + decoder.decode());
    if (!input || typeof input !== 'object') throw new Error();
  } catch {
    return json(
      { authenticated: false, message: '입력 내용을 확인해 주세요.' },
      400,
    );
  }
  if (input.school !== 'pcu')
    return json(
      { authenticated: false, message: '현재 배재대학교만 연결하고 있습니다.' },
      400,
    );
  if (
    typeof input.username !== 'string' ||
    typeof input.password !== 'string' ||
    !/^[A-Za-z0-9_-]{1,40}$/.test(input.username.trim()) ||
    input.password.length < 1 ||
    Buffer.byteLength(input.password) > 100
  ) {
    return json(
      {
        authenticated: false,
        message: '학번/아이디와 비밀번호를 확인해 주세요.',
      },
      400,
    );
  }
  const username = input.username.trim();
  // Private prototype only: a public release needs a durable shared rate limiter.
  const bucket = createHmac('sha256', key)
    .update(username.toLowerCase())
    .digest('hex');
  const now = Date.now();
  for (const [id, entry] of attempts)
    if (entry.reset < now && !entry.active) attempts.delete(id);
  const entry = attempts.get(bucket) ?? {
    count: 0,
    reset: now + 300000,
    active: false,
  };
  if (entry.active || entry.count >= 5 || attempts.size >= 1000)
    return json(
      { authenticated: false, message: '잠시 후 다시 시도해 주세요.' },
      429,
      { 'Retry-After': '300' },
    );
  entry.count++;
  entry.active = true;
  attempts.set(bucket, entry);
  try {
    await verifyPcuAccount(username, input.password);
    input.password = '';
    const token = issueSchoolSession(username, key);
    const session = readSchoolSession(token, key)!;
    try {
      await getDb().prepare('INSERT INTO school_login_events (id,school,subject,logged_at,expires_at) VALUES (?,?,?,?,?)').bind(session.nonce,session.school,session.subject,Date.now(),session.expiresAt*1000).run();
      await getDb().prepare('DELETE FROM school_login_events WHERE logged_at < ?').bind(Date.now()-30*86400000).run();
    } catch { console.warn('Login history storage unavailable'); }
    return json({ authenticated: true, school: 'pcu' }, 200, {
      'Set-Cookie': cookie(
        request,
        token,
        1800,
      ),
    });
  } catch (error) {
    const code =
      error instanceof SchoolAuthError ? error.code : 'SCHOOL_UNAVAILABLE';
    return json(
      {
        authenticated: false,
        code,
        message:
          code === 'LOGIN_NOT_CONFIRMED'
            ? '학교 로그인을 확인하지 못했어요. 입력 정보나 학교의 추가 인증 안내를 확인해 주세요.'
            : '학교 인증 서버와 연결하지 못했어요. 잠시 후 다시 시도해 주세요.',
      },
      code === 'LOGIN_NOT_CONFIRMED' ? 401 : 502,
      { 'Set-Cookie': cookie(request, '', 0) },
    );
  } finally {
    input.password = '';
    entry.active = false;
  }
}
