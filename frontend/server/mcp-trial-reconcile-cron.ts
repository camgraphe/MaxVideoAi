import { NextRequest, NextResponse } from 'next/server';
import type { reconcileTrialEntitlements } from '@/server/agent-api/reconcile-trial-entitlements';
import { authorizeCronRequest } from '@/server/vercel-cron';

type TrialReconciliationCronDependencies = {
  env: Record<string, string | undefined>;
  reconcile: typeof reconcileTrialEntitlements;
  log(value: Record<string, unknown>): void;
};

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
      dependencies.log({ event: 'completed', ...result });
      return NextResponse.json({ ok: true, ...result });
    } catch {
      dependencies.log({ event: 'failed', reasonCode: 'reconciliation_failed' });
      return NextResponse.json(
        { ok: false, error: 'RECONCILIATION_FAILED' },
        { status: 500 },
      );
    }
  };
}
