import { createHash, randomUUID } from 'node:crypto';

import { NextRequest, NextResponse } from 'next/server';

import { withDbTransaction, type TransactionQueryExecutor } from '@/lib/db';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { ensureReusableAsset } from '@/server/media-library';
import { AgentApiError } from '@/server/agent-api/errors';
import { getReferenceUploadPolicy } from '@/server/agent-api/create-reference-upload-link';
import {
  abortReferenceUploadAttempt,
  acquireReferenceUploadCompletionLease,
  claimReferenceUploadPart,
  cleanupReferenceUploadParts,
  cleanupReferenceUploadObject,
  completeReferenceUploadAttempt,
  completeReferenceUploadPart,
  contentSha256,
  createReferenceUploadAttempt,
  failReferenceUploadAttempt,
  failReferenceUploadPart,
  getOwnedReferenceUploadAttempt,
  listReferenceUploadParts,
  renewReferenceUploadCompletionLease,
  registerReferenceUploadCleanupObject,
  retainReferenceUploadCleanupObject,
  stageReferenceUploadAttempt,
  type ReferenceUploadAttempt,
} from '@/server/agent-api/reference-upload-attempts';
import { claimUploadSessionForUpload, completeUploadSession, getOwnedUploadSession } from '@/server/agent-api/reference-upload-sessions';
import { isSameOriginConsentRequest } from '@/server/mcp/oauth-consent';
import { deleteStorageObjectKey, getStorageObjectBuffer, uploadFileBufferToKey } from '@/server/storage';
import { ImageUploadError, loadStoredImageUploadRouteAsset, storeImageUpload } from '@/server/uploads/store-image-upload';
import { MediaUploadError, storeAudioUpload, storeVideoUpload } from '@/server/uploads/store-media-upload';

type RouteContext = { params: Promise<{ token: string }> };
const REQUEST_METADATA_LIMIT_BYTES = 16 * 1024;
export const MCP_REFERENCE_UPLOAD_CHUNK_BYTES = 3_500_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SHA_PATTERN = /^[a-f0-9]{64}$/u;

