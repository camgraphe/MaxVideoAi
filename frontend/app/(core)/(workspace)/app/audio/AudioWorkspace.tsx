'use client';

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { useRequireAuth } from '@/hooks/useRequireAuth';
import { authFetch } from '@/lib/authFetch';
import { getJobStatus, runAudioGenerate } from '@/lib/api';
import type { Job } from '@/types/jobs';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';
import {
  AUDIO_MOOD_VALUES,
  buildAudioPricingSnapshot,
  coerceAudioMood,
  coerceAudioPackId,
  estimateVoiceScriptDurationSec,
  getAudioPackConfig,
  type AudioMood,
  type AudioOutputKind,
  type AudioPackId,
} from '@/lib/audio-generation';
import AudioLatestRendersRail from './AudioLatestRendersRail';

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
  durationSec?: number | null;
  script?: string | null;
  musicEnabled?: boolean | null;
  exportAudioFile?: boolean | null;
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

const AUDIO_MODE_OPTIONS: Array<{
  id: AudioPackId;
  label: string;
  description: string;
}> = [
  {
    id: 'music_only',
    label: 'Music Only',
    description: 'Generate an ambient or cinematic music bed, with or without a source video.',
  },
  {
    id: 'voice_only',
    label: 'Voice Over Only',
    description: 'Generate standalone narration or dialogue without requiring a video upload.',
  },
  {
    id: 'cinematic',
    label: 'Cinematic',
    description: 'Layer synced sound design and, optionally, a subtle score onto a source video.',
  },
  {
    id: 'cinematic_voice',
    label: 'Cinematic + Voice',
    description: 'Blend synced sound design, optional music, and a cinematic voice over on top of video.',
  },
];

const DURATION_OPTIONS = [3, 5, 8, 10, 15, 20] as const;
const DEFAULT_PACK: AudioPackId = 'cinematic';
const DEFAULT_MOOD: AudioMood = 'epic';
const DEFAULT_MANUAL_DURATION_SEC = 8;

function formatCurrency(amount: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function formatDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
}

