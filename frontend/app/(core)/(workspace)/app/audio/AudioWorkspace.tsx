'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import { Button, ButtonLink } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';
import { authFetch } from '@/lib/authFetch';
import type { Job } from '@/types/jobs';
import {
  AUDIO_MAX_DURATION_SEC,
  AUDIO_MOOD_VALUES,
  buildAudioPricingSnapshot,
  coerceAudioMood,
  coerceAudioPackId,
  getAudioPackConfig,
  type AudioMood,
  type AudioPackId,
} from '@/lib/audio-generation';
import { getJobStatus, runAudioGenerate } from '@/lib/api';
import { useRequireAuth } from '@/hooks/useRequireAuth';

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

type AudioJobDetail = {
  ok?: boolean;
  error?: string;
  jobId: string;
  surface?: string;
  status?: 'pending' | 'running' | 'completed' | 'failed' | null;
  progress?: number | null;
  message?: string | null;
  videoUrl?: string | null;
  thumbUrl?: string | null;
  aspectRatio?: string | null;
  engineLabel?: string | null;
  durationSec?: number | null;
  settingsSnapshot?: {
    pack?: string | null;
    mood?: string | null;
    sourceJobId?: string | null;
    sourceVideoUrl?: string | null;
    refs?: {
      sourceVideoUrl?: string | null;
      voiceSampleUrl?: string | null;
    } | null;
  } | null;
};

type ActiveAudioJobState = {
  jobId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  message: string | null;
  videoUrl: string | null;
  thumbUrl: string | null;
};

const DEFAULT_PACK: AudioPackId = 'cinematic';
const DEFAULT_MOOD: AudioMood = 'epic';

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

