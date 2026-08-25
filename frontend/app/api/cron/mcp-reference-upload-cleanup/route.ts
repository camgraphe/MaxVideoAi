import { NextRequest, NextResponse } from 'next/server';

import {
  cleanupExpiredReferenceUploadAttempts,
  countMcpReferenceUploadLiveState,
} from '@/server/agent-api/reference-upload-attempts';
import {
  deleteStorageObjectKey,
  MCP_REFERENCE_STAGING_STORAGE_PREFIX,
  purgeMcpReferenceStagingObjects,
} from '@/server/storage';
import { authorizeCronRequest } from '@/server/vercel-cron';

export const runtime = 'nodejs';

const STAGING_HOST = 'maxvideoai-mcp-staging.vercel.app';
const BATCH_LIMIT = 100;

type CleanupResult = { selected: number; deleted: number };
type CleanupDependencies = {
  env: Readonly<Record<string, string | undefined>>;
  cleanupExpiredReferenceUploadAttempts(input: { limit: number }): Promise<CleanupResult>;
  countMcpReferenceUploadLiveState(input: { limit: number }): Promise<{
    liveSessions: number;
    processingLeases: number;
    unfinishedParts: number;
  }>;
  purgeMcpReferenceStagingObjects(input: { limit: number }): Promise<CleanupResult>;
};

const defaultDependencies: CleanupDependencies = {
  env: process.env,
  cleanupExpiredReferenceUploadAttempts: (input) => cleanupExpiredReferenceUploadAttempts(
    input,
    { deleteStorageObjectKey },
  ),
  countMcpReferenceUploadLiveState,
  purgeMcpReferenceStagingObjects,
};

export function createMcpReferenceUploadCleanupHandler(
  overrides: Partial<CleanupDependencies> = {},
) {
  const dependencies = { ...defaultDependencies, ...overrides };
  return async function handle(request: NextRequest) {
    const cronSecret = (dependencies.env.CRON_SECRET ?? '').trim();
    if (!cronSecret) return NextResponse.json({ ok: false, error: 'CONFIGURATION_ERROR' }, { status: 503 });
    const auth = authorizeCronRequest(request.headers, {
      cronSecret,
      deploymentId: dependencies.env.VERCEL_DEPLOYMENT_ID,
      vercelEnv: dependencies.env.VERCEL,
    });
    if (!auth.ok) return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });

    const requestedMode = request.nextUrl.searchParams.get('mode');
    const mode = requestedMode ?? 'ledger';
    if (mode !== 'ledger' && mode !== 'purge-staging') {
      return NextResponse.json({ ok: false, error: 'PARAMETER_INVALID' }, { status: 400 });
    }

    if (mode === 'purge-staging') {
      if (request.method !== 'POST') {
        return NextResponse.json({ ok: false, error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
      }
      if (request.nextUrl.hostname.toLowerCase() !== STAGING_HOST) {
        return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 });
      }
      if (dependencies.env.MCP_STAGING_HOST !== STAGING_HOST
        || dependencies.env.MCP_STAGING_REFERENCE_CLEANUP_ENABLED !== 'true'
        || dependencies.env.MCP_STAGING_REFERENCE_STORAGE_PREFIX
          !== MCP_REFERENCE_STAGING_STORAGE_PREFIX) {
        return NextResponse.json({ ok: false, error: 'CONFIGURATION_ERROR' }, { status: 503 });
      }
      if (dependencies.env.MCP_STAGING_OPERATIONAL_ENABLED !== 'false') {
        return NextResponse.json({ ok: false, error: 'STAGING_NOT_CLOSED' }, { status: 409 });
      }
    }

    try {
      const ledger = await dependencies.cleanupExpiredReferenceUploadAttempts({ limit: BATCH_LIMIT });
      if (mode === 'ledger') {
        return NextResponse.json(requestedMode
          ? { ok: true, mode, ...ledger }
          : { ok: true, ...ledger });
      }
      if (ledger.selected !== 0) {
        return NextResponse.json({
          ok: false,
          error: 'CLEANUP_PENDING',
          ...ledger,
        }, { status: 409 });
      }

      const liveState = await dependencies.countMcpReferenceUploadLiveState({ limit: BATCH_LIMIT });
      if (Object.values(liveState).some((count) => count !== 0)) {
        return NextResponse.json({
          ok: false,
          error: 'ACTIVE_UPLOADS',
          ...liveState,
        }, { status: 409 });
      }

      const purged = await dependencies.purgeMcpReferenceStagingObjects({ limit: BATCH_LIMIT });
      if (purged.selected !== purged.deleted) {
        return NextResponse.json({
          ok: false,
          error: 'PURGE_INCOMPLETE',
          ...purged,
        }, { status: 503 });
      }
      return NextResponse.json({ ok: true, mode, ...purged });
    } catch {
      return NextResponse.json({ ok: false, error: 'CLEANUP_FAILED' }, { status: 500 });
    }
  };
}

const handle = createMcpReferenceUploadCleanupHandler();
export { handle as GET, handle as POST };
