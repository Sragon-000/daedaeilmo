import { createHash } from 'node:crypto';
import { getDb } from '@/db';
import { ownOrigin, smallJson } from '@/lib/member-server';
import { experimentConfigured, experimentReply, issueExperimentCookie, type ExperimentInvite } from '@/lib/experiment-session';

const attempts = new Map<string, { count: number; until: number }>();
export async function POST(request: Request) {
  if (!ownOrigin(request)) return experimentReply({}, 403);
  if (!experimentConfigured()) return experimentReply({ message: '실험 서버 설정이 필요해요.' }, 503);
  const key = request.headers.get('cf-connecting-ip') || 'local';
  const now = Date.now();
  if (attempts.size > 1000) for (const [id, value] of attempts) if (value.until < now) attempts.delete(id);
  const bucket = attempts.get(key) || { count: 0, until: now + 300000 };
  if (bucket.until < now) { bucket.count = 0; bucket.until = now + 300000; }
  bucket.count++; attempts.set(key, bucket);
  if (bucket.count > 10) return experimentReply({ message: '잠시 후 다시 시도해 주세요.' }, 429, { 'Retry-After': '300' });
  let input: unknown;
  try { input = await smallJson(request); } catch { return experimentReply({}, 400); }
  const token = (input as { token?: unknown })?.token;
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) return experimentReply({ message: '초대 링크를 확인해 주세요.' }, 410);
  try {
    const hash = createHash('sha256').update(token).digest('hex');
    const invite = await getDb().prepare(`SELECT id,participant_code,session_version,expires_at,revoked_at,consented_at,
      available_day,available_start,available_end FROM experiment_invites WHERE token_hash=?`)
      .bind(hash).first<ExperimentInvite>();
    if (!invite || invite.revoked_at || invite.expires_at <= now) return experimentReply({ message: '초대 링크가 만료되었어요.' }, 410);
    const cookie = issueExperimentCookie(request, invite);
    if (!cookie) return experimentReply({}, 503);
    return new Response(null, { status: 204, headers: { 'Set-Cookie': cookie, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
  } catch { return experimentReply({ message: '초대 링크를 확인하지 못했어요.' }, 503); }
}
