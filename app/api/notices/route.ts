import snapshots from '@/data/school-notices.json';
import {
  parseNotices,
  sources,
  type School,
  type Notice,
} from '@/lib/school-notices';
const cached = new Map<
  School,
  { fetchedAt: string; items: Notice[]; until: number }
>();
export async function GET(request: Request) {
  const school = new URL(request.url).searchParams.get('school');
  if (school !== 'pcu' && school !== 'kmu')
    return Response.json(
      { error: '지원하지 않는 학교입니다.' },
      { status: 400 },
    );
  const existing = cached.get(school);
  if (existing && existing.until > Date.now())
    return Response.json({
      school,
      source: sources[school],
      mode: 'live',
      items: existing.items,
      fetchedAt: existing.fetchedAt,
    });
  try {
    const upstream = await fetch(sources[school], {
      signal: AbortSignal.timeout(12000),
      redirect: 'manual',
      headers: {
        Accept: 'text/html',
        'User-Agent': 'DaedaeilmoPrototype/0.1 public-campus-notice-reader',
      },
    });
    if (!upstream.ok)
      throw new Error(
        `upstream ${upstream.status} ${upstream.headers.get('location') ?? ''}`,
      );
    const html = await upstream.text();
    if (html.length > 2_000_000) throw new Error('size');
    const items = parseNotices(html, school);
    if (!items.length) throw new Error('structure');
    const fetchedAt = new Date().toISOString();
    cached.set(school, { items, fetchedAt, until: Date.now() + 300000 });
    return Response.json(
      { school, source: sources[school], items, fetchedAt, mode: 'live' },
      { headers: { 'Cache-Control': 'public, max-age=60' } },
    );
  } catch (error) {
    console.warn(
      'Public school notice fetch failed',
      school,
      error instanceof Error ? error.message : 'Unknown error',
    );
    return Response.json(
      {
        school,
        ...snapshots[school],
        mode: 'snapshot',
        warning:
          '학교 실시간 연결이 지연되어 마지막으로 가져온 실제 공지를 표시합니다.',
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
