import { NextRequest, NextResponse } from 'next/server';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { ensureReusableAsset } from '@/server/media-library';
import {
  deleteStorageObjectKey,
  getStorageObjectBuffer,
  recordUserAsset,
  uploadFileBufferToKey,
} from '@/server/storage';
import {
  getMaxVideoUploadMB,
  isSupportedVideoMime,
  videoUploadLimitBytes,
} from '../../_lib/video-upload-limits';
import {
  isValidFinalUploadKey,
  isValidPartUploadKey,
  isValidUploadId,
  readSize,
  readString,
  readUploadedVideoParts,
  readUploadFileName,
  readUploadMime,
  type UploadedVideoPart,
  uploadJsonError,
} from '../_lib';

export const runtime = 'nodejs';

type CompleteMultipartVideoUploadPayload = {
  uploadId?: unknown;
  key?: unknown;
  fileName?: unknown;
  mime?: unknown;
  size?: unknown;
  parts?: unknown;
};

async function cleanupParts(parts: UploadedVideoPart[]) {
  const results = await Promise.allSettled(parts.map((part) => deleteStorageObjectKey(part.key)));
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.warn('[upload] failed to delete temporary video chunk', {
        key: parts[index]?.key,
        error: result.reason,
      });
    }
  });
}

export async function POST(req: NextRequest) {
  const { userId } = await getRouteAuthContext(req);
  if (!userId) {
    return uploadJsonError('UNAUTHORIZED', 401);
  }

  const payload = (await req.json().catch(() => null)) as CompleteMultipartVideoUploadPayload | null;
  const uploadId = readString(payload?.uploadId);
  const key = readString(payload?.key);
  const fileName = readUploadFileName(payload?.fileName);
  const mime = readUploadMime(payload?.mime);
  const requestedSize = readSize(payload?.size);
  const parts = readUploadedVideoParts(payload?.parts);

  if (!isValidUploadId(uploadId) || !isValidFinalUploadKey({ key, userId })) {
    return uploadJsonError('INVALID_UPLOAD_KEY', 400);
  }

  if (!isSupportedVideoMime(mime)) {
    return uploadJsonError('UNSUPPORTED_TYPE', 415);
  }

  if (requestedSize <= 0) {
    return uploadJsonError('EMPTY_FILE', 400);
  }

  if (!parts || parts.length > 10_000) {
    return uploadJsonError('INVALID_PARTS', 400);
  }

  if (parts.some((part) => !isValidPartUploadKey({ key: part.key, uploadId, userId }))) {
    return uploadJsonError('INVALID_PARTS', 400);
  }

  const maxVideoMB = getMaxVideoUploadMB();
  const maxBytes = videoUploadLimitBytes(maxVideoMB);
  if (requestedSize > maxBytes) {
    return uploadJsonError('FILE_TOO_LARGE', 413, { maxMB: maxVideoMB });
  }

  const buffers: Buffer[] = [];
  let totalSize = 0;

  try {
    for (const part of parts) {
      const buffer = await getStorageObjectBuffer(part.key);
      if (buffer.length !== part.size) {
        return uploadJsonError('INVALID_PARTS', 400);
      }
      totalSize += buffer.length;
      if (totalSize > maxBytes) {
        return uploadJsonError('FILE_TOO_LARGE', 413, { maxMB: maxVideoMB });
      }
      buffers.push(buffer);
    }
  } catch (error) {
    console.warn('[upload] chunked video upload part is missing', {
      uploadId,
      key,
      userId,
      error,
    });
    return uploadJsonError('UPLOAD_NOT_FOUND', 404);
  }

  if (totalSize <= 0) {
    return uploadJsonError('EMPTY_FILE', 400);
  }

  if (totalSize !== requestedSize) {
    return uploadJsonError('SIZE_MISMATCH', 400);
  }

  try {
    const uploadResult = await uploadFileBufferToKey({
      key,
      data: Buffer.concat(buffers, totalSize),
      mime,
    });

    const assetId = await recordUserAsset({
      userId,
      url: uploadResult.url,
      mime,
      width: null,
      height: null,
      size: totalSize,
      source: 'upload',
      metadata: { originalName: fileName, kind: 'video', chunkedUpload: true },
    });

    await ensureReusableAsset({
      userId,
      url: uploadResult.url,
      kind: 'video',
      source: 'upload',
      mimeType: mime,
      sizeBytes: totalSize,
    }).catch((error) => {
      console.warn('[upload] failed to mirror chunked video into media_assets', error);
    });

    await cleanupParts(parts);

    return NextResponse.json({
      ok: true,
      asset: {
        id: assetId,
        url: uploadResult.url,
        width: null,
        height: null,
        size: totalSize,
        mime,
        name: fileName,
        thumbUrl: null,
      },
    });
  } catch (error) {
    console.error('[upload] failed to complete chunked video upload', {
      uploadId,
      key,
      fileName,
      mime,
      size: totalSize,
      userId,
      error,
    });
    return uploadJsonError('STORE_FAILED', 500);
  }
}
