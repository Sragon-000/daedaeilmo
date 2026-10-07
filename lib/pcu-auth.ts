import { constants, createPublicKey, publicEncrypt } from 'node:crypto';

const origin = 'https://portal.pcu.ac.kr';
export class SchoolAuthError extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

export function encryptPcuCredential(
  value: string,
  modulus: string,
  exponent: string,
) {
  if (
    !/^[a-f\d]{256,1024}$/i.test(modulus) ||
    !/^[a-f\d]{1,8}$/i.test(exponent)
  ) {
    throw new SchoolAuthError('SCHOOL_RESPONSE_CHANGED');
  }
  const encode = (hex: string) =>
    Buffer.from(hex.length % 2 ? `0${hex}` : hex, 'hex').toString('base64url');
  const key = createPublicKey({
    key: { kty: 'RSA', n: encode(modulus), e: encode(exponent) },
    format: 'jwk',
  });
  const pem = key.export({ format: 'pem', type: 'spki' });
  return publicEncrypt(
    { key: pem, padding: constants.RSA_PKCS1_PADDING },
    Buffer.from(value, 'utf8'),
  ).toString('hex');
}

export function isPcuProtectedPage(url: string, html: string) {
  return (
    url === `${origin}/main.do` &&
    /로그아웃|\bcpr\.|\bexbuilder\b/i.test(html) &&
    !/<input\b[^>]*type\s*=\s*["']?password\b/i.test(html) &&
    !/id\s*=\s*["']LoginForm["']/i.test(html)
  );
}

// A new private cookie jar for every attempt. Never reuse a prior user's session.
// School cookies and credentials never leave this function or enter logs/storage.
export async function verifyPcuAccount(
  username: string,
  password: string,
  transport: typeof fetch = fetch,
  observe: (
    event: Record<string, string | number | boolean>,
  ) => void = () => {},
) {
  const allowedOrigins = new Set([origin, 'https://sso.pcu.ac.kr']);
  let sawSsoResponse = false;
  let sawAuthenticatedCallback = false;
  const cookies = new Map<
    string,
    {
      name: string;
      value: string;
      path: string;
      domain: string;
      hostOnly: boolean;
    }
  >();
  const signal = AbortSignal.timeout(25000);
  async function request(
    path: string,
    form?: URLSearchParams,
  ): Promise<{ url: string; html: string }> {
    let url = new URL(path, origin);
    let body = form;
    for (let hop = 0; hop < 10; hop++) {
      if (!allowedOrigins.has(url.origin) || url.username || url.password)
        throw new SchoolAuthError('SCHOOL_RESPONSE_CHANGED');
      const cookie = [...cookies.values()]
        .filter(
          (c) =>
            (c.hostOnly
              ? url.hostname === c.domain
              : url.hostname === c.domain ||
                url.hostname.endsWith('.' + c.domain)) &&
            (url.pathname === c.path ||
              url.pathname.startsWith(
                c.path.endsWith('/') ? c.path : c.path + '/',
              )),
        )
        .map((c) => `${c.name}=${c.value}`)
        .join('; ');
      const response = await transport(url, {
        method: body ? 'POST' : 'GET',
        body,
        signal,
        redirect: 'manual',
        headers: {
          Accept: 'text/html,application/json',
          'User-Agent': 'DaedaeilmoPrototype/0.1',
          ...(cookie ? { Cookie: cookie } : {}),
          ...(body
            ? {
                Origin: origin,
                Referer: `${origin}/`,
                'Content-Type': 'application/x-www-form-urlencoded',
              }
            : {}),
        },
      });
      observe({
        phase:
          path === '/'
            ? 'homepage'
            : path.includes('getKey')
              ? 'key'
              : path.includes('AuthController')
                ? 'login'
                : 'protected',
        hop,
        status: response.status,
        sentCookies: !!cookie,
        receivedCookies: response.headers.getSetCookie().length,
      });
      for (const raw of response.headers.getSetCookie()) {
        const [pair, ...attributes] = raw.split(';');
        const split = pair.indexOf('=');
        if (split < 1) continue;
        const name = pair.slice(0, split).trim(),
          value = pair.slice(split + 1).trim();
        if (!/^[\w-]+$/.test(name) || /[\r\n;]/.test(value)) continue;
        let cookiePath =
          url.pathname.slice(0, url.pathname.lastIndexOf('/') + 1) || '/';
        let allowed = true,
          expired = false;
        let domain = url.hostname,
          hostOnly = true;
        for (const attribute of attributes) {
          const at = attribute.indexOf('=');
          const key = (at < 0 ? attribute : attribute.slice(0, at))
            .trim()
            .toLowerCase();
          const val = at < 0 ? '' : attribute.slice(at + 1).trim();
          if (key === 'domain') {
            const candidate = val.replace(/^\./, '').toLowerCase();
            if (
              (candidate !== 'pcu.ac.kr' && candidate !== url.hostname) ||
              !(
                url.hostname === candidate ||
                url.hostname.endsWith('.' + candidate)
              )
            )
              allowed = false;
            else {
              domain = candidate;
              hostOnly = false;
            }
          }
          if (key === 'path' && val.startsWith('/')) cookiePath = val;
          if (key === 'max-age' && Number(val) <= 0) expired = true;
          if (key === 'expires' && Date.parse(val) < Date.now()) expired = true;
        }
        if (!allowed) continue;
        const key = `${domain}:${name}:${cookiePath}`;
        if (expired) cookies.delete(key);
        else
          cookies.set(key, { name, value, path: cookiePath, domain, hostOnly });
        if (cookies.size > 100)
          throw new SchoolAuthError('SCHOOL_RESPONSE_CHANGED');
      }
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        await response.body?.cancel();
        if (!location) throw new SchoolAuthError('SCHOOL_RESPONSE_CHANGED');
        const next = new URL(location, url);
        observe({
          redirectHost: next.hostname.endsWith('.pcu.ac.kr')
            ? next.origin
            : 'external',
          redirectProtocol: next.protocol,
          redirectSameHost: next.hostname === 'portal.pcu.ac.kr',
          redirectSameOrigin: next.origin === origin,
          redirectPath: [
            '/main.do',
            '/exsignon/sso/sso_assert.jsp',
            '/exsignon/sso/sso_identify.jsp',
            '/patis/common/loginForm.do',
          ].includes(next.pathname)
            ? next.pathname
            : 'other',
          hasQuery: !!next.search,
        });
        if (
          url.origin === 'https://sso.pcu.ac.kr' &&
          next.origin === origin &&
          next.pathname === '/exsignon/sso/sso_identify.jsp' &&
          response.status === 302
        ) {
          sawSsoResponse = true;
        }
        if (
          sawSsoResponse &&
          url.origin === origin &&
          url.pathname === '/exsignon/sso/sso_identify.jsp' &&
          next.href === origin + '/main.do' &&
          response.status === 302
        ) {
          sawAuthenticatedCallback = true;
        }
        if (!allowedOrigins.has(next.origin))
          throw new SchoolAuthError('SCHOOL_RESPONSE_CHANGED');
        // Never resend the credential POST through an unexpected 307/308 redirect.
        if (body && [307, 308].includes(response.status))
          throw new SchoolAuthError('SCHOOL_RESPONSE_CHANGED');
        url = next;
        body = undefined;
        continue;
      }
      if (!response.ok) throw new SchoolAuthError('SCHOOL_UNAVAILABLE');
      const html = await response.text();
      if (html.length > 2_000_000)
        throw new SchoolAuthError('SCHOOL_RESPONSE_CHANGED');
      observe({
        bodyFor:
          path === '/'
            ? 'homepage'
            : path.includes('getKey')
              ? 'key'
              : path.includes('AuthController')
                ? 'login'
                : 'protected',
        bytes: html.length,
        logoutText: /로그아웃/.test(html),
        loginForm: /LoginForm/.test(html),
        passwordField: /type\s*=\s*["']password/i.test(html),
        exactMain: url.href === origin + '/main.do',
        isJson: /^[\s]*[{]/.test(html),
        appRuntime: /cpr\.|exbuilder/i.test(html),
      });
      return { url: url.href, html };
    }
    throw new SchoolAuthError('SCHOOL_RESPONSE_CHANGED');
  }
  try {
    await request('/');
    const keyPage = await request(
      '/patis/common/getKey.do',
      new URLSearchParams(),
    );
    let key: { publicKeyModulus?: string; publicKeyExponent?: string };
    try {
      key = JSON.parse(keyPage.html);
    } catch {
      throw new SchoolAuthError('SCHOOL_RESPONSE_CHANGED');
    }
    const modulus = key.publicKeyModulus || '',
      exponent = key.publicKeyExponent || '';
    await request(
      '/patis/system/AuthController.do',
      new URLSearchParams({
        username: '',
        securedUserId: encryptPcuCredential(username, modulus, exponent),
        securedUserPwd: encryptPcuCredential(password, modulus, exponent),
        methodName: 'doSsoLogin',
      }),
    );
    // Re-fetch the protected resource with this attempt's session, independently of the POST response.
    const page = await request('/main.do');
    if (!sawAuthenticatedCallback || !isPcuProtectedPage(page.url, page.html))
      throw new SchoolAuthError('LOGIN_NOT_CONFIRMED');
    return { school: 'pcu' as const };
  } finally {
    cookies.clear();
  }
}
