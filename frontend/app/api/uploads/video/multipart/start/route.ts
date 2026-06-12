import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { buildPublicStorageUrl, createStorageFileKey } from '@/server/storage';
import {
  getMaxVideoUploadMB,
  isSupportedVideoMime,
  VIDEO_MULTIPART_CHUNK_BYTES,
  videoUploadLimitBytes,
} from '../../_lib/video-upload-limits';
import { readSize, readUploadFileName, readUploadMime, uploadJsonError } from '../_lib';

export const runtime = 'nodejs';

type StartMultipartVideoUploadPayload = {
  fileName?: unknown;
  mime?: unknown;
  size?: unknown;
};

export async function POST(req: NextRequest) {
  const { userId } = await getRouteAuthContext(req);
  if (!userId) {
    return uploadJsonError('UNAUTHORIZED', 401);
  }

  const payload = (await req.json().catch(() => null)) as StartMultipartVideoUploadPayload | null;
  const fileName = readUploadFileName(payload?.fileName);
  const mime = readUploadMime(payload?.mime);
  const size = readSize(payload?.size);

  if (!isSupportedVideoMime(mime)) {
    return uploadJsonError('UNSUPPORTED_TYPE', 415);
  }

  if (size <= 0) {
    return uploadJsonError('EMPTY_FILE', 400);
  }

  const maxVideoMB = getMaxVideoUploadMB();
  if (size > videoUploadLimitBytes(maxVideoMB)) {
    return uploadJsonError('FILE_TOO_LARGE', 413, { maxMB: maxVideoMB });
  }

  const uploadId = randomUUID();
  const key = createStorageFileKey({
    mime,
    fileName,
    userId,
    prefix: 'user-assets',
  });

  return NextResponse.json({
    ok: true,
    upload: {
      uploadId,
      key,
      url: buildPublicStorageUrl(key),
      chunkSizeBytes: VIDEO_MULTIPART_CHUNK_BYTES,
    },
  });
}
