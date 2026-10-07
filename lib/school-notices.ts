export type School = 'pcu' | 'kmu';
export type Notice = { id: string; title: string; url: string; postedAt?: string };
export const sources = {
  pcu: 'https://www.pcu.ac.kr/kor/article/Notify_1',
  kmu: 'https://www.kmu.ac.kr/uni/main/page.jsp?mnu_uid=144',
} as const;
function decode(text: string) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, code: string) => {
      const n =
        code[0].toLowerCase() === 'x'
          ? parseInt(code.slice(1), 16)
          : Number(code);
      return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '';
    });
}
export function parseNotices(html: string, school: School, limit = 15): Notice[] {
  const found = new Map<string, Notice>();
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const [, attrs, content] = match;
    let id: string | undefined;
    let url: URL;
    if (school === 'pcu') {
      id = /article\.view\(['"](\d+)['"]\)/.exec(attrs)?.[1];
      if (!id) continue;
      url = new URL(`${sources.pcu}/${id}`);
    } else {
      const href = /href\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1];
      if (!href) continue;
      try {
        url = new URL(decode(href), sources.kmu);
      } catch {
        continue;
      }
      if (url.protocol !== 'https:' || url.hostname !== 'www.kmu.ac.kr')
        continue;
      id = url.searchParams.get('parm_bod_uid') ?? undefined;
      if (!id || !/^\d+$/.test(id)) continue;
    }
    const title = decode(content.replace(/<[^>]*>/g, ' '))
      .replace(/\s+/g, ' ')
      .trim();
    if (title.length < 3 || title.length > 350) continue;
    const postedAt = school === 'pcu' && match.index !== undefined
      ? /<p\s+class=["']date["']\s*>\s*(20\d{2}-\d{2}-\d{2})\s*<\/p>/i.exec(html.slice(match.index + match[0].length, match.index + match[0].length + 3000).split('</li>')[0])?.[1]
      : undefined;
    found.set(id, { id, title, url: url.href, ...(postedAt ? { postedAt } : {}) });
  }
  return [...found.values()].slice(0, Math.max(0, Math.min(100, limit)));
}
