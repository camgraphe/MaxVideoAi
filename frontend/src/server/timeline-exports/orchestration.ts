import {
  createTimelineExportJobWithReservation,
  releaseFailedTimelineExportBilling,
  type TimelineExportBillingReservation,
} from '@/server/timeline-exports/billing';
import type {
  TimelineExportJobResponse,
  TimelineExportPriceEstimate,
  TimelineExportQuota,
} from './contracts';
import type {
  launchTimelineExportWorkerTask,
  TimelineExportWorkerLaunchResult,
} from '@/server/timeline-exports/ecs-runner';
import {
  createTimelineExportEstimateTokenClaims,
  resolveTimelineExportEstimateSecret,
  signTimelineExportEstimateToken,
  timelineExportManifestHash,
} from '@/server/timeline-exports/estimate-token';
import { resolveOwnedTimelineExportRequest } from '@/server/timeline-exports/manifest-resolver';
import { ownedTimelineExportJobResponse } from '@/server/timeline-exports/media-access';
import { estimateTimelineExportPrice, resolveTimelineExportQuota } from './pricing';
import {
  parseTimelineExportRequest,
  resolveTimelineExportFps,
  resolveTimelineExportResolution,
} from '@/server/timeline-exports/render-request';
import {
  countUsedFreeTimelineExports,
  failTimelineExportJob,
  readTimelineExportJob,
  readTimelineExportJobByIdempotencyKey,
} from '@/server/timeline-exports/repository';

export type OwnedTimelineExportRequestInput = {
  userId: string;
  requestOrigin: string;
  rawRequest: unknown;
};

export type SubmitOwnedTimelineExportInput = OwnedTimelineExportRequestInput & {
  estimateToken: unknown;
};

export type TimelineExportServiceError = {
  ok: false;
  error: string;
  reestimate?: boolean;
  message?: string;
  export?: TimelineExportJobResponse;
  billing?: TimelineExportBillingReservation | null;
  reused?: false;
};

export type TimelineExportServiceResult<T> =
  | { status: 200; body: T }
  | { status: 400 | 402 | 404 | 409 | 503; body: TimelineExportServiceError };

export type TimelineExportEstimateResponse = {
  ok: true;
  quota: TimelineExportQuota;
  estimate: TimelineExportPriceEstimate;
  estimateToken: string;
  estimateExpiresAt: number;
};

export type TimelineExportSubmitResponse = {
  ok: true;
  export: TimelineExportJobResponse;
  billing: TimelineExportBillingReservation | null;
  reused: boolean;
  workerLaunch: TimelineExportWorkerLaunchResult | { status: 'reused' };
};

export type TimelineExportStatusResponse = { ok: true; export: TimelineExportJobResponse };

/** External owners remain replaceable for offline callers and behavioral tests. */
export type TimelineExportOrchestrationDependencies = {
  resolveOwnedTimelineExportRequest: typeof resolveOwnedTimelineExportRequest;
  countUsedFreeTimelineExports: typeof countUsedFreeTimelineExports;
  estimateTimelineExportPrice: typeof estimateTimelineExportPrice;
  resolveTimelineExportQuota: typeof resolveTimelineExportQuota;
  resolveTimelineExportEstimateSecret: typeof resolveTimelineExportEstimateSecret;
  readTimelineExportJobByIdempotencyKey: typeof readTimelineExportJobByIdempotencyKey;
  assertTimelineExportWorkerLauncherConfigured: () => void | Promise<void>;
  createTimelineExportJobWithReservation: typeof createTimelineExportJobWithReservation;
  launchTimelineExportWorkerTask: typeof launchTimelineExportWorkerTask;
  releaseFailedTimelineExportBilling: typeof releaseFailedTimelineExportBilling;
  failTimelineExportJob: typeof failTimelineExportJob;
  readTimelineExportJob: typeof readTimelineExportJob;
  ownedTimelineExportJobResponse: typeof ownedTimelineExportJobResponse;
  now?: () => number;
};

