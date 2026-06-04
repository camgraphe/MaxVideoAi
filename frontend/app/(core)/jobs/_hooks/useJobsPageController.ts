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
import { useJobsCopy } from './useJobsCopy';
import {
  resolveClientJobSurface,
  resolveEntryLibrarySavePayload,
  resolveGroupLibrarySavePayload,
} from '../_lib/jobs-page-helpers';
import type { GroupedJobAction, JobsPageSection, JobsSectionKey } from '../_lib/jobs-page-types';

const JOBS_PAGE_SIZE = 24;

export function useJobsPageController() {
  const copy = useJobsCopy();
  const { data: enginesData } = useEngines('all', { includeAverages: false });
  const {
    data: videoData,
    error: videoError,
    isLoading: videoIsLoading,
    setSize: setVideoSize,
    isValidating: videoIsValidating,
    mutate: mutateVideo,
  } = useInfiniteJobs(JOBS_PAGE_SIZE, { surface: 'video' });
  const {
    data: imageData,
    error: imageError,
    isLoading: imageIsLoading,
    setSize: setImageSize,
    isValidating: imageIsValidating,
    mutate: mutateImage,
  } = useInfiniteJobs(JOBS_PAGE_SIZE, { surface: 'image' });
  const {
    data: audioData,
    error: audioError,
    isLoading: audioIsLoading,
    setSize: setAudioSize,
    isValidating: audioIsValidating,
    mutate: mutateAudio,
  } = useInfiniteJobs(JOBS_PAGE_SIZE, { surface: 'audio' });
  const {
    data: storyboardData,
    error: storyboardError,
    isLoading: storyboardIsLoading,
    setSize: setStoryboardSize,
    isValidating: storyboardIsValidating,
    mutate: mutateStoryboard,
  } = useInfiniteJobs(JOBS_PAGE_SIZE, { surface: 'storyboard' });
  const {
    data: characterData,
    error: characterError,
    isLoading: characterIsLoading,
    setSize: setCharacterSize,
    isValidating: characterIsValidating,
    mutate: mutateCharacter,
  } = useInfiniteJobs(JOBS_PAGE_SIZE, { surface: 'character' });
  const {
    data: angleData,
    error: angleError,
    isLoading: angleIsLoading,
    setSize: setAngleSize,
    isValidating: angleIsValidating,
    mutate: mutateAngle,
  } = useInfiniteJobs(JOBS_PAGE_SIZE, { surface: 'angle' });
  const {
    data: upscaleData,
    error: upscaleError,
    isLoading: upscaleIsLoading,
    setSize: setUpscaleSize,
    isValidating: upscaleIsValidating,
    mutate: mutateUpscale,
  } = useInfiniteJobs(JOBS_PAGE_SIZE, { surface: 'upscale' });
  useRequireAuth({ redirectIfLoggedOut: false });

  const videoPages = videoData ?? [];
  const audioPages = audioData ?? [];
  const imagePages = imageData ?? [];
  const storyboardPages = storyboardData ?? [];
  const characterPages = characterData ?? [];
  const anglePages = angleData ?? [];
  const upscalePages = upscaleData ?? [];
  const videoJobs = videoPages.flatMap((page) => page.jobs).filter((job) => resolveClientJobSurface(job) === 'video');
  const audioJobs = audioPages.flatMap((page) => page.jobs).filter((job) => resolveClientJobSurface(job) === 'audio');
  const imageJobs = imagePages.flatMap((page) => page.jobs).filter((job) => resolveClientJobSurface(job) === 'image');
  const storyboardJobs = storyboardPages.flatMap((page) => page.jobs).filter((job) => resolveClientJobSurface(job) === 'storyboard');
  const characterJobs = characterPages.flatMap((page) => page.jobs).filter((job) => resolveClientJobSurface(job) === 'character');
  const angleJobs = anglePages.flatMap((page) => page.jobs).filter((job) => resolveClientJobSurface(job) === 'angle');
  const upscaleJobs = upscalePages.flatMap((page) => page.jobs).filter((job) => resolveClientJobSurface(job) === 'upscale');
  const videoHasMore = videoPages.length > 0 && videoPages[videoPages.length - 1].nextCursor !== null;
  const audioHasMore = audioPages.length > 0 && audioPages[audioPages.length - 1].nextCursor !== null;
  const imageHasMore = imagePages.length > 0 && imagePages[imagePages.length - 1].nextCursor !== null;
  const storyboardHasMore = storyboardPages.length > 0 && storyboardPages[storyboardPages.length - 1].nextCursor !== null;
  const characterHasMore = characterPages.length > 0 && characterPages[characterPages.length - 1].nextCursor !== null;
  const angleHasMore = anglePages.length > 0 && anglePages[anglePages.length - 1].nextCursor !== null;
  const upscaleHasMore = upscalePages.length > 0 && upscalePages[upscalePages.length - 1].nextCursor !== null;

  const { groups: apiVideoGroups } = useMemo(
    () => groupJobsIntoSummaries(videoJobs, { includeSinglesAsGroups: true }),
    [videoJobs]
  );
  const { groups: apiImageGroups } = useMemo(
    () => groupJobsIntoSummaries(imageJobs, { includeSinglesAsGroups: true }),
    [imageJobs]
  );
  const { groups: apiStoryboardGroups } = useMemo(
    () => groupJobsIntoSummaries(storyboardJobs, { includeSinglesAsGroups: true }),
    [storyboardJobs]
  );
  const { groups: apiAudioGroups } = useMemo(
    () => groupJobsIntoSummaries(audioJobs, { includeSinglesAsGroups: true }),
    [audioJobs]
  );
  const { groups: apiCharacterGroups } = useMemo(
    () => groupJobsIntoSummaries(characterJobs, { includeSinglesAsGroups: true }),
    [characterJobs]
  );
  const { groups: apiAngleGroups } = useMemo(
    () => groupJobsIntoSummaries(angleJobs, { includeSinglesAsGroups: true }),
    [angleJobs]
  );
  const { groups: apiUpscaleGroups } = useMemo(
    () => groupJobsIntoSummaries(upscaleJobs, { includeSinglesAsGroups: true }),
    [upscaleJobs]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleHidden = () => {
      void mutateVideo();
      void mutateAudio();
      void mutateImage();
      void mutateStoryboard();
      void mutateCharacter();
      void mutateAngle();
      void mutateUpscale();
    };
    window.addEventListener('jobs:hidden', handleHidden);
    return () => window.removeEventListener('jobs:hidden', handleHidden);
  }, [mutateAngle, mutateAudio, mutateCharacter, mutateImage, mutateStoryboard, mutateUpscale, mutateVideo]);

  const groupedVideoJobs = useMemo(
    () => [...apiVideoGroups].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    [apiVideoGroups]
  );
  const groupedAudioJobs = useMemo(
    () => [...apiAudioGroups].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    [apiAudioGroups]
  );
  const groupedImageJobs = useMemo(
    () => [...apiImageGroups].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    [apiImageGroups]
  );
  const groupedStoryboardJobs = useMemo(
    () => [...apiStoryboardGroups].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    [apiStoryboardGroups]
  );
  const groupedCharacterJobs = useMemo(
    () => [...apiCharacterGroups].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    [apiCharacterGroups]
  );
  const groupedAngleJobs = useMemo(
    () => [...apiAngleGroups].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    [apiAngleGroups]
  );
  const groupedUpscaleJobs = useMemo(
    () => [...apiUpscaleGroups].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    [apiUpscaleGroups]
  );
  const groupedJobs = useMemo(
    () =>
      [
        ...groupedVideoJobs,
        ...groupedAudioJobs,
        ...groupedImageJobs,
        ...groupedStoryboardJobs,
        ...groupedCharacterJobs,
        ...groupedAngleJobs,
        ...groupedUpscaleJobs,
      ].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    [
      groupedAngleJobs,
      groupedAudioJobs,
      groupedCharacterJobs,
      groupedImageJobs,
      groupedStoryboardJobs,
      groupedUpscaleJobs,
      groupedVideoJobs,
    ]
  );

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

  const [collapsedSections, setCollapsedSections] = useState<Record<JobsSectionKey, boolean>>({
    video: true,
    audio: true,
    image: true,
    storyboard: true,
    character: true,
    angle: true,
    upscale: true,
  });
  const [savingImageGroupIds, setSavingImageGroupIds] = useState<Set<string>>(new Set());
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

  const toggleSection = useCallback((section: JobsSectionKey) => {
    setCollapsedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  }, []);

  const videoGroups = useMemo(() => normalizeGroupSummaries(groupedVideoJobs), [groupedVideoJobs]);
  const audioGroups = useMemo(() => normalizeGroupSummaries(groupedAudioJobs), [groupedAudioJobs]);
  const imageGroups = useMemo(() => normalizeGroupSummaries(groupedImageJobs), [groupedImageJobs]);
  const storyboardGroups = useMemo(() => normalizeGroupSummaries(groupedStoryboardJobs), [groupedStoryboardJobs]);
  const characterGroups = useMemo(() => normalizeGroupSummaries(groupedCharacterJobs), [groupedCharacterJobs]);
  const angleGroups = useMemo(() => normalizeGroupSummaries(groupedAngleJobs), [groupedAngleJobs]);
  const upscaleGroups = useMemo(() => normalizeGroupSummaries(groupedUpscaleJobs), [groupedUpscaleJobs]);
  const normalizedGroupMap = useMemo(() => {
    const map = new Map<string, GroupSummary>();
    videoGroups.forEach((group) => map.set(group.id, group));
    audioGroups.forEach((group) => map.set(group.id, group));
    imageGroups.forEach((group) => map.set(group.id, group));
    storyboardGroups.forEach((group) => map.set(group.id, group));
    characterGroups.forEach((group) => map.set(group.id, group));
    angleGroups.forEach((group) => map.set(group.id, group));
    upscaleGroups.forEach((group) => map.set(group.id, group));
    return map;
  }, [angleGroups, audioGroups, characterGroups, imageGroups, storyboardGroups, upscaleGroups, videoGroups]);
  const hasCuratedVideo = useMemo(
    () => videoGroups.some((group) => Boolean(group.hero.job?.curated)),
    [videoGroups]
  );

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
        const removeFromPages = (pages: typeof videoData) => {
          if (!pages) return pages;
          return pages.map((page) => ({
            ...page,
            jobs: page.jobs.filter((entry) => entry.jobId !== heroJob.jobId),
          }));
        };
        await Promise.all([
          mutateVideo((pages) => removeFromPages(pages), false),
          mutateAudio((pages) => removeFromPages(pages), false),
          mutateImage((pages) => removeFromPages(pages), false),
          mutateStoryboard((pages) => removeFromPages(pages), false),
          mutateCharacter((pages) => removeFromPages(pages), false),
          mutateAngle((pages) => removeFromPages(pages), false),
          mutateUpscale((pages) => removeFromPages(pages), false),
        ]);
      } catch (error) {
        console.error('Failed to hide job', error);
      }
    },
    [mutateAngle, mutateAudio, mutateCharacter, mutateImage, mutateStoryboard, mutateUpscale, mutateVideo, summaryMap]
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

  const sections: JobsPageSection[] = [
    {
      key: 'video',
      title: copy.sections.video,
      empty: copy.sections.videoEmpty,
      groups: videoGroups,
      hasMore: videoHasMore,
      isInitialLoading: videoIsLoading && videoJobs.length === 0 && videoGroups.length === 0,
      isValidating: videoIsValidating,
      error: videoError,
      forceImageGroup: false,
      onRetry: () => {
        void mutateVideo();
      },
      onLoadMore: () => setVideoSize((prev) => prev + 1),
    },
    {
      key: 'audio',
      title: copy.sections.audio,
      empty: copy.sections.audioEmpty,
      groups: audioGroups,
      hasMore: audioHasMore,
      isInitialLoading: audioIsLoading && audioJobs.length === 0 && audioGroups.length === 0,
      isValidating: audioIsValidating,
      error: audioError,
      forceImageGroup: false,
      onRetry: () => {
        void mutateAudio();
      },
      onLoadMore: () => setAudioSize((prev) => prev + 1),
    },
    {
      key: 'image',
      title: copy.sections.image,
      empty: copy.sections.imageEmpty,
      groups: imageGroups,
      hasMore: imageHasMore,
      isInitialLoading: imageIsLoading && imageJobs.length === 0 && imageGroups.length === 0,
      isValidating: imageIsValidating,
      error: imageError,
      forceImageGroup: true,
      onRetry: () => {
        void mutateImage();
      },
      onLoadMore: () => setImageSize((prev) => prev + 1),
    },
    {
      key: 'storyboard',
      title: copy.sections.storyboard,
      empty: copy.sections.storyboardEmpty,
      groups: storyboardGroups,
      hasMore: storyboardHasMore,
      isInitialLoading: storyboardIsLoading && storyboardJobs.length === 0 && storyboardGroups.length === 0,
      isValidating: storyboardIsValidating,
      error: storyboardError,
      forceImageGroup: true,
      onRetry: () => {
        void mutateStoryboard();
      },
      onLoadMore: () => setStoryboardSize((prev) => prev + 1),
    },
    {
      key: 'character',
      title: copy.sections.character,
      empty: copy.sections.characterEmpty,
      groups: characterGroups,
      hasMore: characterHasMore,
      isInitialLoading: characterIsLoading && characterJobs.length === 0 && characterGroups.length === 0,
      isValidating: characterIsValidating,
      error: characterError,
      forceImageGroup: true,
      onRetry: () => {
        void mutateCharacter();
      },
      onLoadMore: () => setCharacterSize((prev) => prev + 1),
    },
    {
      key: 'angle',
      title: copy.sections.angle,
      empty: copy.sections.angleEmpty,
      groups: angleGroups,
      hasMore: angleHasMore,
      isInitialLoading: angleIsLoading && angleJobs.length === 0 && angleGroups.length === 0,
      isValidating: angleIsValidating,
      error: angleError,
      forceImageGroup: true,
      onRetry: () => {
        void mutateAngle();
      },
      onLoadMore: () => setAngleSize((prev) => prev + 1),
    },
    {
      key: 'upscale',
      title: copy.sections.upscale,
      empty: copy.sections.upscaleEmpty,
      groups: upscaleGroups,
      hasMore: upscaleHasMore,
      isInitialLoading: upscaleIsLoading && upscaleJobs.length === 0 && upscaleGroups.length === 0,
      isValidating: upscaleIsValidating,
      error: upscaleError,
      forceImageGroup: false,
      onRetry: () => {
        void mutateUpscale();
      },
      onLoadMore: () => setUpscaleSize((prev) => prev + 1),
    },
  ];

  return {
    allowRemove,
    collapsedSections,
    copy,
    engineLookupById,
    hasCuratedVideo,
    onCloseViewer: () => setActiveGroupId(null),
    onGroupAction: handleGroupAction,
    onGroupOpen: handleGroupOpen,
    onRefreshJob: handleRefreshJob,
    onSaveGroupToLibrary: handleSaveGroupToLibrary,
    onSaveLightboxEntryToLibrary: handleSaveLightboxEntryToLibrary,
    onToggleSection: toggleSection,
    savingImageGroupIds,
    sections,
    viewerGroup,
  };
}
