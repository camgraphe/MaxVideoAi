import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { buildUserFacingRefundDescription } from '@/server/user-facing-failure-messages';
import { rollbackPendingPayment } from './payment-rollback';
import type { PendingReceipt } from './initial-video-job';
import type { GenerateRouteMetricOptions, GenerateRouteMetricStatus } from './metric-logger';

type LogMetricFn = (status: GenerateRouteMetricStatus, options?: GenerateRouteMetricOptions) => void;

export async function buildMissingProviderJobIdResponse(params: {
  jobId: string;
  userId: string;
  engineId: string;
  engineLabel: string;
  durationSec: number;
  generationResult: unknown;
  pendingReceipt: PendingReceipt | null;
  walletChargeReserved: boolean;
  logMetric: LogMetricFn;
}) {
  const failureMessage = 'We could not start your render. Please retry.';
  console.error('[api/generate] missing provider_job_id and no result', {
    jobId: params.jobId,
    engineId: params.engineId,
    generationResult: params.generationResult,
  });
  params.logMetric('failed', {
    errorCode: 'FAL_NO_PROVIDER_JOB_ID',
    meta: { stage: 'provider_missing_id' },
  });
  try {
    await query(
      `UPDATE app_jobs
       SET status = 'failed',
           progress = 0,
           message = $2,
           provisional = FALSE,
           updated_at = NOW()
       WHERE job_id = $1`,
      [params.jobId, failureMessage]
    );
  } catch (updateError) {
    console.error('[api/generate] failed to mark job as failed after missing provider_job_id', updateError);
  }

  if (params.pendingReceipt) {
    await rollbackPendingPayment({
      pendingReceipt: params.pendingReceipt,
      walletChargeReserved: params.walletChargeReserved,
      refundDescription: buildUserFacingRefundDescription({
        engineLabel: params.engineLabel,
        durationSec: params.durationSec,
        reason: failureMessage,
      }),
    });
  }

  return NextResponse.json(
    {
      ok: false,
      error: 'FAL_NO_PROVIDER_JOB_ID',
      message: failureMessage,
    },
    { status: 502 }
  );
}