const defaultDependencies: TimelineExportOrchestrationDependencies = {
  resolveOwnedTimelineExportRequest,
  countUsedFreeTimelineExports,
  estimateTimelineExportPrice,
  resolveTimelineExportQuota,
  resolveTimelineExportEstimateSecret,
  readTimelineExportJobByIdempotencyKey,
  assertTimelineExportWorkerLauncherConfigured: async () => {
    const runner = await import('@/server/timeline-exports/ecs-runner');
    runner.assertTimelineExportWorkerLauncherConfigured();
  },
  createTimelineExportJobWithReservation,
  launchTimelineExportWorkerTask: async params => {
    const runner = await import('@/server/timeline-exports/ecs-runner');
    return runner.launchTimelineExportWorkerTask(params);
  },
  releaseFailedTimelineExportBilling,
  failTimelineExportJob,
  readTimelineExportJob,
  ownedTimelineExportJobResponse,
};

export async function estimateOwnedTimelineExport(
  params: OwnedTimelineExportRequestInput,
  overrides: Partial<TimelineExportOrchestrationDependencies> = {},
): Promise<TimelineExportServiceResult<TimelineExportEstimateResponse>> {
  const dependencies = { ...defaultDependencies, ...overrides };
  try {
    const request = await dependencies.resolveOwnedTimelineExportRequest({
      userId: params.userId,
      request: parseTimelineExportRequest(params.rawRequest),
      requestOrigin: params.requestOrigin,
    });
    const quota = dependencies.resolveTimelineExportQuota({
      usedFreeExports: await dependencies.countUsedFreeTimelineExports(params.userId),
    });
    const estimate = dependencies.estimateTimelineExportPrice({
      durationSec: request.manifest.durationSec,
      resolution: resolveTimelineExportResolution(request),
      fps: resolveTimelineExportFps(request),
      qualityPreset: request.exportSettings.qualityPreset,
      freeExportsRemaining: quota.freeExportsRemaining,
    });
    const claims = createTimelineExportEstimateTokenClaims({
      userId: params.userId,
      manifestHash: timelineExportManifestHash(request.manifest),
      qualityPreset: request.exportSettings.qualityPreset,
      idempotencyKey: request.idempotencyKey,
      billingKind: estimate.billingKind,
      amountCents: estimate.amountCents,
      now: dependencies.now?.(),
    });
    const estimateToken = signTimelineExportEstimateToken({
      claims,
      secret: dependencies.resolveTimelineExportEstimateSecret(),
    });
    return { status: 200, body: { ok: true, quota, estimate, estimateToken, estimateExpiresAt: claims.expiresAt } };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'ESTIMATE_FAILED';
    const reestimate = message === 'EXPORT_PROJECT_STATE_STALE';
    return { status: reestimate ? 409 : 400, body: { ok: false, error: message, reestimate } };
  }
}

