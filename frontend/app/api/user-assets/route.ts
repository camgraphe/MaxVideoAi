import { NextRequest, NextResponse } from 'next/server';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { VISITOR_WORKSPACE_ENABLED } from '@/lib/visitor-access';
import {
  deleteLibraryAsset,
  ensureReusableAsset,
  listLibraryAssets,
  type MediaKind,
} from '@/server/media-library';

export const runtime = 'nodejs';

function normalizeKindFromRequest(value: unknown): MediaKind {
  if (value === 'video' || value === 'audio' || value === 'image') return value;
  return 'image';
}

export async function GET(req: NextRequest) {
  const { userId } = await getRouteAuthContext(req);
  if (!userId) {
    if (VISITOR_WORKSPACE_ENABLED) {
      return NextResponse.json({ ok: true, assets: [] });
    }
    return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const assets = await listLibraryAssets({
    userId,
    source: req.nextUrl.searchParams.get('source'),
    originUrl: req.nextUrl.searchParams.get('originUrl'),
    limit: Number(req.nextUrl.searchParams.get('limit') ?? 50),
  });

  return NextResponse.json({
    ok: true,
    assets: assets.map((asset) => ({
      id: asset.id,
      url: asset.url,
      mime: asset.mimeType,
      width: asset.width,
      height: asset.height,
      size: asset.sizeBytes,
      source: asset.source === 'saved_job_output' ? 'generated' : asset.source,
      kind: asset.kind,
      jobId: asset.sourceJobId,
      createdAt: asset.createdAt,
    })),
  });
}

export async function DELETE(req: NextRequest) {
  const { userId } = await getRouteAuthContext(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
  }

  let assetId = '';
  const contentType = req.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const payload = await req.json().catch(() => null);
    if (payload && typeof payload.id === 'string') {
      assetId = payload.id.trim();
    }
  }
  if (!assetId) {
    assetId = (req.nextUrl.searchParams.get('id') ?? '').trim();
  }

  if (!assetId) {
    return NextResponse.json({ ok: false, error: 'ASSET_ID_REQUIRED' }, { status: 400 });
  }

  const result = await deleteLibraryAsset({ assetId, userId });
  if (result === 'not_found') {
    return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  const { userId } = await getRouteAuthContext(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const payload = (await req.json().catch(() => null)) as {
    url?: unknown;
    name?: unknown;
    label?: unknown;
    jobId?: unknown;
    source?: unknown;
    kind?: unknown;
    mime?: unknown;
    width?: unknown;
    height?: unknown;
    size?: unknown;
    thumbUrl?: unknown;
    sourceOutputId?: unknown;
  } | null;

  const sourceUrl = typeof payload?.url === 'string' ? payload.url.trim() : '';
  if (!sourceUrl) {
    return NextResponse.json({ ok: false, error: 'URL_REQUIRED' }, { status: 400 });
  }

  try {
    const asset = await ensureReusableAsset({
      userId,
      url: sourceUrl,
      kind: normalizeKindFromRequest(payload?.kind),
      source: payload?.source,
      sourceJobId: typeof payload?.jobId === 'string' ? payload.jobId : null,
      sourceOutputId: typeof payload?.sourceOutputId === 'string' ? payload.sourceOutputId : null,
      label: typeof payload?.label === 'string' ? payload.label : typeof payload?.name === 'string' ? payload.name : null,
      mimeType: typeof payload?.mime === 'string' ? payload.mime : null,
      width: typeof payload?.width === 'number' ? payload.width : null,
      height: typeof payload?.height === 'number' ? payload.height : null,
      sizeBytes: typeof payload?.size === 'number' ? payload.size : null,
      thumbUrl: typeof payload?.thumbUrl === 'string' ? payload.thumbUrl : null,
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
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'STORE_FAILED';
    return NextResponse.json({ ok: false, error: message }, { status: 422 });
  }
}
