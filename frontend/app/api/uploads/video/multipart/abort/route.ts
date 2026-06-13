import { NextRequest, NextResponse } from 'next/server';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { deleteStorageObjectKey } from '@/server/storage';
import {
  isValidPartUploadKey,
  isValidUploadId,
  readString,
  readUploadedVideoParts,
  type UploadedVideoPart,
  uploadJsonError,
} from '../_lib';

export const runtime = 'nodejs';

type AbortMultipartVideoUploadPayload = {
  uploadId?: unknown;
  parts?: unknown;
};

async function cleanupParts(parts: UploadedVideoPart[]) {
  const results = await Promise.allSettled(parts.map((part) => deleteStorageObjectKey(part.key)));
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.warn('[upload] failed to abort temporary video chunk', {
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

  const payload = (await req.json().catch(() => null)) as AbortMultipartVideoUploadPayload | null;
  const uploadId = readString(payload?.uploadId);
  if (!isValidUploadId(uploadId)) {
    return uploadJsonError('INVALID_UPLOAD_KEY', 400);
  }

  const parts = readUploadedVideoParts(payload?.parts) ?? [];
  const safeParts = parts.filter((part) => isValidPartUploadKey({ key: part.key, uploadId, userId }));
  await cleanupParts(safeParts);

  return NextResponse.json({ ok: true });
}
