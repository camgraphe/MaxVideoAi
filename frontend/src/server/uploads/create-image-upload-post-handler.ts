import { NextRequest, NextResponse } from 'next/server';

import { getRouteAuthContext } from '@/lib/supabase-ssr';
import {
  ImageUploadError,
  loadStoredImageUploadRouteAsset,
  logImageUploadEvent,
  MAX_IMAGE_UPLOAD_BYTES,
  MAX_IMAGE_UPLOAD_MB,
  storeImageUpload,
} from '@/server/uploads/store-image-upload';

type ImageUploadRouteDependencies = {
  getRouteAuthContext: typeof getRouteAuthContext;
  storeImageUpload: typeof storeImageUpload;
  loadStoredImageUploadRouteAsset: typeof loadStoredImageUploadRouteAsset;
};

type ImageUploadRouteLimits = {
  maxBytes: number;
  maxMB: number;
};

const defaultDependencies: ImageUploadRouteDependencies = {
  getRouteAuthContext,
  storeImageUpload,
  loadStoredImageUploadRouteAsset,
};

const defaultLimits: ImageUploadRouteLimits = {
  maxBytes: MAX_IMAGE_UPLOAD_BYTES,
  maxMB: MAX_IMAGE_UPLOAD_MB,
};

function errorResponse(error: unknown, maxMB: number): NextResponse {
  if (!(error instanceof ImageUploadError)) {
    logImageUploadEvent('error', 'IMAGE_UPLOAD_UNEXPECTED_FAILURE');
    return NextResponse.json({ ok: false, error: 'STORE_FAILED' }, { status: 500 });
  }
  if (error.code === 'EMPTY_FILE') {
    return NextResponse.json({ ok: false, error: 'EMPTY_FILE' }, { status: 400 });
  }
  if (error.code === 'FILE_TOO_LARGE') {
    return NextResponse.json({ ok: false, error: 'FILE_TOO_LARGE', maxMB }, { status: 413 });
  }
  if (error.code === 'UNSUPPORTED_TYPE') {
    return NextResponse.json({ ok: false, error: 'UNSUPPORTED_TYPE' }, { status: 415 });
  }
  if (error.code === 'UPLOAD_FAILED') {
    return NextResponse.json({ ok: false, error: 'UPLOAD_FAILED' }, { status: 500 });
  }
  return NextResponse.json({ ok: false, error: 'STORE_FAILED' }, { status: 500 });
}

function exceedsContentLength(req: NextRequest, maxBytes: number): boolean {
  const rawContentLength = req.headers.get('content-length');
  if (!rawContentLength) return false;
  const contentLength = Number(rawContentLength);
  return Number.isFinite(contentLength) && contentLength >= 0 && contentLength > maxBytes;
}

export function createImageUploadPostHandler(
  overrides: Partial<ImageUploadRouteDependencies> = {},
  limitOverrides: Partial<ImageUploadRouteLimits> = {}
): (req: NextRequest) => Promise<NextResponse> {
  const dependencies = { ...defaultDependencies, ...overrides };
  const limits = { ...defaultLimits, ...limitOverrides };

  return async function imageUploadPost(req: NextRequest): Promise<NextResponse> {
    const authContext = await dependencies.getRouteAuthContext(req).catch(() => null);
    const userId = authContext?.userId ?? null;
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }

    if (exceedsContentLength(req, limits.maxBytes)) {
      return NextResponse.json(
        { ok: false, error: 'FILE_TOO_LARGE', maxMB: limits.maxMB },
        { status: 413 }
      );
    }

    const form = await req.formData().catch(() => null);
    if (!form) {
      return NextResponse.json({ ok: false, error: 'INVALID_MULTIPART' }, { status: 400 });
    }
    const blob = form.get('file');
    if (!(blob instanceof File)) {
      return NextResponse.json({ ok: false, error: 'FILE_REQUIRED' }, { status: 400 });
    }
    if (blob.size > limits.maxBytes) {
      return NextResponse.json(
        { ok: false, error: 'FILE_TOO_LARGE', maxMB: limits.maxMB },
        { status: 413 }
      );
    }

    const bytes = Buffer.from(await blob.arrayBuffer());
    try {
      const stored = await dependencies.storeImageUpload({
        userId,
        fileName: blob.name,
        declaredMime: blob.type?.trim().toLowerCase() || null,
        bytes,
      });
      const routeAsset = await dependencies.loadStoredImageUploadRouteAsset({
        userId,
        assetId: stored.assetId,
      });
      return NextResponse.json({
        ok: true,
        asset: {
          id: routeAsset.assetId,
          url: routeAsset.url,
          width: routeAsset.width,
          height: routeAsset.height,
          size: routeAsset.sizeBytes,
          mime: routeAsset.mimeType,
          name: blob.name,
          thumbUrl: routeAsset.thumbUrl,
        },
      });
    } catch (error) {
      return errorResponse(error, limits.maxMB);
    }
  };
}
