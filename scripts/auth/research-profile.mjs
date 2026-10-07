import { writeFile } from 'node:fs/promises';
function shape(value, depth = 0) {
  if (depth > 5) return '[nested]';
  if (Array.isArray(value)) return value.length ? [shape(value[0], depth + 1)] : [];
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, shape(item, depth + 1)]));
  return typeof value;
}
export async function research(context) {
  const page = context.pages().find(p => p.url().startsWith('https://portal.pcu.ac.kr/main.do'));
  if (!page) { console.log({ ready: false }); return; }
  console.log({ scriptPaths: await page.evaluate(() => [...document.scripts].map(s => { try { return new URL(s.src).pathname; } catch { return null; } }).filter(Boolean)) });
  console.log({ userColumns: await page.evaluate(() => window.gds_userInfo?.getColumnNames() ?? []) });
  const pending = [];
  const handler = response => {
    const url = new URL(response.url());
    if (url.hostname !== 'portal.pcu.ac.kr') return;
    if (url.pathname.endsWith('/serviceController.do')) {
      pending.push((async () => {
        try {
          const body = await response.json();
          const names = JSON.stringify(shape(body));
          if (/userInfo|USER_NM|USER_ID/i.test(names)) {
            let request; try { request = shape(response.request().postDataJSON()); } catch { request = 'not-json'; }
            console.log(JSON.stringify({ profileResponseShape: shape(body), profileRequestShape: request, queryKeys: [...url.searchParams.keys()] }));
          }
        } catch { /* Do not print non-JSON response text */ }
      })());
    }
    const files = { '/common/frame/MainFrameNew.clx.js': '/private/tmp/pcu-mainframe-auth.js', '/cpr-lib/user-modules.js': '/private/tmp/pcu-user-modules-auth.js' };
    const local = Object.entries(files).find(([suffix]) => url.pathname.endsWith(suffix))?.[1];
    if (local) pending.push((async () => {
      const source = await response.text();
      if (!/^\s*</.test(source)) { await writeFile(local, source, { mode: 0o600 }); console.log({ staticScript: local, bytes: source.length }); }
    })());
  };
  page.on('response', handler);
  try {
    await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
  } catch { /* Slow unrelated applets do not prevent inspecting observed profile responses */ }
  await Promise.allSettled(pending);
  page.off('response', handler);
}
