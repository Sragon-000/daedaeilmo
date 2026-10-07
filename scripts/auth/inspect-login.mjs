// Local, interactive investigation only. This does NOT issue app sessions.
// Passwords, POST bodies, cookies, headers and response bodies are never logged.
import { createRequire } from 'node:module';
import { createInterface } from 'node:readline';

const require = createRequire(process.env.PLAYWRIGHT_PACKAGE_ROOT
  ? `${process.env.PLAYWRIGHT_PACKAGE_ROOT}/package.json`
  : import.meta.url);
const { chromium } = require('playwright');
const schools = {
  pcu: { url: 'https://portal.pcu.ac.kr/', hosts: ['portal.pcu.ac.kr'] },
  kmu: { url: 'https://portal.kmu.ac.kr/', hosts: ['portal.kmu.ac.kr', 'sso.kmu.ac.kr', 'edward.kmu.ac.kr'] },
};
const browser = await chromium.launch({ channel: 'chrome', headless: false });
const contexts = new Map();
const observations = new Map();
function safePath(value, hosts) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !hosts.includes(url.hostname)) return '[external]';
    // Query parameters/fragments can contain tickets or identifiers; never retain them.
    return url.origin + url.pathname.replace(/[a-f0-9]{16,}|\d{5,}/gi, '[redacted]');
  } catch { return '[unknown]'; }
}
const selection = process.argv[2] || 'pcu';
if (!['pcu', 'kmu', 'both'].includes(selection)) throw new Error('Choose pcu, kmu, or both');
for (const [school, config] of Object.entries(schools)) {
  if (selection !== 'both' && selection !== school) continue;
  const context = await browser.newContext({ acceptDownloads: false });
  context.on('page', page => page.on('dialog', () => {})); // Let the user handle school confirmation dialogs.
  contexts.set(school, context);
  observations.set(school, []);
  context.on('response', async response => {
    const request = response.request();
    if (!['document', 'xhr', 'fetch'].includes(request.resourceType())) return;
    const path = safePath(response.url(), config.hosts);
    if (path.startsWith('[')) return;
    const records = observations.get(school);
    records.push({ path, status: response.status(), method: request.method(), type: request.resourceType() });
    if (records.length > 150) records.shift();
  });
  const page = await context.newPage();
  try { await page.goto(config.url, { waitUntil: 'domcontentloaded', timeout: 30000 }); }
  catch { console.log(JSON.stringify({ school, navigation: 'incomplete; check browser' })); }
}
console.log('School windows ready. Log in directly. Commands: inspect pcu | inspect kmu | quit');
const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
for await (const line of input) {
  const [command, school] = line.trim().split(/\s+/);
  if (command === 'quit') break;
  if (command === 'research' && contexts.has(school)) {
    try { const { research } = await import('./research-profile.mjs?updated=' + Date.now()); await research(contexts.get(school)); } catch (error) { console.log({ researchError: error.name }); }
    continue;
  }
  if (command !== 'inspect' || !contexts.has(school)) continue;
  const config = schools[school];
  const pages = [];
  for (const page of contexts.get(school).pages()) {
    const path = safePath(page.url(), config.hosts);
    if (path.startsWith('[')) continue;
    const signals = await page.evaluate(() => ({
      passwordFields: document.querySelectorAll('input[type=password]').length,
      logoutControl: [...document.querySelectorAll('a,button,input[type=button]')]
        .some(e => /로그아웃|logout/i.test(e.textContent || e.getAttribute('value') || '')),
      // Fixed booleans only: never emit student names, IDs, or arbitrary DOM text.
    })).catch(() => ({ unavailable: true }));
    pages.push({ path, ...signals });
  }
  console.log(JSON.stringify({ school, pages, requests: observations.get(school), authenticated: 'NOT_DETERMINED' }));
}
await browser.close();
