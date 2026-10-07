import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';
const lifetime = 30 * 60;
export type SchoolSession = {
  school: 'pcu';
  subject: string;
  expiresAt: number;
  nonce: string;
};
export function issueSchoolSession(
  username: string,
  secret: string,
  now = Date.now(),
) {
  const claims: SchoolSession = {
    school: 'pcu',
    subject: createHmac('sha256', secret)
      .update(`school:pcu:${username}`)
      .digest('hex'),
    expiresAt: Math.floor(now / 1000) + lifetime,
    nonce: randomBytes(16).toString('hex'),
  };
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return `${payload}.${createHmac('sha256', secret).update(payload).digest('base64url')}`;
}
export function readSchoolSession(
  token: string,
  secret: string,
  now = Date.now(),
): SchoolSession | null {
  try {
    if (token.length > 2048) return null;
    const [payload, signature, extra] = token.split('.');
    if (!payload || !signature || extra !== undefined) return null;
    const expected = createHmac('sha256', secret).update(payload).digest();
    const actual = Buffer.from(signature, 'base64url');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
      return null;
    const claims = JSON.parse(
      Buffer.from(payload, 'base64url').toString(),
    ) as SchoolSession;
    const seconds = Math.floor(now / 1000);
    if (
      claims.school !== 'pcu' ||
      !/^[a-f0-9]{64}$/.test(claims.subject) ||
      !/^[a-f0-9]{32}$/.test(claims.nonce) ||
      !Number.isInteger(claims.expiresAt) ||
      claims.expiresAt <= seconds ||
      claims.expiresAt > seconds + lifetime
    )
      return null;
    return claims;
  } catch {
    return null;
  }
}
