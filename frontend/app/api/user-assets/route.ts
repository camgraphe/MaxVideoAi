import { NextRequest, NextResponse } from 'next/server';
import { ensureAssetSchema } from '@/lib/schema';
import { query } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/user';
import { deleteUserAsset } from '@/server/storage';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
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
  const userId = await getUserIdFromRequest(req);
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
