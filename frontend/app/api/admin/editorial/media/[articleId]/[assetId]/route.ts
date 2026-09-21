import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { AdminAuthError, requireAdmin } from '@/server/admin';
import { getEditorialVersion } from '@/server/editorial/repository';
import { getStorageObjectBuffer, getStorageObjectMetadata } from '@/server/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ articleId: string; assetId: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    await requireAdmin(request);
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: error instanceof AdminAuthError ? error.status : 500 });
  }
  const { articleId, assetId } = await params;
  const versionNumber = Number(request.nextUrl.searchParams.get('version'));
  if (!Number.isInteger(versionNumber) || versionNumber < 1) return new NextResponse(null, { status: 400 });
  const version = await getEditorialVersion(articleId, versionNumber);
  const asset = version?.draft.assets.find((item) => item.id === assetId);
  if (!asset) return new NextResponse(null, { status: 404 });

  let data: Buffer;
  try {
    const localDir = process.env.EDITORIAL_LOCAL_MEDIA_DIR;
    if (process.env.NODE_ENV !== 'production' && process.env.VERCEL !== '1' && localDir && path.isAbsolute(localDir)) {
      const file = path.join(localDir, path.basename(asset.storageKey));
      if ((await stat(file)).size !== asset.bytes) return new NextResponse(null, { status: 422 });
      data = await readFile(file);
    } else {
      const metadata = await getStorageObjectMetadata(asset.storageKey);
      if (metadata.size !== asset.bytes || metadata.mime !== asset.mime) return new NextResponse(null, { status: 422 });
      data = await getStorageObjectBuffer(asset.storageKey);
    }
  } catch {
    return new NextResponse(null, { status: 404 });
  }
  if (asset.sha256 && createHash('sha256').update(data).digest('hex') !== asset.sha256) return new NextResponse(null, { status: 422 });
  if (data.length !== asset.bytes || data.length > 20_000_000) return new NextResponse(null, { status: 422 });
  return new NextResponse(new Uint8Array(data), { headers: { 'Content-Type': asset.mime, 'Content-Length': String(data.length), 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
}
