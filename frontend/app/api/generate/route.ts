export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createGenerateMetricLogger } from './_lib/metric-logger';
import { buildGenerateRequestOptions } from './_lib/request-options';
import { resolveGenerateUserGate } from './_lib/auth-idempotency';
import { resolveGenerateRouteContext } from './_lib/route-context';
import { normalizeProviderRoutedResolution } from './_lib/provider-resolution';
import { videoGenerationAdapters } from './_lib/video-generation-adapters';
import { executeVideoGeneration } from '@/server/video-generation/execute-video-generation';

export async function POST(req: NextRequest) {
  const requestStartedAt = Date.now();
  const { state: metricState, log: logMetric } = createGenerateMetricLogger({ requestStartedAt });
  const body = await req.json().catch((error) => {
    console.error('[api/generate] invalid JSON', error);
    return null;
  });
  if (!body) return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });

  const routeContext = await resolveGenerateRouteContext({ body, req });
  if (!routeContext.ok) {
    return NextResponse.json(routeContext.body, { status: routeContext.status });
  }
  const { engine, isBytePlusV1a, jobId, mode, providerRoutingPlan } = routeContext.context;
  metricState.engineId = engine.id;
  metricState.engineLabel = engine.label;
  metricState.jobId = jobId;
  metricState.mode = mode;

  const requestOptionsResult = buildGenerateRequestOptions({ body, engine, mode, isBytePlusV1a });
  if (!requestOptionsResult.ok) {
    if (requestOptionsResult.metric) logMetric('rejected', requestOptionsResult.metric);
    return NextResponse.json(requestOptionsResult.body, { status: requestOptionsResult.status });
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

  const userGate = await resolveGenerateUserGate({ req, body });
  if (userGate.kind === 'response') {
    if (userGate.metric) logMetric('rejected', userGate.metric);
    return NextResponse.json(userGate.body, { status: userGate.status });
  }
  metricState.userId = userGate.userId;

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
  });
  return NextResponse.json(result.body, result.status === undefined ? undefined : { status: result.status });
}