export default function AudioWorkspace() {
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useRequireAuth({ redirectIfLoggedOut: false });

  const [pack, setPack] = useState<AudioPackId>(DEFAULT_PACK);
  const [mood, setMood] = useState<AudioMood>(DEFAULT_MOOD);
  const [script, setScript] = useState('');
  const [sourceVideo, setSourceVideo] = useState<SourceVideoState | null>(null);
  const [voiceSample, setVoiceSample] = useState<{ url: string; name: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isUploadingSource, setIsUploadingSource] = useState(false);
  const [isUploadingVoice, setIsUploadingVoice] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<{ jobId: string; videoUrl: string | null; thumbUrl: string | null } | null>(null);
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
        // Fall back to raw URL below.
      }
    }

    const sourceVideoUrl = input.sourceVideoUrl?.trim() || null;
    if (!sourceVideoUrl) return;
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

  const restoreAudioJob = useCallback(async (jobId: string) => {
    const detail = await fetchJobDetail(jobId);
    const pack = coerceAudioPackId(detail.settingsSnapshot?.pack) ?? DEFAULT_PACK;
    const mood = coerceAudioMood(detail.settingsSnapshot?.mood) ?? DEFAULT_MOOD;
    setPack(pack);
    setMood(mood);
    setVoiceSample(null);
    setScript('');

    await hydrateSourceVideo({
      sourceJobId: detail.settingsSnapshot?.sourceJobId ?? null,
      sourceVideoUrl:
        detail.settingsSnapshot?.refs?.sourceVideoUrl ??
        detail.settingsSnapshot?.sourceVideoUrl ??
        null,
      fallbackAspectRatio: detail.aspectRatio ?? null,
    });

    const status = detail.status ?? (detail.videoUrl ? 'completed' : 'pending');
    const progress = typeof detail.progress === 'number' ? detail.progress : status === 'completed' ? 100 : 0;
    const normalizedJob: ActiveAudioJobState = {
      jobId: detail.jobId,
      status,
      progress,
      message: detail.message ?? null,
      videoUrl: detail.videoUrl ?? null,
      thumbUrl: detail.thumbUrl ?? null,
    };
    setActiveJob(normalizedJob);

    if (detail.videoUrl) {
      setResult({
        jobId: detail.jobId,
        videoUrl: detail.videoUrl,
        thumbUrl: detail.thumbUrl ?? null,
      });
    } else {
      setResult(null);
    }
  }, [hydrateSourceVideo]);

  const fetchGeneratedVideos = useCallback(async () => {
    setIsGeneratedVideosLoading(true);
    setGeneratedVideosError(null);
    try {
      const response = await authFetch('/api/jobs?surface=video&limit=60');
      const payload = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            error?: string;
            jobs?: Job[];
          }
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
          throw new Error(payload.error ?? 'Unable to load source job');
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
          | {
              ok?: boolean;
              error?: string;
              jobs?: Job[];
            }
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
        const nextStatus: ActiveAudioJobState = {
          jobId: status.jobId,
          status: status.status,
          progress: status.progress,
          message: status.message ?? null,
          videoUrl: status.videoUrl ?? null,
          thumbUrl: status.thumbUrl ?? null,
        };
        setActiveJob(nextStatus);
        if (status.videoUrl) {
          setResult({
            jobId: status.jobId,
            videoUrl: status.videoUrl,
            thumbUrl: status.thumbUrl ?? null,
          });
        }
      } catch {
        // Keep the current state and retry on the next interval.
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

  const quote = useMemo(() => {
    if (!sourceVideo?.durationSec) return null;
    return buildAudioPricingSnapshot({
      pack,
      mood,
      durationSec: sourceVideo.durationSec,
      voiceMode: pack === 'cinematic_voice' ? (voiceSample ? 'clone' : 'standard') : null,
    });
  }, [mood, pack, sourceVideo?.durationSec, voiceSample]);

  const canGenerate =
    Boolean(user) &&
    Boolean(sourceVideo?.url) &&
    Boolean(sourceVideo?.durationSec) &&
    (!sourceVideo?.durationSec || sourceVideo.durationSec <= AUDIO_MAX_DURATION_SEC) &&
    (pack !== 'cinematic_voice' || script.trim().length > 0) &&
    !isGenerating;

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
        setNotice('The source video uploaded, but its duration could not be read in the browser. You can still try again with a different file.');
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
    if (!canGenerate || !sourceVideo?.url) return;
    setIsGenerating(true);
    setNotice(null);
    try {
      const response = await runAudioGenerate({
        sourceVideoUrl: sourceVideo.url,
        sourceJobId: sourceVideo.jobId ?? undefined,
        pack,
        mood,
        script: pack === 'cinematic_voice' ? script.trim() : undefined,
        voiceSampleUrl: voiceSample?.url,
        locale: typeof navigator !== 'undefined' ? navigator.language : 'en',
      });
      setResult({
        jobId: response.jobId,
        videoUrl: response.videoUrl,
        thumbUrl: response.thumbUrl,
      });
      setActiveJob({
        jobId: response.jobId,
        status: response.status,
        progress: response.progress,
        message: 'Audio render complete.',
        videoUrl: response.videoUrl,
        thumbUrl: response.thumbUrl,
      });
      setNotice('Audio render complete.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Audio generation failed.');
    } finally {
      setIsGenerating(false);
    }
  }, [canGenerate, mood, pack, script, sourceVideo, voiceSample]);

  if (authLoading) {
    return <div className="flex-1" />;
  }

  if (!user) {
    return (
      <main className="flex-1 min-w-0 overflow-y-auto p-5 lg:p-7">
        <section className="mx-auto max-w-3xl rounded-card border border-border bg-surface p-8 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">Generate Audio</p>
          <h1 className="mt-3 text-2xl font-semibold text-text-primary">Create an account to generate cinematic audio</h1>
          <p className="mt-3 text-sm text-text-secondary">
            Upload a source video, add cinematic sound design, and optionally generate narration with a cloned or standard voice.
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
    <main className="flex-1 min-w-0 overflow-y-auto p-5 lg:p-7">
      <div className="mx-auto grid max-w-6xl gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="rounded-card border border-border bg-surface p-6 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">Audio workspace</p>
          <h1 className="mt-3 text-2xl font-semibold text-text-primary">Generate Audio</h1>
          <p className="mt-2 max-w-2xl text-sm text-text-secondary">
            Build a final cut with synced sound design, an ambient cinematic score, and optional narration. This V1 focuses on a polished result, not a studio console.
          </p>

          <div className="mt-6 rounded-card border border-border bg-bg/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-text-primary">Source video</h2>
                <p className="mt-1 text-xs text-text-secondary">Upload one MP4/MOV/WebM source video, or open this page with `?job=...` to reuse an existing MaxVideoAI render.</p>
              </div>
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
                <Button type="button" variant="outline" size="sm" onClick={handleClearSourceVideo}>
                  Remove source video
                </Button>
              ) : null}
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
              <div className="mt-4 grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
                <div className="overflow-hidden rounded-card border border-border bg-black">
                  <video src={sourceVideo.url} poster={sourceVideo.thumbUrl ?? undefined} controls className="h-full w-full object-contain" />
                </div>
                <div className="space-y-2 text-sm text-text-secondary">
                  <p className="font-semibold text-text-primary">{sourceVideo.label}</p>
                  <p>Duration: {sourceVideo.durationSec ? `${sourceVideo.durationSec}s` : 'Detecting…'}</p>
                  <p>Source: {sourceVideo.jobId ? `Job ${sourceVideo.jobId}` : 'Uploaded video'}</p>
                  {sourceVideo.durationSec && sourceVideo.durationSec > AUDIO_MAX_DURATION_SEC ? (
                    <p className="text-error">V1 currently supports videos up to {AUDIO_MAX_DURATION_SEC}s.</p>
                  ) : null}
                </div>
              </div>
            ) : queryJobLoading ? (
              <p className="mt-4 text-sm text-text-secondary">
                {queryJobId ? 'Loading source job…' : 'Restoring latest audio job…'}
              </p>
            ) : (
              <p className="mt-4 text-sm text-text-secondary">No source selected yet.</p>
            )}
          </div>

          <div className="mt-6">
            <h2 className="text-sm font-semibold text-text-primary">Audio pack</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {(['cinematic', 'cinematic_voice'] as AudioPackId[]).map((candidate) => {
                const config = getAudioPackConfig(candidate);
                const active = pack === candidate;
                return (
                  <button
                    key={candidate}
                    type="button"
                    onClick={() => setPack(candidate)}
                    className={`rounded-card border p-4 text-left transition ${active ? 'border-brand bg-brand/10' : 'border-border bg-bg/60 hover:border-border-hover'}`}
                  >
                    <p className="text-sm font-semibold text-text-primary">{config.label}</p>
                    <p className="mt-2 text-sm text-text-secondary">{config.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-text-primary">Audio mood</span>
              <select
                value={mood}
                onChange={(event) => setMood(event.target.value as AudioMood)}
                className="h-11 rounded-input border border-hairline bg-bg px-3 text-sm text-text-primary"
              >
                {AUDIO_MOOD_VALUES.map((candidate) => (
                  <option key={candidate} value={candidate}>
                    {candidate}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {pack === 'cinematic_voice' ? (
            <div className="mt-6 rounded-card border border-border bg-bg/70 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-text-primary">Narration</h2>
                  <p className="mt-1 text-xs text-text-secondary">Write the final script. Upload a voice sample if you want cloned delivery; otherwise the workspace uses the standard premium voice path.</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isUploadingVoice}
                  onClick={() => voiceInputRef.current?.click()}
                >
                  {isUploadingVoice ? 'Uploading…' : voiceSample ? 'Replace voice sample' : 'Upload voice sample'}
                </Button>
                <input
                  ref={voiceInputRef}
                  type="file"
                  accept="audio/*"
                  className="sr-only"
                  onChange={(event) => {
                    void handleVoiceFileSelect(event.target.files);
                  }}
                />
              </div>

              <div className="mt-4">
                <Textarea
                  rows={6}
                  value={script}
                  onChange={(event) => setScript(event.target.value)}
                  placeholder="Write the narration or dialogue that should play over the final cut."
                />
              </div>

              {voiceSample ? (
                <div className="mt-4 rounded-card border border-border bg-surface p-3">
                  <p className="text-sm font-semibold text-text-primary">{voiceSample.name}</p>
                  <audio src={voiceSample.url} controls className="mt-3 w-full" />
                </div>
              ) : (
                <p className="mt-4 text-sm text-text-secondary">No voice sample uploaded. Standard TTS will be used.</p>
              )}
            </div>
          ) : null}

          {notice ? (
            <div className="mt-6 rounded-card border border-border bg-bg px-4 py-3 text-sm text-text-secondary">
              {notice}
            </div>
          ) : null}

          {activeJob ? (
            <div className="mt-6 rounded-card border border-border bg-bg/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-text-primary">Latest audio job</h2>
                  <p className="mt-1 text-xs text-text-secondary">Job {activeJob.jobId}</p>
                </div>
                <p className="text-sm font-semibold text-text-primary">
                  {activeJob.status === 'completed'
                    ? 'Completed'
                    : activeJob.status === 'failed'
                      ? 'Failed'
                      : `${activeJob.progress}%`}
                </p>
              </div>
              {activeJob.message ? (
                <p className="mt-3 text-sm text-text-secondary">{activeJob.message}</p>
              ) : null}
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-3">
            <Button type="button" onClick={() => void handleGenerate()} disabled={!canGenerate}>
              {isGenerating ? 'Generating audio…' : 'Generate audio'}
            </Button>
            {result?.videoUrl ? (
              <ButtonLink href={result.videoUrl} linkComponent="a" target="_blank" rel="noreferrer" variant="outline">
                Download result
              </ButtonLink>
            ) : null}
          </div>

          {result?.videoUrl ? (
            <div className="mt-6 rounded-card border border-border bg-bg/70 p-4">
              <h2 className="text-sm font-semibold text-text-primary">Latest result</h2>
              <div className="mt-4 overflow-hidden rounded-card border border-border bg-black">
                <video src={result.videoUrl} poster={result.thumbUrl ?? undefined} controls className="w-full object-contain" />
              </div>
              <p className="mt-3 text-sm text-text-secondary">Job ID: {result.jobId}</p>
            </div>
          ) : null}
        </section>

        <aside className="rounded-card border border-border bg-surface p-6 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">Quote</p>
          <h2 className="mt-3 text-lg font-semibold text-text-primary">This render</h2>
          {quote ? (
            <>
              <p className="mt-2 text-3xl font-semibold text-text-primary">{formatCurrency(quote.totalCents / 100, quote.currency)}</p>
              <div className="mt-4 space-y-2 text-sm text-text-secondary">
                <p>Pack: {getAudioPackConfig(pack).label}</p>
                <p>Mood: {mood}</p>
                <p>Duration: {sourceVideo?.durationSec}s</p>
                <p>Voice: {pack === 'cinematic_voice' ? (voiceSample ? 'Cloned voice' : 'Standard voice') : 'None'}</p>
              </div>
            </>
          ) : (
            <p className="mt-3 text-sm text-text-secondary">Pricing appears once the source video duration is known.</p>
          )}

          <div className="mt-6 rounded-card border border-border bg-bg/70 p-4 text-sm text-text-secondary">
            <p className="font-semibold text-text-primary">Included in V1</p>
            <ul className="mt-3 space-y-2">
              <li>Synced sound design from the source video</li>
              <li>Subtle cinematic music bed</li>
              <li>Automatic mix with voice priority and music ducking</li>
              <li>Final MP4 output with integrated audio</li>
            </ul>
          </div>
        </aside>
      </div>
      {generatedPickerOpen ? (
        <GeneratedVideoPickerModal
          open={generatedPickerOpen}
          videos={generatedVideos}
          isLoading={isGeneratedVideosLoading}
          error={generatedVideosError}
          onClose={() => setGeneratedPickerOpen(false)}
          onRefresh={() => void fetchGeneratedVideos()}
          onSelect={(video) => {
            void handleSelectGeneratedVideo(video);
          }}
        />
      ) : null}
    </main>
  );
}

function GeneratedVideoPickerModal({
  open,
  videos,
  isLoading,
  error,
  onClose,
  onRefresh,
  onSelect,
}: {
  open: boolean;
  videos: GeneratedSourceVideo[];
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
  onRefresh: () => void;
  onSelect: (video: GeneratedSourceVideo) => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-surface-on-media-dark-40 px-4">
      <div className="absolute inset-0" role="presentation" onClick={onClose} />
      <div className="relative z-10 w-full max-w-5xl rounded-modal border border-border bg-surface p-6 shadow-float">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Your generated videos</h2>
            <p className="text-sm text-text-secondary">Pick an existing MaxVideoAI render as the source for the audio pipeline.</p>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button type="button" variant="outline" size="sm" onClick={onRefresh} disabled={isLoading}>
              {isLoading ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>

        <div className="mt-4 max-h-[70vh] overflow-y-auto">
          {error ? (
            <div className="rounded-input border border-error-border bg-error-bg px-4 py-3 text-sm text-error">{error}</div>
          ) : isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={`generated-video-skeleton-${index}`} className="overflow-hidden rounded-card border border-border bg-bg/60">
                  <div className="aspect-video animate-pulse bg-placeholder" />
                  <div className="space-y-2 p-3">
                    <div className="h-4 w-2/3 animate-pulse rounded bg-placeholder" />
                    <div className="h-3 w-1/2 animate-pulse rounded bg-placeholder" />
                  </div>
                </div>
              ))}
            </div>
          ) : videos.length === 0 ? (
            <div className="rounded-input border border-border bg-bg/70 px-4 py-6 text-center text-sm text-text-secondary">
              No generated videos found yet.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {videos.map((video) => (
                <article key={video.jobId} className="overflow-hidden rounded-card border border-border bg-bg/70">
                  <div className="aspect-video overflow-hidden bg-black">
                    <video src={video.url} poster={video.thumbUrl ?? undefined} controls className="h-full w-full object-cover" />
                  </div>
                  <div className="space-y-2 p-4 text-sm text-text-secondary">
                    <p className="font-semibold text-text-primary">{video.label}</p>
                    <p>{formatDateTime(video.createdAt)}</p>
                    <p>Duration: {video.durationSec ? `${video.durationSec}s` : 'Unknown'}</p>
                    <p>Job ID: {video.jobId}</p>
                    <p>Audio: {video.hasAudio ? 'Included' : 'None'}</p>
                    <Button type="button" variant="outline" size="sm" onClick={() => onSelect(video)}>
                      Use this video
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
