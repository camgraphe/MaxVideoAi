'use client';

/* eslint-disable @next/next/no-img-element */

import deepmerge from 'deepmerge';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { useRequireAuth } from '@/hooks/useRequireAuth';
import { authFetch } from '@/lib/authFetch';
import { getJobStatus, runAudioGenerate } from '@/lib/api';
import { useI18n } from '@/lib/i18n/I18nProvider';
import type { Job } from '@/types/jobs';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';
import {
  AUDIO_INTENSITY_VALUES,
  AUDIO_LANGUAGE_VALUES,
  AUDIO_MOOD_VALUES,
  AUDIO_VOICE_DELIVERY_VALUES,
  AUDIO_VOICE_PROFILE_VALUES,
  buildAudioPricingSnapshot,
  coerceAudioIntensity,
  coerceAudioLanguage,
  coerceAudioMood,
  coerceAudioPackId,
  coerceAudioVoiceDelivery,
  coerceAudioVoiceGender,
  coerceAudioVoiceProfile,
  estimateVoiceScriptDurationSec,
  getAudioPackConfig,
  type AudioIntensity,
  type AudioLanguage,
  type AudioMood,
  type AudioOutputKind,
  type AudioPackId,
  type AudioVoiceDelivery,
  type AudioVoiceGender,
  type AudioVoiceProfile,
} from '@/lib/audio-generation';
import AudioLatestRendersRail from './AudioLatestRendersRail';
import {
  buildAudioModeOptions,
  DEFAULT_AUDIO_WORKSPACE_COPY,
  formatAudioOutputKind,
  translateAudioProcessingMessage,
  type AudioWorkspaceCopy,
} from './copy';

type SourceVideoState = {
  url: string;
  jobId?: string | null;
  thumbUrl?: string | null;
  durationSec?: number | null;
  aspectRatio?: string | null;
  label: string;
};

type GeneratedSourceVideo = {
  jobId: string;
  url: string;
  thumbUrl: string | null;
  durationSec: number | null;
  aspectRatio: string | null;
  label: string;
  createdAt: string;
  hasAudio: boolean;
};

type AudioJobSettingsSnapshot = {
  pack?: string | null;
  mood?: string | null;
  intensity?: string | null;
  durationSec?: number | null;
  script?: string | null;
  musicEnabled?: boolean | null;
  exportAudioFile?: boolean | null;
  voiceGender?: string | null;
  voiceProfile?: string | null;
  voiceDelivery?: string | null;
  language?: string | null;
  outputKind?: AudioOutputKind | null;
  sourceJobId?: string | null;
  sourceVideoUrl?: string | null;
  refs?: {
    sourceVideoUrl?: string | null;
    voiceSampleUrl?: string | null;
  } | null;
};

type AudioJobDetail = {
  ok?: boolean;
  error?: string;
  jobId: string;
  surface?: string;
  status?: 'pending' | 'running' | 'completed' | 'failed' | null;
  progress?: number | null;
  message?: string | null;
  videoUrl?: string | null;
  audioUrl?: string | null;
  thumbUrl?: string | null;
  aspectRatio?: string | null;
  engineLabel?: string | null;
  durationSec?: number | null;
  settingsSnapshot?: AudioJobSettingsSnapshot | null;
};

type ActiveAudioJobState = {
  jobId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  message: string | null;
  videoUrl: string | null;
  audioUrl: string | null;
  thumbUrl: string | null;
  outputKind: AudioOutputKind;
};

type AudioResultState = {
  jobId: string;
  videoUrl: string | null;
  audioUrl: string | null;
  thumbUrl: string | null;
  outputKind: AudioOutputKind;
};

const DURATION_OPTIONS = [3, 5, 8, 10, 15, 20] as const;
const DEFAULT_PACK: AudioPackId = 'cinematic';
const DEFAULT_MOOD: AudioMood = 'epic';
const DEFAULT_INTENSITY: AudioIntensity = 'standard';
const DEFAULT_VOICE_GENDER: AudioVoiceGender = 'female';
const DEFAULT_VOICE_PROFILE: AudioVoiceProfile = 'balanced';
const DEFAULT_VOICE_DELIVERY: AudioVoiceDelivery = 'cinematic';
const DEFAULT_LANGUAGE: AudioLanguage = 'auto';
const DEFAULT_MANUAL_DURATION_SEC = 8;
const AUDIO_VOICE_GENDER_VALUES = ['female', 'male', 'neutral'] as const;

function formatCurrency(amount: number, currency = 'USD', locale?: string): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function formatDateTime(value: string, locale?: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
}

function formatCopy(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((resolved, [key, value]) => {
    return resolved.split(`{${key}}`).join(String(value));
  }, template);
}

function resolveUiErrorMessage(
  error: unknown,
  fallback: string,
  genericMessages: string[] = []
): string {
  if (!(error instanceof Error) || !error.message.trim().length) {
    return fallback;
  }
  return genericMessages.includes(error.message) ? fallback : error.message;
}

function inferOutputKind(detail: {
  outputKind?: AudioOutputKind | null;
  videoUrl?: string | null;
  audioUrl?: string | null;
}): AudioOutputKind {
  if (detail.outputKind) return detail.outputKind;
  if (detail.videoUrl && detail.audioUrl) return 'both';
  if (detail.audioUrl) return 'audio';
  return 'video';
}

