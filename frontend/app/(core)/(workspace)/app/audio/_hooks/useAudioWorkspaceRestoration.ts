import { useCallback, useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';

import {
  coerceAudioIntensity,
  coerceAudioLanguage,
  coerceAudioLyria3Bpm,
  coerceAudioLyria3Model,
  coerceAudioMood,
  coerceAudioPackId,
  coerceAudioVoiceDelivery,
  coerceAudioVoiceGender,
  coerceAudioVoiceProfile,
  coerceSeedAudioOutputFormat,
  coerceSeedAudioSampleRate,
  coerceSeedAudioVoice,
  DEFAULT_SEED_AUDIO_OUTPUT_FORMAT,
  DEFAULT_AUDIO_LYRIA3_BPM,
  DEFAULT_AUDIO_LYRIA3_MODEL,
  DEFAULT_SEED_AUDIO_PITCH,
  DEFAULT_SEED_AUDIO_SAMPLE_RATE,
  DEFAULT_SEED_AUDIO_SPEED,
  DEFAULT_SEED_AUDIO_VOICE,
  DEFAULT_SEED_AUDIO_VOLUME,
  getAudioPackConfig,
  type AudioIntensity,
  type AudioLanguage,
  type AudioLyria3Bpm,
  type AudioLyria3Model,
  type AudioMood,
  type AudioOutputKind,
  type AudioPackId,
  type AudioSeedAudioOutputFormat,
  type AudioSeedAudioSampleRate,
  type AudioSeedAudioVoice,
  type AudioVoiceDelivery,
  type AudioVoiceGender,
  type AudioVoiceProfile,
} from '@/lib/audio-generation';
import { authFetch } from '@/lib/authFetch';
import type { Job } from '@/types/jobs';
import type { AudioWorkspaceCopy } from '../copy';
import {
  DEFAULT_INTENSITY,
  DEFAULT_LANGUAGE,
  DEFAULT_MANUAL_DURATION_SEC,
  DEFAULT_MOOD,
  DEFAULT_PACK,
  DEFAULT_VOICE_DELIVERY,
  DEFAULT_VOICE_GENDER,
  DEFAULT_VOICE_PROFILE,
  fetchJobDetail,
  formatCopy,
  inferOutputKind,
  probeVideoDuration,
  resolveUiErrorMessage,
} from '../_lib/audio-workspace-helpers';
import type {
  ActiveAudioJobState,
  AudioResultState,
  SourceVideoState,
} from '../_lib/audio-workspace-types';

type UseAudioWorkspaceRestorationArgs = {
  copy: AudioWorkspaceCopy;
  queryJobId: string | null;
  user: unknown;
  setActiveJob: Dispatch<SetStateAction<ActiveAudioJobState | null>>;
  setExportAudioFile: Dispatch<SetStateAction<boolean>>;
  setIntensity: Dispatch<SetStateAction<AudioIntensity>>;
  setLanguage: Dispatch<SetStateAction<AudioLanguage>>;
  setManualDurationSec: Dispatch<SetStateAction<number>>;
  setMusicBpm: Dispatch<SetStateAction<AudioLyria3Bpm>>;
  setMood: Dispatch<SetStateAction<AudioMood>>;
  setMusicModel: Dispatch<SetStateAction<AudioLyria3Model>>;
  setMusicEnabled: Dispatch<SetStateAction<boolean>>;
  setNotice: Dispatch<SetStateAction<string | null>>;
  setPack: Dispatch<SetStateAction<AudioPackId>>;
  setPrompt: Dispatch<SetStateAction<string>>;
  setResult: Dispatch<SetStateAction<AudioResultState | null>>;
  setScript: Dispatch<SetStateAction<string>>;
  setSeedAudioOutputFormat: Dispatch<SetStateAction<AudioSeedAudioOutputFormat>>;
  setSeedAudioPitch: Dispatch<SetStateAction<number>>;
  setSeedAudioSampleRate: Dispatch<SetStateAction<AudioSeedAudioSampleRate>>;
  setSeedAudioSpeed: Dispatch<SetStateAction<number>>;
  setSeedAudioVoice: Dispatch<SetStateAction<AudioSeedAudioVoice>>;
  setSeedAudioVolume: Dispatch<SetStateAction<number>>;
  setSourceVideo: Dispatch<SetStateAction<SourceVideoState | null>>;
  setVoiceDelivery: Dispatch<SetStateAction<AudioVoiceDelivery>>;
  setVoiceGender: Dispatch<SetStateAction<AudioVoiceGender>>;
  setVoiceProfile: Dispatch<SetStateAction<AudioVoiceProfile>>;
  setVoiceSample: Dispatch<SetStateAction<{ url: string; name: string } | null>>;
};

type UseAudioWorkspaceRestorationResult = {
  manualWorkspaceOverrideRef: MutableRefObject<boolean>;
};

export function useAudioWorkspaceRestoration({
  copy,
  queryJobId,
  user,
  setActiveJob,
  setExportAudioFile,
  setIntensity,
  setLanguage,
  setManualDurationSec,
  setMusicBpm,
  setMood,
  setMusicModel,
  setMusicEnabled,
  setNotice,
  setPack,
  setPrompt,
  setResult,
  setScript,
  setSeedAudioOutputFormat,
  setSeedAudioPitch,
  setSeedAudioSampleRate,
  setSeedAudioSpeed,
  setSeedAudioVoice,
  setSeedAudioVolume,
  setSourceVideo,
  setVoiceDelivery,
  setVoiceGender,
  setVoiceProfile,
  setVoiceSample,
}: UseAudioWorkspaceRestorationArgs): UseAudioWorkspaceRestorationResult {
  const restoredQueryJobRef = useRef<string | null>(null);
  const latestRestoreAttemptedRef = useRef(false);
  const manualWorkspaceOverrideRef = useRef(false);

  const hydrateSourceVideo = useCallback(async (input: {
    sourceJobId?: string | null;
    sourceVideoUrl?: string | null;
    fallbackAspectRatio?: string | null;
  }) => {
    const sourceJobId = input.sourceJobId?.trim() || null;
    if (sourceJobId) {
      try {
        const sourceJob = await fetchJobDetail(sourceJobId);
        if (sourceJob.videoUrl) {
          setSourceVideo({
            url: sourceJob.videoUrl,
            jobId: sourceJob.jobId,
            thumbUrl: sourceJob.thumbUrl ?? null,
            durationSec: typeof sourceJob.durationSec === 'number' ? sourceJob.durationSec : null,
            aspectRatio: sourceJob.aspectRatio ?? input.fallbackAspectRatio ?? null,
            label: sourceJob.engineLabel
              ? formatCopy(copy.source.sourceLabel, { label: sourceJob.engineLabel })
              : formatCopy(copy.source.jobLabel, { id: sourceJob.jobId }),
          });
          return;
        }
      } catch {
        // Fall back to the raw URL below.
      }
    }

    const sourceVideoUrl = input.sourceVideoUrl?.trim() || null;
    if (!sourceVideoUrl) {
      setSourceVideo(null);
      return;
    }
    const durationSec = await probeVideoDuration(sourceVideoUrl);
    setSourceVideo({
      url: sourceVideoUrl,
      jobId: sourceJobId,
      thumbUrl: null,
      durationSec,
      aspectRatio: input.fallbackAspectRatio ?? null,
      label: sourceJobId
        ? formatCopy(copy.source.jobLabel, { id: sourceJobId })
        : copy.source.restoredLabel,
    });
  }, [copy, setSourceVideo]);

  const restoreAudioJob = useCallback(
    async (jobId: string) => {
      const detail = await fetchJobDetail(jobId);
      if (manualWorkspaceOverrideRef.current) {
        return;
      }
      const nextPack = coerceAudioPackId(detail.settingsSnapshot?.pack) ?? DEFAULT_PACK;
      const nextMood = coerceAudioMood(detail.settingsSnapshot?.mood) ?? DEFAULT_MOOD;
      const nextIntensity = coerceAudioIntensity(detail.settingsSnapshot?.intensity) ?? DEFAULT_INTENSITY;
      const nextMusicEnabled =
        typeof detail.settingsSnapshot?.musicEnabled === 'boolean'
          ? detail.settingsSnapshot.musicEnabled
          : getAudioPackConfig(nextPack).supportsMusicToggle
            ? getAudioPackConfig(nextPack).defaultMusicEnabled
            : false;
      const nextExportAudioFile =
        typeof detail.settingsSnapshot?.exportAudioFile === 'boolean'
          ? detail.settingsSnapshot.exportAudioFile
          : false;
      const nextOutputKind: AudioOutputKind = inferOutputKind({
        outputKind: detail.settingsSnapshot?.outputKind ?? null,
        videoUrl: detail.videoUrl ?? null,
        audioUrl: detail.audioUrl ?? null,
      });

      setPack(nextPack);
      setPrompt(detail.settingsSnapshot?.prompt ?? '');
      setMood(nextMood);
      setIntensity(nextIntensity);
      setMusicModel(coerceAudioLyria3Model(detail.settingsSnapshot?.musicModel) ?? DEFAULT_AUDIO_LYRIA3_MODEL);
      setMusicBpm(coerceAudioLyria3Bpm(detail.settingsSnapshot?.musicBpm) ?? DEFAULT_AUDIO_LYRIA3_BPM);
      setScript(detail.settingsSnapshot?.script ?? '');
      setVoiceGender(coerceAudioVoiceGender(detail.settingsSnapshot?.voiceGender) ?? DEFAULT_VOICE_GENDER);
      setVoiceProfile(coerceAudioVoiceProfile(detail.settingsSnapshot?.voiceProfile) ?? DEFAULT_VOICE_PROFILE);
      setVoiceDelivery(coerceAudioVoiceDelivery(detail.settingsSnapshot?.voiceDelivery) ?? DEFAULT_VOICE_DELIVERY);
      setLanguage(coerceAudioLanguage(detail.settingsSnapshot?.language) ?? DEFAULT_LANGUAGE);
      setSeedAudioVoice(coerceSeedAudioVoice(detail.settingsSnapshot?.seedAudioVoice) ?? DEFAULT_SEED_AUDIO_VOICE);
      setSeedAudioOutputFormat(
        coerceSeedAudioOutputFormat(detail.settingsSnapshot?.seedAudioOutputFormat) ?? DEFAULT_SEED_AUDIO_OUTPUT_FORMAT
      );
      setSeedAudioSampleRate(
        coerceSeedAudioSampleRate(detail.settingsSnapshot?.seedAudioSampleRate) ?? DEFAULT_SEED_AUDIO_SAMPLE_RATE
      );
      setSeedAudioSpeed(
        typeof detail.settingsSnapshot?.seedAudioSpeed === 'number'
          ? detail.settingsSnapshot.seedAudioSpeed
          : DEFAULT_SEED_AUDIO_SPEED
      );
      setSeedAudioVolume(
        typeof detail.settingsSnapshot?.seedAudioVolume === 'number'
          ? detail.settingsSnapshot.seedAudioVolume
          : DEFAULT_SEED_AUDIO_VOLUME
      );
      setSeedAudioPitch(
        typeof detail.settingsSnapshot?.seedAudioPitch === 'number'
          ? detail.settingsSnapshot.seedAudioPitch
          : DEFAULT_SEED_AUDIO_PITCH
      );
      setManualDurationSec(
        typeof detail.settingsSnapshot?.durationSec === 'number'
          ? detail.settingsSnapshot.durationSec
          : DEFAULT_MANUAL_DURATION_SEC
      );
      setMusicEnabled(nextMusicEnabled);
      setExportAudioFile(nextExportAudioFile);
      setVoiceSample(null);

      await hydrateSourceVideo({
        sourceJobId: detail.settingsSnapshot?.sourceJobId ?? null,
        sourceVideoUrl:
          detail.settingsSnapshot?.refs?.sourceVideoUrl ??
          detail.settingsSnapshot?.sourceVideoUrl ??
          null,
        fallbackAspectRatio: detail.aspectRatio ?? null,
      });

      const status =
        (detail.videoUrl || detail.audioUrl)
          ? 'completed'
          : detail.status ?? 'pending';
      const progress = typeof detail.progress === 'number' ? detail.progress : status === 'completed' ? 100 : 0;

      const normalizedJob: ActiveAudioJobState = {
        jobId: detail.jobId,
        status,
        progress,
        message: detail.message ?? null,
        videoUrl: detail.videoUrl ?? null,
        audioUrl: detail.audioUrl ?? null,
        thumbUrl: detail.thumbUrl ?? null,
        outputKind: nextOutputKind,
      };
      setActiveJob(normalizedJob);

      if (detail.videoUrl || detail.audioUrl) {
        setResult({
          jobId: detail.jobId,
          videoUrl: detail.videoUrl ?? null,
          audioUrl: detail.audioUrl ?? null,
          thumbUrl: detail.thumbUrl ?? null,
          outputKind: nextOutputKind,
        });
      } else {
        setResult(null);
      }
    },
    [
      hydrateSourceVideo,
      setActiveJob,
      setExportAudioFile,
      setIntensity,
      setLanguage,
      setManualDurationSec,
      setMusicBpm,
      setMood,
      setMusicModel,
      setMusicEnabled,
      setPack,
      setPrompt,
      setResult,
      setScript,
      setSeedAudioOutputFormat,
      setSeedAudioPitch,
      setSeedAudioSampleRate,
      setSeedAudioSpeed,
      setSeedAudioVoice,
      setSeedAudioVolume,
      setVoiceDelivery,
      setVoiceGender,
      setVoiceProfile,
      setVoiceSample,
    ]
  );

  useEffect(() => {
    if (!queryJobId || !user) return;
    if (restoredQueryJobRef.current === queryJobId) return;
    restoredQueryJobRef.current = queryJobId;
    let cancelled = false;
    setNotice(null);
    fetchJobDetail(queryJobId)
      .then(async (payload) => {
        if (cancelled) return;
        if (payload.surface === 'audio') {
          await restoreAudioJob(payload.jobId);
          return;
        }
        if (manualWorkspaceOverrideRef.current) {
          return;
        }
        if (!payload.videoUrl) {
          throw new Error(payload.error ?? copy.messages.loadSourceJob);
        }
        setActiveJob(null);
        setResult(null);
        setSourceVideo({
          url: payload.videoUrl,
          jobId: payload.jobId,
          thumbUrl: payload.thumbUrl ?? null,
          durationSec: typeof payload.durationSec === 'number' ? payload.durationSec : null,
          aspectRatio: payload.aspectRatio ?? null,
          label: payload.engineLabel
            ? formatCopy(copy.source.sourceLabel, { label: payload.engineLabel })
            : formatCopy(copy.source.jobLabel, { id: payload.jobId }),
        });
      })
      .catch((error) => {
        if (!cancelled) {
          restoredQueryJobRef.current = null;
          setNotice(resolveUiErrorMessage(error, copy.messages.loadSourceJob, ['Unable to load job.']));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [copy, queryJobId, restoreAudioJob, setActiveJob, setNotice, setResult, setSourceVideo, user]);

  useEffect(() => {
    if (queryJobId || !user) return;
    if (latestRestoreAttemptedRef.current) return;
    latestRestoreAttemptedRef.current = true;
    let cancelled = false;
    authFetch('/api/jobs?surface=audio&limit=12')
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as
          | { ok?: boolean; error?: string; jobs?: Job[] }
          | null;
        if (!response.ok || !payload?.ok || !Array.isArray(payload.jobs)) {
          throw new Error(payload?.error ?? copy.messages.loadLatestJob);
        }
        const latestJob =
          payload.jobs.find((job) => job.surface === 'audio' && Boolean(job.videoUrl || job.audioUrl)) ??
          null;
        if (!latestJob || cancelled) return;
        if (manualWorkspaceOverrideRef.current) return;
        await restoreAudioJob(latestJob.jobId);
      })
      .catch((error) => {
        if (!cancelled) {
          console.warn('[audio] latest job restore failed', error);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [copy, queryJobId, restoreAudioJob, user]);

  return { manualWorkspaceOverrideRef };
}
