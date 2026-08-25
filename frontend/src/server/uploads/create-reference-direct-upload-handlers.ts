import { createHash, randomUUID } from 'node:crypto';

import { NextRequest, NextResponse } from 'next/server';

import { withDbTransaction, type TransactionQueryExecutor } from '@/lib/db';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { ensureReusableAsset } from '@/server/media-library';
import { AgentApiError } from '@/server/agent-api/errors';
import { getReferenceUploadPolicy } from '@/server/agent-api/create-reference-upload-link';
import {
  contentSha256,
  createReferenceUploadAttempt,
  discardReferenceUploadAttempt,
  getOwnedReferenceUploadAttempt,
  stageReferenceUploadAttempt,
} from '@/server/agent-api/reference-upload-attempts';
import {
  claimUploadSessionForUpload,
  completeUploadSession,
  getOwnedUploadSession,
} from '@/server/agent-api/reference-upload-sessions';
import { isSameOriginConsentRequest } from '@/server/mcp/oauth-consent';
import {
  createSignedUploadUrl,
  deleteStorageObjectKey,
  getStorageObjectBuffer,
  getStorageObjectMetadata,
} from '@/server/storage';
import {
  ImageUploadError,
  loadStoredImageUploadRouteAsset,
  storeImageUpload,
} from '@/server/uploads/store-image-upload';
import { MediaUploadError, storeAudioUpload, storeVideoUpload } from '@/server/uploads/store-media-upload';

