import { NextRequest, NextResponse } from 'next/server';

import { withDbTransaction, type TransactionQueryExecutor } from '@/lib/db';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { ensureReusableAsset } from '@/server/media-library';
import { AgentApiError } from '@/server/agent-api/errors';
import { getReferenceUploadPolicy } from '@/server/agent-api/create-reference-upload-link';
import {
  claimUploadSessionForUpload,
  completeUploadSession,
  releaseUploadSessionClaim,
  type ReferenceUploadSession,
} from '@/server/agent-api/reference-upload-sessions';
import { isSameOriginConsentRequest } from '@/server/mcp/oauth-consent';
import {
  ImageUploadError,
  loadStoredImageUploadRouteAsset,
  storeImageUpload,
} from '@/server/uploads/store-image-upload';
import {
  MediaUploadError,
  storeAudioUpload,
  storeVideoUpload,
} from '@/server/uploads/store-media-upload';

type RouteContext = { params: Promise<{ token: string }> };

async function resolveStoredImageReferenceAsset(input: {
  userId: string;
  assetId: string;
}): Promise<{ assetId: string }> {
  const stored = await loadStoredImageUploadRouteAsset(input);
  const canonical = await ensureReusableAsset({
    userId: input.userId,
    url: stored.url,
    kind: 'image',
    source: 'upload',
    mimeType: stored.mimeType,
    width: stored.width,
    height: stored.height,
    sizeBytes: stored.sizeBytes,
    thumbUrl: stored.thumbUrl,
  });
  if (!canonical.publicId || !/^ma_[a-f0-9]{32}$/u.test(canonical.publicId)) {
    throw new Error('Canonical image has no public alias.');
  }
  return { assetId: canonical.publicId };
}

type ReferenceUploadPostDependencies = {
  isEnabled(request: NextRequest): boolean;
  isSameOriginRequest(request: NextRequest): boolean;
  getRouteAuthContext: typeof getRouteAuthContext;
  withTransaction<TResult>(
    callback: (executor: TransactionQueryExecutor) => Promise<TResult>,
  ): Promise<TResult>;
  claimUploadSessionForUpload: typeof claimUploadSessionForUpload;
  storeImageUpload: typeof storeImageUpload;
  resolveStoredImageReferenceAsset: typeof resolveStoredImageReferenceAsset;
  storeVideoUpload: typeof storeVideoUpload;
  storeAudioUpload: typeof storeAudioUpload;
  completeUploadSession: typeof completeUploadSession;
  releaseUploadSessionClaim: typeof releaseUploadSessionClaim;
  now(): Date;
};

type ReferenceUploadLimits = { maxBytes: number };

const defaultDependencies: ReferenceUploadPostDependencies = {
  isEnabled: () => false,
  isSameOriginRequest: isSameOriginConsentRequest,
  getRouteAuthContext,
  withTransaction: (callback) => withDbTransaction((executor) => callback(executor)),
  claimUploadSessionForUpload,
  storeImageUpload,
  resolveStoredImageReferenceAsset,
  storeVideoUpload,
  storeAudioUpload,
  completeUploadSession,
  releaseUploadSessionClaim,
  now: () => new Date(),
};

