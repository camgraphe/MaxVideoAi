import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { gzipSync } from 'zlib';
import { isDatabaseConfigured } from '@/lib/db';
import { buildDsarPayload } from '@/server/dsar';
import { createSignedDownloadUrl, isStorageConfigured, uploadFileBuffer } from '@/server/storage';
import { getRouteAuthContext } from '@/lib/supabase-ssr';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: 'Database unavailable' }, { status: 503 });
  }
  if (!isStorageConfigured()) {
    return NextResponse.json({ ok: false, error: 'Object storage not configured' }, { status: 503 });
  }

  const { userId } = await getRouteAuthContext(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const payload = await buildDsarPayload(userId);
    const json = JSON.stringify(payload, null, 2);
    const compressed = gzipSync(Buffer.from(json, 'utf8'));
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `maxvideoai-dsar-${timestamp}.json.gz`;

    const upload = await uploadFileBuffer({
      data: compressed,
      mime: 'application/gzip',
      userId,
      fileName,
      prefix: 'exports',
      cacheControl: 'private, max-age=0, must-revalidate',
      acl: 'private',
    });

    const expiresInSeconds = 60 * 60 * 48; // 48 hours
    const signedUrl = await createSignedDownloadUrl(upload.key, { expiresInSeconds });

    console.info('[dsar] export generated', { userId, key: upload.key });

    return NextResponse.json({
      ok: true,
      url: signedUrl,
      expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
    });
  } catch (error) {
    console.error('[dsar] export failed', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to generate export' },
      { status: 500 }
    );
  }
}