/** Reservation and quote verification stay in the existing wallet transaction owner. */
export async function submitOwnedTimelineExport(
  params: SubmitOwnedTimelineExportInput,
  overrides: Partial<TimelineExportOrchestrationDependencies> = {},
): Promise<TimelineExportServiceResult<TimelineExportSubmitResponse>> {
  const dependencies = { ...defaultDependencies, ...overrides };
  try {
    if (typeof params.estimateToken !== 'string' || !params.estimateToken) {
      return { status: 409, body: { ok: false, error: 'EXPORT_ESTIMATE_REQUIRED', reestimate: true } };
    }
    const request = await dependencies.resolveOwnedTimelineExportRequest({
      userId: params.userId,
      request: parseTimelineExportRequest(params.rawRequest),
      requestOrigin: params.requestOrigin,
    });
    const resolution = resolveTimelineExportResolution(request);
    const fps = resolveTimelineExportFps(request);
    const existingJob = await dependencies.readTimelineExportJobByIdempotencyKey({
      userId: params.userId,
      idempotencyKey: request.idempotencyKey,
    });
    if (!existingJob) {
      try {
        await dependencies.assertTimelineExportWorkerLauncherConfigured();
      } catch (workerConfigError) {
        return { status: 503, body: {
          ok: false,
          error: 'TIMELINE_EXPORT_WORKER_NOT_CONFIGURED',
          message: workerConfigError instanceof Error ? workerConfigError.message : 'TIMELINE_EXPORT_WORKER_NOT_CONFIGURED',
        } };
      }
    }
    const result = await dependencies.createTimelineExportJobWithReservation({
      userId: params.userId,
      idempotencyKey: request.idempotencyKey,
      projectName: request.manifest.projectName || 'MaxVideoAI Export',
      durationSec: request.manifest.durationSec,
      resolution,
      fps,
      qualityPreset: request.exportSettings.qualityPreset,
      pricingSnapshot: {
        source: 'timeline_export',
        durationSec: request.manifest.durationSec,
        resolution,
        fps,
        qualityPreset: request.exportSettings.qualityPreset,
      },
      renderManifest: request.manifest,
      exportSettings: request.exportSettings,
      estimateToken: params.estimateToken,
      estimateSecret: dependencies.resolveTimelineExportEstimateSecret(),
      now: dependencies.now?.(),
    });
    if (!result.reused && result.job.status === 'queued') {
      try {
        const workerLaunch = await dependencies.launchTimelineExportWorkerTask({ exportId: result.job.id });
        return { status: 200, body: {
          ok: true,
          export: await dependencies.ownedTimelineExportJobResponse(result.job, params.userId),
          billing: result.billing,
          reused: false,
          workerLaunch,
        } };
      } catch (workerError) {
        const message = workerError instanceof Error ? workerError.message : 'TIMELINE_EXPORT_WORKER_LAUNCH_FAILED';
        const billingStatus = await dependencies.releaseFailedTimelineExportBilling({
          userId: params.userId,
          exportId: result.job.id,
          billingStatus: result.job.billing_status,
          amountCents: Number(result.job.amount_cents ?? 0),
        });
        await dependencies.failTimelineExportJob({ exportId: result.job.id, message, billingStatus });
        return { status: 503, body: {
          ok: false,
          error: 'TIMELINE_EXPORT_WORKER_LAUNCH_FAILED',
          message,
          export: await dependencies.ownedTimelineExportJobResponse({ ...result.job, status: 'failed', message, billing_status: billingStatus }, params.userId),
          billing: result.billing ? { ...result.billing, billingStatus } : null,
          reused: false,
        } };
      }
    }
    return { status: 200, body: {
      ok: true,
      export: await dependencies.ownedTimelineExportJobResponse(result.job, params.userId),
      billing: result.billing,
      reused: result.reused,
      workerLaunch: { status: 'reused' },
    } };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'EXPORT_CREATE_FAILED';
    const reestimate = message === 'EXPORT_ESTIMATE_EXPIRED'
      || message === 'EXPORT_ESTIMATE_CHANGED'
      || message === 'EXPORT_ESTIMATE_INVALID'
      || message === 'EXPORT_PROJECT_STATE_STALE';
    return { status: message === 'INSUFFICIENT_WALLET_BALANCE' ? 402 : reestimate ? 409 : 400,
      body: { ok: false, error: message, reestimate } };
  }
}

export async function readOwnedTimelineExportStatus(
  params: { userId: string; exportId: string },
  overrides: Partial<TimelineExportOrchestrationDependencies> = {},
): Promise<TimelineExportServiceResult<TimelineExportStatusResponse>> {
  const dependencies = { ...defaultDependencies, ...overrides };
  const job = await dependencies.readTimelineExportJob(params);
  if (!job) return { status: 404, body: { ok: false, error: 'EXPORT_NOT_FOUND' } };
  return { status: 200, body: { ok: true, export: await dependencies.ownedTimelineExportJobResponse(job, params.userId) } };
}
