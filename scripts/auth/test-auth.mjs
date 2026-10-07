import assert from 'node:assert/strict';
import { generateKeyPairSync, privateDecrypt, constants } from 'node:crypto';
import { encryptPcuCredential, isPcuProtectedPage, verifyPcuAccount } from '../../lib/pcu-auth.ts';
import { issueSchoolSession, readSchoolSession } from '../../lib/school-session.ts';

const secret = 'a'.repeat(64), now = 1700000000000;
const token = issueSchoolSession('sample-account', secret, now);
assert.equal(readSchoolSession(token, secret, now).school, 'pcu');
assert.equal(readSchoolSession(token, secret, now + 1800000), null);
assert.equal(readSchoolSession(token, 'b'.repeat(64), now), null);
assert.equal(readSchoolSession('eyJzY2hvb2wiOiJwY3UifQ.fake', secret, now), null);
assert.equal(readSchoolSession(token + '.extra', secret, now), null);
assert.ok(!Buffer.from(token.split('.')[0], 'base64url').toString().includes('sample-account'));

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = publicKey.export({ format: 'jwk' });
const modulus = Buffer.from(jwk.n, 'base64url').toString('hex');
const exponent = Buffer.from(jwk.e, 'base64url').toString('hex');
const ciphertext = encryptPcuCredential('local-test-only', modulus, exponent);
const block = privateDecrypt({ key: privateKey, padding: constants.RSA_NO_PADDING }, Buffer.from(ciphertext, 'hex'));
assert.equal(block[0], 0); assert.equal(block[1], 2);
assert.equal(block.subarray(block.indexOf(0, 2) + 1).toString(), 'local-test-only');
assert.notEqual(ciphertext, encryptPcuCredential('local-test-only', modulus, exponent));
assert.throws(() => encryptPcuCredential('test', 'invalid', exponent));
assert.equal(isPcuProtectedPage('https://portal.pcu.ac.kr/main.do', '<a>로그아웃</a>'), true);
assert.equal(isPcuProtectedPage('https://evil.test/main.do', '<a>로그아웃</a>'), false);
assert.equal(isPcuProtectedPage('https://portal.pcu.ac.kr/main.do', '<a>로그아웃</a><input type="password">'), false);

function fakePortal({ success = false, external = false } = {}) {
  const calls = [];
  const transport = async (value, init) => {
    const url = new URL(value); calls.push({ url: url.href, init });
    if (url.pathname === '/') return new Response('<form id="LoginForm"></form>', { headers: { 'Set-Cookie': 'JSESSIONID=synthetic; Path=/; Secure' } });
    if (url.pathname.endsWith('/getKey.do')) return Response.json({ publicKeyModulus: modulus, publicKeyExponent: exponent });
    if (url.pathname.endsWith('/AuthController.do')) {
      assert.match(init.headers.Cookie, /JSESSIONID=synthetic/);
      assert.ok(!init.body.toString().includes('local-test-only'));
      return new Response(null, { status: 302, headers: { Location: external ? 'https://evil.test/' : '/main.do' } });
    }
    if (url.pathname === '/main.do') return new Response(success ? '<button>로그아웃</button>' : '<input type="password">');
    throw new Error('Unexpected path');
  };
  return { transport, calls };
}
const success = fakePortal({ success: true });
await assert.rejects(verifyPcuAccount('synthetic', 'local-test-only', success.transport), { code: 'LOGIN_NOT_CONFIRMED' });
assert.equal(success.calls.filter(c => c.url.endsWith('/main.do')).length, 2);
assert.ok(!success.calls[0].init.headers.Cookie);
const failure = fakePortal();
await assert.rejects(verifyPcuAccount('synthetic', 'local-test-only', failure.transport), { code: 'LOGIN_NOT_CONFIRMED' });
const external = fakePortal({ external: true });
await assert.rejects(verifyPcuAccount('synthetic', 'local-test-only', external.transport), { code: 'SCHOOL_RESPONSE_CHANGED' });
assert.ok(external.calls.every(c => new URL(c.url).hostname === 'portal.pcu.ac.kr'));
console.log('Passed: encryption, fresh cookie isolation, protected-page check, redirect restriction, signed-session tampering and expiry. No real credentials submitted.');

// Official assertion discovery: accept one school HTTPS SSO origin, with separate host-only cookies.
const ssoCalls = [];
const ssoTransport = async (value, init) => {
  const u = new URL(value); ssoCalls.push(u.origin);
  if (u.origin === 'https://sso.pcu.ac.kr') {
    assert.ok(!init.headers.Cookie, 'Portal host-only cookie must not reach SSO');
    return new Response(null, { status: 302, headers: { Location: 'https://portal.pcu.ac.kr/exsignon/sso/sso_identify.jsp?test=synthetic', 'Set-Cookie': 'SSOONLY=test; Path=/; Secure' } });
  }
  assert.ok(!init.headers.Cookie?.includes('SSOONLY'), 'SSO host-only cookie must not reach portal');
  if (u.pathname === '/') return new Response('', { headers: { 'Set-Cookie': 'JSESSIONID=test; Path=/; Secure' } });
  if (u.pathname.endsWith('/getKey.do')) return Response.json({ publicKeyModulus: modulus, publicKeyExponent: exponent });
  if (u.pathname.endsWith('/AuthController.do')) return new Response(null, { status: 302, headers: { Location: '/exsignon/sso/sso_assert.jsp' } });
  if (u.pathname.endsWith('/sso_assert.jsp')) return new Response(null, { status: 302, headers: { Location: 'https://sso.pcu.ac.kr/auth' } });
  if (u.pathname.endsWith('/sso_identify.jsp')) return new Response(null, { status: 302, headers: { Location: '/main.do' } });
  if (u.pathname === '/main.do') return new Response('<html><script>cpr.core.init();</script></html>');
  throw new Error('Unexpected request');
};
assert.deepEqual(await verifyPcuAccount('synthetic', 'local-test-only', ssoTransport), { school: 'pcu' });
assert.ok(ssoCalls.includes('https://sso.pcu.ac.kr'));
console.log('Passed: official SSO discovery and cross-host cookie isolation.');
