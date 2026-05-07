import { useEffect, useMemo, useRef, type Dispatch, type SetStateAction } from 'react';
import { getJobStatus, useInfiniteJobs } from '@/lib/api';
import { groupJobsIntoSummaries } from '@/lib/job-groups';
import { normalizeGroupSummaries } from '@/lib/normalize-group-summary';
import type { UpscaleMediaType } from '@/types/tools-upscale';
import {
  hasRenderableUpscaleJobMedia,
  resolveGeneratedImageSource,
} from '../_lib/upscale-workspace-helpers';
import type {
  PreviewMode,
  PreviewZoom,
  UploadedAsset,
} from '../_lib/upscale-workspace-types';

interface UseUpscaleRecentJobsParams {
  hasResult: boolean;
  mediaType: UpscaleMediaType;
  mediaUrl: string;
  setMediaUrl: Dispatch<SetStateAction<string>>;
  setMessage: Dispatch<SetStateAction<string | null>>;
  setPreviewMode: Dispatch<SetStateAction<PreviewMode>>;
  setPreviewZoom: Dispatch<SetStateAction<PreviewZoom>>;
  setSource: Dispatch<SetStateAction<UploadedAsset | null>>;
  source: UploadedAsset | null;
  user: unknown;
}

export function useUpscaleRecentJobs({
  hasResult,
  mediaType,
  mediaUrl,
  setMediaUrl,
  setMessage,
  setPreviewMode,
  setPreviewZoom,
  setSource,
  source,
  user,
}: UseUpscaleRecentJobsParams) {
  const defaultGeneratedImageAppliedRef = useRef(false);
  const { stableJobs: recentJobs, mutate } = useInfiniteJobs(12, { surface: 'upscale' });
  const { stableJobs: recentGeneratedImageJobs } = useInfiniteJobs(8, { surface: 'image' });

  const recentGroups = useMemo(() => {
    const jobs = recentJobs.map((job) => (!job.videoUrl && job.readyVideoUrl ? { ...job, videoUrl: job.readyVideoUrl } : job));
    return normalizeGroupSummaries(groupJobsIntoSummaries(jobs, { includeSinglesAsGroups: true }).groups);
  }, [recentJobs]);

  const pendingRecentJobIds = useMemo(
    () =>
      recentJobs
        .filter((job) => {
          const status = typeof job.status === 'string' ? job.status.toLowerCase() : '';
          if (status === 'failed' || status === 'cancelled' || status === 'canceled') return false;
          return status !== 'completed' || !hasRenderableUpscaleJobMedia(job);
        })
        .map((job) => job.jobId)
        .filter((jobId): jobId is string => typeof jobId === 'string' && jobId.length > 0),
    [recentJobs]
  );
  const pendingRecentJobKey = pendingRecentJobIds.join('|');
  const defaultGeneratedImageSource = useMemo(() => {
    const sortedJobs = [...recentGeneratedImageJobs].sort(
      (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
    );
    for (const job of sortedJobs) {
      const candidate = resolveGeneratedImageSource(job);
      if (candidate) return candidate;
    }
    return null;
  }, [recentGeneratedImageJobs]);

  useEffect(() => {
    if (typeof window === 'undefined' || !pendingRecentJobKey) return undefined;
    let cancelled = false;
    const jobIds = pendingRecentJobKey.split('|').filter(Boolean);
    const pollPendingJobs = async () => {
      await Promise.all(jobIds.map((jobId) => getJobStatus(jobId).catch(() => null)));
      if (!cancelled) {
        void mutate();
      }
    };
    void pollPendingJobs();
    const interval = window.setInterval(() => {
      void pollPendingJobs();
    }, 5_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [mutate, pendingRecentJobKey]);

  useEffect(() => {
    if (defaultGeneratedImageAppliedRef.current) return;
    if (!user || mediaType !== 'image' || source || hasResult || mediaUrl.trim() || !defaultGeneratedImageSource) return;
    defaultGeneratedImageAppliedRef.current = true;
    setSource(defaultGeneratedImageSource);
    setMediaUrl(defaultGeneratedImageSource.url);
    setPreviewMode('source');
    setPreviewZoom('100');
    setMessage(defaultGeneratedImageSource.name ?? null);
  }, [
    defaultGeneratedImageSource,
    hasResult,
    mediaType,
    mediaUrl,
    setMediaUrl,
    setMessage,
    setPreviewMode,
    setPreviewZoom,
    setSource,
    source,
    user,
  ]);

  return {
    mutate,
    recentGroups,
  };
}
