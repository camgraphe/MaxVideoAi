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
import { GroupViewerModal } from '@/components/groups/GroupViewerModal';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { FEATURES } from '@/content/feature-flags';
import { FlagPill } from '@/components/FlagPill';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { getEngineAliases, listFalEngines } from '@/config/falEngines';
import { ObfuscatedEmailLink } from '@/components/marketing/ObfuscatedEmailLink';

const DEFAULT_JOBS_COPY = {
  title: 'Jobs',
  sections: {
    video: 'Video jobs',
    image: 'Image jobs',
    videoEmpty: 'No video jobs yet.',
    imageEmpty: 'No image jobs yet.',
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
  },
} as const;

type JobsCopy = typeof DEFAULT_JOBS_COPY;

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
  const { data: enginesData } = useEngines();
  const { data, error, isLoading, setSize, isValidating, mutate } = useInfiniteJobs(24);
  const { loading: authLoading, user } = useRequireAuth();
  const { data: preferences } = useUserPreferences(!authLoading && Boolean(user));
  const defaultAllowIndex = preferences?.defaultAllowIndex ?? true;

  const pages = data ?? [];
  const jobs = pages.flatMap((p) => p.jobs);
  const hasMore = pages.length === 0 ? false : pages[pages.length - 1].nextCursor !== null;

  const { groups: apiGroups } = useMemo(
    () => groupJobsIntoSummaries(jobs, { includeSinglesAsGroups: true }),
    [jobs]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleHidden = () => {
      void mutate();
    };
    window.addEventListener('jobs:hidden', handleHidden);
    return () => window.removeEventListener('jobs:hidden', handleHidden);
  }, [mutate]);

  const groupedJobs = useMemo(
    () => [...apiGroups].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    [apiGroups]
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
      if (status.status !== 'completed' && !status.videoUrl) {
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

  const [collapsedSections, setCollapsedSections] = useState<{ video: boolean; image: boolean }>({
    video: true,
    image: true,
  });
  const [savingImageGroupIds, setSavingImageGroupIds] = useState<Set<string>>(new Set());

  const toggleSection = useCallback((section: 'video' | 'image') => {
    setCollapsedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  }, []);

  const normalizedGroups = useMemo(() => normalizeGroupSummaries(groupedJobs), [groupedJobs]);
  const { videoGroups, imageGroups } = useMemo(() => {
    const videos: GroupSummary[] = [];
    const images: GroupSummary[] = [];
    normalizedGroups.forEach((group) => {
      const engineId = group.hero.engineId ?? group.hero.job?.engineId ?? '';
      if (engineId && IMAGE_ENGINE_IDS.has(engineId)) {
        images.push(group);
      } else {
        videos.push(group);
      }
    });
    return { videoGroups: videos, imageGroups: images };
  }, [normalizedGroups]);
  const normalizedGroupMap = useMemo(() => {
    const map = new Map<string, GroupSummary>();
    normalizedGroups.forEach((group) => map.set(group.id, group));
    return map;
  }, [normalizedGroups]);
  const hasCuratedVideo = useMemo(
    () => videoGroups.some((group) => Boolean(group.hero.job?.curated)),
    [videoGroups]
  );
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const teamsLive = FEATURES.workflows.approvals && FEATURES.workflows.budgetControls;

  const handleRemoveVideoGroup = useCallback(
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
        await mutate(
          (pages) => {
            if (!pages) return pages;
            return pages.map((page) => ({
              ...page,
              jobs: page.jobs.filter((entry) => entry.jobId !== heroJob.jobId),
            }));
          },
          false
        );
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
        void handleRemoveVideoGroup(group);
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
    [handleRemoveVideoGroup, handleSaveImageGroup]
  );

  const handleGroupOpen = useCallback((group: GroupSummary) => {
    setActiveGroupId(group.id);
  }, []);

  const isInitialLoading = isLoading && jobs.length === 0 && normalizedGroups.length === 0;
  const viewerGroup = useMemo(() => {
    if (!activeGroupId) return null;
    const normalized = normalizedGroupMap.get(activeGroupId);
    const fallback = summaryMap.get(activeGroupId);
    const target = normalized ?? (fallback ? normalizeGroupSummary(fallback) : null);
    if (!target) return null;
    return adaptGroupSummary(target, provider);
  }, [activeGroupId, normalizedGroupMap, summaryMap, provider]);

  const renderGroupGrid = useCallback(
    (groups: GroupSummary[], emptyCopy: string, prefix: string) => {
      if (!groups.length) {
        if (isInitialLoading) {
          return (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {renderSkeletonCards(4, `${prefix}-initial`)}
            </div>
          );
        }
        return (
          <div className="rounded-card border border-border bg-white p-6 text-center text-sm text-text-secondary">
            {emptyCopy}
          </div>
        );
      }
      return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {groups.map((group) => {
            const engineId = group.hero.engineId;
            const engine = engineId ? engineLookup.byId.get(engineId) ?? null : null;
            const isImageGroup = IMAGE_ENGINE_IDS.has(engineId ?? '');
            return (
              <GroupedJobCard
                key={group.id}
                group={group}
                engine={engine ?? undefined}
                onOpen={handleGroupOpen}
                onAction={handleGroupAction}
                allowRemove={allowRemove(group)}
                isImageGroup={isImageGroup || prefix === 'image'}
                savingToLibrary={savingImageGroupIds.has(group.id)}
                imageLibraryLabel={copy.actions.addToLibrary}
                imageLibrarySavingLabel={copy.actions.saving}
              />
            );
          })}
          {isValidating && hasMore && renderSkeletonCards(2, `${prefix}-more`)}
        </div>
      );
    },
    [
      allowRemove,
      copy.actions.addToLibrary,
      copy.actions.saving,
      engineLookup.byId,
      handleGroupAction,
      handleGroupOpen,
      hasMore,
      isInitialLoading,
      isValidating,
      savingImageGroupIds,
    ]
  );

  if (authLoading) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <HeaderBar />
      <div className="flex flex-1">
        <AppSidebar />
        <main className="flex-1 overflow-y-auto p-5 lg:p-7">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-xl font-semibold text-text-primary">{copy.title}</h1>
          </div>

          <section aria-labelledby="teams-beta" className="mb-4 rounded-card border border-hairline bg-white p-4 shadow-card">
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
            <div className="mb-4 rounded-card border border-hairline bg-white p-4 text-sm text-text-secondary">
              {copy.curated}
            </div>
          ) : null}

          {error ? (
            <div className="rounded-card border border-border bg-white p-4 text-state-warning">
              {copy.error}
              <button
                type="button"
                onClick={() => mutate()}
                className="ml-3 rounded-input border border-border px-2 py-1 text-sm hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {copy.retry}
              </button>
            </div>
          ) : (
            <>
              <section className="mb-8">
                <div className="mb-3 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => toggleSection('video')}
                    aria-label={collapsedSections.video ? 'Expand video jobs' : 'Collapse video jobs'}
                    className="flex items-center gap-2 text-lg font-semibold text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="text-2xl leading-none text-text-primary">
                      {collapsedSections.video ? '▸' : '▾'}
                    </span>
                    <span>{copy.sections.video}</span>
                  </button>
                  <span className="text-xs text-text-secondary">{videoGroups.length}</span>
                </div>
                {!collapsedSections.video && (
                  <>
                    {renderGroupGrid(videoGroups, copy.sections.videoEmpty, 'video')}
                    {videoGroups.length > 0 && hasMore && (
                      <div className="mt-4 flex justify-center">
                        <button
                          type="button"
                          onClick={() => setSize((prev) => prev + 1)}
                          disabled={isValidating}
                          className="rounded-input border border-border bg-white px-4 py-2 text-sm font-medium text-text-primary shadow-card hover:bg-white/80 disabled:opacity-60"
                        >
                          {isValidating ? copy.loading : copy.loadMore}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </section>

              <section>
                <div className="mb-3 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => toggleSection('image')}
                    aria-label={collapsedSections.image ? 'Expand image jobs' : 'Collapse image jobs'}
                    className="flex items-center gap-2 text-lg font-semibold text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="text-2xl leading-none text-text-primary">
                      {collapsedSections.image ? '▸' : '▾'}
                    </span>
                    <span>{copy.sections.image}</span>
                  </button>
                  <span className="text-xs text-text-secondary">{imageGroups.length}</span>
                </div>
                {!collapsedSections.image && (
                  <>
                    {renderGroupGrid(imageGroups, copy.sections.imageEmpty, 'image')}
                    {imageGroups.length > 0 && hasMore && (
                      <div className="mt-4 flex justify-center">
                        <button
                          type="button"
                          onClick={() => setSize((prev) => prev + 1)}
                          disabled={isValidating}
                          className="rounded-input border border-border bg-white px-4 py-2 text-sm font-medium text-text-primary shadow-card hover:bg-white/80 disabled:opacity-60"
                        >
                          {isValidating ? copy.loading : copy.loadMore}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </section>
            </>
          )}
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
    <div key={`${prefix}-skeleton-${index}`} className="rounded-card border border-border bg-white/60 p-0" aria-hidden>
      <div className="relative overflow-hidden rounded-card">
        <div className="relative" style={{ aspectRatio: '16 / 9' }}>
          <div className="skeleton absolute inset-0" />
        </div>
      </div>
      <div className="border-t border-border bg-white/70 px-3 py-2">
        <div className="h-3 w-24 rounded-full bg-neutral-200" />
      </div>
    </div>
  ));
}
const IMAGE_ENGINE_IDS = new Set(
  listFalEngines()
    .filter((engine) => (engine.category ?? 'video') === 'image')
    .flatMap((engine) => getEngineAliases(engine))
);
