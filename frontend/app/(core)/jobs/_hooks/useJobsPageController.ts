'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getJobStatus, hideJob, saveAssetToLibrary, useEngines, useInfiniteJobs } from '@/lib/api';
import { groupJobsIntoSummaries } from '@/lib/job-groups';
import { normalizeGroupSummaries, normalizeGroupSummary } from '@/lib/normalize-group-summary';
import { adaptGroupSummary } from '@/lib/video-group-adapter';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useResultProvider } from '@/hooks/useResultProvider';
import type { MediaLightboxEntry } from '@/components/MediaLightbox';
import type { EngineCaps } from '@/types/engines';
import type { GroupSummary } from '@/types/groups';
import { activityLoadedJobs } from '../_lib/jobs-activity';
import { useJobsCopy } from './useJobsCopy';
import {
  resolveClientJobSurface,
  resolveEntryLibrarySavePayload,
  resolveGroupLibrarySavePayload,
} from '../_lib/jobs-page-helpers';
import type { GroupedJobAction, JobsSource, JobsStatus } from '../_lib/jobs-page-types';

const JOBS_PAGE_SIZE = 24;

export function useJobsPageController() {
  const copy = useJobsCopy();
  const { data: enginesData } = useEngines('all', { includeAverages: false });
  const [source, setSource] = useState<JobsSource>('all');
  const [status, setStatus] = useState<JobsStatus>('all');
  const { data, stableJobs, error, isLoading, setSize, isValidating, mutate } =
    useInfiniteJobs(JOBS_PAGE_SIZE, { surface: source });
  useRequireAuth({ redirectIfLoggedOut: false });
  const hasMore = Boolean(data?.length && data[data.length - 1].nextCursor);
  const groupedJobs = useMemo(() => {
    const { groups } = groupJobsIntoSummaries(activityLoadedJobs(data, stableJobs), { includeSinglesAsGroups: true });
    return groups.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }, [data, stableJobs]);

  useEffect(() => {
    const handleHidden = () => { void mutate(); };
    window.addEventListener('jobs:hidden', handleHidden);
    return () => window.removeEventListener('jobs:hidden', handleHidden);
  }, [mutate]);

  const engineLookupById = useMemo(() => {
    const byId = new Map<string, EngineCaps>();
    (enginesData?.engines ?? []).forEach((engine) => {
      byId.set(engine.id, engine);
    });
    return byId;
  }, [enginesData?.engines]);

  const provider = useResultProvider();
  const summaryMap = useMemo(() => {
    const map = new Map<string, GroupSummary>();
    groupedJobs.forEach((group) => map.set(group.id, group));
    return map;
  }, [groupedJobs]);

  const [savingImageGroupIds, setSavingImageGroupIds] = useState<Set<string>>(new Set());
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const groups = useMemo(() => normalizeGroupSummaries(groupedJobs), [groupedJobs]);
  const normalizedGroupMap = useMemo(() => new Map(groups.map((group) => [group.id, group])), [groups]);
  const hasCuratedVideo = groups.some((group) => Boolean(group.hero.job?.curated));

  const handleRefreshJob = useCallback(async (jobId: string) => {
    try {
      const status = await getJobStatus(jobId);
      if (status.status === 'failed') {
        throw new Error(status.message ?? 'MaxVideoAI could not complete this render.');
      }
      if (status.status !== 'completed' && !status.videoUrl && !status.audioUrl) {
        throw new Error('This render is still processing.');
      }
    } catch (error) {
      throw error instanceof Error ? error : new Error('Unable to refresh render status.');
    }
  }, []);

  const handleRemoveGroup = useCallback(
    async (group: GroupSummary) => {
      const original = summaryMap.get(group.id);
      if (!original) return;
      const heroJob = original.hero.job;
      if (!heroJob || heroJob.curated) return;
      try {
        await hideJob(heroJob.jobId);
        setActiveGroupId((current) => (current === group.id ? null : current));
        const removeFromPages = (pages: typeof data) => {
          if (!pages) return pages;
          return pages.map((page) => ({
            ...page,
            jobs: page.jobs.filter((entry) => entry.jobId !== heroJob.jobId),
          }));
        };
        await mutate((pages) => removeFromPages(pages), false);
      } catch (error) {
        console.error('Failed to hide job', error);
      }
    },
    [mutate, summaryMap]
  );

  const allowRemove = useCallback(
    (group: GroupSummary) => {
      const summary = summaryMap.get(group.id);
      if (!summary) return false;
      if (summary.hero.job?.curated) return false;
      return summary.source !== 'active' && summary.count <= 1;
    },
    [summaryMap]
  );

  const handleSaveGroupToLibrary = useCallback(async (group: GroupSummary) => {
    const payload = resolveGroupLibrarySavePayload(group);
    if (!payload) {
      console.warn('No media available to save for group', group.id);
      return;
    }
    const groupSurface = group.hero.job ? resolveClientJobSurface(group.hero.job) : null;
    setSavingImageGroupIds((prev) => {
      const next = new Set(prev);
      next.add(group.id);
      return next;
    });
    try {
      await saveAssetToLibrary({
        url: payload.url,
        kind: payload.kind,
        jobId: payload.jobId ?? group.id,
        label: payload.label ?? undefined,
        source: groupSurface === 'storyboard' ? 'storyboard' : 'generated',
        thumbUrl: payload.thumbUrl ?? null,
        previewUrl: payload.previewUrl ?? null,
      });
    } catch (error) {
      console.error('Failed to save media to library', error);
    } finally {
      setSavingImageGroupIds((prev) => {
        const next = new Set(prev);
        next.delete(group.id);
        return next;
      });
    }
  }, []);

  const handleSaveLightboxEntryToLibrary = useCallback(async (entry: MediaLightboxEntry) => {
    const payload = resolveEntryLibrarySavePayload(entry);
    if (!payload) {
      throw new Error('No media available to save.');
    }
    await saveAssetToLibrary({
      url: payload.url,
      kind: payload.kind,
      jobId: payload.jobId ?? entry.jobId ?? entry.id,
      label: payload.label ?? undefined,
      source: 'generated',
      thumbUrl: payload.thumbUrl ?? null,
      previewUrl: payload.previewUrl ?? null,
    });
  }, []);

  const handleGroupAction = useCallback(
    (group: GroupSummary, action: GroupedJobAction) => {
      if (action === 'remove') {
        void handleRemoveGroup(group);
        return;
      }
      if (action === 'save-image' || action === 'save-to-library') {
        void handleSaveGroupToLibrary(group);
        return;
      }
      if (action === 'open' || action === 'continue' || action === 'refine' || action === 'branch' || action === 'compare') {
        setActiveGroupId(group.id);
      }
    },
    [handleRemoveGroup, handleSaveGroupToLibrary]
  );

  const handleGroupOpen = useCallback((group: GroupSummary) => {
    setActiveGroupId(group.id);
  }, []);

  const viewerGroup = useMemo(() => {
    if (!activeGroupId) return null;
    const normalized = normalizedGroupMap.get(activeGroupId);
    const fallback = summaryMap.get(activeGroupId);
    const target = normalized ?? (fallback ? normalizeGroupSummary(fallback) : null);
    if (!target) return null;
    return adaptGroupSummary(target, provider);
  }, [activeGroupId, normalizedGroupMap, summaryMap, provider]);

  return {
    allowRemove,
    source,
    status,
    onSourceChange: (next: JobsSource) => { setActiveGroupId(null); setSource(next); },
    onStatusChange: setStatus,
    groups,
    hasMore,
    isInitialLoading: isLoading && groups.length === 0,
    isValidating,
    error,
    onRetry: () => { void mutate(); },
    onLoadMore: () => { if (hasMore && !isValidating) void setSize((size) => size + 1); },
    copy,
    engineLookupById,
    hasCuratedVideo,
    onCloseViewer: () => setActiveGroupId(null),
    onGroupAction: handleGroupAction,
    onGroupOpen: handleGroupOpen,
    onRefreshJob: handleRefreshJob,
    onSaveGroupToLibrary: handleSaveGroupToLibrary,
    onSaveLightboxEntryToLibrary: handleSaveLightboxEntryToLibrary,
    savingImageGroupIds,
    viewerGroup,
  };
}
