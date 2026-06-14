import { NextRequest, NextResponse } from 'next/server';
import { uploadFileBuffer, recordUserAsset } from '@/server/storage';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { ensureReusableAsset } from '@/server/media-library';
import { detectVideoMetadata } from '@/server/media/detect-has-audio';
import { createUploadVideoThumbnail } from '@/server/upload-thumbnails';
import { getMaxVideoUploadMB, isSupportedVideoMime, videoUploadLimitBytes } from './_lib/video-upload-limits';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const blob = form.get('file');

  if (!(blob instanceof File)) {
    return NextResponse.json({ ok: false, error: 'FILE_REQUIRED' }, { status: 400 });
  }

  const mime = blob.type || 'application/octet-stream';
  const size = blob.size ?? 0;
  if (!isSupportedVideoMime(mime)) {
    console.warn('[upload] rejecting unsupported video upload', {
      fileName: blob.name,
      mime,
      size,
    });
    return NextResponse.json({ ok: false, error: 'UNSUPPORTED_TYPE' }, { status: 415 });
  }

  const maxVideoMB = getMaxVideoUploadMB();
  if (size > videoUploadLimitBytes(maxVideoMB)) {
    console.warn('[upload] rejecting oversized video upload', {
      fileName: blob.name,
      mime,
      size,
      maxMB: maxVideoMB,
    });
    return NextResponse.json({ ok: false, error: 'FILE_TOO_LARGE', maxMB: maxVideoMB }, { status: 413 });
  }

  const arrayBuffer = await blob.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (!buffer.length) {
    console.warn('[upload] rejecting empty video upload', {
      fileName: blob.name,
      mime,
      size,
    });
    return NextResponse.json({ ok: false, error: 'EMPTY_FILE' }, { status: 400 });
  }

  const { userId } = await getRouteAuthContext(req);
  if (!userId) {
    console.warn('[upload] rejecting unauthorized video upload', {
      fileName: blob.name,
      mime,
      size,
    });
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
    console.error('[upload] failed to store video', {
      fileName: blob.name,
      mime,
      size,
      userId,
      error,
    });
    return NextResponse.json({ ok: false, error: 'UPLOAD_FAILED' }, { status: 500 });
  }

  try {
    const [videoThumbUrl, videoMetadata] = await Promise.all([
      createUploadVideoThumbnail({
        data: buffer,
        userId,
        fileName: blob.name,
      }),
      detectVideoMetadata(uploadResult.url, { timeoutMs: 8_000 }).catch(() => null),
    ]);

    const assetId = await recordUserAsset({
      userId: userId ?? null,
      url: uploadResult.url,
      mime,
      width: videoMetadata?.width ?? null,
      height: videoMetadata?.height ?? null,
      size: buffer.length,
      source: 'upload',
      metadata: {
        originalName: blob.name,
        kind: 'video',
        thumbUrl: videoThumbUrl,
        durationSec: videoMetadata?.durationSec ?? null,
      },
    });

    await ensureReusableAsset({
      userId,
      url: uploadResult.url,
      kind: 'video',
      source: 'upload',
      mimeType: mime,
      sizeBytes: buffer.length,
      thumbUrl: videoThumbUrl,
      width: videoMetadata?.width ?? null,
      height: videoMetadata?.height ?? null,
      durationSec: videoMetadata?.durationSec ?? null,
    }).catch((error) => {
      console.warn('[upload] failed to mirror video into media_assets', error);
    });

    return NextResponse.json({
      ok: true,
      asset: {
        id: assetId,
        url: uploadResult.url,
        width: videoMetadata?.width ?? null,
        height: videoMetadata?.height ?? null,
        size: buffer.length,
        mime,
        name: blob.name,
        thumbUrl: videoThumbUrl,
        durationSec: videoMetadata?.durationSec ?? null,
      },
    });
  } catch (error) {
    console.error('[upload] failed to record video asset', {
      fileName: blob.name,
      mime,
      size,
      userId,
      url: uploadResult.url,
      error,
    });
    return NextResponse.json({ ok: false, error: 'STORE_FAILED' }, { status: 500 });
  }
}
