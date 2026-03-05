import type { NextRequest } from 'next/server';
import { buildFalProxyUrl } from '@/lib/fal-proxy';
import { authorizeHealthcheckRequest } from '@/server/ops-auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const unauthorized = authorizeHealthcheckRequest(req);
  if (unauthorized) return unauthorized;

  try {
    const pingUrl = buildFalProxyUrl('/');
    const res = await fetch(pingUrl, { method: 'OPTIONS' });
    if (!res.ok && res.status !== 404) {
      return Response.json({ ok: false, error: 'fal_unavailable' }, { status: 503 });
    }
    return Response.json({ ok: true });
  } catch (error) {
    console.error('[health/fal] probe failed', error);
    return Response.json(
      { ok: false, error: 'fal_unavailable' },
      { status: 503 }
    );
  }
}
