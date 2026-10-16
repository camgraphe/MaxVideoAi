export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** User-triggered recovery only; never clear authentication or payment state. */
export function POST(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store' };
  if (request.headers.get('origin') !== new URL(request.url).origin || request.headers.get('sec-fetch-site') === 'cross-site') {
    return Response.json({ error: 'origin_rejected' }, { status: 403, headers });
  }
  return new Response(null, {
    status: 204,
    headers: { ...headers, 'Set-Cookie': '__vdpl=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax' },
  });
}