function formatOutputKind(outputKind: AudioOutputKind): string {
  switch (outputKind) {
    case 'audio':
      return 'Audio output';
    case 'both':
      return 'Video + audio';
    default:
      return 'Video output';
  }
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
  onChange,
}: {
  value: AudioPackId;
  onChange: (pack: AudioPackId) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {AUDIO_MODE_OPTIONS.map((mode) => (
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
        <p className="mt-1 text-sm text-text-secondary">{description}</p>
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
}: {
  result: AudioResultState | null;
  sourceVideo: SourceVideoState | null;
  activeJob: ActiveAudioJobState | null;
  isLoading: boolean;
}) {
  const previewThumb = result?.thumbUrl ?? sourceVideo?.thumbUrl ?? '/assets/frames/thumb-16x9.svg';
  const showOverlay = isLoading || activeJob?.status === 'pending' || activeJob?.status === 'running';
  const overlayMessage = activeJob?.message ?? (isLoading ? 'Loading audio render…' : 'Processing audio render…');
  const overlayProgress = activeJob?.progress ?? 0;

  return (
    <section className="rounded-card border border-border bg-surface-glass-80 shadow-card">
      <div className="border-b border-border px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">Preview</p>
        <h2 className="mt-1 text-xl font-semibold text-text-primary">Latest output</h2>
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
                {formatOutputKind(result.outputKind)}
              </p>
              <p className="relative mt-2 text-2xl font-semibold text-white">Audio render ready</p>
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
            <div className="flex h-full w-full flex-col items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.12),_transparent_42%),linear-gradient(180deg,_rgba(248,250,252,0.9),_rgba(241,245,249,0.7))] px-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-border bg-surface shadow-card">
                <img src="/assets/icons/audio.svg" alt="" className="h-8 w-8 opacity-75" />
              </div>
              <p className="mt-5 text-sm font-semibold text-text-primary">Generate audio in a video-style workspace</p>
              <p className="mt-2 max-w-xl text-sm text-text-secondary">
                Pick a mode, upload a source video when needed, and build either a standalone audio file or a final MP4 with cinematic sound.
              </p>
            </div>
          )}

          {showOverlay ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-on-media-dark-55 px-6 text-center text-white backdrop-blur-[2px]">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/25 border-t-white" />
              <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-white/75">Processing</p>
              <p className="mt-2 text-2xl font-semibold">{Math.max(0, Math.min(100, overlayProgress))}%</p>
              <p className="mt-2 max-w-lg text-sm text-white/80">{overlayMessage}</p>
            </div>
          ) : null}
        </div>

        {(result?.videoUrl || result?.audioUrl) ? (
          <div className="mt-4 flex flex-wrap gap-3">
            {result.videoUrl ? (
              <ButtonLink href={result.videoUrl} target="_blank" rel="noreferrer" variant="outline" size="sm">
                Open video file
              </ButtonLink>
            ) : null}
            {result.audioUrl ? (
              <ButtonLink href={result.audioUrl} target="_blank" rel="noreferrer" variant="outline" size="sm">
                Open audio file
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
  const { user, loading: authLoading } = useRequireAuth({ redirectIfLoggedOut: false });

  const [pack, setPack] = useState<AudioPackId>(DEFAULT_PACK);
  const [mood, setMood] = useState<AudioMood>(DEFAULT_MOOD);
  const [script, setScript] = useState('');
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
  const [queryJobLoading, setQueryJobLoading] = useState(false);
  const [generatedPickerOpen, setGeneratedPickerOpen] = useState(false);
  const [generatedVideos, setGeneratedVideos] = useState<GeneratedSourceVideo[]>([]);
  const [isGeneratedVideosLoading, setIsGeneratedVideosLoading] = useState(false);
  const [generatedVideosError, setGeneratedVideosError] = useState<string | null>(null);
  const sourceInputRef = useRef<HTMLInputElement | null>(null);
  const voiceInputRef = useRef<HTMLInputElement | null>(null);
  const restoredQueryJobRef = useRef<string | null>(null);
  const latestRestoreAttemptedRef = useRef(false);

  const queryJobId = searchParams?.get('job') ?? null;
  const packConfig = getAudioPackConfig(pack);
  const sourceVideoRequired = packConfig.requiresVideo;
  const showMood = packConfig.requiresMood;
  const showVoiceFields = packConfig.includesVoice;
  const showMusicToggle = packConfig.supportsMusicToggle;
  const showExportToggle = packConfig.supportsAudioExport;
  const showManualDuration = pack === 'music_only' && !sourceVideo?.url;
  const currentOutputKind: AudioOutputKind = packConfig.audioOnly ? 'audio' : exportAudioFile ? 'both' : 'video';

  const handlePackChange = useCallback((nextPack: AudioPackId) => {
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
            label: sourceJob.engineLabel ? `${sourceJob.engineLabel} source` : `Job ${sourceJob.jobId}`,
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
      label: sourceJobId ? `Job ${sourceJobId}` : 'Restored source video',
    });
  }, []);

  const restoreAudioJob = useCallback(
    async (jobId: string) => {
      const detail = await fetchJobDetail(jobId);
      const nextPack = coerceAudioPackId(detail.settingsSnapshot?.pack) ?? DEFAULT_PACK;
      const nextMood = coerceAudioMood(detail.settingsSnapshot?.mood) ?? DEFAULT_MOOD;
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
      setScript(detail.settingsSnapshot?.script ?? '');
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
        detail.status ??
        ((detail.videoUrl || detail.audioUrl) ? 'completed' : 'pending');
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
        throw new Error(payload?.error ?? 'Unable to load generated videos.');
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
      setGeneratedVideosError(error instanceof Error ? error.message : 'Unable to load generated videos.');
    } finally {
      setIsGeneratedVideosLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!queryJobId || !user) return;
    if (restoredQueryJobRef.current === queryJobId) return;
    restoredQueryJobRef.current = queryJobId;
    let cancelled = false;
    setQueryJobLoading(true);
    setNotice(null);
    fetchJobDetail(queryJobId)
      .then(async (payload) => {
        if (cancelled) return;
        if (payload.surface === 'audio') {
          await restoreAudioJob(payload.jobId);
          return;
        }
        if (!payload.videoUrl) {
          throw new Error(payload.error ?? 'Unable to load source job.');
        }
        setActiveJob(null);
        setResult(null);
        setSourceVideo({
          url: payload.videoUrl,
          jobId: payload.jobId,
          thumbUrl: payload.thumbUrl ?? null,
          durationSec: typeof payload.durationSec === 'number' ? payload.durationSec : null,
          aspectRatio: payload.aspectRatio ?? null,
          label: payload.engineLabel ? `${payload.engineLabel} source` : `Job ${payload.jobId}`,
        });
      })
      .catch((error) => {
        if (!cancelled) {
          restoredQueryJobRef.current = null;
          setNotice(error instanceof Error ? error.message : 'Unable to load source job.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setQueryJobLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [queryJobId, restoreAudioJob, user]);

  useEffect(() => {
    if (queryJobId || !user) return;
    if (latestRestoreAttemptedRef.current) return;
    latestRestoreAttemptedRef.current = true;
    let cancelled = false;
    setQueryJobLoading(true);
    authFetch('/api/jobs?surface=audio&limit=1')
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as
          | { ok?: boolean; error?: string; jobs?: Job[] }
          | null;
        if (!response.ok || !payload?.ok || !Array.isArray(payload.jobs)) {
          throw new Error(payload?.error ?? 'Unable to load latest audio job.');
        }
        const latestJob = payload.jobs.find((job) => job.surface === 'audio');
        if (!latestJob || cancelled) return;
        await restoreAudioJob(latestJob.jobId);
      })
      .catch((error) => {
        if (!cancelled) {
          console.warn('[audio] latest job restore failed', error);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setQueryJobLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [queryJobId, restoreAudioJob, user]);

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
          status: status.status,
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
        setNotice('The source video uploaded, but its duration could not be read in the browser.');
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Source upload failed.');
    } finally {
      setIsUploadingSource(false);
      if (sourceInputRef.current) {
        sourceInputRef.current.value = '';
      }
    }
  }, []);

  const handleVoiceFileSelect = useCallback(async (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) return;
    setIsUploadingVoice(true);
    setNotice(null);
    try {
      const uploaded = await uploadAsset(file, 'audio');
      setVoiceSample(uploaded);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Voice sample upload failed.');
    } finally {
      setIsUploadingVoice(false);
      if (voiceInputRef.current) {
        voiceInputRef.current.value = '';
      }
    }
  }, []);

  const handleSelectGeneratedVideo = useCallback(async (video: GeneratedSourceVideo) => {
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
      setNotice('The selected video loaded, but its duration could not be confirmed in the browser.');
    }
    setGeneratedPickerOpen(false);
  }, []);

  const handleClearSourceVideo = useCallback(() => {
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
        script: packConfig.requiresScript ? script.trim() : undefined,
        voiceSampleUrl: showVoiceFields ? voiceSample?.url : undefined,
        durationSec: pack === 'music_only' && !sourceVideo?.url ? manualDurationSec : undefined,
        musicEnabled: showMusicToggle ? musicEnabled : undefined,
        exportAudioFile: showExportToggle ? exportAudioFile : undefined,
        locale: typeof navigator !== 'undefined' ? navigator.language : 'en',
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
        message: 'Audio render complete.',
        videoUrl: response.videoUrl,
        audioUrl: response.audioUrl ?? null,
        thumbUrl: response.thumbUrl,
        outputKind: response.outputKind,
      });
      router.replace(`${pathname}?job=${encodeURIComponent(response.jobId)}`, { scroll: false });
      setNotice('Audio render complete.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Audio generation failed.');
    } finally {
      setIsGenerating(false);
    }
  }, [
    canGenerate,
    exportAudioFile,
    manualDurationSec,
    mood,
    musicEnabled,
    pack,
    packConfig.requiresScript,
    pathname,
    router,
    script,
    showExportToggle,
    showMood,
    showMusicToggle,
    showVoiceFields,
    sourceVideo?.jobId,
    sourceVideo?.url,
    voiceSample?.url,
  ]);

  const handleSelectLatestJob = useCallback(
    (jobId: string) => {
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
          <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">Generate Audio</p>
          <h1 className="mt-3 text-2xl font-semibold text-text-primary">Create an account to generate audio</h1>
          <p className="mt-3 text-sm text-text-secondary">
            Build cinematic soundtracks, standalone music beds, or premium voice overs inside the MaxVideoAI workspace.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href="/login" size="sm">
              Create account
            </ButtonLink>
            <ButtonLink href="/login?mode=signin" variant="outline" size="sm">
              Sign in
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
            <div className="rounded-card border border-warning-border bg-warning-bg px-4 py-2 text-sm text-warning shadow-card">
              {notice}
            </div>
          ) : null}

          <section className="rounded-card border border-border bg-surface-glass-80 p-5 shadow-card">
            <div className="flex flex-col gap-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">Generate Audio</p>
                <h1 className="mt-2 text-2xl font-semibold text-text-primary">Audio workspace</h1>
                <p className="mt-2 max-w-3xl text-sm text-text-secondary">
                  Match the video workflow: pick a mode, choose a source video only when needed, preview the latest output, and launch with the price visible next to the CTA.
                </p>
              </div>

              <AudioModePicker value={pack} onChange={handlePackChange} />

              <div className="rounded-card border border-border bg-bg/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-text-primary">Source video</h2>
                    <p className="mt-1 text-xs text-text-secondary">
                      {sourceVideoRequired
                        ? 'Required for cinematic modes. Upload a file or pick one of your generated videos.'
                        : 'Optional for Music Only and Voice Over Only. If you add one, it is used for duration and context only.'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isUploadingSource || queryJobLoading}
                      onClick={() => sourceInputRef.current?.click()}
                    >
                      {isUploadingSource ? 'Uploading…' : 'Upload source video'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={queryJobLoading}
                      onClick={() => setGeneratedPickerOpen(true)}
                    >
                      Choose generated video
                    </Button>
                    {sourceVideo ? (
                      <Button type="button" variant="ghost" size="sm" onClick={handleClearSourceVideo}>
                        Remove source video
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
                        {sourceVideo.durationSec ? `${sourceVideo.durationSec}s` : 'Duration pending'}{sourceVideo.aspectRatio ? ` • ${sourceVideo.aspectRatio}` : ''}
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
            isLoading={queryJobLoading || isGenerating}
          />

          <section className="rounded-card border border-border bg-surface-glass-80 shadow-card">
            <div className="border-b border-border px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">Controls</p>
              <h2 className="mt-1 text-xl font-semibold text-text-primary">Audio setup</h2>
            </div>
            <div className="space-y-5 p-5">
              {showMood ? (
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-text-primary">Audio mood</span>
                  <select
                    value={mood}
                    onChange={(event) => {
                      const nextMood = coerceAudioMood(event.target.value) ?? DEFAULT_MOOD;
                      setMood(nextMood);
                    }}
                    className="h-11 w-full rounded-input border border-hairline bg-bg px-3 text-sm text-text-primary outline-none transition focus:border-border-hover"
                  >
                    {AUDIO_MOOD_VALUES.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {showManualDuration ? (
                <div>
                  <p className="text-sm font-semibold text-text-primary">Duration</p>
                  <p className="mt-1 text-sm text-text-secondary">Choose the target duration for the standalone music render.</p>
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
                    <span className="mb-2 block text-sm font-semibold text-text-primary">Voice over script</span>
                    <Textarea
                      rows={6}
                      value={script}
                      onChange={(event) => setScript(event.target.value)}
                      placeholder={
                        pack === 'voice_only'
                          ? 'Write the standalone voice over you want to render.'
                          : 'Write the narration or dialogue that should sit on top of the cinematic mix.'
                      }
                    />
                    {pack === 'voice_only' && script.trim().length ? (
                      <p className="mt-2 text-xs text-text-secondary">
                        Estimated spoken length: {estimatedDurationSec ?? '—'}s at 150 words/minute.
                      </p>
                    ) : null}
                  </label>
                  <div className="rounded-card border border-border bg-bg/60 p-4">
                    <p className="text-sm font-semibold text-text-primary">Voice sample</p>
                    <p className="mt-1 text-sm text-text-secondary">
                      Optional. Upload a reference sample to switch from standard TTS to voice clone.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isUploadingVoice}
                        onClick={() => voiceInputRef.current?.click()}
                      >
                        {isUploadingVoice ? 'Uploading…' : 'Upload voice sample'}
                      </Button>
                      {voiceSample ? (
                        <Button type="button" variant="ghost" size="sm" onClick={() => setVoiceSample(null)}>
                          Remove sample
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
                        <p className="mt-1 text-xs text-text-secondary">Voice clone enabled</p>
                      </div>
                    ) : (
                      <div className="mt-4 rounded-card border border-dashed border-border bg-surface px-3 py-3 text-sm text-text-secondary">
                        Standard voice will be used if you leave this empty.
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              {showMusicToggle ? (
                <ToggleRow
                  label="Music"
                  description="Keep the score layer in the cinematic mix. Turn it off to keep only synced sound design, and voice if this mode includes one."
                  checked={musicEnabled}
                  onChange={setMusicEnabled}
                />
              ) : null}

              {showExportToggle ? (
                <ToggleRow
                  label="Export audio file"
                  description="Also save a standalone audio file next to the final MP4. Included with cinematic modes."
                  checked={exportAudioFile}
                  onChange={setExportAudioFile}
                />
              ) : null}

              <div className="rounded-card border border-border bg-bg/60 px-4 py-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">Pricing</p>
                    <p className="mt-1 text-2xl font-semibold text-text-primary">
                      {quote ? formatCurrency(quote.totalCents / 100, quote.currency) : 'Add required inputs'}
                    </p>
                    <p className="mt-1 text-sm text-text-secondary">
                      {quote
                        ? `${formatOutputKind(currentOutputKind)} • ${estimatedDurationSec ?? '—'}s`
                        : sourceVideoRequired
                          ? 'Select a source video and complete the required fields to quote this render.'
                          : 'Complete the required fields to quote this render.'}
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
                      {isGenerating ? 'Generating…' : 'Generate audio'}
                    </Button>
                    {quote ? (
                      <Button type="button" variant="outline" size="lg" disabled className="min-w-[180px]">
                        This render: {formatCurrency(quote.totalCents / 100, quote.currency)}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>

      <div className="hidden w-[336px] shrink-0 px-2 py-4 xl:block">
        <AudioLatestRendersRail activeJobId={activeJob?.jobId ?? result?.jobId ?? null} onSelectJob={handleSelectLatestJob} />
      </div>

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
                <h2 className="text-lg font-semibold text-text-primary">Choose generated video</h2>
                <p className="mt-1 text-sm text-text-secondary">Use one of your existing video renders as the source.</p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setGeneratedPickerOpen(false)}>
                Close
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
                  No generated videos found yet.
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
                              Audio
                            </span>
                          ) : null}
                        </div>
                        <p className="text-xs text-text-secondary">
                          {video.durationSec ? `${video.durationSec}s` : 'Duration pending'}{video.aspectRatio ? ` • ${video.aspectRatio}` : ''}
                        </p>
                        <p className="text-xs text-text-muted">{formatDateTime(video.createdAt)}</p>
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
