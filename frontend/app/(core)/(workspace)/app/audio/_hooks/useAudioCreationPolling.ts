'use client';
import { useEffect } from 'react';
import { fetchJobDetail } from '../_lib/audio-workspace-helpers';
import type { AudioJobDetail } from '../_lib/audio-workspace-types';

/** Stable cadence, one owned read at a time. Selection/account changes invalidate late responses. */
export function useAudioCreationPolling(userId: string | null, result: AudioJobDetail | null, onUpdate: (job: AudioJobDetail) => void) {
  const jobId = result?.jobId;
  const pending = result?.status === 'pending' || result?.status === 'running';
  useEffect(() => {
    if (!userId || !jobId || !pending) return;
    let cancelled = false;
    let inFlight = false;
    const poll = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const job = await fetchJobDetail(jobId);
        if (!cancelled) onUpdate(job);
      } catch { /* Keep the last known job status while observation is unavailable. */ }
      finally { inFlight = false; }
    };
    const timer = setInterval(() => void poll(), 5000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [jobId, pending, userId, onUpdate]);
}
