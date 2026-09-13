import { NextRequest } from 'next/server';
import { resolveStudioMedia } from '@/server/studio/media-resolver';
import { resolveStudioRouteContext, studioJson } from '../../_lib/studio-route-utils';

export const runtime = 'nodejs';
export async function POST(req: NextRequest) {
  const context = await resolveStudioRouteContext(req);
  if (context.response) return context.response;
  const payload = await req.json().catch(() => null);
  if (!Array.isArray(payload?.refs) || !payload.refs.length || payload.refs.length > 60) return studioJson({ ok: false, error: 'INVALID_REFS' }, { status: 400 });
  try {
    const assets = [];
    for (const ref of payload.refs) assets.push(await resolveStudioMedia(context.userId, ref));
    return studioJson({ ok: true, assets });
  } catch {
    return studioJson({ ok: false, error: 'MEDIA_NOT_AVAILABLE' }, { status: 404 });
  }
}
