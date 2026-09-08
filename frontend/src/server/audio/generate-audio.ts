import { buildAudioRunReservation, type ReservedAudioRun } from './audio-run-reservation';
import { detectMediaBufferDuration } from '@/server/media/detect-has-audio';
import { upsertLegacyJobOutputs } from '@/server/media-library';

import {
  type AudioGenerateRequestBody,
  type AudioGenerateResponse,
} from '@/lib/audio-generation';
import { prepareAudioRun, assertExpectedAudioQuote } from './prepare-audio';
import { generateSongTrack, generateAmbienceTrack, generateMinimaxVoiceTrack } from './providers/standalone';
import { isDatabaseConfigured } from '@/lib/db';
import { ensureBillingSchema } from '@/lib/schema';
import {
  mixAudioIntoVideo,
  mixAudioTracks,
  uploadAudioRenderAudio,
  uploadAudioRenderVideo,
  persistOriginalAudio,
} from '@/server/audio/media';
import {
  generateClonedVoiceTrack,
  generateMusicTrack,
  generateSoundDesignTrack,
  generateStandardVoiceTrack,
} from '@/server/audio/providers';
import {
  AudioGenerationError,
} from '@/server/audio/audio-generate-validation';
import {
  createInitialAudioJob,
  updateAudioJob,
} from '@/server/audio/audio-generate-jobs';
import { refundAudioCharge } from '@/server/audio/audio-generate-receipts';
import {
  buildProviderSnapshot,
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

  const prepared = await prepareAudioRun(params.body, params.userId);
  assertExpectedAudioQuote(params.body.expectedQuote, { inputKey: prepared.inputKey, pricing: prepared.pricingSnapshot });
  const reservation = buildAudioRunReservation(prepared, params.userId);
  await createInitialAudioJob(reservation.initialJob);
  return executeReservedAudioRun(reservation.execution);
}

/** Shared provider execution after a committed wallet/job reservation. It never reserves a second charge. */
export async function executeReservedAudioRun(params: ReservedAudioRun): Promise<AudioGenerateResponse> {
  const { jobId, initialSettingsSnapshot, initialThumb } = params;
  const { normalized, sourceJob, sourceVideoUrl, sourceProbe, durationSec, pricingSnapshot } = params.prepared;

  try {
    await updateAudioJob(jobId, {
      status: 'running',
      progress: 8,
      message: sourceVideoUrl ? 'Preparing source media…' : 'Preparing audio render…',
    });
    let soundDesign: Awaited<ReturnType<typeof generateSoundDesignTrack>> | null = null;
    let music: Awaited<ReturnType<typeof generateMusicTrack>> | null = null;
    if (normalized.pack === 'song') music = await generateSongTrack({ prompt: normalized.prompt!, lyrics: normalized.lyrics! });
    if (normalized.pack === 'ambience_only') soundDesign = await generateAmbienceTrack({ prompt: normalized.prompt!, durationSec });
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
        musicModel: normalized.musicModel,
        musicBpm: normalized.musicBpm,
        prompt: normalized.prompt,
      });
    }

    if ((normalized.pack === 'voice_only' || normalized.pack === 'cinematic_voice') && normalized.script) {
      await updateAudioJob(jobId, {
        progress: normalized.pack === 'voice_only' ? 56 : 62,
        message:
          normalized.voiceMode === 'clone'
            ? 'Generating reference voice over…'
            : 'Generating voice over…',
      });
      voiceTrack = normalized.voiceModel === 'minimax' ? await generateMinimaxVoiceTrack(normalized) :
        normalized.voiceMode === 'clone' && normalized.voiceSampleUrl
          ? await generateClonedVoiceTrack({
              script: normalized.script,
              voiceSampleUrl: normalized.voiceSampleUrl,
              locale: normalized.locale,
              language: normalized.language,
              voiceProfile: normalized.voiceProfile ?? 'balanced',
              voiceDelivery: normalized.voiceDelivery ?? 'cinematic',
              seedAudioOutputFormat: normalized.seedAudioOutputFormat,
              seedAudioSampleRate: normalized.seedAudioSampleRate,
              seedAudioSpeed: normalized.seedAudioSpeed,
              seedAudioVolume: normalized.seedAudioVolume,
              seedAudioPitch: normalized.seedAudioPitch,
            })
          : await generateStandardVoiceTrack({
              script: normalized.script,
              locale: normalized.locale,
              language: normalized.language,
              voiceGender: normalized.voiceGender ?? 'female',
              voiceProfile: normalized.voiceProfile ?? 'balanced',
              voiceDelivery: normalized.voiceDelivery ?? 'cinematic',
              seedAudioVoice: normalized.seedAudioVoice,
              seedAudioOutputFormat: normalized.seedAudioOutputFormat,
              seedAudioSampleRate: normalized.seedAudioSampleRate,
              seedAudioSpeed: normalized.seedAudioSpeed,
              seedAudioVolume: normalized.seedAudioVolume,
              seedAudioPitch: normalized.seedAudioPitch,
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

    const original = normalized.pack === 'song' ? music : normalized.pack === 'ambience_only' ? soundDesign : normalized.pack === 'voice_only' && normalized.seedAudioOutputFormat !== 'pcm' ? voiceTrack : null;
    const persistedOriginal = original?.url ? await persistOriginalAudio({ userId: params.userId, jobId, url: original.url }) : null;

    if (persistedOriginal) {
      // Keep exact provider bytes; full song and spoken script are not truncated to an estimate.
    } else if (normalized.pack === 'music_only') {
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

    let uploadedAudioUrl: string | null = persistedOriginal?.audioUrl ?? null;
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

    const outputBuffer = audioBuffer ?? videoBuffer;
    const measuredDurationSec = persistedOriginal?.durationSec ?? (outputBuffer ? await detectMediaBufferDuration(outputBuffer, { streamSelector: 'audio' }) : null);
    const finalSettingsSnapshotJson = buildProviderSnapshot({ ...initialSettingsSnapshot, measuredDurationSec, durationSec: measuredDurationSec ?? durationSec, mediaFacts: measuredDurationSec ? { source: 'probe', durationSec: measuredDurationSec } : null }, {
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
      source: sourceVideoUrl ? {
        durationSec: sourceProbe?.durationSec ?? null,
        hasSourceAudio: sourceProbe?.hasAudio ?? null,
      } : null,
    });

    await updateAudioJob(jobId, {
      status: 'completed',
      durationSec: measuredDurationSec ?? durationSec,
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
      duration_sec: Math.ceil(measuredDurationSec ?? durationSec),
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
      durationSec: measuredDurationSec,
      requestedDurationSec: normalized.durationSec,
      mediaFacts: measuredDurationSec ? { source: 'probe', durationSec: measuredDurationSec } : null,
      providers: JSON.parse(finalSettingsSnapshotJson).providers,
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
      // A failed job remains visibly charged until exact receipt reconciliation
      // commits. Existing readers treat this as a recoverable pending refund.
      paymentStatus: 'paid_wallet',
      settingsSnapshotJson:
        providerFailures && providerFailures.length
          ? buildProviderSnapshot(initialSettingsSnapshot, { failures: providerFailures })
          : JSON.stringify(initialSettingsSnapshot),
    });
    try {
      await refundAudioCharge({ userId: params.userId, jobId });
    } catch (refundError) {
      console.error('[audio] wallet refund reconciliation pending', { jobId }, refundError);
      throw new AudioGenerationError(`${message} Wallet refund reconciliation is pending.`, {
        status: 502,
        code: 'audio_refund_reconciliation_pending',
        providerFailures,
      });
    }

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
