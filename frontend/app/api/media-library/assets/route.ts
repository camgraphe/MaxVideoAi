import { NextRequest, NextResponse } from 'next/server';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { deleteLibraryAsset, listLibraryAssets, type MediaKind } from '@/server/media-library';

export const runtime = 'nodejs';

function normalizeKind(value: string | null): MediaKind | null {
  if (value === 'image' || value === 'video' || value === 'audio') return value;
  return null;
}

export async function GET(req: NextRequest) {
  const { userId } = await getRouteAuthContext(req);
  if (!userId) {
    return NextResponse.json({ ok: false, assets: [], error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const assets = await listLibraryAssets({
    userId,
    kind: normalizeKind(req.nextUrl.searchParams.get('kind')),
    source: req.nextUrl.searchParams.get('source'),
    limit: Number(req.nextUrl.searchParams.get('limit') ?? 50),
  });

  return NextResponse.json({
    ok: true,
    assets: assets.map((asset) => ({
      id: asset.id,
      url: asset.url,
      thumbUrl: asset.thumbUrl,
      mime: asset.mimeType,
      width: asset.width,
      height: asset.height,
      size: asset.sizeBytes,
      kind: asset.kind,
      source: asset.source,
      jobId: asset.sourceJobId,
      sourceOutputId: asset.sourceOutputId,
      createdAt: asset.createdAt,
    })),
  });
}

export async function DELETE(req: NextRequest) {
  const { userId } = await getRouteAuthContext(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
  }
  const payload = (await req.json().catch(() => null)) as { id?: unknown } | null;
  const assetId = typeof payload?.id === 'string' ? payload.id.trim() : req.nextUrl.searchParams.get('id')?.trim();
  if (!assetId) {
    return NextResponse.json({ ok: false, error: 'ASSET_ID_REQUIRED' }, { status: 400 });
  }

  const result = await deleteLibraryAsset({ userId, assetId });
  if (result === 'not_found') {
    return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
