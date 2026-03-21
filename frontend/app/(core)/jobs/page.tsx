'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { HeaderBar } from '@/components/HeaderBar';
import { AppSidebar } from '@/components/AppSidebar';
import { getJobStatus, hideJob, useEngines, useInfiniteJobs, saveImageToLibrary } from '@/lib/api';
import { groupJobsIntoSummaries } from '@/lib/job-groups';
import type { GroupSummary } from '@/types/groups';
import type { EngineCaps } from '@/types/engines';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { adaptGroupSummary } from '@/lib/video-group-adapter';
import { useResultProvider } from '@/hooks/useResultProvider';
import { GroupedJobCard, type GroupedJobAction } from '@/components/GroupedJobCard';
import { normalizeGroupSummaries, normalizeGroupSummary } from '@/lib/normalize-group-summary';
import dynamic from 'next/dynamic';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { FEATURES } from '@/content/feature-flags';
import { FlagPill } from '@/components/FlagPill';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { ObfuscatedEmailLink } from '@/components/marketing/ObfuscatedEmailLink';
import { isPlaceholderMediaUrl } from '@/lib/media';
import { resolveJobsRailPlaceholderThumb, resolveJobsRailThumb, resolveJobsRailVideo } from '@/lib/jobs-rail-thumb';
import { Button } from '@/components/ui/Button';
import type { Job } from '@/types/jobs';
import type { JobSurface } from '@/types/billing';
import { deriveJobSurface } from '@/lib/job-surface';

