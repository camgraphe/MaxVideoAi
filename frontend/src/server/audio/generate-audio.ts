import { randomUUID } from 'node:crypto';

import {
  AUDIO_MAX_DURATION_SEC,
  AUDIO_MIN_DURATION_SEC,
  AUDIO_PROMPT_MAX_LENGTH,
  AUDIO_SCRIPT_MAX_LENGTH,
  AUDIO_SURFACE,
  buildAudioPricingSnapshot,
  coerceAudioIntensity,
  coerceAudioLanguage,
  coerceAudioMood,
  coerceAudioPackId,
  coerceAudioVoiceDelivery,
  coerceAudioVoiceGender,
  coerceAudioVoiceProfile,
  estimateVoiceScriptDurationSec,
  formatAudioDurationLabel,
  getAudioPackConfig,
  resolveAudioOutputKind,
  resolveAudioVoiceMode,
  type AudioGenerateRequestBody,
  type AudioIntensity,
  type AudioLanguage,
  type AudioGenerateResponse,
  type AudioMood,
  type AudioOutputKind,
  type AudioPackId,
  type AudioVoiceDelivery,
  type AudioVoiceGender,
  type AudioVoiceProfile,
  type AudioVoiceMode,
} from '@/lib/audio-generation';
import { isDatabaseConfigured, query, withDbTransaction } from '@/lib/db';
import { ensureBillingSchema } from '@/lib/schema';
import { reserveWalletChargeInExecutor } from '@/lib/wallet';
import {
  mixAudioIntoVideo,
  mixAudioTracks,
  inspectSourceVideo,
  resolveAudioAspectRatio,
  uploadAudioRenderAudio,
  uploadAudioRenderVideo,
} from '@/server/audio/media';
import {
  generateClonedVoiceTrack,
  generateMusicTrack,
  generateSoundDesignTrack,
  generateStandardVoiceTrack,
  type AudioProviderError,
} from '@/server/audio/providers';

const PLACEHOLDER_THUMB = '/assets/frames/thumb-16x9.svg';

