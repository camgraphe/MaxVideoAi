import { NextRequest, NextResponse } from 'next/server';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { ensureReusableAsset } from '@/server/media-library';
import { detectVideoMetadata } from '@/server/media/detect-has-audio';
import {
  buildPublicStorageUrl,
  getStorageObjectMetadata,
  isStorageKeyWithinUserPrefix,
  recordUserAsset,
} from '@/server/storage';
import {
  getMaxVideoUploadMB,
  isSupportedVideoMime,
  videoUploadLimitBytes,
} from '../_lib/video-upload-limits';

export const runtime = 'nodejs';

type CompleteVideoUploadPayload = {
  key?: unknown;
  fileName?: unknown;
  mime?: unknown;
  size?: unknown;
};

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function readSize(value: unknown): number | null {
  const size = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : null;
  return typeof size === 'number' && Number.isFinite(size) && size > 0 ? size : null;
}

export async function POST(req: NextRequest) {
  const { userId } = await getRouteAuthContext(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const payload = (await req.json().catch(() => null)) as CompleteVideoUploadPayload | null;
  const key = readString(payload?.key);
  const fileName = readString(payload?.fileName) || 'video-upload.mp4';
  const requestedMime = readString(payload?.mime).toLowerCase() || 'video/mp4';
  const requestedSize = readSize(payload?.size);

  if (!key || !isStorageKeyWithinUserPrefix({ key, prefix: 'user-assets', userId })) {
    return NextResponse.json({ ok: false, error: 'INVALID_UPLOAD_KEY' }, { status: 400 });
  }

  let metadata: { size: number | null; mime: string | null };
  try {
    metadata = await getStorageObjectMetadata(key);
  } catch (error) {
    console.warn('[upload] direct video upload object is missing', {
      key,
      userId,
      error,
    });
    return NextResponse.json({ ok: false, error: 'UPLOAD_NOT_FOUND' }, { status: 404 });
  }

  const mime = metadata.mime?.trim().toLowerCase() || requestedMime;
  const size = metadata.size ?? requestedSize ?? 0;

  if (!isSupportedVideoMime(mime)) {
    return NextResponse.json({ ok: false, error: 'UNSUPPORTED_TYPE' }, { status: 415 });
  }

  if (size <= 0) {
    return NextResponse.json({ ok: false, error: 'EMPTY_FILE' }, { status: 400 });
  }

  const maxVideoMB = getMaxVideoUploadMB();
  if (size > videoUploadLimitBytes(maxVideoMB)) {
    return NextResponse.json({ ok: false, error: 'FILE_TOO_LARGE', maxMB: maxVideoMB }, { status: 413 });
  }

  const url = buildPublicStorageUrl(key);
  const videoMetadata = await detectVideoMetadata(url, { timeoutMs: 8_000 }).catch(() => null);

  try {
    const assetId = await recordUserAsset({
      userId,
      url,
      mime,
      width: videoMetadata?.width ?? null,
      height: videoMetadata?.height ?? null,
      size,
      source: 'upload',
      metadata: {
        originalName: fileName,
        kind: 'video',
        directUpload: true,
        durationSec: videoMetadata?.durationSec ?? null,
      },
    });

    await ensureReusableAsset({
      userId,
      url,
      kind: 'video',
      source: 'upload',
      mimeType: mime,
      sizeBytes: size,
      width: videoMetadata?.width ?? null,
      height: videoMetadata?.height ?? null,
      durationSec: videoMetadata?.durationSec ?? null,
    }).catch((error) => {
      console.warn('[upload] failed to mirror direct video into media_assets', error);
    });

    return NextResponse.json({
      ok: true,
      asset: {
        id: assetId,
        url,
        width: videoMetadata?.width ?? null,
        height: videoMetadata?.height ?? null,
        size,
        mime,
        name: fileName,
        thumbUrl: null,
        durationSec: videoMetadata?.durationSec ?? null,
      },
    });
  } catch (error) {
    console.error('[upload] failed to record direct video asset', {
      key,
      fileName,
      mime,
      size,
      userId,
      error,
    });
    return NextResponse.json({ ok: false, error: 'STORE_FAILED' }, { status: 500 });
  }
}
