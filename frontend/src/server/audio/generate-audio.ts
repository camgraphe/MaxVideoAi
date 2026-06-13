import { randomUUID } from 'node:crypto';
import { upsertLegacyJobOutputs } from '@/server/media-library';

import {
  AUDIO_SURFACE,
  buildAudioPricingSnapshot,
  getAudioPackConfig,
  type AudioGenerateRequestBody,
  type AudioGenerateResponse,
} from '@/lib/audio-generation';
import { isDatabaseConfigured } from '@/lib/db';
import { ensureBillingSchema } from '@/lib/schema';
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
} from '@/server/audio/providers';
import {
  AudioGenerationError,
  resolveAudioRenderDuration,
  validateAudioGenerateRequest,
} from '@/server/audio/audio-generate-validation';
import {
  createInitialAudioJob,
  loadSourceJob,
  PLACEHOLDER_THUMB,
  updateAudioJob,
} from '@/server/audio/audio-generate-jobs';
import { refundAudioCharge } from '@/server/audio/audio-generate-receipts';
import {
  buildPromptSummary,
  buildProviderSnapshot,
  isVideoBackedPack,
  parseProviderFailures,
} from '@/server/audio/audio-generate-snapshots';

export {
  AudioGenerationError,
  resolveAudioRenderDuration,
  validateAudioGenerateRequest,
} from '@/server/audio/audio-generate-validation';
export type { ValidatedAudioGenerateRequest } from '@/server/audio/audio-generate-validation';

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

  await createInitialAudioJob({
    userId: params.userId,
    jobId,
    amountCents,
    currency: pricingSnapshot.currency,
    description: packConfig.label,
    billingProductKey: packConfig.billingProductKey,
    pricingSnapshotJson,
    applicationFeeCents: pricingSnapshot.platformFeeCents ?? pricingSnapshot.margin.amountCents,
    vendorAccountId: pricingSnapshot.vendorAccountId ?? null,
    engineId: packConfig.engineId,
    engineLabel: packConfig.label,
    durationSec,
    promptSummary,
    initialThumb,
    aspectRatio,
    settingsSnapshotJson: JSON.stringify(initialSettingsSnapshot),
  });

  await updateAudioJob(jobId, {
    status: 'running',
    progress: 8,
    message: sourceVideoUrl ? 'Preparing source media…' : 'Preparing audio render…',
  });

  try {
    let soundDesign: Awaited<ReturnType<typeof generateSoundDesignTrack>> | null = null;
    let music: Awaited<ReturnType<typeof generateMusicTrack>> | null = null;
    let voiceTrack: Awaited<ReturnType<typeof generateStandardVoiceTrack>> | null = null;

    if (normalized.pack === 'sfx_only' || normalized.pack === 'cinematic' || normalized.pack === 'cinematic_voice') {
      await updateAudioJob(jobId, {
        progress: 24,
        message: normalized.pack === 'sfx_only' ? 'Generating sound effects…' : 'Generating cinematic sound design…',
      });
      soundDesign = await generateSoundDesignTrack({
        sourceVideoUrl,
        durationSec,
        mood: normalized.mood ?? 'epic',
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
    } else if (normalized.pack === 'sfx_only') {
      if (!soundDesign?.url) {
        throw new AudioGenerationError('Sound design generation returned no audio output.', {
          status: 502,
          code: 'sound_design_output_missing',
        });
      }
      audioBuffer = await mixAudioTracks({
        soundDesignUrl: soundDesign.url,
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

    await upsertLegacyJobOutputs({
      job_id: jobId,
      user_id: params.userId,
      surface: 'audio',
      video_url: uploadedVideoUrl,
      audio_url: uploadedAudioUrl,
      thumb_url: uploadedThumbUrl ?? initialThumb,
      preview_frame: uploadedThumbUrl ?? initialThumb,
      render_ids: null,
      duration_sec: durationSec,
      status: 'completed',
    }).catch((outputError) => {
      console.warn('[audio] failed to persist job outputs', { jobId }, outputError);
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
