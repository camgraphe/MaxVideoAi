import { randomUUID } from 'node:crypto';

import {
  AUDIO_MAX_DURATION_SEC,
  AUDIO_MIN_DURATION_SEC,
  AUDIO_SURFACE,
  buildAudioPricingSnapshot,
  clampAudioDuration,
  coerceAudioMood,
  coerceAudioPackId,
  getAudioPackConfig,
  resolveAudioVoiceMode,
  type AudioGenerateRequestBody,
  type AudioGenerateResponse,
  type AudioMood,
  type AudioPackId,
  type AudioVoiceMode,
} from '@/lib/audio-generation';
import { isDatabaseConfigured, query, withDbTransaction } from '@/lib/db';
import { reserveWalletChargeInExecutor } from '@/lib/wallet';
import { ensureBillingSchema } from '@/lib/schema';
import {
  generateClonedVoiceTrack,
  generateMusicTrack,
  generateSoundDesignTrack,
  generateStandardVoiceTrack,
  type AudioProviderError,
} from '@/server/audio/providers';
import { inspectSourceVideo, mixAudioIntoVideo, resolveAudioAspectRatio, uploadAudioRenderVideo } from '@/server/audio/media';

const PLACEHOLDER_THUMB = '/assets/frames/thumb-16x9.svg';

type NormalizedAudioGenerateInput = {
  sourceVideoUrl: string | null;
  sourceJobId: string | null;
  pack: AudioPackId;
  mood: AudioMood;
  script: string | null;
  voiceSampleUrl: string | null;
  locale: string | null;
  voiceMode: AudioVoiceMode | null;
};

export type ValidatedAudioGenerateRequest = NormalizedAudioGenerateInput;

type SourceJobRow = {
  job_id: string;
  video_url: string | null;
  thumb_url: string | null;
  prompt: string;
  aspect_ratio: string | null;
};

type AudioGenerationErrorOptions = {
  status?: number;
  code?: string;
  field?: string;
  providerFailures?: Array<{ providerKey: string; model: string; message: string }>;
};

export class AudioGenerationError extends Error {
  status: number;
  code: string;
  field?: string;
  providerFailures?: Array<{ providerKey: string; model: string; message: string }>;

