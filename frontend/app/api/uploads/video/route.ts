import { NextRequest, NextResponse } from 'next/server';
import { uploadFileBuffer, recordUserAsset } from '@/server/storage';
import { getRouteAuthContext } from '@/lib/supabase-ssr';

export const runtime = 'nodejs';

const MAX_VIDEO_MB = Number(process.env.ASSET_MAX_VIDEO_MB ?? '30');

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const blob = form.get('file');

  if (!(blob instanceof File)) {
    return NextResponse.json({ ok: false, error: 'FILE_REQUIRED' }, { status: 400 });
  }

  const mime = blob.type || 'application/octet-stream';
  if (!mime.startsWith('video/')) {
    return NextResponse.json({ ok: false, error: 'UNSUPPORTED_TYPE' }, { status: 415 });
  }

  const size = blob.size ?? 0;
  if (Number.isFinite(MAX_VIDEO_MB) && MAX_VIDEO_MB > 0 && size > MAX_VIDEO_MB * 1024 * 1024) {
    return NextResponse.json({ ok: false, error: 'FILE_TOO_LARGE', maxMB: MAX_VIDEO_MB }, { status: 413 });
  }

  const arrayBuffer = await blob.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (!buffer.length) {
    return NextResponse.json({ ok: false, error: 'EMPTY_FILE' }, { status: 400 });
  }

  const { userId } = await getRouteAuthContext(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
  }

  let uploadResult;
  try {
    uploadResult = await uploadFileBuffer({
      data: buffer,
      mime,
      fileName: blob.name,
      userId: userId ?? undefined,
      prefix: 'user-assets',
    });
  } catch (error) {
    console.error('[upload] failed to store video', error);
    return NextResponse.json({ ok: false, error: 'UPLOAD_FAILED' }, { status: 500 });
  }

  try {
    const assetId = await recordUserAsset({
      userId: userId ?? null,
      url: uploadResult.url,
      mime,
      width: null,
      height: null,
      size: buffer.length,
      source: 'upload',
      metadata: { originalName: blob.name, kind: 'video' },
    });

    return NextResponse.json({
      ok: true,
      asset: {
        id: assetId,
        url: uploadResult.url,
        width: null,
        height: null,
        size: buffer.length,
        mime,
        name: blob.name,
      },
    });
  } catch (error) {
    console.error('[upload] failed to record video asset', error);
    return NextResponse.json({ ok: false, error: 'STORE_FAILED' }, { status: 500 });
  }
}
