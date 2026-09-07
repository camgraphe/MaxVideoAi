import { degradedGenerationObservation, isStaleGenerationUpdate, mergeGenerationObservation } from '@/lib/generation-observation';
import { useEffect, type Dispatch, type SetStateAction } from 'react';
import { getJobStatus } from '@/lib/api';
import { inferOutputKind } from '../_lib/audio-workspace-helpers';
import type {
  ActiveAudioJobState,
  AudioResultState,
} from '../_lib/audio-workspace-types';

interface UseAudioActiveJobPollingParams {
  activeJob: ActiveAudioJobState | null;
  setActiveJob: Dispatch<SetStateAction<ActiveAudioJobState | null>>;
  setResult: Dispatch<SetStateAction<AudioResultState | null>>;
}

export function useAudioActiveJobPolling({
  activeJob,
  setActiveJob,
  setResult,
}: UseAudioActiveJobPollingParams) {
  const jobId = activeJob?.jobId;
  const pending = activeJob?.status === 'pending' || activeJob?.status === 'running';
  useEffect(() => {
    if (!jobId || !pending) {
      return;
    }
    let cancelled = false;
    let inFlight = false;
    const poll = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const status = await getJobStatus(jobId);
        if (cancelled) return;
        const nextOutputKind = inferOutputKind({
          videoUrl: status.videoUrl ?? null,
          audioUrl: status.audioUrl ?? null,
        });
        const nextStatus: ActiveAudioJobState = {
          jobId: status.jobId,
          status: status.videoUrl || status.audioUrl ? 'completed' : status.status,
          progress: status.progress,
          observation: status.observation,
          startedAt: status.createdAt ? Date.parse(status.createdAt) : undefined,
          etaSeconds: status.etaSeconds,
          message: status.message ?? null,
          videoUrl: status.videoUrl ?? null,
          audioUrl: status.audioUrl ?? null,
          thumbUrl: status.thumbUrl ?? null,
          outputKind: nextOutputKind,
        };
        setActiveJob((current) => !current || current.jobId !== jobId || isStaleGenerationUpdate(current, nextStatus)
          ? current : { ...current, ...nextStatus, observation: mergeGenerationObservation(current.observation, nextStatus.observation), startedAt: current.startedAt ?? nextStatus.startedAt });
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
        if (cancelled) return;
        setActiveJob((current) => current?.jobId === jobId && (current.status === 'pending' || current.status === 'running')
          ? { ...current, observation: degradedGenerationObservation(current.observation) } : current);
      } finally {
        inFlight = false;
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
  }, [jobId, pending, setActiveJob, setResult]);
}
