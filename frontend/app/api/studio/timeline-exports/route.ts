export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { resolveStudioRouteContext } from '../_lib/studio-route-utils';
import { createTimelineExportJobWithReservation, releaseFailedTimelineExportBilling } from '@/server/timeline-exports/billing';
import { assertTimelineExportWorkerLauncherConfigured, launchTimelineExportWorkerTask } from '@/server/timeline-exports/ecs-runner';
import {
  failTimelineExportJob,
  readTimelineExportJobByIdempotencyKey,
  timelineExportJobResponse,
} from '@/server/timeline-exports/repository';
import {
  parseTimelineExportRequest,
  resolveTimelineExportFps,
  resolveTimelineExportResolution,
} from '@/server/timeline-exports/render-request';
import { resolveOwnedTimelineExportRequest } from '@/server/timeline-exports/manifest-resolver';
import { resolveTimelineExportEstimateSecret } from '@/server/timeline-exports/estimate-token';

function json(body: unknown, init?: Parameters<typeof NextResponse.json>[1]) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

async function markWorkerLaunchFailed(params: {
  exportId: string;
  userId: string;
  billingStatus: Parameters<typeof releaseFailedTimelineExportBilling>[0]['billingStatus'];
  amountCents: number;
  message: string;
}) {
  const billingStatus = await releaseFailedTimelineExportBilling({
    userId: params.userId,
    exportId: params.exportId,
    billingStatus: params.billingStatus,
    amountCents: params.amountCents,
  });
  await failTimelineExportJob({
    exportId: params.exportId,
    message: params.message,
    billingStatus,
  });
  return billingStatus;
}

export async function POST(req: NextRequest) {
  const context = await resolveStudioRouteContext(req);
  if (context.response) return context.response;
  const { userId } = context;
  const payload = await req.json().catch(() => null);

  try {
    if (typeof payload?.estimateToken !== 'string' || !payload.estimateToken) {
      return json({ ok: false, error: 'EXPORT_ESTIMATE_REQUIRED', reestimate: true }, { status: 409 });
    }
    const parsedRequest = parseTimelineExportRequest(payload?.request ?? payload);
    const request = await resolveOwnedTimelineExportRequest({
      userId,
      request: parsedRequest,
      requestOrigin: req.nextUrl.origin,
    });
    const projectName = request.manifest.projectName || 'MaxVideoAI Export';
    const resolution = resolveTimelineExportResolution(request);
    const fps = resolveTimelineExportFps(request);
    const pricingSnapshot = {
      source: 'timeline_export',
      durationSec: request.manifest.durationSec,
      resolution,
      fps,
      qualityPreset: request.exportSettings.qualityPreset,
    };
    const existingJob = await readTimelineExportJobByIdempotencyKey({
      userId,
      idempotencyKey: request.idempotencyKey,
    });
    if (!existingJob) {
      try {
        assertTimelineExportWorkerLauncherConfigured();
      } catch (workerConfigError) {
        return json(
          {
            ok: false,
            error: 'TIMELINE_EXPORT_WORKER_NOT_CONFIGURED',
            message: workerConfigError instanceof Error ? workerConfigError.message : 'TIMELINE_EXPORT_WORKER_NOT_CONFIGURED',
          },
          { status: 503 }
        );
      }
    }
    const result = await createTimelineExportJobWithReservation({
      userId,
      idempotencyKey: request.idempotencyKey,
      projectName,
      durationSec: request.manifest.durationSec,
      resolution,
      fps,
      qualityPreset: request.exportSettings.qualityPreset,
      pricingSnapshot,
      renderManifest: request.manifest,
      exportSettings: request.exportSettings,
      estimateToken: payload.estimateToken,
      estimateSecret: resolveTimelineExportEstimateSecret(),
    });
    if (!result.reused && result.job.status === 'queued') {
      try {
        const workerLaunch = await launchTimelineExportWorkerTask({ exportId: result.job.id });
        return json({ ok: true, export: timelineExportJobResponse(result.job), billing: result.billing, reused: false, workerLaunch });
      } catch (workerError) {
        const workerMessage = workerError instanceof Error ? workerError.message : 'TIMELINE_EXPORT_WORKER_LAUNCH_FAILED';
        const billingStatus = await markWorkerLaunchFailed({
          exportId: result.job.id,
          userId,
          billingStatus: result.job.billing_status,
          amountCents: Number(result.job.amount_cents ?? 0),
          message: workerMessage,
        });
        return json(
          {
            ok: false,
            error: 'TIMELINE_EXPORT_WORKER_LAUNCH_FAILED',
            message: workerMessage,
            export: timelineExportJobResponse({ ...result.job, status: 'failed', message: workerMessage, billing_status: billingStatus }),
            billing: result.billing ? { ...result.billing, billingStatus } : null,
            reused: false,
          },
          { status: 503 }
        );
      }
    }
    return json({ ok: true, export: timelineExportJobResponse(result.job), billing: result.billing, reused: result.reused, workerLaunch: { status: 'reused' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'EXPORT_CREATE_FAILED';
    const reestimate = message === 'EXPORT_ESTIMATE_EXPIRED'
      || message === 'EXPORT_ESTIMATE_CHANGED'
      || message === 'EXPORT_ESTIMATE_INVALID'
      || message === 'EXPORT_PROJECT_STATE_STALE';
    const status = message === 'INSUFFICIENT_WALLET_BALANCE' ? 402 : reestimate ? 409 : 400;
    return json({ ok: false, error: message, reestimate }, { status });
  }
}
