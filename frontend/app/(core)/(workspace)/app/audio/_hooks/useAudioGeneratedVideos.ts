import { useEffect, useRef, useState } from 'react';
import { ownedAuthFetch } from '@/lib/owned-auth-fetch';
import { useLibraryCacheRevision, libraryCacheRevision } from '@/hooks/useLibraryCacheRevision';
import type { GeneratedVideoCandidate } from '@/lib/generated-video-candidates';
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
  const revision = useLibraryCacheRevision(userId);
  // A new identity object also invalidates A → B → A round trips before effects.
  const currentScope = useRef({ userId, revision });
  if (currentScope.current.userId !== userId || currentScope.current.revision !== revision) currentScope.current = { userId, revision };
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
    const isCurrent = () => currentScope.current === scope && requestVersion.current === request && libraryCacheRevision(userId) === revision;
    setSnapshot({ scope, videos: [], loading: true, error: null });
    const fetchGeneratedVideos = async () => {
      try {
        const response = await ownedAuthFetch('/api/media-library/generated-videos?surface=video&limit=60', userId, { cache: 'no-store' });
        const payload = (await response.json().catch(() => null)) as
          | { ok?: boolean; error?: string; jobs?: GeneratedVideoCandidate[] }
          | null;
        if (!isCurrent()) return;
        if (!response.ok || !payload?.ok || !Array.isArray(payload.jobs)) {
          throw new Error(payload?.error ?? loadErrorMessage);
        }
        const next = payload.jobs
          .filter((job) => typeof job.videoUrl === 'string' && job.videoUrl.trim().length > 0)
          .map((job) => ({
            jobId: job.jobId,
            sourceOutputId: job.sourceOutputId, sourceRevision: job.sourceRevision, ref: job.ref,
            url: job.videoUrl as string,
            thumbUrl: job.thumbUrl ?? null,
            durationSec: typeof job.durationSec === 'number' ? job.durationSec : null,
            aspectRatio: job.aspectRatio ?? null,
            width: job.width ?? null, height: job.height ?? null,
            label: job.engineLabel?.trim().length ? job.engineLabel : `Job ${job.jobId}`,
            createdAt: job.createdAt,
            hasAudio: typeof job.hasAudio === 'boolean' ? job.hasAudio : null,
          }))
          .filter((job, index, list) => list.findIndex((entry) => entry.jobId === job.jobId && entry.sourceOutputId === job.sourceOutputId) === index);
        setSnapshot({ scope, videos: next, loading: false, error: null });
      } catch (error) {
        if (!isCurrent()) return;
        setSnapshot({ scope, videos: [], loading: false, error: resolveUiErrorMessage(error, loadErrorMessage, ['Unable to load generated videos.']) });
      }
    };
    void fetchGeneratedVideos();
    // Closing, changing account or unmounting cannot publish a late result.
    return () => { requestVersion.current += 1; };
  }, [loadErrorMessage, open, scope, userId, revision]);

  const current = userId && snapshot?.scope === scope ? snapshot : null;
  return {
    generatedVideos: current?.videos ?? [],
    generatedVideosError: current?.error ?? null,
    isGeneratedVideosLoading: Boolean(open && userId && (current?.loading ?? true)),
  };
}