type NormalizedAudioGenerateInput = {
  sourceVideoUrl: string | null;
  sourceJobId: string | null;
  pack: AudioPackId;
  prompt: string | null;
  mood: AudioMood | null;
  intensity: AudioIntensity;
  script: string | null;
  voiceSampleUrl: string | null;
  voiceGender: AudioVoiceGender | null;
  voiceProfile: AudioVoiceProfile | null;
  voiceDelivery: AudioVoiceDelivery | null;
  language: AudioLanguage | null;
  durationSec: number | null;
  musicEnabled: boolean;
  exportAudioFile: boolean;
  locale: string | null;
  voiceMode: AudioVoiceMode | null;
  outputKind: AudioOutputKind;
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

function normalizeOptionalInteger(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
  if (typeof value === 'string' && value.trim().length) {
    const parsed = Number.parseInt(value.trim(), 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeOptionalBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return null;
}

function validateTextLength(value: string | null, maxLength: number, field: string, label: string): void {
  if (value && value.length > maxLength) {
    throw new AudioGenerationError(`${label} must be ${maxLength} characters or fewer.`, {
      status: 400,
      code: `${field}_too_long`,
      field,
    });
  }
}

function validateAudioDurationInRange(
  durationSec: number,
  options: { field: string; code: string; label: string }
): number {
  if (!Number.isFinite(durationSec) || durationSec < AUDIO_MIN_DURATION_SEC || durationSec > AUDIO_MAX_DURATION_SEC) {
    throw new AudioGenerationError(
      `${options.label} must be between ${formatAudioDurationLabel(AUDIO_MIN_DURATION_SEC)} and ${formatAudioDurationLabel(AUDIO_MAX_DURATION_SEC)}.`,
      {
        status: 400,
        code: options.code,
        field: options.field,
      }
    );
  }
  return Math.round(durationSec);
}

function buildPromptSummary(input: { pack: AudioPackId; prompt: string | null; mood: AudioMood | null; script: string | null }): string {
  const base = getAudioPackConfig(input.pack).label;
  if (input.script) {
    return `${base} • ${input.script.slice(0, 80).trim()}`;
  }
  if (input.prompt) {
    return `${base} • ${input.prompt.slice(0, 80).trim()}`;
  }
  if (input.mood) {
    return `${base} • ${input.mood}`;
  }
  return base;
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
    throw new AudioGenerationError('Audio mode is required.', {
      status: 400,
      code: 'audio_pack_required',
      field: 'pack',
    });
  }

  const packConfig = getAudioPackConfig(pack);
  const prompt = normalizeString(body.prompt);
  validateTextLength(prompt, AUDIO_PROMPT_MAX_LENGTH, 'prompt', 'Audio prompt');

  const sourceVideoUrl = normalizeString(body.sourceVideoUrl);
  const sourceJobId = normalizeString(body.sourceJobId);
  if (packConfig.requiresVideo && !sourceVideoUrl && !sourceJobId) {
    throw new AudioGenerationError('A source video is required.', {
      status: 400,
      code: 'source_video_required',
      field: 'sourceVideoUrl',
    });
  }
  if ((pack === 'music_only' || pack === 'cinematic') && !prompt) {
    throw new AudioGenerationError('An audio prompt is required for this mode.', {
      status: 400,
      code: 'audio_prompt_required',
      field: 'prompt',
    });
  }

  const moodValue = normalizeString(body.mood);
  const mood = moodValue ? coerceAudioMood(moodValue) : null;
  if (packConfig.requiresMood && !mood) {
    throw new AudioGenerationError('Audio mood is required.', {
      status: 400,
      code: 'audio_mood_required',
      field: 'mood',
    });
  }
  if (moodValue && !mood) {
    throw new AudioGenerationError('Audio mood is invalid.', {
      status: 400,
      code: 'audio_mood_invalid',
      field: 'mood',
    });
  }

  const intensityValue = normalizeString(body.intensity);
  const intensity = intensityValue ? coerceAudioIntensity(intensityValue) : 'standard';
  if (intensityValue && !intensity) {
    throw new AudioGenerationError('Intensity is invalid.', {
      status: 400,
      code: 'audio_intensity_invalid',
      field: 'intensity',
    });
  }

  const script = normalizeString(body.script);
  validateTextLength(script, AUDIO_SCRIPT_MAX_LENGTH, 'script', 'Narration script');
  if (packConfig.requiresScript && !script) {
    throw new AudioGenerationError('A narration script is required for this mode.', {
      status: 400,
      code: 'audio_script_required',
      field: 'script',
    });
  }

  const voiceSampleUrl = normalizeString(body.voiceSampleUrl);
  if (voiceSampleUrl && !packConfig.includesVoice) {
    throw new AudioGenerationError('Voice samples are only supported on voice modes.', {
      status: 400,
      code: 'voice_sample_not_supported',
      field: 'voiceSampleUrl',
    });
  }

  const voiceGenderValue = normalizeString(body.voiceGender);
  const voiceGender = voiceGenderValue ? coerceAudioVoiceGender(voiceGenderValue) : packConfig.includesVoice ? 'female' : null;
  if (voiceGenderValue && !voiceGender) {
    throw new AudioGenerationError('Voice type is invalid.', {
      status: 400,
      code: 'audio_voice_gender_invalid',
      field: 'voiceGender',
    });
  }
  if (!packConfig.includesVoice && voiceGenderValue) {
    throw new AudioGenerationError('Voice type is only supported on voice modes.', {
      status: 400,
      code: 'audio_voice_gender_not_supported',
      field: 'voiceGender',
    });
  }

  const voiceProfileValue = normalizeString(body.voiceProfile);
  const voiceProfile = voiceProfileValue ? coerceAudioVoiceProfile(voiceProfileValue) : packConfig.includesVoice ? 'balanced' : null;
  if (voiceProfileValue && !voiceProfile) {
    throw new AudioGenerationError('Voice option is invalid.', {
      status: 400,
      code: 'audio_voice_profile_invalid',
      field: 'voiceProfile',
    });
  }
  if (!packConfig.includesVoice && voiceProfileValue) {
    throw new AudioGenerationError('Voice options are only supported on voice modes.', {
      status: 400,
      code: 'audio_voice_profile_not_supported',
      field: 'voiceProfile',
    });
  }

  const voiceDeliveryValue = normalizeString(body.voiceDelivery);
  const voiceDelivery = voiceDeliveryValue
    ? coerceAudioVoiceDelivery(voiceDeliveryValue)
    : packConfig.includesVoice
      ? 'cinematic'
      : null;
  if (voiceDeliveryValue && !voiceDelivery) {
    throw new AudioGenerationError('Voice delivery is invalid.', {
      status: 400,
      code: 'audio_voice_delivery_invalid',
      field: 'voiceDelivery',
    });
  }
  if (!packConfig.includesVoice && voiceDeliveryValue) {
    throw new AudioGenerationError('Voice delivery is only supported on voice modes.', {
      status: 400,
      code: 'audio_voice_delivery_not_supported',
      field: 'voiceDelivery',
    });
  }

  const languageValue = normalizeString(body.language);
  const language = languageValue ? coerceAudioLanguage(languageValue) : packConfig.includesVoice ? 'auto' : null;
  if (languageValue && !language) {
    throw new AudioGenerationError('Voice language is invalid.', {
      status: 400,
      code: 'audio_language_invalid',
      field: 'language',
    });
  }
  if (!packConfig.includesVoice && languageValue) {
    throw new AudioGenerationError('Voice language is only supported on voice modes.', {
      status: 400,
      code: 'audio_language_not_supported',
      field: 'language',
    });
  }

  const musicEnabledInput = normalizeOptionalBoolean(body.musicEnabled);
  if (!packConfig.supportsMusicToggle && musicEnabledInput !== null) {
    throw new AudioGenerationError('Music toggle is not supported for this mode.', {
      status: 400,
      code: 'music_toggle_not_supported',
      field: 'musicEnabled',
    });
  }
  const exportAudioFileInput = normalizeOptionalBoolean(body.exportAudioFile);
  if (!packConfig.supportsAudioExport && exportAudioFileInput !== null) {
    throw new AudioGenerationError('Audio export is not supported for this mode.', {
      status: 400,
      code: 'audio_export_not_supported',
      field: 'exportAudioFile',
    });
  }

  const durationInput = normalizeOptionalInteger(body.durationSec);
  const requestedDurationSec =
    durationInput == null
      ? null
      : validateAudioDurationInRange(durationInput, {
          field: 'durationSec',
          code: 'audio_duration_invalid',
          label: 'Duration',
        });
  if (pack === 'music_only' && !sourceVideoUrl && !sourceJobId && durationInput == null) {
    throw new AudioGenerationError('Duration is required when generating music without a video.', {
      status: 400,
      code: 'audio_duration_required',
      field: 'durationSec',
    });
  }

  const locale = normalizeString(body.locale);

  return {
    sourceVideoUrl,
    sourceJobId,
    pack,
    prompt,
    mood,
    intensity: intensity ?? 'standard',
    script,
    voiceSampleUrl,
    voiceGender,
    voiceProfile,
    voiceDelivery,
    language,
    durationSec: requestedDurationSec,
    musicEnabled: packConfig.supportsMusicToggle ? musicEnabledInput ?? packConfig.defaultMusicEnabled : false,
    exportAudioFile: packConfig.supportsAudioExport ? exportAudioFileInput ?? false : false,
    locale,
    voiceMode: resolveAudioVoiceMode({ pack, voiceSampleUrl }),
    outputKind: resolveAudioOutputKind({ pack, exportAudioFile: packConfig.supportsAudioExport ? exportAudioFileInput ?? false : false }),
  };
}

async function updateAudioJob(jobId: string, patch: {
  progress?: number;
  status?: 'pending' | 'running' | 'completed' | 'failed';
  message?: string | null;
  videoUrl?: string | null;
  audioUrl?: string | null;
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

function isVideoBackedPack(pack: AudioPackId): boolean {
  return !getAudioPackConfig(pack).audioOnly;
}

export function resolveAudioRenderDuration(params: {
  pack: AudioPackId;
  sourceVideoUrl: string | null;
  requiresVideo: boolean;
  probedDurationSec: number | null;
  requestedDurationSec: number | null;
  script: string | null;
}): number {
  if (params.requiresVideo) {
    if (!params.probedDurationSec) {
      throw new AudioGenerationError('Unable to inspect the source video duration.', {
        status: 422,
        code: 'source_video_probe_failed',
        field: 'sourceVideoUrl',
      });
    }
    validateAudioDurationInRange(params.probedDurationSec, {
      field: 'sourceVideoUrl',
      code: 'source_video_duration_invalid',
      label: 'Source video',
    });
  } else if (params.sourceVideoUrl && params.probedDurationSec) {
    validateAudioDurationInRange(params.probedDurationSec, {
      field: 'sourceVideoUrl',
      code: 'source_video_duration_invalid',
      label: 'Source video',
    });
  }

  if (params.pack === 'voice_only') {
    return estimateVoiceScriptDurationSec(params.script ?? '');
  }

  if (params.pack === 'music_only') {
    return validateAudioDurationInRange(params.probedDurationSec ?? params.requestedDurationSec ?? AUDIO_MIN_DURATION_SEC, {
      field: 'durationSec',
      code: 'audio_duration_invalid',
      label: 'Duration',
    });
  }

  return validateAudioDurationInRange(params.probedDurationSec ?? AUDIO_MIN_DURATION_SEC, {
    field: 'sourceVideoUrl',
    code: 'source_video_duration_invalid',
    label: 'Source video',
  });
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
  const packConfig = getAudioPackConfig(normalized.pack);
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
  if (packConfig.requiresVideo && !sourceVideoUrl) {
    throw new AudioGenerationError('Source video is missing.', {
      status: 400,
      code: 'source_video_missing',
      field: 'sourceVideoUrl',
    });
  }

  const needsSourceProbe = Boolean(sourceVideoUrl) && (packConfig.requiresVideo || normalized.pack === 'music_only');
  const sourceProbe = needsSourceProbe && sourceVideoUrl ? await inspectSourceVideo(sourceVideoUrl) : null;
  const probedDurationSec = sourceProbe?.durationSec ? Math.round(sourceProbe.durationSec) : null;
  const durationSec = resolveAudioRenderDuration({
    pack: normalized.pack,
    sourceVideoUrl,
    requiresVideo: packConfig.requiresVideo,
    probedDurationSec,
    requestedDurationSec: normalized.durationSec,
    script: normalized.script,
  });

  const aspectRatio =
    sourceJob?.aspect_ratio ??
    resolveAudioAspectRatio(sourceProbe?.width ?? null, sourceProbe?.height ?? null) ??
    (isVideoBackedPack(normalized.pack) ? '16:9' : null);
  const pricingSnapshot = buildAudioPricingSnapshot({
    pack: normalized.pack,
    durationSec,
    mood: normalized.mood ?? null,
    voiceMode: normalized.voiceMode,
    script: normalized.script,
    musicEnabled: normalized.musicEnabled,
  });
  const pricingSnapshotJson = JSON.stringify(pricingSnapshot);
  const promptSummary = buildPromptSummary({
    pack: normalized.pack,
    prompt: normalized.prompt,
    mood: normalized.mood,
    script: normalized.script,
  });
  const initialSettingsSnapshot = {
    schemaVersion: 2,
    surface: AUDIO_SURFACE,
    pack: normalized.pack,
    prompt: normalized.prompt,
    mood: normalized.mood,
    intensity: normalized.intensity,
    durationSec,
    script: normalized.script,
    musicEnabled: normalized.musicEnabled,
    exportAudioFile: normalized.exportAudioFile,
    voiceMode: normalized.voiceMode,
    voiceGender: normalized.voiceGender,
    voiceProfile: normalized.voiceProfile,
    voiceDelivery: normalized.voiceDelivery,
    language: normalized.language,
    outputKind: normalized.outputKind,
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
      applicationFeeCents: pricingSnapshot.platformFeeCents ?? pricingSnapshot.margin.amountCents,
      vendorAccountId: pricingSnapshot.vendorAccountId ?? null,
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
    message: sourceVideoUrl ? 'Preparing source media…' : 'Preparing audio render…',
  });

  try {
    let soundDesign: Awaited<ReturnType<typeof generateSoundDesignTrack>> | null = null;
    let music: Awaited<ReturnType<typeof generateMusicTrack>> | null = null;
    let voiceTrack: Awaited<ReturnType<typeof generateStandardVoiceTrack>> | null = null;

    if (normalized.pack === 'cinematic' || normalized.pack === 'cinematic_voice') {
      await updateAudioJob(jobId, {
        progress: 24,
        message: 'Generating cinematic sound design…',
      });
      soundDesign = await generateSoundDesignTrack({
        sourceVideoUrl: sourceVideoUrl!,
        durationSec,
        mood: normalized.mood!,
        intensity: normalized.intensity,
        prompt: normalized.prompt,
      });
    }

    if (normalized.pack === 'music_only' || ((normalized.pack === 'cinematic' || normalized.pack === 'cinematic_voice') && normalized.musicEnabled)) {
      await updateAudioJob(jobId, {
        progress: 44,
        message: normalized.pack === 'music_only' ? 'Generating music track…' : 'Generating music bed…',
      });
      music = await generateMusicTrack({
        durationSec,
        mood: normalized.mood!,
        intensity: normalized.intensity,
        prompt: normalized.prompt,
      });
    }

    if ((normalized.pack === 'voice_only' || normalized.pack === 'cinematic_voice') && normalized.script) {
      await updateAudioJob(jobId, {
        progress: normalized.pack === 'voice_only' ? 56 : 62,
        message:
          normalized.voiceMode === 'clone'
            ? 'Generating cloned voice over…'
            : 'Generating voice over…',
      });
      voiceTrack =
        normalized.voiceMode === 'clone' && normalized.voiceSampleUrl
          ? await generateClonedVoiceTrack({
              script: normalized.script,
              voiceSampleUrl: normalized.voiceSampleUrl,
              locale: normalized.locale,
              language: normalized.language,
              voiceProfile: normalized.voiceProfile ?? 'balanced',
              voiceDelivery: normalized.voiceDelivery ?? 'cinematic',
            })
          : await generateStandardVoiceTrack({
              script: normalized.script,
              locale: normalized.locale,
              language: normalized.language,
              voiceGender: normalized.voiceGender ?? 'female',
              voiceProfile: normalized.voiceProfile ?? 'balanced',
              voiceDelivery: normalized.voiceDelivery ?? 'cinematic',
            });

      if (!voiceTrack.url) {
        throw new AudioGenerationError('Voice generation returned no audio output.', {
          status: 502,
          code: 'voice_output_missing',
        });
      }
    }

    let audioBuffer: Buffer | null = null;
    let videoBuffer: Buffer | null = null;

    await updateAudioJob(jobId, {
      progress: normalized.outputKind === 'audio' ? 78 : 80,
      message: normalized.outputKind === 'audio' ? 'Mastering audio file…' : 'Mixing final soundtrack…',
    });

    if (normalized.pack === 'music_only') {
      if (!music?.url) {
        throw new AudioGenerationError('Music generation returned no audio output.', {
          status: 502,
          code: 'music_output_missing',
        });
      }
      audioBuffer = await mixAudioTracks({
        musicUrl: music.url,
        targetDurationSec: durationSec,
        mixIntensity: normalized.intensity,
      });
    } else if (normalized.pack === 'voice_only') {
      if (!voiceTrack?.url) {
        throw new AudioGenerationError('Voice generation returned no audio output.', {
          status: 502,
          code: 'voice_output_missing',
        });
      }
      audioBuffer = await mixAudioTracks({
        voiceUrl: voiceTrack.url,
      });
    } else {
      if (!soundDesign?.url) {
        throw new AudioGenerationError('Sound design generation returned no audio output.', {
          status: 502,
          code: 'sound_design_output_missing',
        });
      }
      const mixed = await mixAudioIntoVideo({
        sourceVideoUrl: sourceVideoUrl!,
        soundDesignUrl: soundDesign.url,
        musicUrl: normalized.musicEnabled ? music?.url ?? null : null,
        voiceUrl: voiceTrack?.url ?? null,
        targetDurationSec: durationSec,
        mixIntensity: normalized.intensity,
      });
      audioBuffer = normalized.exportAudioFile ? mixed.audioBuffer : null;
      videoBuffer = mixed.videoBuffer;
    }

    let uploadedAudioUrl: string | null = null;
    let uploadedVideoUrl: string | null = null;
    let uploadedThumbUrl: string | null = initialThumb;

    if (audioBuffer) {
      await updateAudioJob(jobId, {
        progress: normalized.outputKind === 'audio' ? 90 : 90,
        message: normalized.outputKind === 'audio' ? 'Uploading audio render…' : 'Uploading audio export…',
      });
      const uploadedAudio = await uploadAudioRenderAudio({
        userId: params.userId,
        jobId,
        audioBuffer,
      });
      uploadedAudioUrl = uploadedAudio.audioUrl;
    }

    if (videoBuffer) {
      await updateAudioJob(jobId, {
        progress: 94,
        message: 'Uploading final render…',
      });
      const uploadedVideo = await uploadAudioRenderVideo({
        userId: params.userId,
        jobId,
        videoBuffer,
      });
      uploadedVideoUrl = uploadedVideo.videoUrl;
      uploadedThumbUrl = uploadedVideo.thumbUrl ?? initialThumb;
    }

    const finalSettingsSnapshotJson = buildProviderSnapshot(initialSettingsSnapshot, {
      soundDesign:
        soundDesign
          ? {
              providerKey: soundDesign.providerKey,
              providerLabel: soundDesign.providerLabel,
              model: soundDesign.model,
              requestId: soundDesign.requestId ?? null,
            }
          : null,
      music:
        music
          ? {
              providerKey: music.providerKey,
              providerLabel: music.providerLabel,
              model: music.model,
              requestId: music.requestId ?? null,
            }
          : null,
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
        hasSourceAudio: sourceProbe?.hasAudio ?? null,
      },
    });

    await updateAudioJob(jobId, {
      status: 'completed',
      progress: 100,
      message: 'Audio render complete.',
      videoUrl: uploadedVideoUrl,
      audioUrl: uploadedAudioUrl,
      thumbUrl: uploadedThumbUrl ?? initialThumb,
      hasAudio: true,
      paymentStatus: 'paid_wallet',
      settingsSnapshotJson: finalSettingsSnapshotJson,
    });

    return {
      ok: true,
      jobId,
      videoUrl: uploadedVideoUrl,
      audioUrl: uploadedAudioUrl,
      thumbUrl: uploadedThumbUrl ?? initialThumb,
      outputKind: normalized.outputKind,
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