type RouteContext = { params: Promise<{ token: string }> };
const REQUEST_METADATA_LIMIT_BYTES = 16 * 1024;
const SIGNED_UPLOAD_TTL_SECONDS = 5 * 60;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function headers(): HeadersInit {
  return { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow', 'X-Content-Type-Options': 'nosniff' };
}
function json(body: Record<string, unknown>, status: number): NextResponse {
  return NextResponse.json(body, { status, headers: headers() });
}
function requestTooLarge(request: NextRequest): boolean {
  const value = Number(request.headers.get('content-length'));
  return Number.isFinite(value) && value > REQUEST_METADATA_LIMIT_BYTES;
}
function safeError(error: unknown): NextResponse {
  if (error instanceof AgentApiError) {
    if (error.code === 'REFERENCE_NOT_FOUND') return json({ ok: false, error: error.code }, 404);
    if (error.code === 'UPLOAD_EXPIRED') return json({ ok: false, error: error.code }, 410);
    if (error.code === 'UPLOAD_ALREADY_USED') return json({ ok: false, error: error.code }, 409);
  }
  return json({ ok: false, error: 'STORE_FAILED' }, 500);
}

type CommonDependencies = {
  isEnabled(request: NextRequest): boolean;
  isSameOriginRequest(request: NextRequest): boolean;
  getRouteAuthContext: typeof getRouteAuthContext;
  withTransaction<T>(callback: (executor: TransactionQueryExecutor) => Promise<T>): Promise<T>;
};

const commonDefaults: CommonDependencies = {
  isEnabled: () => false,
  isSameOriginRequest: isSameOriginConsentRequest,
  getRouteAuthContext,
  withTransaction: (callback) => withDbTransaction(callback),
};

export function createReferenceUploadStartHandler(overrides: Partial<CommonDependencies & {
  getOwnedUploadSession: typeof getOwnedUploadSession;
  createSignedUploadUrl: typeof createSignedUploadUrl;
  claimUploadSessionForUpload: typeof claimUploadSessionForUpload;
  createReferenceUploadAttempt: typeof createReferenceUploadAttempt;
}> = {}) {
  const dependencies = {
    ...commonDefaults, getOwnedUploadSession, createSignedUploadUrl,
    claimUploadSessionForUpload, createReferenceUploadAttempt, ...overrides,
  };
  return async (request: NextRequest, context: RouteContext): Promise<NextResponse> => {
    if (!dependencies.isEnabled(request)) return json({ ok: false, error: 'NOT_FOUND' }, 404);
    if (!dependencies.isSameOriginRequest(request)) return json({ ok: false, error: 'FORBIDDEN' }, 403);
    const { userId } = await dependencies.getRouteAuthContext(request);
    if (!userId) return json({ ok: false, error: 'AUTH_REQUIRED' }, 401);
    const { token } = await context.params;
    try {
      const owned = await dependencies.getOwnedUploadSession({ token, userId });
      if (!owned) throw new AgentApiError('REFERENCE_NOT_FOUND', 'Reference upload session not found.');
      if (owned.state !== 'created' || owned.claimId) throw new AgentApiError('UPLOAD_ALREADY_USED', 'Reference upload link has already been used.');
      if (requestTooLarge(request)) return json({ ok: false, error: 'REQUEST_TOO_LARGE' }, 413);
      const body = await request.json() as Record<string, unknown>;
      const fileName = typeof body.fileName === 'string' ? body.fileName.trim() : '';
      const declaredMime = typeof body.declaredMime === 'string' ? body.declaredMime.trim().toLowerCase() : '';
      const sizeBytes = body.sizeBytes;
      const policy = getReferenceUploadPolicy(owned.mediaKind);
      if (!fileName || fileName.length > 255 || !policy.accepted.includes(declaredMime as never)) {
        return json({ ok: false, error: 'REFERENCE_INVALID' }, 400);
      }
      if (typeof sizeBytes !== 'number' || !Number.isSafeInteger(sizeBytes) || sizeBytes < 1) {
        return json({ ok: false, error: 'REFERENCE_INVALID' }, 400);
      }
      if (sizeBytes > policy.maxBytes) return json({ ok: false, error: 'FILE_TOO_LARGE', maxBytes: policy.maxBytes }, 413);
      const signed = await dependencies.createSignedUploadUrl({
        userId: createHash('sha256').update(userId).digest('hex').slice(0, 32),
        fileName, mime: declaredMime, prefix: 'mcp-reference-staging',
        expiresInSeconds: SIGNED_UPLOAD_TTL_SECONDS, acl: null,
      });
      const uploadId = randomUUID();
      const attempt = await dependencies.withTransaction(async (executor) => {
        const claimed = await dependencies.claimUploadSessionForUpload(
          { token, userId }, { executor, randomUUID },
        );
        if (claimed.sessionId !== owned.sessionId || claimed.mediaKind !== owned.mediaKind) throw new Error('Reference upload session changed.');
        return dependencies.createReferenceUploadAttempt({
          session: claimed, uploadId, storageKey: signed.key, fileName, declaredMime,
          declaredSize: sizeBytes, mediaKind: claimed.mediaKind,
        }, { executor });
      });
      return json({ ok: true, uploadId: attempt.uploadId, uploadUrl: signed.url, headers: signed.headers, expiresInSeconds: SIGNED_UPLOAD_TTL_SECONDS }, 200);
    } catch (error) {
      return safeError(error);
    }
  };
}

export function createReferenceUploadCompleteHandler(overrides: Partial<CommonDependencies & {
  getOwnedReferenceUploadAttempt: typeof getOwnedReferenceUploadAttempt;
  getStorageObjectMetadata: typeof getStorageObjectMetadata;
  getStorageObjectBuffer: typeof getStorageObjectBuffer;
  storeImageUpload: typeof storeImageUpload;
  storeVideoUpload: typeof storeVideoUpload;
  storeAudioUpload: typeof storeAudioUpload;
  stageReferenceUploadAttempt: typeof stageReferenceUploadAttempt;
  completeUploadSession: typeof completeUploadSession;
  discardReferenceUploadAttempt: typeof discardReferenceUploadAttempt;
  deleteStorageObjectKey: typeof deleteStorageObjectKey;
  now(): Date;
}> = {}) {
  const dependencies = {
    ...commonDefaults, getOwnedReferenceUploadAttempt, getStorageObjectMetadata, getStorageObjectBuffer,
    storeImageUpload, storeVideoUpload, storeAudioUpload, stageReferenceUploadAttempt,
    completeUploadSession, discardReferenceUploadAttempt, deleteStorageObjectKey, now: () => new Date(), ...overrides,
  };
  return async (request: NextRequest, context: RouteContext): Promise<NextResponse> => {
    if (!dependencies.isEnabled(request)) return json({ ok: false, error: 'NOT_FOUND' }, 404);
    if (!dependencies.isSameOriginRequest(request)) return json({ ok: false, error: 'FORBIDDEN' }, 403);
    const { userId } = await dependencies.getRouteAuthContext(request);
    if (!userId) return json({ ok: false, error: 'AUTH_REQUIRED' }, 401);
    if (requestTooLarge(request)) return json({ ok: false, error: 'REQUEST_TOO_LARGE' }, 413);
    const { token } = await context.params;
    let attempt: Awaited<ReturnType<typeof getOwnedReferenceUploadAttempt>> | null = null;
    const cleanupInvalid = async () => {
      if (!attempt?.session.claimId) return;
      const discarded = await dependencies.withTransaction((executor) => dependencies.discardReferenceUploadAttempt({
        sessionId: attempt!.session.sessionId, uploadId: attempt!.uploadId,
        userId, claimId: attempt!.session.claimId!,
      }, { executor, discardedAt: dependencies.now() })).catch(() => false);
      if (discarded) await dependencies.deleteStorageObjectKey(attempt.storageKey).catch(() => undefined);
    };
    try {
      const body = await request.json() as Record<string, unknown>;
      if (typeof body.uploadId !== 'string' || !UUID_PATTERN.test(body.uploadId)) return json({ ok: false, error: 'REFERENCE_INVALID' }, 400);
      attempt = await dependencies.getOwnedReferenceUploadAttempt({ token, userId, uploadId: body.uploadId });
      const session = attempt.session;
      if (!session.claimId) throw new AgentApiError('UPLOAD_ALREADY_USED', 'Reference upload link has already been used.');
      let assetId = attempt.stagedAssetId;
      if (!assetId) {
        const policy = getReferenceUploadPolicy(session.mediaKind);
        const metadata = await dependencies.getStorageObjectMetadata(attempt.storageKey);
        if (metadata.size !== attempt.declaredSize || metadata.size < 1 || metadata.size > policy.maxBytes) {
          await cleanupInvalid();
          return json({ ok: false, error: 'FILE_TOO_LARGE', maxBytes: policy.maxBytes }, 413);
        }
        if (metadata.mime?.split(';', 1)[0]?.trim().toLowerCase() !== attempt.declaredMime) {
          await cleanupInvalid();
          return json({ ok: false, error: 'REFERENCE_INVALID' }, 400);
        }
        const bytes = await dependencies.getStorageObjectBuffer(attempt.storageKey);
        if (bytes.length !== attempt.declaredSize || bytes.length > policy.maxBytes) {
          await cleanupInvalid();
          return json({ ok: false, error: 'FILE_TOO_LARGE', maxBytes: policy.maxBytes }, 413);
        }
        if (session.mediaKind === 'image') {
          const stored = await dependencies.storeImageUpload({ userId, fileName: attempt.fileName, declaredMime: attempt.declaredMime, bytes });
          const image = await loadStoredImageUploadRouteAsset({ userId, assetId: stored.assetId });
          const canonical = await ensureReusableAsset({
            userId, url: image.url, kind: 'image', source: 'upload', mimeType: image.mimeType,
            width: image.width, height: image.height, sizeBytes: image.sizeBytes, thumbUrl: image.thumbUrl,
          });
          if (!canonical.publicId || !/^ma_[a-f0-9]{32}$/u.test(canonical.publicId)) throw new Error('Canonical image has no public alias.');
          assetId = canonical.publicId;
        } else {
          const stored = session.mediaKind === 'video'
            ? await dependencies.storeVideoUpload({ userId, fileName: attempt.fileName, declaredMime: attempt.declaredMime, bytes, referenceEligibility: 'mcp' })
            : await dependencies.storeAudioUpload({ userId, fileName: attempt.fileName, declaredMime: attempt.declaredMime, bytes, referenceEligibility: 'mcp' });
          assetId = stored.assetId;
        }
        const digest = contentSha256(bytes);
        await dependencies.withTransaction((executor) => dependencies.stageReferenceUploadAttempt({
          sessionId: session.sessionId, uploadId: attempt!.uploadId, userId, claimId: session.claimId!,
          mediaKind: session.mediaKind, contentSha256: digest, assetId: assetId!,
        }, { executor, updatedAt: dependencies.now() }));
      }
      await dependencies.withTransaction((executor) => dependencies.completeUploadSession({
        sessionId: session.sessionId, userId, claimId: session.claimId!, mediaKind: session.mediaKind, assetId: assetId!,
      }, { executor, uploadedAt: dependencies.now() }));
      await dependencies.deleteStorageObjectKey(attempt.storageKey).catch(() => undefined);
      return json({ ok: true, assetId, mediaKind: session.mediaKind }, 200);
    } catch (error) {
      if (error instanceof ImageUploadError || error instanceof MediaUploadError) {
        if (error.code === 'EMPTY_FILE' || error.code === 'UNSUPPORTED_TYPE'
          || error.code === 'METADATA_UNVERIFIED' || error.code === 'FILE_TOO_LARGE') {
          await cleanupInvalid();
          if (error.code === 'FILE_TOO_LARGE') return json({ ok: false, error: error.code }, 413);
          if (error.code === 'UNSUPPORTED_TYPE') return json({ ok: false, error: error.code }, 415);
          if (error.code === 'METADATA_UNVERIFIED') return json({ ok: false, error: 'REFERENCE_INVALID' }, 422);
          return json({ ok: false, error: error.code }, 400);
        }
      }
      return safeError(error);
    }
  };
}
