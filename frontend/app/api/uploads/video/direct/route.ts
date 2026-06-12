import { NextRequest, NextResponse } from 'next/server';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { createSignedUploadUrl } from '@/server/storage';
import {
  getMaxVideoUploadMB,
  isSupportedVideoMime,
  videoUploadLimitBytes,
} from '../_lib/video-upload-limits';

export const runtime = 'nodejs';

type DirectVideoUploadPayload = {
  fileName?: unknown;
  mime?: unknown;
  size?: unknown;
};

function readFileName(value: unknown): string {
  const fileName = typeof value === 'string' ? value.trim() : '';
  return fileName || 'video-upload.mp4';
}

function readMime(value: unknown): string {
  const mime = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return mime || 'application/octet-stream';
}

function readSize(value: unknown): number {
  const size = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : 0;
  return Number.isFinite(size) ? size : 0;
}

export async function POST(req: NextRequest) {
  const { userId } = await getRouteAuthContext(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const payload = (await req.json().catch(() => null)) as DirectVideoUploadPayload | null;
  const fileName = readFileName(payload?.fileName);
  const mime = readMime(payload?.mime);
  const size = readSize(payload?.size);

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

  try {
    const signedUpload = await createSignedUploadUrl({
      mime,
      fileName,
      userId,
      prefix: 'user-assets',
      expiresInSeconds: 600,
    });

    return NextResponse.json({
      ok: true,
      upload: {
        uploadUrl: signedUpload.url,
        key: signedUpload.key,
        url: signedUpload.publicUrl,
        headers: signedUpload.headers,
      },
    });
  } catch (error) {
    console.error('[upload] failed to create direct video upload', {
      fileName,
      mime,
      size,
      userId,
      error,
    });
    return NextResponse.json({ ok: false, error: 'UPLOAD_FAILED' }, { status: 500 });
  }
}
