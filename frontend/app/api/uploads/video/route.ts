import { NextRequest, NextResponse } from 'next/server';

import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { MediaUploadError, storeVideoUpload } from '@/server/uploads/store-media-upload';

import {
  getMaxVideoUploadMB,
  isSupportedVideoMime,
  videoUploadLimitBytes,
} from './_lib/video-upload-limits';

export const runtime = 'nodejs';

function exceedsContentLength(request: NextRequest, maxBytes: number): boolean {
  const raw = request.headers.get('content-length');
  if (!raw) return false;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 && value > maxBytes;
}

function uploadErrorResponse(error: unknown): NextResponse {
  if (!(error instanceof MediaUploadError)) {
    return NextResponse.json({ ok: false, error: 'STORE_FAILED' }, { status: 500 });
  }
  if (error.code === 'EMPTY_FILE') {
    return NextResponse.json({ ok: false, error: 'EMPTY_FILE' }, { status: 400 });
  }
  if (error.code === 'UNSUPPORTED_TYPE') {
    return NextResponse.json({ ok: false, error: 'UNSUPPORTED_TYPE' }, { status: 415 });
  }
  if (error.code === 'METADATA_UNVERIFIED') {
    return NextResponse.json({ ok: false, error: 'METADATA_UNVERIFIED' }, { status: 422 });
  }
  if (error.code === 'UPLOAD_FAILED') {
    return NextResponse.json({ ok: false, error: 'UPLOAD_FAILED' }, { status: 500 });
  }
  return NextResponse.json({ ok: false, error: 'STORE_FAILED' }, { status: 500 });
}

export async function POST(req: NextRequest) {
  const { userId } = await getRouteAuthContext(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const maxVideoMB = getMaxVideoUploadMB();
  const maxBytes = videoUploadLimitBytes(maxVideoMB);
  if (exceedsContentLength(req, maxBytes)) {
    return NextResponse.json(
      { ok: false, error: 'FILE_TOO_LARGE', maxMB: maxVideoMB },
      { status: 413 },
    );
  }

  const form = await req.formData();
  const blob = form.get('file');
  if (!(blob instanceof File)) {
    return NextResponse.json({ ok: false, error: 'FILE_REQUIRED' }, { status: 400 });
  }

  const mime = blob.type.trim().toLowerCase() || 'application/octet-stream';
  if (!isSupportedVideoMime(mime)) {
    return NextResponse.json({ ok: false, error: 'UNSUPPORTED_TYPE' }, { status: 415 });
  }
  if (blob.size > maxBytes) {
    return NextResponse.json(
      { ok: false, error: 'FILE_TOO_LARGE', maxMB: maxVideoMB },
      { status: 413 },
    );
  }

  const bytes = Buffer.from(await blob.arrayBuffer());
  try {
    const stored = await storeVideoUpload({
      userId,
      fileName: blob.name,
      declaredMime: mime,
      bytes,
    });
    return NextResponse.json({
      ok: true,
      asset: {
        id: stored.legacyAssetId,
        url: stored.storageUrl,
        width: stored.width,
        height: stored.height,
        size: stored.sizeBytes,
        mime: stored.mimeType,
        name: blob.name,
        thumbUrl: stored.previewUrl,
      },
    });
  } catch (error) {
    return uploadErrorResponse(error);
  }
}
