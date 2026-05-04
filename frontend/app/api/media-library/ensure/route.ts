import { NextRequest, NextResponse } from 'next/server';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { ensureReusableAsset, type MediaKind } from '@/server/media-library';

export const runtime = 'nodejs';

function normalizeKind(value: unknown): MediaKind {
  if (value === 'video' || value === 'audio' || value === 'image') return value;
  return 'image';
}

export async function POST(req: NextRequest) {
  const { userId } = await getRouteAuthContext(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const payload = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const url = typeof payload?.url === 'string' ? payload.url.trim() : '';
  if (!url) {
    return NextResponse.json({ ok: false, error: 'URL_REQUIRED' }, { status: 400 });
  }

  try {
    const asset = await ensureReusableAsset({
      userId,
      url,
      kind: normalizeKind(payload?.kind),
      source: payload?.source,
      sourceJobId: typeof payload?.jobId === 'string' ? payload.jobId : typeof payload?.sourceJobId === 'string' ? payload.sourceJobId : null,
      sourceOutputId: typeof payload?.sourceOutputId === 'string' ? payload.sourceOutputId : null,
      label: typeof payload?.label === 'string' ? payload.label : typeof payload?.name === 'string' ? payload.name : null,
      mimeType: typeof payload?.mime === 'string' ? payload.mime : null,
      thumbUrl: typeof payload?.thumbUrl === 'string' ? payload.thumbUrl : null,
      width: typeof payload?.width === 'number' ? payload.width : null,
      height: typeof payload?.height === 'number' ? payload.height : null,
      sizeBytes: typeof payload?.size === 'number' ? payload.size : null,
    });

    return NextResponse.json({
      ok: true,
      asset: {
        id: asset.id,
        url: asset.url,
        width: asset.width,
        height: asset.height,
        mime: asset.mimeType,
        size: asset.sizeBytes,
        source: asset.source,
        jobId: asset.sourceJobId,
        sourceOutputId: asset.sourceOutputId,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'SAVE_FAILED';
    return NextResponse.json({ ok: false, error: message }, { status: 422 });
  }
}