const DEFAULT_JOBS_COPY = {
  title: 'Jobs',
  sections: {
    video: 'Video jobs',
    audio: 'Audio jobs',
    image: 'Image jobs',
    character: 'Character jobs',
    angle: 'Angle jobs',
    videoEmpty: 'No video jobs yet.',
    audioEmpty: 'No audio jobs yet.',
    imageEmpty: 'No image jobs yet.',
    characterEmpty: 'No character jobs yet.',
    angleEmpty: 'No angle jobs yet.',
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
  error: 'Failed to load jobs.',
  retry: 'Retry',
  empty: 'No renders yet. Start a generation to populate your history.',
  loadMore: 'Load more',
  loading: 'Loading…',
  actions: {
    addToLibrary: 'Add to Library',
    saving: 'Saving…',
    recreate: 'Generate same settings',
  },
} as const;

type JobsCopy = typeof DEFAULT_JOBS_COPY;

function resolveClientJobSurface(job: Job): JobSurface {
  return deriveJobSurface({
    surface: job.surface,
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
  return `/app?job=${encodeURIComponent(jobId)}`;
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
  const { data: enginesData } = useEngines('all');
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
  const { loading: authLoading, user } = useRequireAuth({ redirectIfLoggedOut: false });
  const { data: preferences } = useUserPreferences(!authLoading && Boolean(user));
  const defaultAllowIndex = preferences?.defaultAllowIndex ?? true;

  const videoPages = videoData ?? [];
  const audioPages = audioData ?? [];
  const imagePages = imageData ?? [];
  const characterPages = characterData ?? [];
  const anglePages = angleData ?? [];
  const videoJobs = videoPages.flatMap((page) => page.jobs).filter((job) => resolveClientJobSurface(job) === 'video');
  const audioJobs = audioPages.flatMap((page) => page.jobs).filter((job) => resolveClientJobSurface(job) === 'audio');
  const imageJobs = imagePages.flatMap((page) => page.jobs).filter((job) => resolveClientJobSurface(job) === 'image');
  const characterJobs = characterPages.flatMap((page) => page.jobs).filter((job) => resolveClientJobSurface(job) === 'character');
  const angleJobs = anglePages.flatMap((page) => page.jobs).filter((job) => resolveClientJobSurface(job) === 'angle');
  const videoHasMore = videoPages.length > 0 && videoPages[videoPages.length - 1].nextCursor !== null;
  const audioHasMore = audioPages.length > 0 && audioPages[audioPages.length - 1].nextCursor !== null;
  const imageHasMore = imagePages.length > 0 && imagePages[imagePages.length - 1].nextCursor !== null;
  const characterHasMore = characterPages.length > 0 && characterPages[characterPages.length - 1].nextCursor !== null;
  const angleHasMore = anglePages.length > 0 && anglePages[anglePages.length - 1].nextCursor !== null;

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

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleHidden = () => {
      void mutateVideo();
      void mutateAudio();
      void mutateImage();
      void mutateCharacter();
      void mutateAngle();
    };
    window.addEventListener('jobs:hidden', handleHidden);
    return () => window.removeEventListener('jobs:hidden', handleHidden);
  }, [mutateAngle, mutateAudio, mutateCharacter, mutateImage, mutateVideo]);

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
  const groupedJobs = useMemo(
    () =>
      [...groupedVideoJobs, ...groupedAudioJobs, ...groupedImageJobs, ...groupedCharacterJobs, ...groupedAngleJobs].sort(
        (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
      ),
    [groupedAngleJobs, groupedAudioJobs, groupedCharacterJobs, groupedImageJobs, groupedVideoJobs]
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
  }>({
    video: true,
    audio: true,
    image: true,
    character: true,
    angle: true,
  });
  const [savingImageGroupIds, setSavingImageGroupIds] = useState<Set<string>>(new Set());

  const toggleSection = useCallback((section: 'video' | 'audio' | 'image' | 'character' | 'angle') => {
    setCollapsedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  }, []);

  const videoGroups = useMemo(() => normalizeGroupSummaries(groupedVideoJobs), [groupedVideoJobs]);
  const audioGroups = useMemo(() => normalizeGroupSummaries(groupedAudioJobs), [groupedAudioJobs]);
  const imageGroups = useMemo(() => normalizeGroupSummaries(groupedImageJobs), [groupedImageJobs]);
  const characterGroups = useMemo(() => normalizeGroupSummaries(groupedCharacterJobs), [groupedCharacterJobs]);
  const angleGroups = useMemo(() => normalizeGroupSummaries(groupedAngleJobs), [groupedAngleJobs]);
  const normalizedGroupMap = useMemo(() => {
    const map = new Map<string, GroupSummary>();
    videoGroups.forEach((group) => map.set(group.id, group));
    audioGroups.forEach((group) => map.set(group.id, group));
    imageGroups.forEach((group) => map.set(group.id, group));
    characterGroups.forEach((group) => map.set(group.id, group));
    angleGroups.forEach((group) => map.set(group.id, group));
    return map;
  }, [angleGroups, audioGroups, characterGroups, imageGroups, videoGroups]);
  const hasCuratedVideo = useMemo(
    () => videoGroups.some((group) => Boolean(group.hero.job?.curated)),
    [videoGroups]
  );
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const teamsLive = FEATURES.workflows.approvals && FEATURES.workflows.budgetControls;

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
        ]);
      } catch (error) {
        console.error('Failed to hide job', error);
      }
    },
    [mutateAngle, mutateAudio, mutateCharacter, mutateImage, mutateVideo, summaryMap]
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

  const handleSaveImageGroup = useCallback(
    async (group: GroupSummary) => {
      const job = group.hero.job;
      const renderIds =
        job?.renderIds?.filter((url): url is string => typeof url === 'string' && url.length > 0) ?? [];
      const previewThumb = group.previews.find((preview) => preview.thumbUrl)?.thumbUrl;
      const imageUrl = renderIds[0] ?? previewThumb ?? job?.thumbUrl ?? group.hero.thumbUrl ?? null;
      if (!imageUrl) {
        console.warn('No image available to save for group', group.id);
        return;
      }
      setSavingImageGroupIds((prev) => {
        const next = new Set(prev);
        next.add(group.id);
        return next;
      });
      try {
        await saveImageToLibrary({
          url: imageUrl,
          jobId: job?.jobId ?? group.id,
          label: job?.prompt ?? undefined,
        });
      } catch (error) {
        console.error('Failed to save image to library', error);
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

  const handleGroupAction = useCallback(
    (group: GroupSummary, action: GroupedJobAction) => {
      if (action === 'remove') {
        void handleRemoveGroup(group);
        return;
      }
      if (action === 'save-image') {
        void handleSaveImageGroup(group);
        return;
      }
      if (action === 'open' || action === 'continue' || action === 'refine' || action === 'branch' || action === 'compare') {
        setActiveGroupId(group.id);
      }
    },
    [handleRemoveGroup, handleSaveImageGroup]
  );

  const handleGroupOpen = useCallback((group: GroupSummary) => {
    setActiveGroupId(group.id);
  }, []);

  const videoInitialLoading = videoIsLoading && videoJobs.length === 0 && videoGroups.length === 0;
  const audioInitialLoading = audioIsLoading && audioJobs.length === 0 && audioGroups.length === 0;
  const imageInitialLoading = imageIsLoading && imageJobs.length === 0 && imageGroups.length === 0;
  const characterInitialLoading = characterIsLoading && characterJobs.length === 0 && characterGroups.length === 0;
  const angleInitialLoading = angleIsLoading && angleJobs.length === 0 && angleGroups.length === 0;
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
                recreateHref={recreateHref}
                recreateLabel={copy.actions.recreate}
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
        />
      );
    },
    [handleGroupOpen]
  );

  if (authLoading) {
    return null;
  }

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

          <section aria-labelledby="teams-beta" className="mb-4 rounded-card border border-hairline bg-surface p-4 shadow-card">
            <h2 id="teams-beta" className="flex items-center gap-2 text-base font-semibold text-text-primary">
              {copy.teams.title}
              <FlagPill live={teamsLive} />
              <span className="sr-only">{teamsLive ? copy.teams.srLive : copy.teams.srSoon}</span>
            </h2>
            {teamsLive ? (
              <p className="mt-2 text-sm text-text-secondary">{copy.teams.live}</p>
            ) : (
              <p className="mt-2 text-sm text-text-secondary">
                {copy.teams.beta.split('{email}')[0]}
                <ObfuscatedEmailLink
                  user="support"
                  domain="maxvideo.ai"
                  label={copy.teams.email}
                  placeholder="support [at] maxvideo.ai"
                  className="underline underline-offset-2"
                />
                {copy.teams.beta.split('{email}')[1] ?? ''}
              </p>
            )}
          </section>

          {hasCuratedVideo ? (
            <div className="mb-4 rounded-card border border-hairline bg-surface p-4 text-sm text-text-secondary">
              {copy.curated}
            </div>
          ) : null}

          {sections.map((section, index) => (
            <section key={section.key} className={index < sections.length - 1 ? 'mb-8' : undefined}>
              <div className="mb-3 flex items-center justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleSection(section.key)}
                  aria-label={collapsedSections[section.key] ? `Expand ${section.key} jobs` : `Collapse ${section.key} jobs`}
                  className="gap-2 text-lg font-semibold text-text-primary hover:bg-transparent"
                >
                  <span className="text-2xl leading-none text-text-primary">{collapsedSections[section.key] ? '▸' : '▾'}</span>
                  <span>{section.title}</span>
                </Button>
                <span className="text-xs text-text-secondary">{section.groups.length}</span>
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
          defaultAllowIndex={defaultAllowIndex}
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
}: {
  groups: GroupSummary[];
  onOpen: (group: GroupSummary) => void;
}) {
  const items = groups.slice(0, 12);
  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {items.map((group) => {
        const thumb = resolveJobsRailThumb(group);
        const fallbackThumb = resolveJobsRailPlaceholderThumb(group.hero.aspectRatio ?? group.previews[0]?.aspectRatio ?? null);
        const video = resolveJobsRailVideo(group);
        return (
          <button
            key={group.id}
            type="button"
            onClick={() => onOpen(group)}
            className="group relative block h-auto min-h-0 shrink-0 overflow-hidden rounded-card border border-border bg-surface p-0 shadow-card transition hover:border-border-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            style={{ width: COLLAPSED_RAIL_ITEM_WIDTH }}
            aria-label="Open render"
          >
            <div className="relative w-full overflow-hidden" style={{ aspectRatio: '16 / 9' }}>
              <RailThumb src={thumb} videoSrc={video} fallbackSrc={fallbackThumb} />
              {group.count > 1 ? (
                <div className="absolute bottom-2 right-2 rounded-full bg-surface-on-media-dark-55 px-2 py-0.5 text-xs font-semibold text-on-inverse">
                  ×{group.count}
                </div>
              ) : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}
const GroupViewerModal = dynamic(
  () => import('@/components/groups/GroupViewerModal').then((mod) => mod.GroupViewerModal),
  { ssr: false }
);
