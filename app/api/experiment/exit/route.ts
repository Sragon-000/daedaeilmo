import { ownOrigin } from '@/lib/member-server';
import { experimentReply, sessionCookie } from '@/lib/experiment-session';

export async function POST(request: Request) {
  if (!ownOrigin(request)) return experimentReply({}, 403);
  return new Response(null, { status: 204, headers: { 'Set-Cookie': sessionCookie(request, '', 0),
    'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
}
