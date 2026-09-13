import { useEffect, useRef, useState } from 'react';
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
  const userId = user && typeof user === 'object' && 'id' in user && typeof user.id === 'string' ? user.id : null;
  // A new identity object also invalidates A → B → A round trips before effects.
  const currentScope = useRef({ userId });
  if (currentScope.current.userId !== userId) currentScope.current = { userId };
  const scope = currentScope.current;
  const requestVersion = useRef(0);
  const [snapshot, setSnapshot] = useState<{
    scope: typeof scope;
    videos: GeneratedSourceVideo[];
    loading: boolean;
    error: string | null;
  } | null>(null);
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  useEffect(() => {
    if (!open || !userId) return;
    if (snapshotRef.current?.scope === scope && snapshotRef.current.videos.length) return;
    const request = ++requestVersion.current;
    const isCurrent = () => currentScope.current === scope && requestVersion.current === request;
    setSnapshot({ scope, videos: [], loading: true, error: null });
    const fetchGeneratedVideos = async () => {
      try {
        const response = await authFetch('/api/jobs?surface=video&limit=60');
        const payload = (await response.json().catch(() => null)) as
          | { ok?: boolean; error?: string; jobs?: Job[] }
          | null;
        if (!isCurrent()) return;
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
        setSnapshot({ scope, videos: next, loading: false, error: null });
      } catch (error) {
        if (!isCurrent()) return;
        setSnapshot({ scope, videos: [], loading: false, error: resolveUiErrorMessage(error, loadErrorMessage, ['Unable to load generated videos.']) });
      }
    };
    void fetchGeneratedVideos();
    // Closing, changing account or unmounting cannot publish a late result.
    return () => { requestVersion.current += 1; };
  }, [loadErrorMessage, open, scope, userId]);

  const current = userId && snapshot?.scope === scope ? snapshot : null;
  return {
    generatedVideos: current?.videos ?? [],
    generatedVideosError: current?.error ?? null,
    isGeneratedVideosLoading: Boolean(open && userId && (current?.loading ?? true)),
  };
}