async function probeVideoDuration(url: string): Promise<number | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    const cleanup = () => {
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
    const finish = (value: number | null) => {
      cleanup();
      resolve(value);
    };

    video.preload = 'metadata';
    video.muted = true;
    video.onloadedmetadata = () => {
      finish(Number.isFinite(video.duration) ? Math.round(video.duration) : null);
    };
    video.onerror = () => finish(null);
    video.src = url;
  });
}

async function uploadAsset(file: File, kind: 'video' | 'audio'): Promise<{ url: string; name: string }> {
  const formData = new FormData();
  formData.append('file', file, file.name);
  const response = await authFetch(kind === 'video' ? '/api/uploads/video' : '/api/uploads/audio', {
    method: 'POST',
    body: formData,
  });
  const payload = (await response.json().catch(() => null)) as
    | { ok?: boolean; error?: string; asset?: { url?: string; name?: string } }
    | null;
  if (!response.ok || !payload?.ok || !payload.asset?.url) {
    throw new Error(payload?.error ?? 'Upload failed');
  }
  return {
    url: payload.asset.url,
    name: payload.asset.name ?? file.name,
  };
}

async function fetchJobDetail(jobId: string): Promise<AudioJobDetail> {
  const response = await authFetch(`/api/jobs/${encodeURIComponent(jobId)}`);
  const payload = (await response.json().catch(() => null)) as AudioJobDetail | null;
  if (!response.ok || !payload?.jobId) {
    throw new Error(payload?.error ?? 'Unable to load job.');
  }
  return payload;
}

function AudioModePicker({
  value,
  options,
  onChange,
}: {
  value: AudioPackId;
  options: Array<{ id: AudioPackId; label: string; description: string }>;
  onChange: (pack: AudioPackId) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {options.map((mode) => (
        <button
          key={mode.id}
          type="button"
          onClick={() => onChange(mode.id)}
          className={[
            'rounded-card border p-4 text-left transition',
            value === mode.id
              ? 'border-brand bg-brand/5 shadow-card'
              : 'border-border bg-surface hover:border-border-hover hover:bg-surface-hover',
          ].join(' ')}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-text-primary">{mode.label}</span>
            <span
              className={[
                'h-2.5 w-2.5 rounded-full',
                value === mode.id ? 'bg-brand' : 'bg-border',
              ].join(' ')}
            />
          </div>
          <p className="mt-2 text-sm text-text-secondary">{mode.description}</p>
        </button>
      ))}
    </div>
  );
}