function headers(): HeadersInit {
  return { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow', 'X-Content-Type-Options': 'nosniff' };
}
function json(body: Record<string, unknown>, status: number): NextResponse { return NextResponse.json(body, { status, headers: headers() }); }

class BoundedBodyError extends Error {}
class MalformedJsonError extends Error {}
class ReferenceValidationError extends Error {}

async function readBoundedBody(request: NextRequest, maximumBytes: number): Promise<Buffer> {
  const declared = request.headers.get('content-length');
  if (declared !== null && /^\d+$/u.test(declared) && Number(declared) > maximumBytes) throw new BoundedBodyError();
  if (!request.body) return Buffer.alloc(0);
  const reader = request.body.getReader();
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      size += result.value.byteLength;
      if (size > maximumBytes) throw new BoundedBodyError();
      chunks.push(Buffer.from(result.value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, size);
}

async function readBoundedJson(request: NextRequest): Promise<Record<string, unknown>> {
  const bytes = await readBoundedBody(request, REQUEST_METADATA_LIMIT_BYTES);
  try {
    const parsed = JSON.parse(bytes.toString('utf8')) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new MalformedJsonError();
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof MalformedJsonError) throw error;
    throw new MalformedJsonError();
  }
}

function safeError(error: unknown): NextResponse {
  if (error instanceof BoundedBodyError) return json({ ok: false, error: 'REQUEST_TOO_LARGE' }, 413);
  if (error instanceof MalformedJsonError) return json({ ok: false, error: 'REFERENCE_INVALID' }, 400);
  if (error instanceof AgentApiError) {
    if (error.code === 'REFERENCE_NOT_FOUND') return json({ ok: false, error: error.code }, 404);
    if (error.code === 'UPLOAD_EXPIRED') return json({ ok: false, error: error.code }, 410);
    if (error.code === 'UPLOAD_ALREADY_USED') return json({ ok: false, error: error.code }, 409);
    if (error.code === 'REFERENCE_INVALID') return json({ ok: false, error: error.code }, 400);
  }
  return json({ ok: false, error: 'STORE_FAILED' }, 500);
}

type CommonDependencies = {
  isEnabled(request: NextRequest): boolean;
  isSameOriginRequest(request: NextRequest): boolean;
  getRouteAuthContext: typeof getRouteAuthContext;
  withTransaction<T>(callback: (executor: TransactionQueryExecutor) => Promise<T>): Promise<T>;
  now(): Date;
};
const commonDefaults: CommonDependencies = {
  isEnabled: () => false, isSameOriginRequest: isSameOriginConsentRequest, getRouteAuthContext,
  withTransaction: (callback) => withDbTransaction(callback), now: () => new Date(),
};

async function authorize(request: NextRequest, dependencies: CommonDependencies): Promise<string | NextResponse> {
  if (!dependencies.isEnabled(request)) return json({ ok: false, error: 'NOT_FOUND' }, 404);
  if (!dependencies.isSameOriginRequest(request)) return json({ ok: false, error: 'FORBIDDEN' }, 403);
  const { userId } = await dependencies.getRouteAuthContext(request);
  return userId ?? json({ ok: false, error: 'AUTH_REQUIRED' }, 401);
}

export function createReferenceUploadStartHandler(overrides: Partial<CommonDependencies & {
  getOwnedUploadSession: typeof getOwnedUploadSession;
  claimUploadSessionForUpload: typeof claimUploadSessionForUpload;
  createReferenceUploadAttempt: typeof createReferenceUploadAttempt;
}> = {}) {
  const dependencies = { ...commonDefaults, getOwnedUploadSession, claimUploadSessionForUpload, createReferenceUploadAttempt, ...overrides };
  return async (request: NextRequest, context: RouteContext): Promise<NextResponse> => {
    const authorized = await authorize(request, dependencies);
    if (typeof authorized !== 'string') return authorized;
    const userId = authorized;
    const { token } = await context.params;
    try {
      const owned = await dependencies.getOwnedUploadSession({ token, userId });
      if (!owned) throw new AgentApiError('REFERENCE_NOT_FOUND', 'Reference upload session not found.');
      if (owned.state !== 'created' || owned.claimId) throw new AgentApiError('UPLOAD_ALREADY_USED', 'Reference upload link has already been used.');
      const body = await readBoundedJson(request);
      const fileName = typeof body.fileName === 'string' ? body.fileName.trim() : '';
      const declaredMime = typeof body.declaredMime === 'string' ? body.declaredMime.trim().toLowerCase() : '';
      const sizeBytes = body.sizeBytes;
      const fileSha256 = body.fileSha256;
      const policy = getReferenceUploadPolicy(owned.mediaKind);
      if (!fileName || fileName.length > 255 || !policy.accepted.includes(declaredMime as never)
        || typeof fileSha256 !== 'string' || !SHA_PATTERN.test(fileSha256)
        || typeof sizeBytes !== 'number' || !Number.isSafeInteger(sizeBytes) || sizeBytes < 1) {
        return json({ ok: false, error: 'REFERENCE_INVALID' }, 400);
      }
      if (sizeBytes > policy.maxBytes) return json({ ok: false, error: 'FILE_TOO_LARGE', maxBytes: policy.maxBytes }, 413);
      const uploadId = randomUUID();
      const attempt = await dependencies.withTransaction(async (executor) => {
        const claimed = await dependencies.claimUploadSessionForUpload({ token, userId }, { executor, randomUUID });
        if (claimed.sessionId !== owned.sessionId || claimed.mediaKind !== owned.mediaKind) throw new Error('Reference upload session changed.');
        const owner = createHash('sha256').update(userId).digest('hex').slice(0, 32);
        return dependencies.createReferenceUploadAttempt({
          session: claimed, uploadId, storageKey: `mcp-reference-staging/${owner}/${uploadId}`,
          fileName, declaredMime, declaredSize: sizeBytes, fileSha256,
          chunkBytes: MCP_REFERENCE_UPLOAD_CHUNK_BYTES,
          totalParts: Math.ceil(sizeBytes / MCP_REFERENCE_UPLOAD_CHUNK_BYTES), mediaKind: claimed.mediaKind,
        }, { executor });
      });
      return json({ ok: true, uploadId: attempt.uploadId, chunkBytes: MCP_REFERENCE_UPLOAD_CHUNK_BYTES, totalParts: Math.ceil(sizeBytes / MCP_REFERENCE_UPLOAD_CHUNK_BYTES) }, 200);
    } catch (error) { return safeError(error); }
  };
}

type PartDependencies = CommonDependencies & {
  getOwnedReferenceUploadAttempt: typeof getOwnedReferenceUploadAttempt;
  claimReferenceUploadPart: typeof claimReferenceUploadPart;
  completeReferenceUploadPart: typeof completeReferenceUploadPart;
  failReferenceUploadPart: typeof failReferenceUploadPart;
  abortReferenceUploadAttempt: typeof abortReferenceUploadAttempt;
  cleanupReferenceUploadParts: typeof cleanupReferenceUploadParts;
  cleanupReferenceUploadObject: typeof cleanupReferenceUploadObject;
  uploadFileBufferToKey: typeof uploadFileBufferToKey;
  deleteStorageObjectKey: typeof deleteStorageObjectKey;
};

async function abortAndCleanup(attempt: ReferenceUploadAttempt, dependencies: CommonDependencies & {
  abortReferenceUploadAttempt: typeof abortReferenceUploadAttempt;
  cleanupReferenceUploadParts: typeof cleanupReferenceUploadParts;
  deleteStorageObjectKey: typeof deleteStorageObjectKey;
}): Promise<void> {
  await dependencies.withTransaction((executor) => dependencies.abortReferenceUploadAttempt(
    { attempt }, { executor, abortedAt: dependencies.now() },
  ));
  await dependencies.cleanupReferenceUploadParts({ attempt }, { deleteStorageObjectKey: dependencies.deleteStorageObjectKey }).catch(() => undefined);
  if (attempt.protocolVersion === 1) {
    await dependencies.deleteStorageObjectKey(attempt.storageKey).catch(() => undefined);
  }
}

export function createReferenceUploadPartHandler(overrides: Partial<PartDependencies> = {}) {
  const dependencies: PartDependencies = {
    ...commonDefaults, getOwnedReferenceUploadAttempt, claimReferenceUploadPart, completeReferenceUploadPart, failReferenceUploadPart,
    abortReferenceUploadAttempt, cleanupReferenceUploadParts, cleanupReferenceUploadObject,
    uploadFileBufferToKey, deleteStorageObjectKey, ...overrides,
  };
  return async (request: NextRequest, context: RouteContext): Promise<NextResponse> => {
    const authorized = await authorize(request, dependencies);
    if (typeof authorized !== 'string') return authorized;
    const userId = authorized;
    const { token } = await context.params;
    try {
      const uploadId = request.headers.get('x-upload-id');
      const partNumber = Number(request.headers.get('x-part-number'));
      const declaredSha = request.headers.get('x-content-sha256');
      if (!uploadId || !UUID_PATTERN.test(uploadId) || !Number.isSafeInteger(partNumber)
        || partNumber < 1 || !declaredSha || !SHA_PATTERN.test(declaredSha)) return json({ ok: false, error: 'REFERENCE_INVALID' }, 400);
      const attempt = await dependencies.getOwnedReferenceUploadAttempt({ token, userId, uploadId });
      if (attempt.protocolVersion !== 2 || attempt.chunkBytes === null || attempt.totalParts === null) {
        await abortAndCleanup(attempt, dependencies);
        return json({ ok: false, error: 'UPLOAD_EXPIRED' }, 410);
      }
      if (attempt.session.expiresAt <= dependencies.now()) {
        await abortAndCleanup(attempt, dependencies);
        return json({ ok: false, error: 'UPLOAD_EXPIRED' }, 410);
      }
      if (attempt.state !== 'pending') throw new AgentApiError('UPLOAD_ALREADY_USED', 'Reference upload cannot accept parts.');
      if (partNumber > attempt.totalParts) return json({ ok: false, error: 'REFERENCE_INVALID' }, 400);
      const expectedSize = partNumber === attempt.totalParts
        ? attempt.declaredSize - attempt.chunkBytes * (attempt.totalParts - 1) : attempt.chunkBytes;
      const bytes = await readBoundedBody(request, expectedSize);
      if (bytes.length !== expectedSize) return json({ ok: false, error: 'REFERENCE_INVALID' }, 400);
      const actualSha = contentSha256(bytes);
      if (actualSha !== declaredSha) return json({ ok: false, error: 'REFERENCE_INVALID' }, 400);
      const claim = await dependencies.withTransaction((executor) => dependencies.claimReferenceUploadPart(
        { attempt, partNumber, contentSha256: actualSha, sizeBytes: bytes.length },
        { executor, now: dependencies.now() },
      ));
      if (!claim.alreadyStored) {
        try {
          await dependencies.uploadFileBufferToKey({ key: claim.storageKey, data: bytes, mime: 'application/octet-stream', acl: null });
          await dependencies.withTransaction((executor) => dependencies.completeReferenceUploadPart(
            { attempt, partNumber, leaseId: claim.leaseId, sizeBytes: bytes.length, contentSha256: actualSha },
            { executor, now: dependencies.now() },
          ));
        } catch (error) {
          await dependencies.withTransaction((executor) => dependencies.failReferenceUploadPart(
            { attempt, partNumber, leaseId: claim.leaseId }, { executor, failedAt: dependencies.now() },
          )).catch(() => undefined);
          await dependencies.cleanupReferenceUploadObject(
            { attempt, objectKey: claim.storageKey }, { deleteStorageObjectKey: dependencies.deleteStorageObjectKey },
          ).catch(() => false);
          throw error;
        }
      }
      return json({ ok: true, partNumber }, 200);
    } catch (error) { return safeError(error); }
  };
}

type CompletionDependencies = CommonDependencies & {
  getOwnedReferenceUploadAttempt: typeof getOwnedReferenceUploadAttempt;
  acquireReferenceUploadCompletionLease: typeof acquireReferenceUploadCompletionLease;
  listReferenceUploadParts: typeof listReferenceUploadParts;
  renewReferenceUploadCompletionLease: typeof renewReferenceUploadCompletionLease;
  getStorageObjectBuffer: typeof getStorageObjectBuffer;
  storeImageUpload: typeof storeImageUpload;
  storeVideoUpload: typeof storeVideoUpload;
  storeAudioUpload: typeof storeAudioUpload;
  stageReferenceUploadAttempt: typeof stageReferenceUploadAttempt;
  completeUploadSession: typeof completeUploadSession;
  completeReferenceUploadAttempt: typeof completeReferenceUploadAttempt;
  failReferenceUploadAttempt: typeof failReferenceUploadAttempt;
  cleanupReferenceUploadParts: typeof cleanupReferenceUploadParts;
  abortReferenceUploadAttempt: typeof abortReferenceUploadAttempt;
  deleteStorageObjectKey: typeof deleteStorageObjectKey;
  registerReferenceUploadCleanupObject: typeof registerReferenceUploadCleanupObject;
  retainReferenceUploadCleanupObject: typeof retainReferenceUploadCleanupObject;
};

export function createReferenceUploadCompleteHandler(overrides: Partial<CompletionDependencies> = {}) {
  const dependencies: CompletionDependencies = {
    ...commonDefaults, getOwnedReferenceUploadAttempt, acquireReferenceUploadCompletionLease,
    listReferenceUploadParts, renewReferenceUploadCompletionLease, getStorageObjectBuffer, storeImageUpload, storeVideoUpload, storeAudioUpload,
    stageReferenceUploadAttempt, completeUploadSession, completeReferenceUploadAttempt,
    failReferenceUploadAttempt, cleanupReferenceUploadParts, abortReferenceUploadAttempt, deleteStorageObjectKey,
    registerReferenceUploadCleanupObject, retainReferenceUploadCleanupObject, ...overrides,
  };
  return async (request: NextRequest, context: RouteContext): Promise<NextResponse> => {
    const authorized = await authorize(request, dependencies);
    if (typeof authorized !== 'string') return authorized;
    const userId = authorized;
    const { token } = await context.params;
    let leased: ReferenceUploadAttempt | null = null;
    try {
      const body = await readBoundedJson(request);
      if (typeof body.uploadId !== 'string' || !UUID_PATTERN.test(body.uploadId)) return json({ ok: false, error: 'REFERENCE_INVALID' }, 400);
      const initial = await dependencies.getOwnedReferenceUploadAttempt({ token, userId, uploadId: body.uploadId });
      if (initial.protocolVersion !== 2 || initial.fileSha256 === null
        || initial.chunkBytes === null || initial.totalParts === null) {
        await abortAndCleanup(initial, dependencies);
        return json({ ok: false, error: 'UPLOAD_EXPIRED' }, 410);
      }
      if (initial.session.expiresAt <= dependencies.now()) {
        await abortAndCleanup(initial, dependencies);
        return json({ ok: false, error: 'UPLOAD_EXPIRED' }, 410);
      }
      if (initial.state === 'completed' || initial.state === 'aborted') throw new AgentApiError('UPLOAD_ALREADY_USED', 'Reference upload has already been used.');
      leased = await dependencies.withTransaction((executor) => dependencies.acquireReferenceUploadCompletionLease(
        { attempt: initial }, { executor, now: dependencies.now() },
      ));
      if (!leased.leaseId) throw new Error('Reference upload lease was not persisted.');
      if (leased.fileSha256 === null || leased.chunkBytes === null || leased.totalParts === null) {
        throw new Error('Reference upload protocol identity was lost.');
      }
      const renewLease = async () => {
        if (!leased?.leaseId) throw new Error('Reference upload lease was not persisted.');
        leased = await dependencies.withTransaction((executor) => dependencies.renewReferenceUploadCompletionLease(
          { attempt: leased!, leaseId: leased!.leaseId!, version: leased!.version },
          { executor, now: dependencies.now() },
        ));
      };
      let assetId = leased.stagedAssetId;
      if (!assetId) {
        await renewLease();
        const parts = await dependencies.listReferenceUploadParts({ attempt: leased });
        if (parts.length !== leased.totalParts) throw new ReferenceValidationError();
        const buffers: Buffer[] = [];
        let totalSize = 0;
        for (let index = 0; index < parts.length; index += 1) {
          await renewLease();
          const part = parts[index];
          const expectedNumber = index + 1;
          const expectedSize = expectedNumber === leased.totalParts
            ? leased.declaredSize - leased.chunkBytes * (leased.totalParts - 1) : leased.chunkBytes;
          if (!part || part.partNumber !== expectedNumber || part.sizeBytes !== expectedSize) throw new ReferenceValidationError();
          const bytes = await dependencies.getStorageObjectBuffer(part.storageKey);
          if (bytes.length !== part.sizeBytes || contentSha256(bytes) !== part.contentSha256) throw new ReferenceValidationError();
          totalSize += bytes.length;
          buffers.push(bytes);
        }
        if (totalSize !== leased.declaredSize) throw new ReferenceValidationError();
        const bytes = Buffer.concat(buffers, totalSize);
        const digest = contentSha256(bytes);
        if (digest !== leased.fileSha256) throw new ReferenceValidationError();
        await renewLease();
        const cleanupObjects = {
          beforeUpload: (entry: { objectRole: 'final' | 'thumbnail'; objectKey: string; safeToDelete: boolean }) =>
            dependencies.withTransaction((executor) => dependencies.registerReferenceUploadCleanupObject(
              { attempt: leased!, ...entry }, { executor, now: dependencies.now() },
            )),
          retain: (objectKey: string) => dependencies.withTransaction((executor) =>
            dependencies.retainReferenceUploadCleanupObject(
              { attempt: leased!, objectKey }, { executor, now: dependencies.now() },
            )),
        };
        if (leased.session.mediaKind === 'image') {
          const stored = await dependencies.storeImageUpload({ userId, fileName: leased.fileName, declaredMime: leased.declaredMime, bytes, cleanupObjects });
          const image = await loadStoredImageUploadRouteAsset({ userId, assetId: stored.assetId });
          const canonical = await ensureReusableAsset({ userId, url: image.url, kind: 'image', source: 'upload', mimeType: image.mimeType,
            width: image.width, height: image.height, sizeBytes: image.sizeBytes, thumbUrl: image.thumbUrl });
          if (!canonical.publicId || !/^ma_[a-f0-9]{32}$/u.test(canonical.publicId)) throw new Error('Canonical image has no public alias.');
          assetId = canonical.publicId;
        } else {
          const stored = leased.session.mediaKind === 'video'
            ? await dependencies.storeVideoUpload({ userId, fileName: leased.fileName, declaredMime: leased.declaredMime, bytes, referenceEligibility: 'mcp', cleanupObjects })
            : await dependencies.storeAudioUpload({ userId, fileName: leased.fileName, declaredMime: leased.declaredMime, bytes, referenceEligibility: 'mcp', cleanupObjects });
          assetId = stored.assetId;
        }
        await renewLease();
        leased = await dependencies.withTransaction((executor) => dependencies.stageReferenceUploadAttempt(
          { attempt: leased!, leaseId: leased!.leaseId!, version: leased!.version, contentSha256: digest, assetId: assetId! },
          { executor, updatedAt: dependencies.now() },
        ));
      }
      await renewLease();
      await dependencies.withTransaction(async (executor) => {
        await dependencies.completeUploadSession({ sessionId: leased!.session.sessionId, userId,
          claimId: leased!.session.claimId!, mediaKind: leased!.session.mediaKind, assetId: assetId! },
        { executor, uploadedAt: dependencies.now() });
        await dependencies.completeReferenceUploadAttempt(
          { attempt: leased!, leaseId: leased!.leaseId!, version: leased!.version },
          { executor, completedAt: dependencies.now() },
        );
      });
      await dependencies.cleanupReferenceUploadParts({ attempt: leased }, { deleteStorageObjectKey: dependencies.deleteStorageObjectKey }).catch(() => undefined);
      return json({ ok: true, assetId, mediaKind: leased.session.mediaKind }, 200);
    } catch (error) {
      if (error instanceof ReferenceValidationError && leased) {
        await abortAndCleanup(leased, dependencies);
        return json({ ok: false, error: 'REFERENCE_INVALID' }, 400);
      }
      if (leased?.leaseId) await dependencies.withTransaction((executor) => dependencies.failReferenceUploadAttempt(
        { attempt: leased!, leaseId: leased!.leaseId!, version: leased!.version, failureCode: error instanceof Error ? error.name : 'STORE_FAILED' },
        { executor, failedAt: dependencies.now() },
      )).catch(() => undefined);
      if (error instanceof ImageUploadError || error instanceof MediaUploadError) {
        if (error.code === 'FILE_TOO_LARGE') return json({ ok: false, error: error.code }, 413);
        if (error.code === 'UNSUPPORTED_TYPE') return json({ ok: false, error: error.code }, 415);
        if (error.code === 'METADATA_UNVERIFIED') return json({ ok: false, error: 'REFERENCE_INVALID' }, 422);
        if (error.code === 'EMPTY_FILE') return json({ ok: false, error: error.code }, 400);
      }
      return safeError(error);
    }
  };
}

export function createReferenceUploadAbortHandler(overrides: Partial<PartDependencies> = {}) {
  const dependencies: PartDependencies = {
    ...commonDefaults, getOwnedReferenceUploadAttempt, claimReferenceUploadPart, completeReferenceUploadPart, failReferenceUploadPart,
    abortReferenceUploadAttempt, cleanupReferenceUploadParts, cleanupReferenceUploadObject,
    uploadFileBufferToKey, deleteStorageObjectKey, ...overrides,
  };
  return async (request: NextRequest, context: RouteContext): Promise<NextResponse> => {
    const authorized = await authorize(request, dependencies);
    if (typeof authorized !== 'string') return authorized;
    const userId = authorized;
    const { token } = await context.params;
    try {
      const body = await readBoundedJson(request);
      if (typeof body.uploadId !== 'string' || !UUID_PATTERN.test(body.uploadId)) return json({ ok: false, error: 'REFERENCE_INVALID' }, 400);
      const attempt = await dependencies.getOwnedReferenceUploadAttempt({ token, userId, uploadId: body.uploadId });
      await abortAndCleanup(attempt, dependencies);
      return json({ ok: true }, 200);
    } catch (error) { return safeError(error); }
  };
}
