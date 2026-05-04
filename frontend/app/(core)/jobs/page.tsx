'use client';

import { ChevronDown, Plus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { HeaderBar } from '@/components/HeaderBar';
import { AppSidebar } from '@/components/AppSidebar';
import { getJobStatus, hideJob, useEngines, useInfiniteJobs, saveAssetToLibrary } from '@/lib/api';
import { groupJobsIntoSummaries } from '@/lib/job-groups';
import type { GroupSummary } from '@/types/groups';
import type { EngineCaps } from '@/types/engines';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { adaptGroupSummary } from '@/lib/video-group-adapter';
import { useResultProvider } from '@/hooks/useResultProvider';
import { GroupedJobCard, type GroupedJobAction } from '@/components/GroupedJobCard';
import type { MediaLightboxEntry } from '@/components/MediaLightbox';
import { normalizeGroupSummaries, normalizeGroupSummary } from '@/lib/normalize-group-summary';
import dynamic from 'next/dynamic';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { isPlaceholderMediaUrl } from '@/lib/media';
import { AudioWaveformThumb } from '@/components/ui/AudioWaveformThumb';
import {
  resolveJobsRailAudio,
  resolveJobsRailPlaceholderThumb,
  resolveJobsRailThumb,
  resolveJobsRailVideo,
} from '@/lib/jobs-rail-thumb';
import { Button } from '@/components/ui/Button';
import type { Job } from '@/types/jobs';
import type { JobSurface } from '@/types/billing';
import { deriveJobSurface } from '@/lib/job-surface';

const DEFAULT_JOBS_COPY = {
  title: 'History',
  sections: {
    video: 'Video history',
    audio: 'Audio history',
    image: 'Image history',
    character: 'Character history',
    angle: 'Angle history',
    upscale: 'Upscale history',
    videoEmpty: 'No video renders yet.',
    audioEmpty: 'No audio renders yet.',
    imageEmpty: 'No image renders yet.',
    characterEmpty: 'No character renders yet.',
    angleEmpty: 'No angle renders yet.',
    upscaleEmpty: 'No upscale renders yet.',
  },
  teams: {
    title: 'Teams',
    srLive: 'Live',
    srSoon: 'Coming soon',
    live: 'Shared wallets, approvals, and budgets are enabled in your workspace.',
    beta: 'Coming soon — shared wallets, approvals, and budgets. Join the beta at {email}.',
    email: 'support@maxvideoai.com',
  },
  curated: 'Starter renders curated by the MaxVideo team appear here until you generate your own clips.',
  error: 'Failed to load history.',
  retry: 'Retry',
  empty: 'No renders yet. Start a generation to populate your history.',
  loadMore: 'Load more',
  loading: 'Loading…',
  actions: {
    addToLibrary: 'Add to Library',
    saving: 'Saving…',
    recreate: 'Generate same settings',
    openDetails: 'View details',
    actions: 'Actions',
    expandSection: 'Show',
    collapseSection: 'Hide',
  },
} as const;

type JobsCopy = typeof DEFAULT_JOBS_COPY;
type LibrarySaveKind = 'image' | 'video' | 'audio';
type LibrarySavePayload = {
  url: string;
  kind: LibrarySaveKind;
  jobId?: string | null;
  label?: string | null;
  thumbUrl?: string | null;
  previewUrl?: string | null;
};

function resolveClientJobSurface(job: Job): JobSurface {
  return deriveJobSurface({
    surface: job.surface,
    settingsSnapshot: job.settingsSnapshot,
    jobId: job.jobId,
    engineId: job.engineId ?? null,
    videoUrl: job.videoUrl ?? null,
    renderIds: job.renderIds,
  });
}

function resolveWorkspaceJobHref(jobId: string, surface: JobSurface, forceImageGroup = false): string {
  if (surface === 'audio') {
    return `/app/audio?job=${encodeURIComponent(jobId)}`;
  }
  if (forceImageGroup || surface === 'image') {
    return `/app/image?job=${encodeURIComponent(jobId)}`;
  }
  if (surface === 'upscale') {
    return `/app/tools/upscale?job=${encodeURIComponent(jobId)}`;
  }
  return `/app?job=${encodeURIComponent(jobId)}`;
}

function firstHttpUrl(values: Array<string | null | undefined>): string | null {
  return values.find((value): value is string => typeof value === 'string' && /^https?:\/\//i.test(value)) ?? null;
}

function resolveGroupLibrarySavePayload(group: GroupSummary): LibrarySavePayload | null {
  const job = group.hero.job;
  const members = group.members;
  const firstPreview = group.previews[0];
  const jobRenderUrl = firstHttpUrl(job?.renderIds ?? []);
  const videoUrl = firstHttpUrl([group.hero.videoUrl, firstPreview?.videoUrl, ...members.map((member) => member.videoUrl)]);
  const audioUrl = firstHttpUrl([group.hero.audioUrl, ...members.map((member) => member.audioUrl)]);
  const thumbUrl = firstHttpUrl([group.hero.thumbUrl, firstPreview?.thumbUrl, job?.thumbUrl]);
  const previewUrl = firstHttpUrl([group.hero.previewVideoUrl, firstPreview?.previewVideoUrl, job?.previewVideoUrl]);
  const imageUrl = firstHttpUrl([jobRenderUrl, ...members.map((member) => member.thumbUrl), thumbUrl]);
  const jobId = job?.jobId ?? group.hero.jobId ?? group.id;
  const label = job?.prompt ?? group.hero.prompt ?? undefined;

  if (videoUrl) {
    return { url: videoUrl, kind: 'video', jobId, label, thumbUrl, previewUrl };
  }
  if (audioUrl) {
    return { url: audioUrl, kind: 'audio', jobId, label, thumbUrl, previewUrl: null };
  }
  if (imageUrl) {
    return { url: imageUrl, kind: 'image', jobId, label, thumbUrl, previewUrl: null };
  }
  return null;
}

function resolveEntryLibrarySavePayload(entry: MediaLightboxEntry): LibrarySavePayload | null {
  const videoUrl = firstHttpUrl([entry.videoUrl]);
  const audioUrl = firstHttpUrl([entry.audioUrl]);
  const imageUrl = firstHttpUrl([entry.imageUrl, entry.thumbUrl]);
  const label = entry.prompt ?? entry.label ?? undefined;

  if (videoUrl) {
    return {
      url: videoUrl,
      kind: 'video',
      jobId: entry.jobId,
      label,
      thumbUrl: entry.thumbUrl ?? null,
      previewUrl: entry.previewUrl ?? null,
    };
  }
  if (audioUrl) {
    return {
      url: audioUrl,
      kind: 'audio',
      jobId: entry.jobId,
      label,
      thumbUrl: entry.thumbUrl ?? null,
      previewUrl: null,
    };
  }
  if (imageUrl) {
    return {
      url: imageUrl,
      kind: 'image',
      jobId: entry.jobId,
      label,
      thumbUrl: entry.thumbUrl ?? imageUrl,
      previewUrl: null,
    };
  }
  return null;
}

export default function JobsPage() {
  const { t } = useI18n();
  const rawCopy = t('workspace.jobs', DEFAULT_JOBS_COPY);
  const copy: JobsCopy = useMemo(() => {
    if (!rawCopy || typeof rawCopy !== 'object') return DEFAULT_JOBS_COPY;
    return {
      ...DEFAULT_JOBS_COPY,
      ...rawCopy,
      sections: {
        ...DEFAULT_JOBS_COPY.sections,
        ...(rawCopy.sections ?? {}),
      },
      teams: {
        ...DEFAULT_JOBS_COPY.teams,
        ...(rawCopy.teams ?? {}),
      },
      actions: {
        ...DEFAULT_JOBS_COPY.actions,
        ...(rawCopy.actions ?? {}),
      },
    };
  }, [rawCopy]);
  const { data: enginesData } = useEngines('all', { includeAverages: false });
  const {
    data: videoData,
    error: videoError,
    isLoading: videoIsLoading,
    setSize: setVideoSize,
    isValidating: videoIsValidating,
    mutate: mutateVideo,
  } = useInfiniteJobs(24, { surface: 'video' });
  const {
    data: imageData,
    error: imageError,
    isLoading: imageIsLoading,
    setSize: setImageSize,
    isValidating: imageIsValidating,
    mutate: mutateImage,
  } = useInfiniteJobs(24, { surface: 'image' });
  const {
    data: audioData,
    error: audioError,
    isLoading: audioIsLoading,
    setSize: setAudioSize,
    isValidating: audioIsValidating,
    mutate: mutateAudio,
  } = useInfiniteJobs(24, { surface: 'audio' });
  const {
    data: characterData,
    error: characterError,
    isLoading: characterIsLoading,
    setSize: setCharacterSize,
    isValidating: characterIsValidating,
    mutate: mutateCharacter,
  } = useInfiniteJobs(24, { surface: 'character' });
  const {
    data: angleData,
    error: angleError,
    isLoading: angleIsLoading,
    setSize: setAngleSize,
    isValidating: angleIsValidating,
    mutate: mutateAngle,
  } = useInfiniteJobs(24, { surface: 'angle' });
  const {
    data: upscaleData,
    error: upscaleError,
    isLoading: upscaleIsLoading,
    setSize: setUpscaleSize,
    isValidating: upscaleIsValidating,
    mutate: mutateUpscale,
  } = useInfiniteJobs(24, { surface: 'upscale' });
  useRequireAuth({ redirectIfLoggedOut: false });

  const videoPages = videoData ?? [];
  const audioPages = audioData ?? [];
  const imagePages = imageData ?? [];
  const characterPages = characterData ?? [];
  const anglePages = angleData ?? [];
  const upscalePages = upscaleData ?? [];
  const videoJobs = videoPages.flatMap((page) => page.jobs).filter((job) => resolveClientJobSurface(job) === 'video');
  const audioJobs = audioPages.flatMap((page) => page.jobs).filter((job) => resolveClientJobSurface(job) === 'audio');
  const imageJobs = imagePages.flatMap((page) => page.jobs).filter((job) => resolveClientJobSurface(job) === 'image');
  const characterJobs = characterPages.flatMap((page) => page.jobs).filter((job) => resolveClientJobSurface(job) === 'character');
  const angleJobs = anglePages.flatMap((page) => page.jobs).filter((job) => resolveClientJobSurface(job) === 'angle');
  const upscaleJobs = upscalePages.flatMap((page) => page.jobs).filter((job) => resolveClientJobSurface(job) === 'upscale');
  const videoHasMore = videoPages.length > 0 && videoPages[videoPages.length - 1].nextCursor !== null;
  const audioHasMore = audioPages.length > 0 && audioPages[audioPages.length - 1].nextCursor !== null;
  const imageHasMore = imagePages.length > 0 && imagePages[imagePages.length - 1].nextCursor !== null;
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
      void mutateCharacter();
      void mutateAngle();
      void mutateUpscale();
    };
    window.addEventListener('jobs:hidden', handleHidden);
    return () => window.removeEventListener('jobs:hidden', handleHidden);
  }, [mutateAngle, mutateAudio, mutateCharacter, mutateImage, mutateUpscale, mutateVideo]);

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
      [...groupedVideoJobs, ...groupedAudioJobs, ...groupedImageJobs, ...groupedCharacterJobs, ...groupedAngleJobs, ...groupedUpscaleJobs].sort(
        (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
      ),
    [groupedAngleJobs, groupedAudioJobs, groupedCharacterJobs, groupedImageJobs, groupedUpscaleJobs, groupedVideoJobs]
  );

  const engineLookup = useMemo(() => {
    const byId = new Map<string, EngineCaps>();
    (enginesData?.engines ?? []).forEach((engine) => {
      byId.set(engine.id, engine);
    });
    return { byId };
  }, [enginesData?.engines]);

  const provider = useResultProvider();

  const handleRefreshJob = useCallback(async (jobId: string) => {
    try {
      const status = await getJobStatus(jobId);
      if (status.status === 'failed') {
        throw new Error(status.message ?? 'Provider reported this render as failed.');
      }
      if (status.status !== 'completed' && !status.videoUrl && !status.audioUrl) {
        throw new Error('The provider is still processing this render.');
      }
    } catch (error) {
      throw error instanceof Error ? error : new Error('Unable to refresh render status.');
    }
  }, []);

  const summaryMap = useMemo(() => {
    const map = new Map<string, GroupSummary>();
    groupedJobs.forEach((group) => map.set(group.id, group));
    return map;
  }, [groupedJobs]);

  const [collapsedSections, setCollapsedSections] = useState<{
    video: boolean;
    audio: boolean;
    image: boolean;
    character: boolean;
    angle: boolean;
    upscale: boolean;
  }>({
    video: true,
    audio: true,
    image: true,
    character: true,
    angle: true,
    upscale: true,
  });
  const [savingImageGroupIds, setSavingImageGroupIds] = useState<Set<string>>(new Set());

  const toggleSection = useCallback((section: 'video' | 'audio' | 'image' | 'character' | 'angle' | 'upscale') => {
    setCollapsedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  }, []);

  const videoGroups = useMemo(() => normalizeGroupSummaries(groupedVideoJobs), [groupedVideoJobs]);
  const audioGroups = useMemo(() => normalizeGroupSummaries(groupedAudioJobs), [groupedAudioJobs]);
  const imageGroups = useMemo(() => normalizeGroupSummaries(groupedImageJobs), [groupedImageJobs]);
  const characterGroups = useMemo(() => normalizeGroupSummaries(groupedCharacterJobs), [groupedCharacterJobs]);
  const angleGroups = useMemo(() => normalizeGroupSummaries(groupedAngleJobs), [groupedAngleJobs]);
  const upscaleGroups = useMemo(() => normalizeGroupSummaries(groupedUpscaleJobs), [groupedUpscaleJobs]);
  const normalizedGroupMap = useMemo(() => {
    const map = new Map<string, GroupSummary>();
    videoGroups.forEach((group) => map.set(group.id, group));
    audioGroups.forEach((group) => map.set(group.id, group));
    imageGroups.forEach((group) => map.set(group.id, group));
    characterGroups.forEach((group) => map.set(group.id, group));
    angleGroups.forEach((group) => map.set(group.id, group));
    upscaleGroups.forEach((group) => map.set(group.id, group));
    return map;
  }, [angleGroups, audioGroups, characterGroups, imageGroups, upscaleGroups, videoGroups]);
  const hasCuratedVideo = useMemo(
    () => videoGroups.some((group) => Boolean(group.hero.job?.curated)),
    [videoGroups]
  );
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const handleRemoveGroup = useCallback(
    async (group: GroupSummary) => {
      const original = summaryMap.get(group.id);
      if (!original) return;
      const heroJob = original.hero.job;
      if (!heroJob) return;
      if (heroJob.curated) {
        return;
      }
      try {
        await hideJob(heroJob.jobId);
        setActiveGroupId((current) => (current === group.id ? null : current));
        const removeFromPages = (pages: typeof videoData | typeof imageData) => {
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
          mutateCharacter((pages) => removeFromPages(pages), false),
          mutateAngle((pages) => removeFromPages(pages), false),
          mutateUpscale((pages) => removeFromPages(pages), false),
        ]);
      } catch (error) {
        console.error('Failed to hide job', error);
      }
    },
    [mutateAngle, mutateAudio, mutateCharacter, mutateImage, mutateUpscale, mutateVideo, summaryMap]
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

  const handleSaveGroupToLibrary = useCallback(
    async (group: GroupSummary) => {
      const payload = resolveGroupLibrarySavePayload(group);
      if (!payload) {
        console.warn('No media available to save for group', group.id);
        return;
      }
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
          source: 'generated',
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
    },
    []
  );

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

  const videoInitialLoading = videoIsLoading && videoJobs.length === 0 && videoGroups.length === 0;
  const audioInitialLoading = audioIsLoading && audioJobs.length === 0 && audioGroups.length === 0;
  const imageInitialLoading = imageIsLoading && imageJobs.length === 0 && imageGroups.length === 0;
  const characterInitialLoading = characterIsLoading && characterJobs.length === 0 && characterGroups.length === 0;
  const angleInitialLoading = angleIsLoading && angleJobs.length === 0 && angleGroups.length === 0;
  const upscaleInitialLoading = upscaleIsLoading && upscaleJobs.length === 0 && upscaleGroups.length === 0;
  const viewerGroup = useMemo(() => {
    if (!activeGroupId) return null;
    const normalized = normalizedGroupMap.get(activeGroupId);
    const fallback = summaryMap.get(activeGroupId);
    const target = normalized ?? (fallback ? normalizeGroupSummary(fallback) : null);
    if (!target) return null;
    return adaptGroupSummary(target, provider);
  }, [activeGroupId, normalizedGroupMap, summaryMap, provider]);

  const renderGroupGrid = useCallback(
    (
      groups: GroupSummary[],
      emptyCopy: string,
      prefix: string,
      options: {
        forceImageGroup: boolean;
        hasMore: boolean;
        isInitialLoading: boolean;
        isValidating: boolean;
        error?: Error;
        onRetry: () => void;
      }
    ) => {
      if (options.error) {
        return (
          <div className="rounded-card border border-border bg-surface p-4 text-state-warning">
            {copy.error}
            <Button type="button" variant="outline" size="sm" onClick={options.onRetry} className="ml-3 px-2 text-sm">
              {copy.retry}
            </Button>
          </div>
        );
      }
      if (!groups.length) {
        if (options.isInitialLoading) {
          return (
            <div className="grid grid-gap-sm sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {renderSkeletonCards(4, `${prefix}-initial`)}
            </div>
          );
        }
        return (
          <div className="rounded-card border border-border bg-surface p-6 text-center text-sm text-text-secondary">
            {emptyCopy}
          </div>
        );
      }
      return (
        <div className="grid grid-gap-sm sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {groups.map((group) => {
            const engineId = group.hero.engineId;
            const engine = engineId ? engineLookup.byId.get(engineId) ?? null : null;
            const heroJobId = group.hero.jobId ?? group.hero.job?.jobId ?? null;
            const heroSurface = group.hero.job ? resolveClientJobSurface(group.hero.job) : options.forceImageGroup ? 'image' : 'video';
            const recreateHref =
              heroJobId
                ? resolveWorkspaceJobHref(heroJobId, heroSurface, options.forceImageGroup)
                : undefined;
            return (
              <GroupedJobCard
                key={group.id}
                group={group}
                engine={engine ?? undefined}
                onOpen={handleGroupOpen}
                onAction={handleGroupAction}
                allowRemove={allowRemove(group)}
                isImageGroup={options.forceImageGroup}
                savingToLibrary={savingImageGroupIds.has(group.id)}
                imageLibraryLabel={copy.actions.addToLibrary}
                imageLibrarySavingLabel={copy.actions.saving}
                showLibraryCta
                recreateHref={recreateHref}
                recreateLabel={copy.actions.recreate}
                openLabel={copy.actions.openDetails}
                actionMenuLabel={copy.actions.actions}
                menuVariant="compact"
              />
            );
          })}
          {options.isValidating && options.hasMore && renderSkeletonCards(2, `${prefix}-more`)}
        </div>
      );
    },
    [
      allowRemove,
      copy.actions.addToLibrary,
      copy.actions.actions,
      copy.actions.openDetails,
      copy.actions.recreate,
      copy.actions.saving,
      engineLookup.byId,
      handleGroupAction,
      handleGroupOpen,
      savingImageGroupIds,
      copy.error,
      copy.retry,
    ]
  );

  const renderCollapsedRail = useCallback(
    (groups: GroupSummary[], emptyCopy: string, isInitialLoading: boolean) => {
      if (!groups.length) {
        if (isInitialLoading) {
          return <CollapsedGroupRailSkeleton />;
        }
        return (
          <div className="rounded-card border border-border bg-surface p-4 text-center text-sm text-text-secondary">
            {emptyCopy}
          </div>
        );
      }

      return (
        <CollapsedGroupRail
          groups={groups}
          onOpen={handleGroupOpen}
          onSaveToLibrary={handleSaveGroupToLibrary}
          savingIds={savingImageGroupIds}
          addLabel={copy.actions.addToLibrary}
          savingLabel={copy.actions.saving}
        />
      );
    },
    [copy.actions.addToLibrary, copy.actions.saving, handleGroupOpen, handleSaveGroupToLibrary, savingImageGroupIds]
  );

  const sections = [
    {
      key: 'video' as const,
      title: copy.sections.video,
      empty: copy.sections.videoEmpty,
      groups: videoGroups,
      hasMore: videoHasMore,
      isInitialLoading: videoInitialLoading,
      isValidating: videoIsValidating,
      error: videoError,
      forceImageGroup: false,
      onRetry: () => {
        void mutateVideo();
      },
      onLoadMore: () => setVideoSize((prev) => prev + 1),
    },
    {
      key: 'audio' as const,
      title: copy.sections.audio,
      empty: copy.sections.audioEmpty,
      groups: audioGroups,
      hasMore: audioHasMore,
      isInitialLoading: audioInitialLoading,
      isValidating: audioIsValidating,
      error: audioError,
      forceImageGroup: false,
      onRetry: () => {
        void mutateAudio();
      },
      onLoadMore: () => setAudioSize((prev) => prev + 1),
    },
    {
      key: 'image' as const,
      title: copy.sections.image,
      empty: copy.sections.imageEmpty,
      groups: imageGroups,
      hasMore: imageHasMore,
      isInitialLoading: imageInitialLoading,
      isValidating: imageIsValidating,
      error: imageError,
      forceImageGroup: true,
      onRetry: () => {
        void mutateImage();
      },
      onLoadMore: () => setImageSize((prev) => prev + 1),
    },
    {
      key: 'character' as const,
      title: copy.sections.character,
      empty: copy.sections.characterEmpty,
      groups: characterGroups,
      hasMore: characterHasMore,
      isInitialLoading: characterInitialLoading,
      isValidating: characterIsValidating,
      error: characterError,
      forceImageGroup: true,
      onRetry: () => {
        void mutateCharacter();
      },
      onLoadMore: () => setCharacterSize((prev) => prev + 1),
    },
    {
      key: 'angle' as const,
      title: copy.sections.angle,
      empty: copy.sections.angleEmpty,
      groups: angleGroups,
      hasMore: angleHasMore,
      isInitialLoading: angleInitialLoading,
      isValidating: angleIsValidating,
      error: angleError,
      forceImageGroup: true,
      onRetry: () => {
        void mutateAngle();
      },
      onLoadMore: () => setAngleSize((prev) => prev + 1),
    },
    {
      key: 'upscale' as const,
      title: copy.sections.upscale,
      empty: copy.sections.upscaleEmpty,
      groups: upscaleGroups,
      hasMore: upscaleHasMore,
      isInitialLoading: upscaleInitialLoading,
      isValidating: upscaleIsValidating,
      error: upscaleError,
      forceImageGroup: false,
      onRetry: () => {
        void mutateUpscale();
      },
      onLoadMore: () => setUpscaleSize((prev) => prev + 1),
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <HeaderBar />
      <div className="flex flex-1 min-w-0">
        <AppSidebar />
        <main className="flex-1 min-w-0 overflow-y-auto p-5 lg:p-7">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-xl font-semibold text-text-primary">{copy.title}</h1>
          </div>

          {hasCuratedVideo ? (
            <div className="mb-4 rounded-card border border-hairline bg-surface p-4 text-sm text-text-secondary">
              {copy.curated}
            </div>
          ) : null}

          {sections.map((section, index) => (
            <section key={section.key} className={index < sections.length - 1 ? 'mb-8' : undefined}>
              <div className="mb-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleSection(section.key)}
                  aria-label={`${collapsedSections[section.key] ? copy.actions.expandSection : copy.actions.collapseSection} ${section.title}`}
                  className="w-full justify-between gap-3 rounded-card border border-border bg-surface px-3 py-2 text-sm font-semibold text-text-primary shadow-card hover:bg-surface-glass-80"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-text-secondary transition-transform ${collapsedSections[section.key] ? '-rotate-90' : 'rotate-0'}`}
                      aria-hidden="true"
                    />
                    <span className="truncate text-left">{section.title}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-text-secondary">
                    <span className="rounded-pill border border-hairline bg-bg px-2 py-0.5">{section.groups.length}</span>
                    <span className="hidden font-semibold sm:inline">
                      {collapsedSections[section.key] ? copy.actions.expandSection : copy.actions.collapseSection}
                    </span>
                  </span>
                </Button>
              </div>
              {section.error ? (
                renderGroupGrid(section.groups, section.empty, section.key, {
                  forceImageGroup: section.forceImageGroup,
                  hasMore: section.hasMore,
                  isInitialLoading: section.isInitialLoading,
                  isValidating: section.isValidating,
                  error: section.error,
                  onRetry: section.onRetry,
                })
              ) : collapsedSections[section.key] ? (
                renderCollapsedRail(section.groups, section.empty, section.isInitialLoading)
              ) : (
                <>
                  {renderGroupGrid(section.groups, section.empty, section.key, {
                    forceImageGroup: section.forceImageGroup,
                    hasMore: section.hasMore,
                    isInitialLoading: section.isInitialLoading,
                    isValidating: section.isValidating,
                    onRetry: section.onRetry,
                  })}
                  {section.groups.length > 0 && section.hasMore ? (
                    <div className="mt-4 flex justify-center">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={section.onLoadMore}
                        disabled={section.isValidating}
                        className="border-border bg-surface px-4 text-sm font-medium text-text-primary shadow-card hover:bg-surface-glass-80"
                      >
                        {section.isValidating ? copy.loading : copy.loadMore}
                      </Button>
                    </div>
                  ) : null}
                </>
              )}
            </section>
          ))}
        </main>
      </div>
      {viewerGroup ? (
        <GroupViewerModal
          group={viewerGroup}
          onClose={() => setActiveGroupId(null)}
          onRefreshJob={handleRefreshJob}
          onSaveToLibrary={handleSaveLightboxEntryToLibrary}
        />
      ) : null}
    </div>
  );
}

function renderSkeletonCards(count: number, prefix: string) {
  return Array.from({ length: count }).map((_, index) => (
    <div key={`${prefix}-skeleton-${index}`} className="rounded-card border border-border bg-surface-glass-60 p-0" aria-hidden>
      <div className="relative overflow-hidden rounded-card">
        <div className="relative" style={{ aspectRatio: '16 / 9' }}>
          <div className="skeleton absolute inset-0" />
        </div>
      </div>
      <div className="border-t border-border bg-surface-glass-70 px-3 py-2">
        <div className="h-3 w-24 rounded-full bg-skeleton" />
      </div>
    </div>
  ));
}
const COLLAPSED_RAIL_ITEM_WIDTH = 220;

function RailThumb({ src, videoSrc, fallbackSrc }: { src: string; videoSrc?: string | null; fallbackSrc: string }) {
  const [resolvedSrc, setResolvedSrc] = useState(src);
  const [imageFailed, setImageFailed] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);

  useEffect(() => {
    setResolvedSrc(src);
    setImageFailed(false);
    setVideoFailed(false);
  }, [src, videoSrc]);

  const showVideo = Boolean(videoSrc && (isPlaceholderMediaUrl(resolvedSrc) || imageFailed) && !videoFailed);

  if (showVideo) {
    return (
      <video
        src={videoSrc ?? undefined}
        poster={fallbackSrc}
        className="absolute inset-0 h-full w-full object-cover"
        muted
        playsInline
        loop
        autoPlay
        preload="metadata"
        onError={() => {
          setVideoFailed(true);
          setResolvedSrc(fallbackSrc);
        }}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolvedSrc}
      alt=""
      className="absolute inset-0 h-full w-full object-cover"
      loading="lazy"
      onError={() => {
        setImageFailed(true);
        if (!videoSrc && resolvedSrc !== fallbackSrc) {
          setResolvedSrc(fallbackSrc);
        }
      }}
    />
  );
}

function CollapsedGroupRailSkeleton() {
  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          key={`jobs-rail-skeleton-${index}`}
          className="relative shrink-0 overflow-hidden rounded-card border border-border bg-surface-glass-60"
          style={{ width: COLLAPSED_RAIL_ITEM_WIDTH }}
          aria-hidden
        >
          <div className="relative" style={{ aspectRatio: '16 / 9' }}>
            <div className="skeleton absolute inset-0" />
          </div>
        </div>
      ))}
    </div>
  );
}

function CollapsedGroupRail({
  groups,
  onOpen,
  onSaveToLibrary,
  savingIds,
  addLabel,
  savingLabel,
}: {
  groups: GroupSummary[];
  onOpen: (group: GroupSummary) => void;
  onSaveToLibrary: (group: GroupSummary) => void;
  savingIds: Set<string>;
  addLabel: string;
  savingLabel: string;
}) {
  const items = groups.slice(0, 12);
  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {items.map((group) => {
        const thumb = resolveJobsRailThumb(group);
        const fallbackThumb = resolveJobsRailPlaceholderThumb(group.hero.aspectRatio ?? group.previews[0]?.aspectRatio ?? null);
        const video = resolveJobsRailVideo(group);
        const audio = resolveJobsRailAudio(group);
        const isSaving = savingIds.has(group.id);
        return (
          <div
            key={group.id}
            className="group relative block h-auto min-h-0 shrink-0 overflow-hidden rounded-card border border-border bg-surface p-0 shadow-card transition hover:border-border-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            style={{ width: COLLAPSED_RAIL_ITEM_WIDTH }}
          >
            <button
              type="button"
              onClick={() => onOpen(group)}
              className="block w-full"
              aria-label="Open render"
            >
              <div className="relative w-full overflow-hidden" style={{ aspectRatio: '16 / 9' }}>
                {video ? (
                  <RailThumb src={thumb} videoSrc={video} fallbackSrc={fallbackThumb} />
                ) : audio ? (
                  <AudioWaveformThumb
                    seed={audio}
                    thumbSrc={thumb !== fallbackThumb ? thumb : null}
                    label={null}
                    active={false}
                  />
                ) : (
                  <RailThumb src={thumb} videoSrc={video} fallbackSrc={fallbackThumb} />
                )}
                {group.count > 1 ? (
                  <div className="absolute bottom-2 right-2 rounded-full bg-surface-on-media-dark-55 px-2 py-0.5 text-xs font-semibold text-on-inverse">
                    ×{group.count}
                  </div>
                ) : null}
              </div>
            </button>
            <button
              type="button"
              onClick={() => onSaveToLibrary(group)}
              disabled={isSaving}
              title={isSaving ? savingLabel : addLabel}
              aria-label={isSaving ? savingLabel : addLabel}
              className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full border border-white/70 bg-white/90 text-black/80 shadow-md backdrop-blur transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-70"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
const GroupViewerModal = dynamic(
  () => import('@/components/groups/GroupViewerModal').then((mod) => mod.GroupViewerModal),
  { ssr: false }
);
