import { NextRequest, NextResponse } from 'next/server';
import { ensureAssetSchema } from '@/lib/schema';
import { query } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/user';

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
