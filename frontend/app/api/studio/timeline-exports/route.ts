export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { createTimelineExportJobWithReservation, releaseFailedTimelineExportBilling } from '@/server/timeline-exports/billing';
import { launchTimelineExportWorkerTask } from '@/server/timeline-exports/ecs-runner';
import { failTimelineExportJob } from '@/server/timeline-exports/repository';
import {
  parseTimelineExportRequest,
  resolveTimelineExportFps,
  resolveTimelineExportResolution,
} from '@/server/timeline-exports/render-request';

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
  const { userId } = await getRouteAuthContext(req);
  if (!userId) return json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
  const payload = await req.json().catch(() => null);

  try {
    const request = parseTimelineExportRequest(payload?.request ?? payload);
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
    });
    if (!result.reused && result.job.status === 'queued') {
      try {
        const workerLaunch = await launchTimelineExportWorkerTask({ exportId: result.job.id });
        return json({ ok: true, export: result.job, billing: result.billing, reused: false, workerLaunch });
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
            export: { ...result.job, status: 'failed', message: workerMessage, billing_status: billingStatus },
            billing: result.billing ? { ...result.billing, billingStatus } : null,
            reused: false,
          },
          { status: 503 }
        );
      }
    }
    return json({ ok: true, export: result.job, billing: result.billing, reused: result.reused, workerLaunch: { status: 'reused' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'EXPORT_CREATE_FAILED';
    const status = message === 'INSUFFICIENT_WALLET_BALANCE' ? 402 : 400;
    return json({ ok: false, error: message }, { status });
  }
}
