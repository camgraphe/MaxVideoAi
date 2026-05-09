import { AUDIO_SURFACE } from '@/lib/audio-generation';
import { query, type QueryExecutor, withDbTransaction } from '@/lib/db';
import { reserveWalletChargeInExecutor } from '@/lib/wallet';
import { AudioGenerationError } from './audio-generate-validation';

export const PLACEHOLDER_THUMB = '/assets/frames/thumb-16x9.svg';

export type SourceJobRow = {
  job_id: string;
  video_url: string | null;
  thumb_url: string | null;
  prompt: string;
  aspect_ratio: string | null;
};

export type AudioJobPatch = {
  progress?: number;
  status?: 'pending' | 'running' | 'completed' | 'failed';
  message?: string | null;
  videoUrl?: string | null;
  audioUrl?: string | null;
  thumbUrl?: string | null;
  hasAudio?: boolean;
  paymentStatus?: string;
  settingsSnapshotJson?: string | null;
};

type InitialAudioJobParams = {
  userId: string;
  jobId: string;
  amountCents: number;
  currency: string;
  description: string;
  billingProductKey: string;
  pricingSnapshotJson: string;
  applicationFeeCents: number | null;
  vendorAccountId: string | null;
  engineId: string;
  engineLabel: string;
  durationSec: number;
  promptSummary: string;
  initialThumb: string;
  aspectRatio: string | null;
  settingsSnapshotJson: string;
};

export async function loadSourceJob(userId: string, sourceJobId: string): Promise<SourceJobRow | null> {
  const rows = await query<SourceJobRow>(
    `SELECT job_id, video_url, thumb_url, prompt, aspect_ratio
       FROM app_jobs
      WHERE job_id = $1
        AND user_id = $2
      LIMIT 1`,
    [sourceJobId, userId]
  );
  return rows[0] ?? null;
}

export async function updateAudioJob(jobId: string, patch: AudioJobPatch): Promise<void> {
  const assignments: string[] = [];
  const params: unknown[] = [];

  if (typeof patch.progress === 'number') {
    params.push(Math.max(0, Math.min(100, Math.round(patch.progress))));
    assignments.push(`progress = $${params.length}`);
  }
  if (patch.status) {
    params.push(patch.status);
    assignments.push(`status = $${params.length}`);
  }
  if (patch.message !== undefined) {
    params.push(patch.message);
    assignments.push(`message = $${params.length}`);
  }
  if (patch.videoUrl !== undefined) {
    params.push(patch.videoUrl);
    assignments.push(`video_url = $${params.length}`);
  }
  if (patch.audioUrl !== undefined) {
    params.push(patch.audioUrl);
    assignments.push(`audio_url = $${params.length}`);
  }
  if (patch.thumbUrl !== undefined) {
    params.push(patch.thumbUrl);
    assignments.push(`thumb_url = $${params.length}`);
    assignments.push(`preview_frame = $${params.length}`);
  }
  if (typeof patch.hasAudio === 'boolean') {
    params.push(patch.hasAudio);
    assignments.push(`has_audio = $${params.length}`);
  }
  if (patch.paymentStatus) {
    params.push(patch.paymentStatus);
    assignments.push(`payment_status = $${params.length}`);
  }
  if (patch.settingsSnapshotJson !== undefined) {
    params.push(patch.settingsSnapshotJson);
    assignments.push(`settings_snapshot = $${params.length}::jsonb`);
  }

  if (!assignments.length) return;

  params.push(jobId);
  await query(`UPDATE app_jobs SET ${assignments.join(', ')}, updated_at = NOW() WHERE job_id = $${params.length}`, params);
}

async function insertInitialAudioJob(executor: QueryExecutor, params: InitialAudioJobParams): Promise<void> {
  await executor.query(
    `INSERT INTO app_jobs (
       job_id,
       user_id,
       surface,
       billing_product_key,
       engine_id,
       engine_label,
       duration_sec,
       prompt,
       thumb_url,
       video_url,
       audio_url,
       aspect_ratio,
       has_audio,
       preview_frame,
       status,
       progress,
       final_price_cents,
       pricing_snapshot,
       settings_snapshot,
       currency,
       vendor_account_id,
       payment_status,
       visibility,
       indexable,
       provisional
     )
     VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,NULL,NULL,$10,FALSE,$11,'pending',0,$12,$13::jsonb,$14::jsonb,$15,NULL,'paid_wallet','private',FALSE,TRUE
     )`,
    [
      params.jobId,
      params.userId,
      AUDIO_SURFACE,
      params.billingProductKey,
      params.engineId,
      params.engineLabel,
      params.durationSec,
      params.promptSummary,
      params.initialThumb,
      params.aspectRatio,
      params.initialThumb,
      params.amountCents,
      params.pricingSnapshotJson,
      params.settingsSnapshotJson,
      params.currency,
    ]
  );
}

export async function createInitialAudioJob(params: InitialAudioJobParams): Promise<void> {
  await withDbTransaction(async (executor) => {
    const reserveResult = await reserveWalletChargeInExecutor(executor, {
      userId: params.userId,
      amountCents: params.amountCents,
      currency: params.currency,
      description: params.description,
      jobId: params.jobId,
      surface: AUDIO_SURFACE,
      billingProductKey: params.billingProductKey,
      pricingSnapshotJson: params.pricingSnapshotJson,
      applicationFeeCents: params.applicationFeeCents,
      vendorAccountId: params.vendorAccountId,
      stripePaymentIntentId: null,
      stripeChargeId: null,
    });

    if (!reserveResult.ok) {
      if (reserveResult.errorCode === 'currency_mismatch') {
        throw new AudioGenerationError('Existing wallet balance uses a different currency.', {
          status: 400,
          code: 'wallet_currency_mismatch',
        });
      }
      throw new AudioGenerationError('Insufficient wallet balance.', {
        status: 402,
        code: 'INSUFFICIENT_WALLET_FUNDS',
      });
    }

    await insertInitialAudioJob(executor, params);
  });
}
