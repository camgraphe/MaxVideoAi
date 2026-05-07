import { query } from '@/lib/db';
import type { FalInputSummary } from './fal-request';

type QueryFn = (sql: string, params?: unknown[]) => Promise<unknown>;

export async function persistFinalVideoJobUpdate(params: {
  jobId: string;
  thumb: string | null;
  aspectRatio: string | null;
  previewFrame: string | null;
  etaSeconds: number | null;
  etaLabel: string | null;
  video: string | null;
  status: string;
  progress: number;
  providerJobId: string | null;
  finalPriceCents: number;
  pricingSnapshotJson: string;
  costBreakdownJson: string | null;
  currency: string;
  vendorAccountId: string | null;
  paymentStatus: string;
  stripePaymentIntentId: string | null;
  stripeChargeId: string | null;
  visibility: 'public' | 'private';
  indexable: boolean;
  message: string | null;
  settingsSnapshotJson: string;
  queryFn?: QueryFn;
}): Promise<void> {
  const queryFn = params.queryFn ?? query;
  await queryFn(
    `UPDATE app_jobs
     SET thumb_url = $2,
         aspect_ratio = $3,
         preview_frame = $4,
         eta_seconds = $5,
         eta_label = $6,
         video_url = $7,
         status = $8,
         progress = $9,
         provider_job_id = COALESCE($10, provider_job_id),
         final_price_cents = $11,
         pricing_snapshot = $12::jsonb,
         cost_breakdown_usd = $13::jsonb,
         currency = $14,
         vendor_account_id = $15,
         payment_status = $16,
         stripe_payment_intent_id = $17,
         stripe_charge_id = $18,
         visibility = $19,
         indexable = $20,
         message = $21,
         settings_snapshot = $22::jsonb,
         provisional = FALSE,
         updated_at = NOW()
     WHERE job_id = $1`,
    [
      params.jobId,
      params.thumb,
      params.aspectRatio,
      params.previewFrame,
      params.etaSeconds,
      params.etaLabel,
      params.video,
      params.status,
      params.progress,
      params.providerJobId,
      params.finalPriceCents,
      params.pricingSnapshotJson,
      params.costBreakdownJson,
      params.currency,
      params.vendorAccountId,
      params.paymentStatus,
      params.stripePaymentIntentId,
      params.stripeChargeId,
      params.visibility,
      params.indexable,
      params.message,
      params.settingsSnapshotJson,
    ]
  );
}

export async function recordFinalGenerateQueueLog(params: {
  jobId: string;
  provider: string;
  providerJobId: string | null;
  engineId: string;
  status: string;
  durationSec: number;
  durationLabel: string | undefined;
  aspectRatio: string | null;
  resolution: string;
  loop: boolean | undefined;
  inputSummary: FalInputSummary;
  totalCents: number;
  currency: string;
  costBreakdownUsd: Record<string, unknown> | null;
  queryFn?: QueryFn;
}): Promise<void> {
  const queryFn = params.queryFn ?? query;
  try {
    await queryFn(
      `INSERT INTO fal_queue_log (job_id, provider, provider_job_id, engine_id, status, payload)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
      [
        params.jobId,
        params.provider,
        params.providerJobId,
        params.engineId,
        params.status,
        JSON.stringify({
          request: {
            durationSec: params.durationSec,
            durationLabel: params.durationLabel,
            aspectRatio: params.aspectRatio,
            resolution: params.resolution,
            loop: params.loop,
          },
          inputSummary: params.inputSummary,
          pricing: {
            totalCents: params.totalCents,
            currency: params.currency,
            cost_breakdown_usd: params.costBreakdownUsd,
          },
        }),
      ]
    );
  } catch (error) {
    console.warn('[queue-log] failed to insert entry', error);
  }
}
