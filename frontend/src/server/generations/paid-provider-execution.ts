import { getPlatformFeeCents } from '@maxvideoai/pricing';
import { NextRequest } from 'next/server';

import { createGenerateMetricLogger } from '@/app/api/generate/_lib/metric-logger';
import { rollbackPendingPayment } from '@/app/api/generate/_lib/payment-rollback';
import { normalizeProviderRoutedResolution } from '@/app/api/generate/_lib/provider-resolution';
import { buildGenerateRequestOptions } from '@/app/api/generate/_lib/request-options';
import { resolveTrustedPaidGenerateRouteContext } from '@/app/api/generate/_lib/route-context';
import { videoGenerationAdapters } from '@/app/api/generate/_lib/video-generation-adapters';
import { query } from '@/lib/db';
import type {
  IncludedTrialVideoContinuationOptions,
  PaidGenerationExecution,
  PaidGenerationSubmissionDependencies,
  PaidVideoContinuationOptions,
} from '@/server/agent-api/paid-generation-execution';
import { executeImageGeneration } from '@/server/images/execute-image-generation';
import { executeVideoGeneration } from '@/server/video-generation/execute-video-generation';
import type { PricingSnapshot } from '@/types/engines';

async function executePaidVideoContinuation(
  options: PaidVideoContinuationOptions | IncludedTrialVideoContinuationOptions,
) {
  const req = new NextRequest('https://maxvideoai.com/api/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
  });
  const mode = options.body.mode;
  if (mode !== 't2v' && mode !== 'i2v' && mode !== 'ref2v' && mode !== 'v2v' && mode !== 'extend') {
    return { status: 400, body: { ok: false, error: 'Unsupported paid video mode' } };
  }
  const jobId = String(options.body.jobId ?? '');
  const routeContext = resolveTrustedPaidGenerateRouteContext({
    body: options.body,
    engine: options.engine,
    jobId,
    mode,
  });
  if (!routeContext.ok) return { status: routeContext.status, body: routeContext.body };
  const requestOptions = buildGenerateRequestOptions({
    body: options.body,
    engine: options.engine,
    mode,
    isBytePlusV1a: routeContext.context.isBytePlusV1a,
  });
  if (!requestOptions.ok) return { status: requestOptions.status, body: requestOptions.body };
  const normalizedResolution = normalizeProviderRoutedResolution({
    providerRoutingPlan: routeContext.context.providerRoutingPlan,
    engineId: options.engine.id,
    mode,
    pricingResolution: requestOptions.options.pricingResolution,
    effectiveResolution: requestOptions.options.effectiveResolution,
  });
  const requestStartedAt = Date.now();
  const metric = createGenerateMetricLogger({ requestStartedAt });
  const common = {
    req,
    body: options.body,
    requestOptions: { ...requestOptions.options, ...normalizedResolution },
    userId: options.userId,
    localKey: null,
    requestStartedAt,
    metricState: metric.state,
    logMetric: metric.log,
    adapters: videoGenerationAdapters,
  };
  if ('funding' in options) {
    return executeVideoGeneration({
      ...common,
      routeContext: { ...routeContext.context, payment: { mode: 'mcp_trial' } },
      funding: options.funding,
      preReservedInitialState: options.preReservedInitialState,
      trustedIncludedTrialBilling: options.trustedIncludedTrialBilling,
    });
  }
  return executeVideoGeneration({
    ...common,
    routeContext: routeContext.context,
    walletReservation: 'already_reserved',
    preReservedInitialState: options.preReservedInitialState,
    trustedQuotedBilling: options.trustedQuotedBilling,
  });
}

async function ensureKnownRejectionRefund(
  execution: PaidGenerationExecution,
): Promise<boolean> {
  const pricing = execution.canonicalPricing as unknown as PricingSnapshot;
  const applicationFeeCents = getPlatformFeeCents(pricing);
  const vendorAccountId = typeof pricing.vendorAccountId === 'string'
    ? pricing.vendorAccountId
    : null;
  await rollbackPendingPayment({
    pendingReceipt: {
      userId: execution.userId,
      amountCents: pricing.totalCents,
      currency: pricing.currency,
      description: `MCP ${execution.engine.label} generation`,
      jobId: execution.quoteId,
      snapshot: pricing,
      applicationFeeCents,
      vendorAccountId,
    },
    walletChargeReserved: true,
    refundDescription: `Refund MCP ${execution.engine.label} generation`,
  });
  const rows = await query<{ id: unknown }>(
    `SELECT id FROM app_receipts
      WHERE job_id = $1 AND type = 'refund'
      LIMIT 1`,
    [execution.quoteId],
  );
  if (!rows.length) return false;
  await query(
    `UPDATE app_jobs
        SET status = 'failed',
            progress = 0,
            payment_status = 'refunded_wallet',
            provisional = FALSE,
            updated_at = NOW()
      WHERE job_id = $1`,
    [execution.quoteId],
  );
  return true;
}

export const paidProviderSubmissionDependencies: PaidGenerationSubmissionDependencies = {
  executeVideo: executePaidVideoContinuation,
  executeImage: (options) => executeImageGeneration(options),
  ensureKnownRejectionRefund,
};
