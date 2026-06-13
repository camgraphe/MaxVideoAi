import { NextRequest, NextResponse } from 'next/server';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { uploadFileBuffer } from '@/server/storage';
import { VIDEO_MULTIPART_CHUNK_BYTES } from '../../_lib/video-upload-limits';
import {
  isValidFinalUploadKey,
  isValidUploadId,
  multipartTempPrefix,
  readPositiveInteger,
  readString,
  uploadJsonError,
} from '../_lib';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const { userId } = await getRouteAuthContext(req);
  if (!userId) {
    return uploadJsonError('UNAUTHORIZED', 401);
  }

  const form = await req.formData();
  const uploadId = readString(form.get('uploadId'));
  const key = readString(form.get('key'));
  const partNumber = readPositiveInteger(form.get('partNumber'));
  const chunk = form.get('chunk');

  if (!isValidUploadId(uploadId) || !isValidFinalUploadKey({ key, userId })) {
    return uploadJsonError('INVALID_UPLOAD_KEY', 400);
  }

  if (!partNumber || partNumber > 10_000) {
    return uploadJsonError('INVALID_PART_NUMBER', 400);
  }

  if (!(chunk instanceof Blob)) {
    return uploadJsonError('FILE_REQUIRED', 400);
  }

  if (chunk.size <= 0) {
    return uploadJsonError('EMPTY_FILE', 400);
  }

  if (chunk.size > VIDEO_MULTIPART_CHUNK_BYTES) {
    return uploadJsonError('FILE_TOO_LARGE', 413);
  }

  const buffer = Buffer.from(await chunk.arrayBuffer());
  if (!buffer.length) {
    return uploadJsonError('EMPTY_FILE', 400);
  }

  try {
    const upload = await uploadFileBuffer({
      data: buffer,
      mime: 'application/octet-stream',
      fileName: `part-${partNumber}.bin`,
      userId,
      prefix: multipartTempPrefix(uploadId),
      cacheControl: 'private, max-age=3600',
      acl: null,
    });

    return NextResponse.json({
      ok: true,
      part: {
        partNumber,
        etag: upload.key,
        key: upload.key,
        size: buffer.length,
      },
    });
  } catch (error) {
    console.error('[upload] failed to store video chunk', {
      uploadId,
      key,
      partNumber,
      size: buffer.length,
      userId,
      error,
    });
    return uploadJsonError('UPLOAD_FAILED', 500);
  }
}