function OptionPillGroup({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (next: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={[
            'rounded-full border px-3 py-1.5 text-sm font-medium transition',
            value === option.value
              ? 'border-brand bg-brand text-on-brand'
              : 'border-border bg-surface text-text-primary hover:border-border-hover hover:bg-surface-hover',
          ].join(' ')}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-card border border-border bg-surface px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-text-primary">{label}</p>
        {description ? <p className="mt-1 text-sm text-text-secondary">{description}</p> : null}
      </div>
      <span className="relative mt-1 inline-flex h-6 w-11 shrink-0 items-center">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="peer sr-only"
        />
        <span className="absolute inset-0 rounded-full bg-border transition peer-checked:bg-brand" />
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

function ResultPreview({
  result,
  sourceVideo,
  activeJob,
  isLoading,
  copy,
}: {
  result: AudioResultState | null;
  sourceVideo: SourceVideoState | null;
  activeJob: ActiveAudioJobState | null;
  isLoading: boolean;
  copy: AudioWorkspaceCopy;
}) {
  const previewThumb = result?.thumbUrl ?? sourceVideo?.thumbUrl ?? '/assets/frames/thumb-16x9.svg';
  const hasRenderableOutput = Boolean(result?.videoUrl || result?.audioUrl);
  const showOverlay = !hasRenderableOutput && (isLoading || activeJob?.status === 'pending' || activeJob?.status === 'running');
  const overlayMessage =
    translateAudioProcessingMessage(
      copy,
      activeJob?.message ?? (isLoading ? copy.preview.loadingMessage : copy.preview.processingMessage)
    ) ?? copy.preview.processingMessage;
  const overlayProgress = activeJob?.progress ?? 0;

  return (
    <section className="rounded-card border border-border bg-surface-glass-80 shadow-card">
      <div className="border-b border-border px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{copy.preview.eyebrow}</p>
        <h2 className="mt-1 text-xl font-semibold text-text-primary">{copy.preview.title}</h2>
      </div>
      <div className="p-4">
        <div className="relative overflow-hidden rounded-card border border-border bg-bg" style={{ aspectRatio: '16 / 9' }}>
          {result?.videoUrl ? (
            <video
              src={result.videoUrl}
              poster={previewThumb}
              className="h-full w-full object-cover"
              controls
              playsInline
            />
          ) : result?.audioUrl ? (
            <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.18),_transparent_48%),linear-gradient(135deg,_rgba(15,23,42,0.98),_rgba(30,41,59,0.88))] px-6 py-6 text-center">
              <img src={previewThumb} alt="" className="absolute inset-0 h-full w-full object-cover opacity-20" />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-white/15 bg-white/10">
                <img src="/assets/icons/audio.svg" alt="" className="h-10 w-10 opacity-95" />
              </div>
              <p className="relative mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-white/70">
                {formatAudioOutputKind(copy, result.outputKind)}
              </p>
              <p className="relative mt-2 text-2xl font-semibold text-white">{copy.preview.audioReady}</p>
              <div className="relative mt-5 w-full max-w-xl">
                <audio controls src={result.audioUrl} className="w-full" />
              </div>
            </div>
          ) : sourceVideo?.url ? (
            <video
              src={sourceVideo.url}
              poster={sourceVideo.thumbUrl ?? undefined}
              className="h-full w-full object-cover"
              muted
              playsInline
              loop
              autoPlay
              preload="metadata"
            />
          ) : (
            <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-bg/70 px-6 text-center">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.14),_transparent_46%)]" />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-border bg-surface shadow-card">
                <img src="/assets/icons/audio.svg" alt="" className="h-8 w-8 opacity-75" />
              </div>
              <p className="relative mt-5 text-sm font-semibold text-text-primary">{copy.preview.emptyTitle}</p>
              <p className="relative mt-2 max-w-xl text-sm text-text-secondary">{copy.preview.emptyBody}</p>
            </div>
          )}

          {showOverlay ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-on-media-dark-55 px-6 text-center text-white backdrop-blur-[2px]">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/25 border-t-white" />
              <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-white/75">{copy.preview.processingLabel}</p>
              <p className="mt-2 text-2xl font-semibold">{Math.max(0, Math.min(100, overlayProgress))}%</p>
              <p className="mt-2 max-w-lg text-sm text-white/80">{overlayMessage}</p>
            </div>
          ) : null}
        </div>

        {(result?.videoUrl || result?.audioUrl) ? (
          <div className="mt-4 flex flex-wrap gap-3">
            {result.videoUrl ? (
              <ButtonLink href={result.videoUrl} target="_blank" rel="noreferrer" variant="outline" size="sm">
                {copy.preview.openVideoFile}
              </ButtonLink>
            ) : null}
            {result.audioUrl ? (
              <ButtonLink href={result.audioUrl} target="_blank" rel="noreferrer" variant="outline" size="sm">
                {copy.preview.openAudioFile}
              </ButtonLink>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default function AudioWorkspace() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { locale, t } = useI18n();
  const { user, loading: authLoading } = useRequireAuth({ redirectIfLoggedOut: false });
  const rawCopy = t('workspace.audio', DEFAULT_AUDIO_WORKSPACE_COPY);
  const copy = useMemo<AudioWorkspaceCopy>(() => {
    return deepmerge<AudioWorkspaceCopy>(DEFAULT_AUDIO_WORKSPACE_COPY, (rawCopy ?? {}) as Partial<AudioWorkspaceCopy>);
  }, [rawCopy]);

  const [pack, setPack] = useState<AudioPackId>(DEFAULT_PACK);
  const [mood, setMood] = useState<AudioMood>(DEFAULT_MOOD);
  const [intensity, setIntensity] = useState<AudioIntensity>(DEFAULT_INTENSITY);
  const [script, setScript] = useState('');
  const [voiceGender, setVoiceGender] = useState<AudioVoiceGender>(DEFAULT_VOICE_GENDER);
  const [voiceProfile, setVoiceProfile] = useState<AudioVoiceProfile>(DEFAULT_VOICE_PROFILE);
  const [voiceDelivery, setVoiceDelivery] = useState<AudioVoiceDelivery>(DEFAULT_VOICE_DELIVERY);
  const [language, setLanguage] = useState<AudioLanguage>(DEFAULT_LANGUAGE);
  const [manualDurationSec, setManualDurationSec] = useState<number>(DEFAULT_MANUAL_DURATION_SEC);
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [exportAudioFile, setExportAudioFile] = useState(false);
  const [sourceVideo, setSourceVideo] = useState<SourceVideoState | null>(null);
  const [voiceSample, setVoiceSample] = useState<{ url: string; name: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isUploadingSource, setIsUploadingSource] = useState(false);
  const [isUploadingVoice, setIsUploadingVoice] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<AudioResultState | null>(null);
  const [activeJob, setActiveJob] = useState<ActiveAudioJobState | null>(null);
  const [generatedPickerOpen, setGeneratedPickerOpen] = useState(false);
  const [generatedVideos, setGeneratedVideos] = useState<GeneratedSourceVideo[]>([]);
  const [isGeneratedVideosLoading, setIsGeneratedVideosLoading] = useState(false);
  const [generatedVideosError, setGeneratedVideosError] = useState<string | null>(null);
  const sourceInputRef = useRef<HTMLInputElement | null>(null);
  const voiceInputRef = useRef<HTMLInputElement | null>(null);
  const restoredQueryJobRef = useRef<string | null>(null);
  const latestRestoreAttemptedRef = useRef(false);
  const manualWorkspaceOverrideRef = useRef(false);

  const queryJobId = searchParams?.get('job') ?? null;
  const packConfig = getAudioPackConfig(pack);
  const sourceVideoRequired = packConfig.requiresVideo;
  const showMood = packConfig.requiresMood;
  const showIntensity = pack !== 'voice_only';
  const showVoiceFields = packConfig.includesVoice;
  const showVoiceGender = showVoiceFields && !voiceSample;
  const showMusicToggle = packConfig.supportsMusicToggle;
  const showExportToggle = packConfig.supportsAudioExport;
  const showManualDuration = pack === 'music_only' && !sourceVideo?.url;
  const currentOutputKind: AudioOutputKind = packConfig.audioOnly ? 'audio' : exportAudioFile ? 'both' : 'video';
  const modeOptions = useMemo(() => buildAudioModeOptions(copy), [copy]);
  const intensityOptions = useMemo(
    () =>
      AUDIO_INTENSITY_VALUES.map((value) => ({
        value,
        label: copy.controls.intensities[value],
      })),
    [copy]
  );
  const moodOptions = useMemo(
    () =>
      AUDIO_MOOD_VALUES.map((value) => ({
        value,
        label: copy.controls.moods[value],
      })),
    [copy]
  );
  const voiceGenderOptions = useMemo(
    () =>
      AUDIO_VOICE_GENDER_VALUES.map((value) => ({
        value,
        label: copy.controls.voiceGenders[value],
      })),
    [copy]
  );
  const voiceProfileOptions = useMemo(
    () =>
      AUDIO_VOICE_PROFILE_VALUES.map((value) => ({
        value,
        label: copy.controls.voiceProfiles[value],
      })),
    [copy]
  );
  const voiceDeliveryOptions = useMemo(
    () =>
      AUDIO_VOICE_DELIVERY_VALUES.map((value) => ({
        value,
        label: copy.controls.voiceDeliveries[value],
      })),
    [copy]
  );
  const languageOptions = useMemo(
    () =>
      AUDIO_LANGUAGE_VALUES.map((value) => ({
        value,
        label: copy.controls.languages[value],
      })),
    [copy]
  );

  const handlePackChange = useCallback((nextPack: AudioPackId) => {
    manualWorkspaceOverrideRef.current = true;
    const nextConfig = getAudioPackConfig(nextPack);
    setPack(nextPack);
    setMusicEnabled(nextConfig.supportsMusicToggle ? nextConfig.defaultMusicEnabled : false);
    setExportAudioFile(false);
    if (!nextConfig.includesVoice) {
      setVoiceSample(null);
    }
  }, []);

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
  }, [copy]);

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
      const nextOutputKind = inferOutputKind({
        outputKind: detail.settingsSnapshot?.outputKind ?? null,
        videoUrl: detail.videoUrl ?? null,
        audioUrl: detail.audioUrl ?? null,
      });

      setPack(nextPack);
      setMood(nextMood);
      setIntensity(nextIntensity);
      setScript(detail.settingsSnapshot?.script ?? '');
      setVoiceGender(coerceAudioVoiceGender(detail.settingsSnapshot?.voiceGender) ?? DEFAULT_VOICE_GENDER);
      setVoiceProfile(coerceAudioVoiceProfile(detail.settingsSnapshot?.voiceProfile) ?? DEFAULT_VOICE_PROFILE);
      setVoiceDelivery(coerceAudioVoiceDelivery(detail.settingsSnapshot?.voiceDelivery) ?? DEFAULT_VOICE_DELIVERY);
      setLanguage(coerceAudioLanguage(detail.settingsSnapshot?.language) ?? DEFAULT_LANGUAGE);
      setManualDurationSec(typeof detail.settingsSnapshot?.durationSec === 'number' ? detail.settingsSnapshot.durationSec : DEFAULT_MANUAL_DURATION_SEC);
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
    [hydrateSourceVideo]
  );

  const fetchGeneratedVideos = useCallback(async () => {
    setIsGeneratedVideosLoading(true);
    setGeneratedVideosError(null);
    try {
      const response = await authFetch('/api/jobs?surface=video&limit=60');
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string; jobs?: Job[] }
        | null;
      if (!response.ok || !payload?.ok || !Array.isArray(payload.jobs)) {
        throw new Error(payload?.error ?? copy.messages.loadGeneratedVideos);
      }
      const next = payload.jobs
        .filter((job) => typeof job.videoUrl === 'string' && job.videoUrl.trim().length > 0)
        .map((job) => ({
          jobId: job.jobId,
          url: job.videoUrl as string,
          thumbUrl: job.thumbUrl ?? null,
          durationSec: typeof job.durationSec === 'number' ? job.durationSec : null,
          aspectRatio: job.aspectRatio ?? null,
          label: job.engineLabel?.trim().length ? job.engineLabel : `Job ${job.jobId}`,
          createdAt: job.createdAt,
          hasAudio: Boolean(job.hasAudio),
        }))
        .filter((job, index, list) => list.findIndex((entry) => entry.jobId === job.jobId) === index);
      setGeneratedVideos(next);
    } catch (error) {
      setGeneratedVideosError(resolveUiErrorMessage(error, copy.messages.loadGeneratedVideos, ['Unable to load generated videos.']));
    } finally {
      setIsGeneratedVideosLoading(false);
    }
  }, [copy.messages.loadGeneratedVideos]);

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
      })
    return () => {
      cancelled = true;
    };
  }, [copy, queryJobId, restoreAudioJob, user]);

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
      })
    return () => {
      cancelled = true;
    };
  }, [copy, queryJobId, restoreAudioJob, user]);

  useEffect(() => {
    if (!activeJob || (activeJob.status !== 'pending' && activeJob.status !== 'running')) {
      return;
    }
    let cancelled = false;
    const poll = async () => {
      try {
        const status = await getJobStatus(activeJob.jobId);
        if (cancelled) return;
        const nextOutputKind = inferOutputKind({
          videoUrl: status.videoUrl ?? null,
          audioUrl: status.audioUrl ?? null,
        });
        const nextStatus: ActiveAudioJobState = {
          jobId: status.jobId,
          status: status.videoUrl || status.audioUrl ? 'completed' : status.status,
          progress: status.progress,
          message: status.message ?? null,
          videoUrl: status.videoUrl ?? null,
          audioUrl: status.audioUrl ?? null,
          thumbUrl: status.thumbUrl ?? null,
          outputKind: nextOutputKind,
        };
        setActiveJob(nextStatus);
        if (status.videoUrl || status.audioUrl) {
          setResult({
            jobId: status.jobId,
            videoUrl: status.videoUrl ?? null,
            audioUrl: status.audioUrl ?? null,
            thumbUrl: status.thumbUrl ?? null,
            outputKind: nextOutputKind,
          });
        }
      } catch {
        // Keep current state and retry on the next interval.
      }
    };

    void poll();
    const interval = window.setInterval(() => {
      void poll();
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [activeJob]);

  useEffect(() => {
    if (!generatedPickerOpen || !user) return;
    if (generatedVideos.length || isGeneratedVideosLoading) return;
    void fetchGeneratedVideos();
  }, [fetchGeneratedVideos, generatedPickerOpen, generatedVideos.length, isGeneratedVideosLoading, user]);

  const estimatedDurationSec = useMemo(() => {
    if (pack === 'voice_only') {
      return script.trim().length ? estimateVoiceScriptDurationSec(script) : null;
    }
    if (sourceVideo?.durationSec) {
      return sourceVideo.durationSec;
    }
    if (pack === 'music_only') {
      return manualDurationSec;
    }
    return null;
  }, [manualDurationSec, pack, script, sourceVideo?.durationSec]);

  const quote = useMemo(() => {
    if (!estimatedDurationSec) return null;
    return buildAudioPricingSnapshot({
      pack,
      mood: showMood ? mood : null,
      durationSec: estimatedDurationSec,
      voiceMode: showVoiceFields ? (voiceSample ? 'clone' : 'standard') : null,
    });
  }, [estimatedDurationSec, mood, pack, showMood, showVoiceFields, voiceSample]);

  const canGenerate =
    Boolean(user) &&
    !isGenerating &&
    (!sourceVideoRequired || Boolean(sourceVideo?.url)) &&
    (pack !== 'music_only' || Boolean(sourceVideo?.url) || manualDurationSec >= 3) &&
    (!packConfig.requiresScript || script.trim().length > 0);

  const handleSourceFileSelect = useCallback(async (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) return;
    manualWorkspaceOverrideRef.current = true;
    setIsUploadingSource(true);
    setNotice(null);
    setResult(null);
    try {
      const uploaded = await uploadAsset(file, 'video');
      const durationSec = await probeVideoDuration(uploaded.url);
      setSourceVideo({
        url: uploaded.url,
        jobId: null,
        thumbUrl: null,
        durationSec,
        aspectRatio: null,
        label: uploaded.name,
      });
      if (!durationSec) {
        setNotice(copy.source.uploadDurationWarning);
      }
    } catch (error) {
      setNotice(resolveUiErrorMessage(error, copy.messages.sourceUploadFailed, ['Upload failed']));
    } finally {
      setIsUploadingSource(false);
      if (sourceInputRef.current) {
        sourceInputRef.current.value = '';
      }
    }
  }, [copy.messages.sourceUploadFailed, copy.source.uploadDurationWarning]);

  const handleVoiceFileSelect = useCallback(async (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) return;
    manualWorkspaceOverrideRef.current = true;
    setIsUploadingVoice(true);
    setNotice(null);
    try {
      const uploaded = await uploadAsset(file, 'audio');
      setVoiceSample(uploaded);
    } catch (error) {
      setNotice(resolveUiErrorMessage(error, copy.messages.voiceUploadFailed, ['Upload failed']));
    } finally {
      setIsUploadingVoice(false);
      if (voiceInputRef.current) {
        voiceInputRef.current.value = '';
      }
    }
  }, [copy.messages.voiceUploadFailed]);

  const handleSelectGeneratedVideo = useCallback(async (video: GeneratedSourceVideo) => {
    manualWorkspaceOverrideRef.current = true;
    setNotice(null);
    const durationSec = video.durationSec ?? (await probeVideoDuration(video.url));
    setSourceVideo({
      url: video.url,
      jobId: video.jobId,
      thumbUrl: video.thumbUrl,
      durationSec,
      aspectRatio: video.aspectRatio,
      label: video.label,
    });
    setResult(null);
    if (!durationSec) {
      setNotice(copy.source.selectedDurationWarning);
    }
    setGeneratedPickerOpen(false);
  }, [copy.source.selectedDurationWarning]);

  const handleClearSourceVideo = useCallback(() => {
    manualWorkspaceOverrideRef.current = true;
    setSourceVideo(null);
    setResult(null);
    setNotice(null);
    if (sourceInputRef.current) {
      sourceInputRef.current.value = '';
    }
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!canGenerate) return;
    setIsGenerating(true);
    setNotice(null);
    try {
      const response = await runAudioGenerate({
        sourceVideoUrl: sourceVideo?.url ?? undefined,
        sourceJobId: sourceVideo?.jobId ?? undefined,
        pack,
        mood: showMood ? mood : undefined,
        intensity: showIntensity ? intensity : undefined,
        script: packConfig.requiresScript ? script.trim() : undefined,
        voiceSampleUrl: showVoiceFields ? voiceSample?.url : undefined,
        voiceGender: showVoiceFields ? voiceGender : undefined,
        voiceProfile: showVoiceFields ? voiceProfile : undefined,
        voiceDelivery: showVoiceFields ? voiceDelivery : undefined,
        language: showVoiceFields ? language : undefined,
        durationSec: pack === 'music_only' && !sourceVideo?.url ? manualDurationSec : undefined,
        musicEnabled: showMusicToggle ? musicEnabled : undefined,
        exportAudioFile: showExportToggle ? exportAudioFile : undefined,
        locale,
      });
      const nextResult: AudioResultState = {
        jobId: response.jobId,
        videoUrl: response.videoUrl,
        audioUrl: response.audioUrl ?? null,
        thumbUrl: response.thumbUrl,
        outputKind: response.outputKind,
      };
      setResult(nextResult);
      setActiveJob({
        jobId: response.jobId,
        status: response.status,
        progress: response.progress,
        message: copy.messages.processing.complete,
        videoUrl: response.videoUrl,
        audioUrl: response.audioUrl ?? null,
        thumbUrl: response.thumbUrl,
        outputKind: response.outputKind,
      });
      router.replace(`${pathname}?job=${encodeURIComponent(response.jobId)}`, { scroll: false });
      setNotice(copy.messages.renderComplete);
    } catch (error) {
      setNotice(resolveUiErrorMessage(error, copy.messages.generationFailed));
    } finally {
      setIsGenerating(false);
    }
  }, [
    canGenerate,
    exportAudioFile,
    intensity,
    language,
    manualDurationSec,
    mood,
    musicEnabled,
    pack,
    packConfig.requiresScript,
    pathname,
    router,
    script,
    showExportToggle,
    showIntensity,
    showMood,
    showMusicToggle,
    showVoiceFields,
    sourceVideo?.jobId,
    sourceVideo?.url,
    copy.messages.generationFailed,
    copy.messages.processing.complete,
    copy.messages.renderComplete,
    voiceDelivery,
    voiceGender,
    voiceProfile,
    voiceSample?.url,
    locale,
  ]);

  const handleSelectLatestJob = useCallback(
    (jobId: string) => {
      manualWorkspaceOverrideRef.current = false;
      void router.replace(`${pathname}?job=${encodeURIComponent(jobId)}`, { scroll: false });
    },
    [pathname, router]
  );

  if (authLoading) {
    return <div className="flex-1" />;
  }

  if (!user) {
    return (
      <main className="flex-1 min-w-0 overflow-y-auto p-5 lg:p-7">
        <section className="mx-auto max-w-3xl rounded-card border border-border bg-surface p-8 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{copy.auth.eyebrow}</p>
          <h1 className="mt-3 text-2xl font-semibold text-text-primary">{copy.auth.title}</h1>
          <p className="mt-3 text-sm text-text-secondary">{copy.auth.body}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href="/login" size="sm">
              {copy.auth.createAccount}
            </ButtonLink>
            <ButtonLink href="/login?mode=signin" variant="outline" size="sm">
              {copy.auth.signIn}
            </ButtonLink>
          </div>
        </section>
      </main>
    );
  }

  return (
    <div className="flex flex-1 min-w-0 flex-col xl:flex-row">
      <div className="flex flex-1 min-w-0 flex-col overflow-hidden">
        <main className="flex flex-1 min-w-0 flex-col gap-[var(--stack-gap-lg)] overflow-y-auto p-5 lg:p-7">
          {notice ? (
            <div role="status" aria-live="polite" className="rounded-card border border-warning-border bg-warning-bg px-4 py-2 text-sm text-warning shadow-card">
              {notice}
            </div>
          ) : null}

          <div className="grid gap-[var(--stack-gap-lg)] xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_400px] xl:items-start">
            <section className="rounded-card border border-border bg-surface-glass-80 p-5 shadow-card">
              <div className="flex flex-col gap-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{copy.hero.eyebrow}</p>
                  <h1 className="mt-2 text-2xl font-semibold text-text-primary">{copy.hero.title}</h1>
                </div>

                <AudioModePicker value={pack} options={modeOptions} onChange={handlePackChange} />

                <div className="rounded-card border border-border bg-bg/60 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold text-text-primary">{copy.source.title}</h2>
                      <p className="mt-1 text-xs text-text-secondary">
                        {sourceVideoRequired
                          ? copy.source.required
                          : copy.source.optional}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isUploadingSource}
                        onClick={() => sourceInputRef.current?.click()}
                      >
                        {isUploadingSource ? copy.source.uploading : copy.source.upload}
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => setGeneratedPickerOpen(true)}>
                        {copy.source.useGenerated}
                      </Button>
                      {sourceVideo ? (
                        <Button type="button" variant="ghost" size="sm" onClick={handleClearSourceVideo}>
                          {copy.source.clear}
                        </Button>
                      ) : null}
                    </div>
                    <input
                      ref={sourceInputRef}
                      type="file"
                      accept="video/*"
                      className="sr-only"
                      onChange={(event) => {
                        void handleSourceFileSelect(event.target.files);
                      }}
                    />
                  </div>
                  {sourceVideo ? (
                    <div className="mt-4 flex flex-wrap items-center gap-4 rounded-card border border-border bg-surface px-4 py-3">
                      <div className="h-16 w-24 overflow-hidden rounded-card border border-border bg-bg">
                        <video
                          src={sourceVideo.url}
                          poster={sourceVideo.thumbUrl ?? undefined}
                          className="h-full w-full object-cover"
                          muted
                          playsInline
                          loop
                          autoPlay
                          preload="metadata"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-text-primary">{sourceVideo.label}</p>
                        <p className="mt-1 text-xs text-text-secondary">
                          {sourceVideo.durationSec ? `${sourceVideo.durationSec}s` : copy.source.durationPending}{sourceVideo.aspectRatio ? ` • ${sourceVideo.aspectRatio}` : ''}
                        </p>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </section>

            <ResultPreview
              result={result}
              sourceVideo={sourceVideo}
              activeJob={activeJob}
              isLoading={isGenerating}
              copy={copy}
            />
          </div>

          <section className="rounded-card border border-border bg-surface-glass-80 shadow-card">
            <div className="border-b border-border px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{copy.controls.eyebrow}</p>
              <h2 className="mt-1 text-xl font-semibold text-text-primary">{copy.controls.title}</h2>
            </div>
            <div className="space-y-5 p-5">
              {showMood ? (
                <div>
                  <span className="mb-2 block text-sm font-semibold text-text-primary">{copy.controls.mood}</span>
                  <OptionPillGroup
                    value={mood}
                    options={moodOptions}
                    onChange={(next) => {
                      const nextMood = coerceAudioMood(next) ?? DEFAULT_MOOD;
                      setMood(nextMood);
                    }}
                  />
                </div>
              ) : null}

              {showIntensity ? (
                <div>
                  <span className="mb-2 block text-sm font-semibold text-text-primary">{copy.controls.intensity}</span>
                  <OptionPillGroup
                    value={intensity}
                    options={intensityOptions}
                    onChange={(next) => {
                      const nextIntensity = coerceAudioIntensity(next) ?? DEFAULT_INTENSITY;
                      setIntensity(nextIntensity);
                    }}
                  />
                </div>
              ) : null}

              {showManualDuration ? (
                <div>
                  <p className="text-sm font-semibold text-text-primary">{copy.controls.duration}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {DURATION_OPTIONS.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setManualDurationSec(option)}
                        className={[
                          'rounded-full border px-3 py-1.5 text-sm font-medium transition',
                          manualDurationSec === option
                            ? 'border-brand bg-brand text-on-brand'
                            : 'border-border bg-surface text-text-primary hover:border-border-hover',
                        ].join(' ')}
                      >
                        {option}s
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {showVoiceFields ? (
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-text-primary">{copy.controls.script}</span>
                    <Textarea
                      rows={6}
                      value={script}
                      onChange={(event) => setScript(event.target.value)}
                      placeholder={
                        pack === 'voice_only'
                          ? copy.controls.scriptVoiceOnlyPlaceholder
                          : copy.controls.scriptCinematicPlaceholder
                      }
                    />
                    {pack === 'voice_only' && script.trim().length ? (
                      <p className="mt-2 text-xs text-text-secondary">
                        {formatCopy(copy.controls.estimatedDuration, { seconds: estimatedDurationSec ?? '—' })}
                      </p>
                    ) : null}
                  </label>
                  <div className="rounded-card border border-border bg-bg/60 p-4">
                    <p className="text-sm font-semibold text-text-primary">{copy.controls.voiceSample}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isUploadingVoice}
                        onClick={() => voiceInputRef.current?.click()}
                      >
                        {isUploadingVoice ? copy.source.uploading : copy.controls.uploadSample}
                      </Button>
                      {voiceSample ? (
                        <Button type="button" variant="ghost" size="sm" onClick={() => setVoiceSample(null)}>
                          {copy.source.clear}
                        </Button>
                      ) : null}
                    </div>
                    <input
                      ref={voiceInputRef}
                      type="file"
                      accept="audio/*"
                      className="sr-only"
                      onChange={(event) => {
                        void handleVoiceFileSelect(event.target.files);
                      }}
                    />
                    {voiceSample ? (
                      <div className="mt-4 rounded-card border border-border bg-surface px-3 py-3">
                        <p className="truncate text-sm font-semibold text-text-primary">{voiceSample.name}</p>
                        <p className="mt-1 text-xs text-text-secondary">{copy.controls.cloneEnabled}</p>
                      </div>
                    ) : (
                      <div className="mt-4 rounded-card border border-dashed border-border bg-surface px-3 py-3 text-sm text-text-secondary">
                        {copy.controls.defaultVoice}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              {showVoiceFields ? (
                <div className={showVoiceGender ? 'grid gap-4 md:grid-cols-4' : 'grid gap-4 md:grid-cols-3'}>
                  {showVoiceGender ? (
                    <div>
                      <span className="mb-2 block text-sm font-semibold text-text-primary">{copy.controls.voiceType}</span>
                      <OptionPillGroup
                        value={voiceGender}
                        options={voiceGenderOptions}
                        onChange={(next) => {
                          const nextGender = coerceAudioVoiceGender(next) ?? DEFAULT_VOICE_GENDER;
                          setVoiceGender(nextGender);
                        }}
                      />
                    </div>
                  ) : null}
                  <div>
                    <span className="mb-2 block text-sm font-semibold text-text-primary">{copy.controls.voice}</span>
                    <OptionPillGroup
                      value={voiceProfile}
                      options={voiceProfileOptions}
                      onChange={(next) => {
                        const nextProfile = coerceAudioVoiceProfile(next) ?? DEFAULT_VOICE_PROFILE;
                        setVoiceProfile(nextProfile);
                      }}
                    />
                  </div>
                  <div>
                    <span className="mb-2 block text-sm font-semibold text-text-primary">{copy.controls.delivery}</span>
                    <OptionPillGroup
                      value={voiceDelivery}
                      options={voiceDeliveryOptions}
                      onChange={(next) => {
                        const nextDelivery = coerceAudioVoiceDelivery(next) ?? DEFAULT_VOICE_DELIVERY;
                        setVoiceDelivery(nextDelivery);
                      }}
                    />
                  </div>
                  <div>
                    <span className="mb-2 block text-sm font-semibold text-text-primary">{copy.controls.language}</span>
                    <OptionPillGroup
                      value={language}
                      options={languageOptions}
                      onChange={(next) => {
                        const nextLanguage = coerceAudioLanguage(next) ?? DEFAULT_LANGUAGE;
                        setLanguage(nextLanguage);
                      }}
                    />
                  </div>
                </div>
              ) : null}

              {showMusicToggle ? (
                <ToggleRow
                  label={copy.controls.musicToggle.label}
                  description={copy.controls.musicToggle.description}
                  checked={musicEnabled}
                  onChange={setMusicEnabled}
                />
              ) : null}

              {showExportToggle ? (
                <ToggleRow
                  label={copy.controls.exportToggle.label}
                  description={copy.controls.exportToggle.description}
                  checked={exportAudioFile}
                  onChange={setExportAudioFile}
                />
              ) : null}

              <div className="rounded-card border border-border bg-bg/60 px-4 py-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{copy.pricing.eyebrow}</p>
                    <p className="mt-1 text-2xl font-semibold text-text-primary">
                      {quote ? formatCurrency(quote.totalCents / 100, quote.currency, locale) : copy.pricing.missingInputs}
                    </p>
                    <p className="mt-1 text-sm text-text-secondary">
                      {quote
                        ? formatCopy(copy.pricing.summary, {
                            output: formatAudioOutputKind(copy, currentOutputKind),
                            duration: `${estimatedDurationSec ?? '—'}s`,
                          })
                        : sourceVideoRequired
                          ? copy.pricing.missingSourceVideo
                          : copy.pricing.missingOptions}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="button"
                      size="lg"
                      onClick={handleGenerate}
                      disabled={!canGenerate}
                      className="min-w-[180px]"
                    >
                      {isGenerating ? copy.pricing.generating : copy.pricing.generate}
                    </Button>
                    {quote ? (
                      <Button type="button" variant="outline" size="lg" disabled className="min-w-[180px]">
                        {formatCopy(copy.pricing.thisRender, {
                          amount: formatCurrency(quote.totalCents / 100, quote.currency, locale),
                        })}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>

      <aside className="hidden h-[calc(125vh-var(--header-height))] w-full max-w-[336px] shrink-0 flex-col border-l border-border bg-bg/80 px-3 pb-6 pt-4 xl:flex">
        <AudioLatestRendersRail activeJobId={activeJob?.jobId ?? result?.jobId ?? null} onSelectJob={handleSelectLatestJob} />
      </aside>

      <div className="border-t border-border px-4 py-4 xl:hidden">
        <AudioLatestRendersRail
          activeJobId={activeJob?.jobId ?? result?.jobId ?? null}
          onSelectJob={handleSelectLatestJob}
          variant="mobile"
        />
      </div>

      {generatedPickerOpen ? (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-surface-on-media-dark-55 px-4">
          <div className="absolute inset-0" role="presentation" onClick={() => setGeneratedPickerOpen(false)} />
          <div className="relative z-10 flex max-h-[80vh] w-full max-w-4xl flex-col overflow-hidden rounded-card border border-border bg-surface shadow-float">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">{copy.picker.title}</h2>
                <p className="mt-1 text-sm text-text-secondary">{copy.picker.description}</p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setGeneratedPickerOpen(false)}>
                {copy.picker.close}
              </Button>
            </div>
            <div className="overflow-y-auto p-5">
              {generatedVideosError ? (
                <div className="rounded-card border border-warning-border bg-warning-bg p-4 text-sm text-warning">
                  {generatedVideosError}
                </div>
              ) : null}
              {!generatedVideosError && !generatedVideos.length && isGeneratedVideosLoading ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={`generated-source-skeleton-${index}`} className="overflow-hidden rounded-card border border-border bg-surface shadow-card" aria-hidden>
                      <div className="aspect-[16/9] w-full bg-skeleton" />
                      <div className="space-y-2 px-4 py-4">
                        <div className="h-4 w-36 rounded-full bg-skeleton" />
                        <div className="h-3 w-28 rounded-full bg-skeleton" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
              {!generatedVideosError && !generatedVideos.length && !isGeneratedVideosLoading ? (
                <div className="rounded-card border border-border bg-bg/60 p-5 text-sm text-text-secondary">
                  {copy.picker.empty}
                </div>
              ) : null}
              {generatedVideos.length ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {generatedVideos.map((video) => (
                    <button
                      key={video.jobId}
                      type="button"
                      className="overflow-hidden rounded-card border border-border bg-surface text-left shadow-card transition hover:border-border-hover hover:bg-surface-hover"
                      onClick={() => {
                        void handleSelectGeneratedVideo(video);
                      }}
                    >
                      <div className="relative aspect-[16/9] w-full overflow-hidden bg-bg">
                        <video
                          src={video.url}
                          poster={video.thumbUrl ?? undefined}
                          className="h-full w-full object-cover"
                          muted
                          playsInline
                          loop
                          autoPlay
                          preload="metadata"
                        />
                      </div>
                      <div className="space-y-2 px-4 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <p className="min-w-0 truncate text-sm font-semibold text-text-primary">{video.label}</p>
                          {video.hasAudio ? (
                            <span className="rounded-full border border-border bg-bg px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">
                              {copy.picker.audioBadge}
                            </span>
                          ) : null}
                        </div>
                        <p className="text-xs text-text-secondary">
                          {video.durationSec ? `${video.durationSec}s` : copy.source.durationPending}{video.aspectRatio ? ` • ${video.aspectRatio}` : ''}
                        </p>
                        <p className="text-xs text-text-muted">{formatDateTime(video.createdAt, locale)}</p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
