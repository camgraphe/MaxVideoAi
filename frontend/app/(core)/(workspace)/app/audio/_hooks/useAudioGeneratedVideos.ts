import { useCallback, useEffect, useState } from 'react';
import { authFetch } from '@/lib/authFetch';
import type { Job } from '@/types/jobs';
import { resolveUiErrorMessage } from '../_lib/audio-workspace-helpers';
import type { GeneratedSourceVideo } from '../_lib/audio-workspace-types';

interface UseAudioGeneratedVideosParams {
  loadErrorMessage: string;
  open: boolean;
  user: unknown;
}

export function useAudioGeneratedVideos({
  loadErrorMessage,
  open,
  user,
}: UseAudioGeneratedVideosParams) {
  const [generatedVideos, setGeneratedVideos] = useState<GeneratedSourceVideo[]>([]);
  const [isGeneratedVideosLoading, setIsGeneratedVideosLoading] = useState(false);
  const [generatedVideosError, setGeneratedVideosError] = useState<string | null>(null);

  const fetchGeneratedVideos = useCallback(async () => {
    setIsGeneratedVideosLoading(true);
    setGeneratedVideosError(null);
    try {
      const response = await authFetch('/api/jobs?surface=video&limit=60');
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string; jobs?: Job[] }
        | null;
      if (!response.ok || !payload?.ok || !Array.isArray(payload.jobs)) {
        throw new Error(payload?.error ?? loadErrorMessage);
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
      setGeneratedVideosError(resolveUiErrorMessage(error, loadErrorMessage, ['Unable to load generated videos.']));
    } finally {
      setIsGeneratedVideosLoading(false);
    }
  }, [loadErrorMessage]);

  useEffect(() => {
    if (!open || !user) return;
    if (generatedVideos.length || isGeneratedVideosLoading) return;
    void fetchGeneratedVideos();
  }, [fetchGeneratedVideos, generatedVideos.length, isGeneratedVideosLoading, open, user]);

  return {
    generatedVideos,
    generatedVideosError,
    isGeneratedVideosLoading,
  };
}
