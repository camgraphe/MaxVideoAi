import { NextRequest, NextResponse } from 'next/server';
import { ensureAssetSchema } from '@/lib/schema';
import { query } from '@/lib/db';
import { deleteUserAsset, uploadImageToStorage, recordUserAsset } from '@/server/storage';
import { getRouteAuthContext } from '@/lib/supabase-ssr';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { userId } = await getRouteAuthContext(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
  }

  await ensureAssetSchema();

  const limit = Math.min(200, Number(req.nextUrl.searchParams.get('limit') ?? 50));
  const rows = await query<{
    asset_id: string;
    url: string;
    mime_type: string | null;
    width: number | null;
    height: number | null;
    size_bytes: string | number | null;
    created_at: string;
  }>(
    `SELECT asset_id, url, mime_type, width, height, size_bytes, created_at
     FROM user_assets
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit]
  );

  const assets = rows.map((row) => ({
    id: row.asset_id,
    url: row.url,
    mime: row.mime_type,
    width: row.width,
    height: row.height,
    size: typeof row.size_bytes === 'string' ? Number(row.size_bytes) : row.size_bytes,
    createdAt: row.created_at,
  }));

  return NextResponse.json({ ok: true, assets });
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

  const result = await deleteUserAsset({ assetId, userId });
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

  let payload: { url?: string; name?: string; jobId?: string } | null = null;
  try {
    payload = (await req.json()) as { url?: string; name?: string; jobId?: string } | null;
  } catch {
    return NextResponse.json({ ok: false, error: 'INVALID_JSON' }, { status: 400 });
  }

  const sourceUrl = typeof payload?.url === 'string' ? payload.url.trim() : '';
  if (!sourceUrl) {
    return NextResponse.json({ ok: false, error: 'URL_REQUIRED' }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(sourceUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error('unsupported protocol');
    }
  } catch {
    return NextResponse.json({ ok: false, error: 'INVALID_URL' }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(parsed.toString(), { signal: controller.signal });
    clearTimeout(timeout);
    if (!response.ok) {
      return NextResponse.json(
        { ok: false, error: 'FETCH_FAILED', status: response.status },
        { status: 422 }
      );
    }
    const mime = response.headers.get('content-type') ?? 'image/png';
    if (!mime.startsWith('image/')) {
      return NextResponse.json({ ok: false, error: 'UNSUPPORTED_TYPE' }, { status: 415 });
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const MAX_BYTES = 25 * 1024 * 1024;
    if (!buffer.length) {
      return NextResponse.json({ ok: false, error: 'EMPTY_IMAGE' }, { status: 422 });
    }
    if (buffer.length > MAX_BYTES) {
      return NextResponse.json({ ok: false, error: 'IMAGE_TOO_LARGE' }, { status: 422 });
    }

    const upload = await uploadImageToStorage({
      data: buffer,
      mime,
      userId,
      prefix: 'library',
      fileName: payload?.name ?? parsed.pathname.split('/').pop() ?? 'image.png',
    });

    const assetId = await recordUserAsset({
      userId,
      url: upload.url,
      mime: upload.mime,
      width: upload.width,
      height: upload.height,
      size: upload.size,
      source: 'generated',
      metadata: {
        originUrl: sourceUrl,
        jobId: payload?.jobId ?? null,
      },
    });

    return NextResponse.json({
      ok: true,
      asset: {
        id: assetId,
        url: upload.url,
        width: upload.width,
        height: upload.height,
        mime: upload.mime,
        size: upload.size,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json({ ok: false, error: 'FETCH_TIMEOUT' }, { status: 504 });
    }
    console.error('[user-assets] save failed', error);
    return NextResponse.json({ ok: false, error: 'SAVE_FAILED' }, { status: 500 });
  }
}