  constructor(message: string, options: AudioGenerationErrorOptions = {}) {
    super(message);
    this.name = 'AudioGenerationError';
    this.status = options.status ?? 500;
    this.code = options.code ?? 'audio_generation_failed';
    this.field = options.field;
    this.providerFailures = options.providerFailures;
  }
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function buildPromptSummary(input: { pack: AudioPackId; mood: AudioMood; script: string | null }): string {
  const base = getAudioPackConfig(input.pack).label;
  if (!input.script) {
    return `${base} • ${input.mood}`;
  }
  return `${base} • ${input.mood} • ${input.script.slice(0, 80).trim()}`;
}

async function loadSourceJob(userId: string, sourceJobId: string): Promise<SourceJobRow | null> {
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

export function validateAudioGenerateRequest(body: AudioGenerateRequestBody): ValidatedAudioGenerateRequest {
  const pack = coerceAudioPackId(body.pack);
  if (!pack) {
    throw new AudioGenerationError('Audio pack is required.', {
      status: 400,
      code: 'audio_pack_required',
      field: 'pack',
    });
  }

  const mood = coerceAudioMood(body.mood);
  if (!mood) {
    throw new AudioGenerationError('Audio mood is required.', {
      status: 400,
      code: 'audio_mood_required',
      field: 'mood',
    });
  }

  const sourceVideoUrl = normalizeString(body.sourceVideoUrl);
  const sourceJobId = normalizeString(body.sourceJobId);
  if (!sourceVideoUrl && !sourceJobId) {
    throw new AudioGenerationError('A source video is required.', {
      status: 400,
      code: 'source_video_required',
      field: 'sourceVideoUrl',
    });
  }

  const script = normalizeString(body.script);
  if (pack === 'cinematic_voice' && !script) {
    throw new AudioGenerationError('A narration script is required for Cinematic + Voice.', {
      status: 400,
      code: 'audio_script_required',
      field: 'script',
    });
  }

  const voiceSampleUrl = normalizeString(body.voiceSampleUrl);
  const locale = normalizeString(body.locale);

  return {
    sourceVideoUrl,
    sourceJobId,
    pack,
    mood,
    script,
    voiceSampleUrl,
    locale,
    voiceMode: resolveAudioVoiceMode({ pack, voiceSampleUrl }),
  };
}

async function updateAudioJob(jobId: string, patch: {
  progress?: number;
  status?: 'pending' | 'running' | 'completed' | 'failed';
  message?: string | null;
  videoUrl?: string | null;
  thumbUrl?: string | null;
  hasAudio?: boolean;
  paymentStatus?: string;
  settingsSnapshotJson?: string | null;
}): Promise<void> {
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

async function refundAudioCharge(params: {
  userId: string;
  jobId: string;
  amountCents: number;
  currency: string;
  description: string;
  billingProductKey: string;
  pricingSnapshotJson: string;
}): Promise<void> {
  try {
    await query(
      `INSERT INTO app_receipts (
         user_id,
         type,
         amount_cents,
         currency,
         description,
         job_id,
         surface,
         billing_product_key,
         pricing_snapshot,
         application_fee_cents,
         vendor_account_id
       )
       VALUES ($1, 'refund', $2, $3, $4, $5, $6, $7, $8::jsonb, 0, NULL)`,
      [
        params.userId,
        params.amountCents,
        params.currency,
        params.description,
        params.jobId,
        AUDIO_SURFACE,
        params.billingProductKey,
        params.pricingSnapshotJson,
      ]
    );
  } catch (error) {
    console.warn('[audio] failed to record wallet refund', error);
  }
}

function buildProviderSnapshot(base: Record<string, unknown>, providers: Record<string, unknown>) {
  return JSON.stringify({
    ...base,
    providers,
  });
}

function parseProviderFailures(error: unknown) {
  if (error && typeof error === 'object' && 'failures' in (error as Record<string, unknown>)) {
    return (error as AudioProviderError).failures;
  }
  return undefined;
}

export async function generateAudioRun(params: {
  body: AudioGenerateRequestBody;
  userId: string;
}): Promise<AudioGenerateResponse> {
  if (!isDatabaseConfigured()) {
    throw new AudioGenerationError('Database unavailable.', { status: 503, code: 'database_unavailable' });
  }

  await ensureBillingSchema();

  const normalized = validateAudioGenerateRequest(params.body);
  const sourceJob =
    normalized.sourceJobId
      ? await loadSourceJob(params.userId, normalized.sourceJobId)
      : null;

  if (normalized.sourceJobId && !sourceJob) {
    throw new AudioGenerationError('Source job not found.', {
      status: 404,
      code: 'source_job_not_found',
      field: 'sourceJobId',
    });
  }

  const sourceVideoUrl = normalized.sourceVideoUrl ?? sourceJob?.video_url ?? null;
  if (!sourceVideoUrl) {
    throw new AudioGenerationError('Source video is missing.', {
      status: 400,
      code: 'source_video_missing',
      field: 'sourceVideoUrl',
    });
  }

  const sourceProbe = await inspectSourceVideo(sourceVideoUrl);
  if (!sourceProbe.durationSec) {
    throw new AudioGenerationError('Unable to inspect the source video duration.', {
      status: 422,
      code: 'source_video_probe_failed',
      field: 'sourceVideoUrl',
    });
  }

  const roundedDuration = Math.round(sourceProbe.durationSec);
  if (roundedDuration < AUDIO_MIN_DURATION_SEC || roundedDuration > AUDIO_MAX_DURATION_SEC) {
    throw new AudioGenerationError(`Source video must be between ${AUDIO_MIN_DURATION_SEC}s and ${AUDIO_MAX_DURATION_SEC}s.`, {
      status: 400,
      code: 'source_video_duration_invalid',
      field: 'sourceVideoUrl',
    });
  }

  const durationSec = clampAudioDuration(roundedDuration);
  const aspectRatio =
    sourceJob?.aspect_ratio ??
    resolveAudioAspectRatio(sourceProbe.width, sourceProbe.height) ??
    '16:9';
  const packConfig = getAudioPackConfig(normalized.pack);
  const pricingSnapshot = buildAudioPricingSnapshot({
    pack: normalized.pack,
    durationSec,
    mood: normalized.mood,
    voiceMode: normalized.voiceMode,
  });
  const pricingSnapshotJson = JSON.stringify(pricingSnapshot);
  const promptSummary = buildPromptSummary({
    pack: normalized.pack,
    mood: normalized.mood,
    script: normalized.script,
  });
  const initialSettingsSnapshot = {
    schemaVersion: 1,
    surface: AUDIO_SURFACE,
    pack: normalized.pack,
    mood: normalized.mood,
    voiceMode: normalized.voiceMode,
    sourceJobId: sourceJob?.job_id ?? null,
    sourceVideoUrl,
    refs: {
      sourceVideoUrl,
      voiceSampleUrl: normalized.voiceSampleUrl,
    },
    providers: null,
  };

  const jobId = `aud_${randomUUID()}`;
  const amountCents = pricingSnapshot.totalCents;
  const initialThumb = sourceJob?.thumb_url ?? PLACEHOLDER_THUMB;

  const walletReservation = await withDbTransaction(async (executor) => {
    const reserveResult = await reserveWalletChargeInExecutor(executor, {
      userId: params.userId,
      amountCents,
      currency: pricingSnapshot.currency,
      description: packConfig.label,
      jobId,
      surface: AUDIO_SURFACE,
      billingProductKey: packConfig.billingProductKey,
      pricingSnapshotJson,
      applicationFeeCents: 0,
      vendorAccountId: null,
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
         $1,$2,$3,$4,$5,$6,$7,$8,$9,NULL,$10,FALSE,$11,'pending',0,$12,$13::jsonb,$14::jsonb,$15,NULL,'paid_wallet','private',FALSE,TRUE
       )`,
      [
        jobId,
        params.userId,
        AUDIO_SURFACE,
        packConfig.billingProductKey,
        packConfig.engineId,
        packConfig.label,
        durationSec,
        promptSummary,
        initialThumb,
        aspectRatio,
        initialThumb,
        amountCents,
        pricingSnapshotJson,
        JSON.stringify(initialSettingsSnapshot),
        pricingSnapshot.currency,
      ]
    );

    return reserveResult;
  });

  void walletReservation;

  await updateAudioJob(jobId, {
    status: 'running',
    progress: 8,
    message: 'Preparing source video…',
  });

  try {
    await updateAudioJob(jobId, {
      progress: 22,
      message: 'Generating cinematic sound design…',
    });
    const soundDesign = await generateSoundDesignTrack({
      sourceVideoUrl,
      durationSec,
      mood: normalized.mood,
    });

    await updateAudioJob(jobId, {
      progress: 42,
      message: 'Generating music bed…',
    });
    const music = await generateMusicTrack({
      durationSec,
      mood: normalized.mood,
    });

    let voiceTrack: Awaited<ReturnType<typeof generateStandardVoiceTrack>> | null = null;
    if (normalized.pack === 'cinematic_voice' && normalized.script) {
      await updateAudioJob(jobId, {
        progress: 58,
        message:
          normalized.voiceMode === 'clone'
            ? 'Generating cloned narration…'
            : 'Generating narration…',
      });
      voiceTrack =
        normalized.voiceMode === 'clone' && normalized.voiceSampleUrl
          ? await generateClonedVoiceTrack({
              script: normalized.script,
              voiceSampleUrl: normalized.voiceSampleUrl,
              locale: normalized.locale,
            })
          : await generateStandardVoiceTrack({
              script: normalized.script,
              locale: normalized.locale,
            });

      if (!voiceTrack.url) {
        throw new AudioGenerationError('Voice generation returned no audio output.', {
          status: 502,
          code: 'voice_output_missing',
        });
      }
    }

    await updateAudioJob(jobId, {
      progress: 76,
      message: 'Mixing final soundtrack…',
    });
    const mixedVideoBuffer = await mixAudioIntoVideo({
      sourceVideoUrl,
      soundDesignUrl: soundDesign.url,
      musicUrl: music.url,
      voiceUrl: voiceTrack?.url ?? null,
    });

    await updateAudioJob(jobId, {
      progress: 91,
      message: 'Uploading final render…',
    });
    const uploaded = await uploadAudioRenderVideo({
      userId: params.userId,
      jobId,
      videoBuffer: mixedVideoBuffer,
    });

    const finalSettingsSnapshotJson = buildProviderSnapshot(initialSettingsSnapshot, {
      soundDesign: {
        providerKey: soundDesign.providerKey,
        providerLabel: soundDesign.providerLabel,
        model: soundDesign.model,
        requestId: soundDesign.requestId ?? null,
      },
      music: {
        providerKey: music.providerKey,
        providerLabel: music.providerLabel,
        model: music.model,
        requestId: music.requestId ?? null,
      },
      tts:
        voiceTrack && normalized.voiceMode !== 'clone'
          ? {
              providerKey: voiceTrack.providerKey,
              providerLabel: voiceTrack.providerLabel,
              model: voiceTrack.model,
              requestId: voiceTrack.requestId ?? null,
            }
          : null,
      voiceClone:
        voiceTrack && normalized.voiceMode === 'clone'
          ? {
              providerKey: voiceTrack.providerKey,
              providerLabel: voiceTrack.providerLabel,
              model: voiceTrack.model,
              requestId: voiceTrack.requestId ?? null,
            }
          : null,
      source: {
        durationSec,
        hasSourceAudio: sourceProbe.hasAudio,
      },
    });

    await updateAudioJob(jobId, {
      status: 'completed',
      progress: 100,
      message: 'Audio render complete.',
      videoUrl: uploaded.videoUrl,
      thumbUrl: uploaded.thumbUrl ?? initialThumb,
      hasAudio: true,
      paymentStatus: 'paid_wallet',
      settingsSnapshotJson: finalSettingsSnapshotJson,
    });

    return {
      ok: true,
      jobId,
      videoUrl: uploaded.videoUrl,
      thumbUrl: uploaded.thumbUrl ?? initialThumb,
      status: 'completed',
      progress: 100,
      pricing: pricingSnapshot,
      paymentStatus: 'paid_wallet',
      sourceJobId: sourceJob?.job_id ?? null,
    };
  } catch (error) {
    const providerFailures = parseProviderFailures(error);
    const message =
      error instanceof AudioGenerationError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Audio generation failed.';

    await updateAudioJob(jobId, {
      status: 'failed',
      progress: 0,
      message,
      paymentStatus: 'refunded_wallet',
      settingsSnapshotJson:
        providerFailures && providerFailures.length
          ? buildProviderSnapshot(initialSettingsSnapshot, { failures: providerFailures })
          : JSON.stringify(initialSettingsSnapshot),
    });
    await refundAudioCharge({
      userId: params.userId,
      jobId,
      amountCents,
      currency: pricingSnapshot.currency,
      description: `${packConfig.label} refund`,
      billingProductKey: packConfig.billingProductKey,
      pricingSnapshotJson,
    });

    if (error instanceof AudioGenerationError) {
      throw error;
    }

    throw new AudioGenerationError(message, {
      status: 502,
      code: 'audio_generation_failed',
      providerFailures,
    });
  }
}
