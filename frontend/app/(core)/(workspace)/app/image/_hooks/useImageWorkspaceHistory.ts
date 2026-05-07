'use client';

import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';

import { useInfiniteJobs } from '@/lib/api';
import { countResolvedVisualSlots } from '@/lib/group-progress';
import { groupJobsIntoSummaries } from '@/lib/job-groups';
import { normalizeJobSurface } from '@/lib/job-surface-normalize';
import type { GroupSummary } from '@/types/groups';
import type { Job } from '@/types/jobs';
import { mapJobToHistoryEntry } from '../_lib/image-workspace-history';
import type { HistoryEntry, ImageEngineOption } from '../_lib/image-workspace-types';

export function useImageWorkspaceHistory({
  engines,
  localHistory,
}: {
  engines: ImageEngineOption[];
  localHistory: HistoryEntry[];
}): {
  historyEntries: HistoryEntry[];
  isImageJob: (job: Job) => boolean;
  mutateJobs: () => Promise<unknown>;
  pendingGroups: GroupSummary[];
  setPendingGroups: Dispatch<SetStateAction<GroupSummary[]>>;
} {
  const [pendingGroups, setPendingGroups] = useState<GroupSummary[]>([]);
  const {
    data: jobPages,
    mutate: mutateJobs,
  } = useInfiniteJobs(24, { surface: 'image' });

  const imageEngineAliasSet = useMemo(() => {
    const set = new Set<string>();
    engines.forEach((option) => {
      const aliases = option.aliases?.length ? option.aliases : [option.engineCaps.id, option.id];
      aliases.forEach((alias) => {
        if (typeof alias === 'string' && alias.trim().length) {
          set.add(alias.trim().toLowerCase());
        }
      });
    });
    return set;
  }, [engines]);

  const isImageJob = useCallback(
    (job: Job) => {
      const surface = normalizeJobSurface(job.surface);
      if (surface) {
        return surface === 'image';
      }
      const check = (value: string | null | undefined) =>
        Boolean(value && imageEngineAliasSet.has(value.trim().toLowerCase()));
      if (check(job.engineId)) return true;
      if (check(job.engineLabel)) return true;
      if (!job.videoUrl && Array.isArray(job.renderIds) && job.renderIds.length > 0) return true;
      return false;
    },
    [imageEngineAliasSet]
  );

  const remoteImageJobs = useMemo(() => {
    if (!jobPages) return [];
    return jobPages
      .flatMap((page) => page.jobs ?? [])
      .filter((job) => isImageJob(job));
  }, [jobPages, isImageJob]);

  const remoteHistory = useMemo(() => {
    if (!remoteImageJobs.length) return [];
    return remoteImageJobs
      .map((job) => mapJobToHistoryEntry(job))
      .filter((entry): entry is HistoryEntry => Boolean(entry));
  }, [remoteImageJobs]);

  const remoteResolvedGroupMap = useMemo(() => {
    if (!remoteImageJobs.length) return new Map<string, number>();
    const { groups } = groupJobsIntoSummaries(remoteImageJobs, { includeSinglesAsGroups: true });
    const map = new Map<string, number>();
    groups.forEach((group) => {
      const resolvedCount = countResolvedVisualSlots(group);
      const candidateIds = new Set<string>();
      candidateIds.add(group.id);
      if (group.hero.jobId) {
        candidateIds.add(group.hero.jobId);
      }
      group.members.forEach((member) => {
        if (member.jobId) {
          candidateIds.add(member.jobId);
        }
      });
      candidateIds.forEach((candidateId) => {
        if (!candidateId) return;
        map.set(candidateId, Math.max(map.get(candidateId) ?? 0, resolvedCount));
      });
    });
    return map;
  }, [remoteImageJobs]);

  const historyEntries = useMemo(() => {
    const map = new Map<string, HistoryEntry>();
    remoteHistory.forEach((entry) => {
      map.set(entry.id, entry);
    });
    localHistory.forEach((entry) => {
      map.set(entry.id, entry);
    });
    return Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt);
  }, [localHistory, remoteHistory]);

  useEffect(() => {
    if (!remoteResolvedGroupMap.size) return;
    setPendingGroups((previous) =>
      previous.filter((group) => {
        const expectedCount = Math.max(1, Math.min(4, group.count || group.members.length || 1));
        const relatedIds = new Set<string>();
        relatedIds.add(group.id);
        if (group.hero.jobId) {
          relatedIds.add(group.hero.jobId);
        }
        group.members.forEach((member) => {
          if (member.jobId) {
            relatedIds.add(member.jobId);
          }
        });
        for (const candidateId of relatedIds) {
          const resolvedCount = remoteResolvedGroupMap.get(candidateId) ?? 0;
          if (resolvedCount >= expectedCount) {
            return false;
          }
        }
        return true;
      })
    );
  }, [remoteResolvedGroupMap]);

  useEffect(() => {
    if (!pendingGroups.length) return;
    const intervalId = window.setInterval(() => {
      void mutateJobs();
    }, 2000);
    const timeoutId = window.setTimeout(() => {
      window.clearInterval(intervalId);
    }, 30000);
    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
    };
  }, [mutateJobs, pendingGroups]);

  return {
    historyEntries,
    isImageJob,
    mutateJobs,
    pendingGroups,
    setPendingGroups,
  };
}
