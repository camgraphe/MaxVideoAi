import { NextRequest, NextResponse } from 'next/server';
import { uploadImageToStorage, recordUserAsset } from '@/server/storage';
import { getRouteAuthContext } from '@/lib/supabase-ssr';

export const runtime = 'nodejs';

const MAX_IMAGE_MB = Number(process.env.ASSET_MAX_IMAGE_MB ?? '25');

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const blob = form.get('file');

  if (!(blob instanceof File)) {
    return NextResponse.json({ ok: false, error: 'FILE_REQUIRED' }, { status: 400 });
  }

  const mime = blob.type || 'application/octet-stream';
  if (!mime.startsWith('image/')) {
    return NextResponse.json({ ok: false, error: 'UNSUPPORTED_TYPE' }, { status: 415 });
  }

  const size = blob.size ?? 0;
  if (Number.isFinite(MAX_IMAGE_MB) && MAX_IMAGE_MB > 0 && size > MAX_IMAGE_MB * 1024 * 1024) {
    return NextResponse.json(
      { ok: false, error: 'FILE_TOO_LARGE', maxMB: MAX_IMAGE_MB },
      { status: 413 }
    );
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
    uploadResult = await uploadImageToStorage({
      data: buffer,
      mime,
      fileName: blob.name,
      userId: userId ?? undefined,
      prefix: 'user-assets',
    });
  } catch (error) {
    console.error('[upload] failed to store image', error);
    return NextResponse.json({ ok: false, error: 'UPLOAD_FAILED' }, { status: 500 });
  }

  try {
    const assetId = await recordUserAsset({
      userId: userId ?? null,
      url: uploadResult.url,
      mime: uploadResult.mime,
      width: uploadResult.width,
      height: uploadResult.height,
      size: uploadResult.size,
      source: 'upload',
      metadata: { originalName: blob.name },
    });

    return NextResponse.json({
      ok: true,
      asset: {
        id: assetId,
        url: uploadResult.url,
        width: uploadResult.width,
        height: uploadResult.height,
        size: uploadResult.size,
        mime: uploadResult.mime,
        name: blob.name,
      },
    });
  } catch (error) {
    console.error('[upload] failed to record asset', error);
    return NextResponse.json({ ok: false, error: 'STORE_FAILED' }, { status: 500 });
  }
}
