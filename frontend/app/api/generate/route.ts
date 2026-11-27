import { requireCurrentWebPricingPolicy } from '@/server/pricing/web-pricing-policy';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { customerGenerationResponse } from './_lib/customer-generation-response';
import { createGenerateMetricLogger } from './_lib/metric-logger';
import { buildGenerateRequestOptions } from './_lib/request-options';
import { resolveGenerateUserGate } from './_lib/auth-idempotency';
import { resolveGenerateRouteContext } from './_lib/route-context';
import { normalizeProviderRoutedResolution } from './_lib/provider-resolution';
import { videoGenerationAdapters } from './_lib/video-generation-adapters';
import { executeVideoGeneration } from '@/server/video-generation/execute-video-generation';
import { seedanceWorkflowEnabled, resolveSeedanceWorkflowRequest, SeedanceWorkflowRequestError } from '@/server/seedance-workflow-request';

export async function POST(req: NextRequest) {
  const requestStartedAt = Date.now();
  const { state: metricState, log: logMetric, logPreflightRejection } = createGenerateMetricLogger({ requestStartedAt });
  let body = await req.json().catch((error) => {
    console.error('[api/generate] invalid JSON', error);
    return null;
  });
  if (!body) return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });

  let seedanceWorkflow;
  let workflowUserGate;
  if (body.seedanceWorkflow !== undefined) {
    workflowUserGate = await resolveGenerateUserGate({ req, body });
    if (workflowUserGate.kind === 'response') return NextResponse.json(customerGenerationResponse(workflowUserGate.body, body.engineId, undefined, workflowUserGate.storedEngineId), { status: workflowUserGate.status });
    try {
      seedanceWorkflow = await resolveSeedanceWorkflowRequest({ body, userId: workflowUserGate.userId,
        engineId: String(body.engineId), enabled: seedanceWorkflowEnabled(req.url) });
      if (seedanceWorkflow) body = seedanceWorkflow.body;
    } catch (error) {
      if (!(error instanceof SeedanceWorkflowRequestError)) throw error;
      return NextResponse.json({ ok: false, error: error.code, message: error.message }, { status: error.status });
    }
  }
  const routeContext = await resolveGenerateRouteContext({ body, req, seedanceWorkflow: seedanceWorkflow ?? undefined });
  if (!routeContext.ok) {
    await logPreflightRejection(body, routeContext);
    return NextResponse.json(customerGenerationResponse(routeContext.body, body.engineId), { status: routeContext.status });
  }
  const { engine, isBytePlusV1a, jobId, providerRoutingPlan } = routeContext.context;
  const { mode } = routeContext.context;
  metricState.engineId = engine.id;
  metricState.engineLabel = engine.label;
  metricState.jobId = jobId;
  metricState.mode = mode;

  const userGate = workflowUserGate ?? await resolveGenerateUserGate({ req, body });
  if (userGate.kind === 'response') {
    if (userGate.metric) logMetric('rejected', userGate.metric);
    return NextResponse.json(customerGenerationResponse(userGate.body, engine.id, undefined, userGate.storedEngineId), { status: userGate.status });
  }
  try {
    seedanceWorkflow ??= await resolveSeedanceWorkflowRequest({ body, userId: userGate.userId,
      engineId: engine.id, enabled: seedanceWorkflowEnabled(req.url) });
    if (seedanceWorkflow) body = seedanceWorkflow.body;
  } catch (error) {
    if (!(error instanceof SeedanceWorkflowRequestError)) throw error;
    return NextResponse.json({ ok: false, error: error.code, message: error.message }, { status: error.status });
  }

  const requestOptionsResult = buildGenerateRequestOptions({ body, engine, mode, isBytePlusV1a });
  if (!requestOptionsResult.ok) {
    if (requestOptionsResult.metric) logMetric('rejected', requestOptionsResult.metric);
    return NextResponse.json(customerGenerationResponse(requestOptionsResult.body, engine.id), { status: requestOptionsResult.status });
  }
  const normalizedResolution = normalizeProviderRoutedResolution({
    providerRoutingPlan,
    engineId: engine.id,
    mode,
    pricingResolution: requestOptionsResult.options.pricingResolution,
    effectiveResolution: requestOptionsResult.options.effectiveResolution,
  });
  const requestOptions = { ...requestOptionsResult.options, ...normalizedResolution };
  metricState.resolution = requestOptions.effectiveResolution;

  metricState.userId = userGate.userId;
  const pricingPolicyError = requireCurrentWebPricingPolicy(req, 'video');
  if (pricingPolicyError) return pricingPolicyError;

  const result = await executeVideoGeneration({
    req,
    body,
    routeContext: routeContext.context,
    requestOptions,
    userId: userGate.userId,
    localKey: userGate.localKey,
    requestStartedAt,
    metricState,
    logMetric,
    walletReservation: 'reserve',
    adapters: videoGenerationAdapters,
    seedanceWorkflow: seedanceWorkflow ?? undefined,
  });
  return NextResponse.json(customerGenerationResponse(result.body, engine.id, result.origin, result.storedEngineId), result.status === undefined ? undefined : { status: result.status });
}
