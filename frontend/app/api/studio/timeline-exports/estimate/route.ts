export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { resolveStudioRouteContext } from '../../_lib/studio-route-utils';
import { countUsedFreeTimelineExports } from '@/server/timeline-exports/repository';
import {
  parseTimelineExportRequest,
  resolveTimelineExportFps,
  resolveTimelineExportResolution,
} from '@/server/timeline-exports/render-request';
import { estimateTimelineExportPrice, resolveTimelineExportQuota } from '@/server/timeline-exports/pricing';
import { resolveOwnedTimelineExportRequest } from '@/server/timeline-exports/manifest-resolver';
import {
  createTimelineExportEstimateTokenClaims,
  resolveTimelineExportEstimateSecret,
  signTimelineExportEstimateToken,
  timelineExportManifestHash,
} from '@/server/timeline-exports/estimate-token';

function json(body: unknown, init?: Parameters<typeof NextResponse.json>[1]) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export async function POST(req: NextRequest) {
  const context = await resolveStudioRouteContext(req);
  if (context.response) return context.response;
  const { userId } = context;
  const payload = await req.json().catch(() => null);

  try {
    const parsedRequest = parseTimelineExportRequest(payload?.request ?? payload);
    const request = await resolveOwnedTimelineExportRequest({
      userId,
      request: parsedRequest,
      requestOrigin: req.nextUrl.origin,
    });
    const quota = resolveTimelineExportQuota({
      usedFreeExports: await countUsedFreeTimelineExports(userId),
    });
    const estimate = estimateTimelineExportPrice({
      durationSec: request.manifest.durationSec,
      resolution: resolveTimelineExportResolution(request),
      fps: resolveTimelineExportFps(request),
      qualityPreset: request.exportSettings.qualityPreset,
      freeExportsRemaining: quota.freeExportsRemaining,
    });
    const claims = createTimelineExportEstimateTokenClaims({
      userId,
      manifestHash: timelineExportManifestHash(request.manifest),
      qualityPreset: request.exportSettings.qualityPreset,
      idempotencyKey: request.idempotencyKey,
      billingKind: estimate.billingKind,
      amountCents: estimate.amountCents,
    });
    const estimateToken = signTimelineExportEstimateToken({
      claims,
      secret: resolveTimelineExportEstimateSecret(),
    });
    return json({ ok: true, quota, estimate, estimateToken, estimateExpiresAt: claims.expiresAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'ESTIMATE_FAILED';
    const reestimate = message === 'EXPORT_PROJECT_STATE_STALE';
    return json(
      { ok: false, error: message, reestimate },
      { status: reestimate ? 409 : 400 }
    );
  }
}
