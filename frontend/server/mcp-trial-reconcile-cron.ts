import { NextRequest, NextResponse } from 'next/server';
import type { reconcileTrialEntitlements } from '@/server/agent-api/reconcile-trial-entitlements';
import { MCP_TRIAL_RISK_RETENTION_DAYS } from '@/server/agent-api/trial-risk';
import type { cleanupTrialRiskEvents } from '@/server/agent-api/trial-risk-repository';
import { authorizeCronRequest } from '@/server/vercel-cron';

const MCP_TRIAL_RISK_CLEANUP_BATCH_LIMIT = 1_000;

type TrialRiskRetentionResult = {
  availability: 'available' | 'unavailable';
  reasonCode: 'batch_processed' | 'query_unavailable';
  deleted: number | null;
  batchLimit: number;
};

type TrialReconciliationCronDependencies = {
  env: Record<string, string | undefined>;
  reconcile: typeof reconcileTrialEntitlements;
  now(): Date;
  cleanupRiskEvents: typeof cleanupTrialRiskEvents;
  log(value: Record<string, unknown>): void;
};

async function cleanupExpiredTrialRiskEvents(
  dependencies: Pick<TrialReconciliationCronDependencies, 'now' | 'cleanupRiskEvents'>,
): Promise<TrialRiskRetentionResult> {
  try {
    const now = dependencies.now();
    if (!Number.isFinite(now.getTime())) throw new Error('Invalid trial risk cleanup clock.');
    const cutoff = new Date(
      now.getTime() - MCP_TRIAL_RISK_RETENTION_DAYS * 24 * 60 * 60 * 1_000,
    );
    const deleted = await dependencies.cleanupRiskEvents({
      cutoff,
      limit: MCP_TRIAL_RISK_CLEANUP_BATCH_LIMIT,
    });
    return {
      availability: 'available',
      reasonCode: 'batch_processed',
      deleted,
      batchLimit: MCP_TRIAL_RISK_CLEANUP_BATCH_LIMIT,
    };
  } catch {
    return {
      availability: 'unavailable',
      reasonCode: 'query_unavailable',
      deleted: null,
      batchLimit: MCP_TRIAL_RISK_CLEANUP_BATCH_LIMIT,
    };
  }
}

export function createTrialReconciliationCronHandler(
  dependencies: TrialReconciliationCronDependencies,
): (request: NextRequest) => Promise<NextResponse> {
  return async (request) => {
    const cronSecret = (dependencies.env.CRON_SECRET ?? '').trim();
    const localToken = (dependencies.env.MCP_TRIAL_RECONCILE_TOKEN ?? '').trim();
    if (!cronSecret && !localToken) {
      dependencies.log({ event: 'unauthorized', reasonCode: 'credentials_not_configured' });
      return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }
    const auth = authorizeCronRequest(request.headers, {
      cronSecret,
      deploymentId: dependencies.env.VERCEL_DEPLOYMENT_ID,
      localTokens: [localToken],
      overrideHeaderName: 'x-mcp-trial-reconcile-token',
      vercelEnv: dependencies.env.VERCEL,
    });
    if (!auth.ok || auth.mode === 'local-no-secret' || auth.mode === 'vercel-fallback') {
      dependencies.log({
        event: 'unauthorized',
        reasonCode: auth.ok ? 'explicit_credentials_required' : auth.reason,
      });
      return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }

    try {
      const result = await dependencies.reconcile();
      const riskRetention = await cleanupExpiredTrialRiskEvents(dependencies);
      dependencies.log({ event: 'completed', ...result, riskRetention });
      return NextResponse.json({ ok: true, ...result, riskRetention });
    } catch {
      dependencies.log({ event: 'failed', reasonCode: 'reconciliation_failed' });
      return NextResponse.json(
        { ok: false, error: 'RECONCILIATION_FAILED' },
        { status: 500 },
      );
    }
  };
}
