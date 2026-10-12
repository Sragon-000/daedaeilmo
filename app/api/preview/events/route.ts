import { experimentCatalog } from '@/lib/experiment-catalog';

export async function GET() {
  try {
    // The public preview does not claim a time fit; the fixed window only satisfies the catalog reader.
    const catalog = await experimentCatalog({ day: 0, start: 480, end: 960 });
    return Response.json({ items: catalog.events.map(item => item.public), supplyStatus: catalog.supplyStatus, asOf: catalog.asOf },
      { headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
  } catch {
    return Response.json({ message: '학교 활동을 불러오지 못했어요.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
