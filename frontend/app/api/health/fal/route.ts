import { buildFalProxyUrl } from '@/lib/fal-proxy';

export const runtime = 'edge';

export async function GET() {
  try {
    const pingUrl = buildFalProxyUrl('/');
    const res = await fetch(pingUrl, { method: 'OPTIONS' });
    if (!res.ok && res.status !== 404) {
      return Response.json({ ok: false, status: res.status }, { status: 500 });
    }
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

