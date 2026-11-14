import { audioJobMediaUrl } from '@/lib/audio-job-media';
import { generationStage } from '@/lib/generation-observation';
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
  AudioJobDetail,
  ActiveAudioJobState,
  AudioResultState,
  SourceVideoState,
} from '../_lib/audio-workspace-types';

type UseAudioWorkspaceRestorationArgs = {
  copy: AudioWorkspaceCopy;
  queryJobId: string | null;
  user: { id: string } | null | undefined;
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
  const userId = user?.id;
  const manualWorkspaceOverrideRef = useRef(false);

  const hydrateSourceVideo = useCallback(async (input: {
    audioJobId: string;
    isCurrent: () => boolean;
    sourceJobId?: string | null;
    sourceVideoUrl?: string | null;
    fallbackAspectRatio?: string | null;
  }) => {
    const sourceJobId = input.sourceJobId?.trim() || null;
    if (sourceJobId) {
      try {
        const sourceJob = await fetchJobDetail(sourceJobId);
        if (!input.isCurrent()) return;
        if (sourceJob.videoUrl) {
          setSourceVideo({
            url: sourceJob.videoUrl,
            accessUrl: audioJobMediaUrl(input.audioJobId, 'source'),
            readAccessOwnerId: userId,
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
        // Fall back to the stored source, using a fresh read grant for its metadata.
      }
    }

    const sourceVideoUrl = input.sourceVideoUrl?.trim() || null;
    if (!input.isCurrent()) return;
    if (!sourceVideoUrl) {
      setSourceVideo(null);
      return;
    }
    const accessUrl = audioJobMediaUrl(input.audioJobId, 'source');
    const durationSec = await probeVideoDuration(accessUrl);
    if (!input.isCurrent()) return;
    setSourceVideo({
      url: sourceVideoUrl,
      accessUrl,
      readAccessOwnerId: userId,
      jobId: sourceJobId,
      thumbUrl: null,
      durationSec,
      aspectRatio: input.fallbackAspectRatio ?? null,
      label: sourceJobId
        ? formatCopy(copy.source.jobLabel, { id: sourceJobId })
        : copy.source.restoredLabel,
    });
  }, [copy, setSourceVideo, userId]);

  const restoreAudioJob = useCallback(
    async (detail: AudioJobDetail, isCurrent: () => boolean) => {
      if (!isCurrent()) {
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

      const status =
        (detail.videoUrl || detail.audioUrl)
          ? 'completed'
          : detail.status ?? 'pending';
      const progress = typeof detail.progress === 'number' ? detail.progress : status === 'completed' ? 100 : 0;

      const normalizedJob: ActiveAudioJobState = {
        startedAt: detail.createdAt ? Date.parse(detail.createdAt) : undefined,
        observation: { stage: generationStage(detail.status) },
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

      await hydrateSourceVideo({
        audioJobId: detail.jobId,
        isCurrent,
        sourceJobId: detail.settingsSnapshot?.sourceJobId ?? null,
        sourceVideoUrl:
          detail.settingsSnapshot?.refs?.sourceVideoUrl ??
          detail.settingsSnapshot?.sourceVideoUrl ??
          null,
        fallbackAspectRatio: detail.aspectRatio ?? null,
      });
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
    if (!queryJobId || !userId) return;
    let cancelled = false;
    const isCurrent = () => !cancelled && !manualWorkspaceOverrideRef.current;
    setNotice(null);
    fetchJobDetail(queryJobId)
      .then(async (payload) => {
        if (!isCurrent()) return;
        if (payload.surface === 'audio') {
          await restoreAudioJob(payload, isCurrent);
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
        if (isCurrent()) {
          setNotice(resolveUiErrorMessage(error, copy.messages.loadSourceJob, ['Unable to load job.']));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [copy, queryJobId, restoreAudioJob, setActiveJob, setNotice, setResult, setSourceVideo, userId]);

  useEffect(() => {
    if (queryJobId || !userId) return;
    let cancelled = false;
    const isCurrent = () => !cancelled && !manualWorkspaceOverrideRef.current;
    authFetch('/api/jobs?surface=audio&limit=12')
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as
          | { ok?: boolean; error?: string; jobs?: Job[] }
          | null;
        if (!response.ok || !payload?.ok || !Array.isArray(payload.jobs)) {
          throw new Error(payload?.error ?? copy.messages.loadLatestJob);
        }
        const latestJob =
          payload.jobs.find((job) => job.surface === 'audio' && Boolean(job.videoUrl)) ??
          null;
        if (!latestJob || !isCurrent()) return;
        const detail = await fetchJobDetail(latestJob.jobId);
        await restoreAudioJob(detail, isCurrent);
      })
      .catch((error) => {
        if (!cancelled) {
          console.warn('[audio] latest job restore failed', error);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [copy, queryJobId, restoreAudioJob, userId]);

  return { manualWorkspaceOverrideRef };
}
