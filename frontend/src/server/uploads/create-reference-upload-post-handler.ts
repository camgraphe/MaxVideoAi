import { NextRequest, NextResponse } from 'next/server';

import { withDbTransaction, type TransactionQueryExecutor } from '@/lib/db';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { AgentApiError } from '@/server/agent-api/errors';
import { REFERENCE_UPLOAD_ACCEPTED_MIME_TYPES } from '@/server/agent-api/create-reference-upload-link';
import {
  claimUploadSessionForUpload,
  completeUploadSession,
  releaseUploadSessionClaim,
  type ReferenceUploadSession,
} from '@/server/agent-api/reference-upload-sessions';
import { isSameOriginConsentRequest } from '@/server/mcp/oauth-consent';
import {
  ImageUploadError,
  MAX_IMAGE_UPLOAD_BYTES,
  storeImageUpload,
} from '@/server/uploads/store-image-upload';

type RouteContext = { params: Promise<{ token: string }> };

type ReferenceUploadPostDependencies = {
  isEnabled(request: NextRequest): boolean;
  isSameOriginRequest(request: NextRequest): boolean;
  getRouteAuthContext: typeof getRouteAuthContext;
  withTransaction<TResult>(
    callback: (executor: TransactionQueryExecutor) => Promise<TResult>,
  ): Promise<TResult>;
  claimUploadSessionForUpload: typeof claimUploadSessionForUpload;
  storeImageUpload: typeof storeImageUpload;
  completeUploadSession: typeof completeUploadSession;
  releaseUploadSessionClaim: typeof releaseUploadSessionClaim;
  now(): Date;
};

type ReferenceUploadLimits = { maxBytes: number };

const ACCEPTED_MIME_TYPES = new Set<string>(REFERENCE_UPLOAD_ACCEPTED_MIME_TYPES);
const defaultDependencies: ReferenceUploadPostDependencies = {
  isEnabled: () => false,
  isSameOriginRequest: isSameOriginConsentRequest,
  getRouteAuthContext,
  withTransaction: (callback) => withDbTransaction((executor) => callback(executor)),
  claimUploadSessionForUpload,
  storeImageUpload,
  completeUploadSession,
  releaseUploadSessionClaim,
  now: () => new Date(),
};
const defaultLimits: ReferenceUploadLimits = { maxBytes: MAX_IMAGE_UPLOAD_BYTES };

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
  if (error instanceof ImageUploadError) {
    if (error.code === 'FILE_TOO_LARGE') return json({ ok: false, error: error.code }, 413);
    if (error.code === 'UNSUPPORTED_TYPE') return json({ ok: false, error: error.code }, 415);
    if (error.code === 'EMPTY_FILE') return json({ ok: false, error: error.code }, 400);
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
  const limits = { ...defaultLimits, ...limitOverrides };

  return async function referenceUploadPost(
    request: NextRequest,
    context: RouteContext,
  ): Promise<NextResponse> {
    if (!dependencies.isEnabled(request)) return json({ ok: false, error: 'NOT_FOUND' }, 404);
    if (!dependencies.isSameOriginRequest(request)) return json({ ok: false, error: 'FORBIDDEN' }, 403);

    const { userId } = await dependencies.getRouteAuthContext(request);
    if (!userId) return json({ ok: false, error: 'AUTH_REQUIRED' }, 401);
    if (exceedsContentLength(request, limits.maxBytes)) {
      return json({ ok: false, error: 'FILE_TOO_LARGE', maxBytes: limits.maxBytes }, 413);
    }

    const { token } = await context.params;
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return json({ ok: false, error: 'FILE_REQUIRED' }, 400);
    if (file.size < 1) return json({ ok: false, error: 'EMPTY_FILE' }, 400);
    if (file.size > limits.maxBytes) {
      return json({ ok: false, error: 'FILE_TOO_LARGE', maxBytes: limits.maxBytes }, 413);
    }
    const declaredMime = file.type.trim().toLowerCase();
    if (!ACCEPTED_MIME_TYPES.has(declaredMime)) {
      return json({ ok: false, error: 'UNSUPPORTED_TYPE' }, 415);
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.length > limits.maxBytes) {
      return json({ ok: false, error: 'FILE_TOO_LARGE', maxBytes: limits.maxBytes }, 413);
    }

    let claimed: ReferenceUploadSession | null = null;
    try {
      claimed = await dependencies.withTransaction((executor) =>
        dependencies.claimUploadSessionForUpload(
          { token, userId },
          { executor, randomUUID: crypto.randomUUID },
        ));
      const stored = await dependencies.storeImageUpload({
        userId,
        fileName: file.name,
        declaredMime,
        bytes,
      });
      const completedAt = dependencies.now();
      await dependencies.withTransaction((executor) =>
        dependencies.completeUploadSession(
          {
            sessionId: claimed!.sessionId,
            userId,
            claimId: claimed!.claimId!,
            assetId: stored.assetId,
          },
          { executor, uploadedAt: completedAt },
        ));
      return json({ ok: true, assetId: stored.assetId }, 200);
    } catch (error) {
      if (claimed?.claimId && error instanceof ImageUploadError) {
        const releasedAt = dependencies.now();
        await dependencies.withTransaction((executor) =>
          dependencies.releaseUploadSessionClaim(
            { sessionId: claimed!.sessionId, userId, claimId: claimed!.claimId! },
            { executor, releasedAt },
          )).catch(() => undefined);
      }
      return errorResponse(error);
    }
  };
}
