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
  }, [activeJob, setActiveJob, setResult]);
}
