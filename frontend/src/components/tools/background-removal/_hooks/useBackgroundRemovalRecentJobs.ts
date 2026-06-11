import { useEffect, useMemo } from 'react';
import { getJobStatus, useInfiniteJobs } from '@/lib/api';
import { resolveRecentBackgroundRemovalResult } from '../_lib/background-removal-workspace-helpers';

export function useBackgroundRemovalRecentJobs(user: unknown) {
  const { stableJobs, mutate } = useInfiniteJobs(12, { surface: 'background-removal' });
  const results = useMemo(
    () => stableJobs.map(resolveRecentBackgroundRemovalResult).filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)),
    [stableJobs]
  );
  const pendingJobIds = useMemo(
    () =>
      stableJobs
        .filter((job) => {
          const status = typeof job.status === 'string' ? job.status.toLowerCase() : '';
          return status !== 'completed' && status !== 'failed' && status !== 'cancelled' && status !== 'canceled';
        })
        .map((job) => job.jobId)
        .filter(Boolean),
    [stableJobs]
  );
  const pendingKey = pendingJobIds.join('|');

  useEffect(() => {
    if (!user || !pendingKey || typeof window === 'undefined') return undefined;
    let cancelled = false;
    const jobIds = pendingKey.split('|').filter(Boolean);
    const poll = async () => {
      await Promise.all(jobIds.map((jobId) => getJobStatus(jobId).catch(() => null)));
      if (!cancelled) void mutate();
    };
    void poll();
    const timer = window.setInterval(() => {
      void poll();
    }, 5_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [mutate, pendingKey, user]);

  return {
    mutate,
    recentJobs: stableJobs,
    recentResults: results,
  };
}