function privateHeaders(): HeadersInit {
  return {
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': 'noindex, nofollow',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  };
}

function json(body: Record<string, unknown>, status: number): NextResponse {
  return NextResponse.json(body, { status, headers: privateHeaders() });
}

function errorResponse(error: unknown): NextResponse {
  if (error instanceof AgentApiError) {
    if (error.code === 'REFERENCE_NOT_FOUND') return json({ ok: false, error: error.code }, 404);
    if (error.code === 'UPLOAD_EXPIRED') return json({ ok: false, error: error.code }, 410);
    if (error.code === 'UPLOAD_ALREADY_USED') return json({ ok: false, error: error.code }, 409);
    if (error.code === 'AUTH_REQUIRED') return json({ ok: false, error: error.code }, 401);
    return json({ ok: false, error: 'REFERENCE_INVALID' }, 400);
  }
  if (error instanceof ImageUploadError || error instanceof MediaUploadError) {
    if (error.code === 'FILE_TOO_LARGE') return json({ ok: false, error: error.code }, 413);
    if (error.code === 'UNSUPPORTED_TYPE') return json({ ok: false, error: error.code }, 415);
    if (error.code === 'EMPTY_FILE') return json({ ok: false, error: error.code }, 400);
    if (error instanceof MediaUploadError && error.code === 'METADATA_UNVERIFIED') {
      return json({ ok: false, error: 'REFERENCE_INVALID' }, 422);
    }
    return json({ ok: false, error: error.code }, 500);
  }
  return json({ ok: false, error: 'STORE_FAILED' }, 500);
}

function exceedsContentLength(request: NextRequest, maxBytes: number): boolean {
  const raw = request.headers.get('content-length');
  if (!raw) return false;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 && value > maxBytes;
}

export function createReferenceUploadPostHandler(
  overrides: Partial<ReferenceUploadPostDependencies> = {},
  limitOverrides: Partial<ReferenceUploadLimits> = {},
): (request: NextRequest, context: RouteContext) => Promise<NextResponse> {
  const dependencies = { ...defaultDependencies, ...overrides };

  return async function referenceUploadPost(
    request: NextRequest,
    context: RouteContext,
  ): Promise<NextResponse> {
    if (!dependencies.isEnabled(request)) return json({ ok: false, error: 'NOT_FOUND' }, 404);
    if (!dependencies.isSameOriginRequest(request)) return json({ ok: false, error: 'FORBIDDEN' }, 403);

    const { userId } = await dependencies.getRouteAuthContext(request);
    if (!userId) return json({ ok: false, error: 'AUTH_REQUIRED' }, 401);

    const { token } = await context.params;
    let claimed: ReferenceUploadSession | null = null;
    let storedAssetId: string | null = null;
    const releaseClaim = async (): Promise<void> => {
      if (!claimed?.claimId) return;
      const releasedAt = dependencies.now();
      await dependencies.withTransaction((executor) =>
        dependencies.releaseUploadSessionClaim(
          { sessionId: claimed!.sessionId, userId, claimId: claimed!.claimId! },
          { executor, releasedAt },
        )).catch(() => undefined);
    };

    try {
      claimed = await dependencies.withTransaction((executor) =>
        dependencies.claimUploadSessionForUpload(
          { token, userId },
          { executor, randomUUID: crypto.randomUUID },
        ));
      const policy = getReferenceUploadPolicy(claimed.mediaKind);
      const maxBytes = limitOverrides.maxBytes === undefined
        ? policy.maxBytes
        : Math.min(policy.maxBytes, limitOverrides.maxBytes);
      if (exceedsContentLength(request, maxBytes)) {
        await releaseClaim();
        return json({ ok: false, error: 'FILE_TOO_LARGE', maxBytes }, 413);
      }

      const form = await request.formData();
      const file = form.get('file');
      if (!(file instanceof File)) {
        await releaseClaim();
        return json({ ok: false, error: 'FILE_REQUIRED' }, 400);
      }
      if (file.size < 1) {
        await releaseClaim();
        return json({ ok: false, error: 'EMPTY_FILE' }, 400);
      }
      if (file.size > maxBytes) {
        await releaseClaim();
        return json({ ok: false, error: 'FILE_TOO_LARGE', maxBytes }, 413);
      }
      const declaredMime = file.type.trim().toLowerCase();
      if (!policy.accepted.includes(declaredMime)) {
        await releaseClaim();
        return json({ ok: false, error: 'REFERENCE_INVALID' }, 400);
      }
      const bytes = Buffer.from(await file.arrayBuffer());
      if (bytes.length > maxBytes) {
        await releaseClaim();
        return json({ ok: false, error: 'FILE_TOO_LARGE', maxBytes }, 413);
      }

      let assetId: string;
      if (claimed.mediaKind === 'image') {
        const stored = await dependencies.storeImageUpload({
          userId,
          fileName: file.name,
          declaredMime,
          bytes,
        });
        assetId = (await dependencies.resolveStoredImageReferenceAsset({
          userId,
          assetId: stored.assetId,
        })).assetId;
      } else if (claimed.mediaKind === 'video') {
        assetId = (await dependencies.storeVideoUpload({
          userId,
          fileName: file.name,
          declaredMime,
          bytes,
          referenceEligibility: 'mcp',
        })).assetId;
      } else {
        assetId = (await dependencies.storeAudioUpload({
          userId,
          fileName: file.name,
          declaredMime,
          bytes,
          referenceEligibility: 'mcp',
        })).assetId;
      }
      storedAssetId = assetId;

      const completedAt = dependencies.now();
      await dependencies.withTransaction((executor) =>
        dependencies.completeUploadSession(
          {
            sessionId: claimed!.sessionId,
            userId,
            claimId: claimed!.claimId!,
            mediaKind: claimed!.mediaKind,
            assetId,
          },
          { executor, uploadedAt: completedAt },
        ));
      return json({ ok: true, assetId, mediaKind: claimed.mediaKind }, 200);
    } catch (error) {
      if (claimed?.claimId && storedAssetId === null) {
        await releaseClaim();
      }
      return errorResponse(error);
    }
  };
}
