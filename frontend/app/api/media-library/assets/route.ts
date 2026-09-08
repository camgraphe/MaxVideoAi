import { NextRequest, NextResponse } from 'next/server';
import { canonicalMediaAssetFields, readMediaFacts } from '@/lib/media-identity';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import {
  deleteLibraryAsset,
  findLibraryAssetByOrigin,
  listLibraryAssetPage,
  type MediaKind,
} from '@/server/media-library';
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

  let page: Awaited<ReturnType<typeof listLibraryAssetPage>>;
  try {
    const originUrl = req.nextUrl.searchParams.get('originUrl');
    if (originUrl) {
      const asset = await findLibraryAssetByOrigin({
        userId,
        originUrl,
        kind: normalizeKind(req.nextUrl.searchParams.get('kind')),
        source: req.nextUrl.searchParams.get('source'),
      });
      page = { items: asset ? [asset] : [], nextCursor: null, hasMore: false };
    } else {
      page = await listLibraryAssetPage({
        userId,
        kind: normalizeKind(req.nextUrl.searchParams.get('kind')),
        source: req.nextUrl.searchParams.get('source'),
        limit: Number(req.nextUrl.searchParams.get('limit') ?? 50),
        cursor: req.nextUrl.searchParams.get('cursor'),
        q: req.nextUrl.searchParams.get('q'),
      });
    }
  } catch (error) {
    console.error('[media-library] failed to list assets', error);
    return NextResponse.json({ ok: false, assets: [], error: 'LOAD_FAILED' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    assets: page.items.map((asset) => ({
      id: asset.id,
      ...canonicalMediaAssetFields(asset.publicId, asset.kind),
      mediaFacts: readMediaFacts(asset.metadata.mediaFacts),
      url: asset.url,
      thumbUrl: asset.thumbUrl,
      previewUrl: asset.previewUrl,
      mime: asset.mimeType,
      width: asset.width,
      height: asset.height,
      size: asset.sizeBytes,
      durationSec: asset.durationSec,
      kind: asset.kind,
      source: asset.source,
      jobId: asset.sourceJobId,
      sourceOutputId: asset.sourceOutputId,
      createdAt: asset.createdAt,
    })),
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
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
