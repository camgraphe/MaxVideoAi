'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getJobStatus, useEngines, useInfiniteJobs } from '@/lib/api';
import { groupJobsIntoSummaries } from '@/lib/job-groups';
import { normalizeGroupSummaries } from '@/lib/normalize-group-summary';
import type { MediaLightboxEntry } from '@/components/MediaLightbox';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useI18n } from '@/lib/i18n/I18nProvider';
import type { GroupSummary } from '@/types/groups';
import { DEFAULT_DASHBOARD_COPY, type DashboardCopy } from './_lib/dashboard-copy';
import { formatCurrencyLocal, formatRunway } from './_lib/dashboard-formatters';
import {
  getJobCostCents,
  resolveDashboardJobSurface,
  resolveGroupSurface,
  resolveRemixEntryHref,
} from './_lib/dashboard-media';
import {
  readTemplates,
  type TemplateEntry,
  writeTemplates,
} from './_lib/dashboard-storage';
import { DashboardPageShell, type DashboardLightbox } from './_components/DashboardPageShell';
import { type RecentTypeTab } from './_components/RecentGrid';
import { useDashboardAccountSummary } from './_hooks/useDashboardAccountSummary';
import { useDashboardEngineSelection } from './_hooks/useDashboardEngineSelection';

const IN_PROGRESS_POLL_MS = 5000;
const IN_PROGRESS_LIMIT = 8;
const DASHBOARD_RECENT_PAGE_SIZE = 12;
const RECENT_SAMPLE_LIMIT = 20;
const TEMPLATE_LIMIT = 6;

export default function DashboardPage() {
  const { t } = useI18n();
  const copy = t('workspace.dashboard', DEFAULT_DASHBOARD_COPY) as DashboardCopy;
  const router = useRouter();
  const { loading: authLoading, user } = useRequireAuth({ redirectIfLoggedOut: false });
  const [recentTab, setRecentTab] = useState<RecentTypeTab>('all');
  const { data: enginesData, error: enginesError } = useEngines('video', { includeAverages: false });
  const { data: imageEnginesData } = useEngines('image');
  const {
    data: jobsPages,
    mutate: mutateJobs,
    stableJobs,
  } = useInfiniteJobs(25, { type: 'all' });
  const recentFeedOptions = useMemo(
    () => (recentTab === 'all' ? { type: 'all' as const } : { surface: recentTab }),
    [recentTab]
  );
  const {
    data: recentJobsPages,
    isLoading: recentIsLoading,
    setSize: setRecentSize,
    isValidating: recentIsValidating,
    mutate: mutateRecentJobs,
    stableJobs: stableRecentJobs,
  } = useInfiniteJobs(DASHBOARD_RECENT_PAGE_SIZE, recentFeedOptions);
  const { stableJobs: stableImageJobs } = useInfiniteJobs(1, { type: 'image' });

  const [, setTemplates] = useState<TemplateEntry[]>([]);
  const [lightbox, setLightbox] = useState<DashboardLightbox | null>(null);
  const videoEngines = useMemo(() => enginesData?.engines ?? [], [enginesData?.engines]);
  const imageEngines = useMemo(() => imageEnginesData?.engines ?? [], [imageEnginesData?.engines]);

  const jobs = useMemo(() => {
    if (Array.isArray(stableJobs) && stableJobs.length) return stableJobs;
    return jobsPages?.flatMap((page) => page.jobs) ?? [];
  }, [jobsPages, stableJobs]);
  const recentJobs = useMemo(() => {
    if (Array.isArray(stableRecentJobs) && stableRecentJobs.length) return stableRecentJobs;
    return recentJobsPages?.flatMap((page) => page.jobs) ?? [];
  }, [recentJobsPages, stableRecentJobs]);
  const imageJobs = useMemo(() => {
    if (Array.isArray(stableImageJobs) && stableImageJobs.length) return stableImageJobs;
    return [];
  }, [stableImageJobs]);

  const latestRealJob = useMemo(
    () => jobs.find((job) => !job.curated && job.engineId && resolveDashboardJobSurface(job) === 'video'),
    [jobs]
  );
  const latestImageJob = useMemo(() => imageJobs.find((job) => !job.curated && job.engineId), [imageJobs]);
  const lastRecentJobsPage = recentJobsPages && recentJobsPages.length ? recentJobsPages[recentJobsPages.length - 1] : null;

  const {
    availableEngines,
    availableImageEngines,
    selectedEngine,
    selectedMode,
    selectedImageEngine,
    selectedImageMode,
    hasStoredForm,
    hasStoredImageForm,
    canStart,
    canStartImage,
    engineLookupById,
    handleVideoModeChange,
    handleVideoEngineChange,
    handleImageModeChange,
    handleImageEngineChange,
    resolveVideoStart,
    resolveImageStart,
  } = useDashboardEngineSelection({
    videoEngines,
    imageEngines,
    authLoading,
    latestVideoEngineId: latestRealJob?.engineId ?? null,
    latestImageEngineId: latestImageJob?.engineId ?? null,
  });
  const { walletSummary, memberSummary } = useDashboardAccountSummary({ authLoading, user });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setTemplates(readTemplates());
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleHidden = () => {
      void mutateJobs();
      void mutateRecentJobs();
    };
    window.addEventListener('jobs:hidden', handleHidden);
    return () => window.removeEventListener('jobs:hidden', handleHidden);
  }, [mutateJobs, mutateRecentJobs]);

  const pendingJobs = useMemo(() => {
    return jobs
      .filter((job) => job.status === 'pending' && !job.curated)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, IN_PROGRESS_LIMIT);
  }, [jobs]);

  useEffect(() => {
    if (pendingJobs.length === 0) return;
    const interval = window.setInterval(() => {
      void mutateJobs();
      void mutateRecentJobs();
    }, IN_PROGRESS_POLL_MS);
    return () => window.clearInterval(interval);
  }, [mutateJobs, mutateRecentJobs, pendingJobs.length]);

  const groupedJobs = useMemo(() => {
    const { groups } = groupJobsIntoSummaries(recentJobs, { includeSinglesAsGroups: true });
    return [...groups]
      .filter((group) => group.members.length > 0)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }, [recentJobs]);

  const normalizedGroups = useMemo(() => normalizeGroupSummaries(groupedJobs), [groupedJobs]);
  const recentGroups = useMemo(() => {
    return normalizedGroups.filter((group) => {
      const status = group.hero.status ?? 'completed';
      if (status === 'pending') return false;
      if (recentTab !== 'all') return resolveGroupSurface(group) === recentTab;
      return true;
    });
  }, [normalizedGroups, recentTab]);

  const isInitialLoading = recentIsLoading && recentJobs.length === 0 && normalizedGroups.length === 0;
  const currencyCode =
    walletSummary?.currency ??
    jobs.find((job) => typeof job.currency === 'string')?.currency ??
    'USD';
  const spendTodayDisplay =
    typeof memberSummary?.spentToday === 'number' ? formatCurrencyLocal(memberSummary.spentToday, currencyCode) : '--';
  const spend30Display =
    typeof memberSummary?.spent30 === 'number' ? formatCurrencyLocal(memberSummary.spent30, currencyCode) : '--';

  const completedJobsForStats = useMemo(() => {
    return jobs
      .filter((job) => job.status === 'completed' && !job.curated)
      .slice(0, RECENT_SAMPLE_LIMIT);
  }, [jobs]);

  const avgCostCents = useMemo(() => {
    const values = completedJobsForStats
      .map((job) => getJobCostCents(job))
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    if (!values.length) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }, [completedJobsForStats]);

  const avgCostDisplay = avgCostCents != null ? formatCurrencyLocal(avgCostCents / 100, currencyCode) : '—';
  const avgCostPerSec = useMemo(() => {
    const samples = completedJobsForStats
      .map((job) => {
        const cost = getJobCostCents(job);
        if (typeof cost !== 'number' || !Number.isFinite(cost)) return null;
        if (!job.durationSec || !Number.isFinite(job.durationSec)) return null;
        return cost / Math.max(1, job.durationSec);
      })
      .filter((value): value is number => value !== null && Number.isFinite(value));
    if (!samples.length) return null;
    return samples.reduce((sum, value) => sum + value, 0) / samples.length;
  }, [completedJobsForStats]);

  const runwaySeconds = useMemo(() => {
    if (!walletSummary || avgCostPerSec == null || avgCostPerSec <= 0) return null;
    return (walletSummary.balance * 100) / avgCostPerSec;
  }, [avgCostPerSec, walletSummary]);

  const mostUsedEngine = useMemo(() => {
    const counts = new Map<string, number>();
    jobs
      .filter((job) => !job.curated && job.engineId)
      .slice(0, RECENT_SAMPLE_LIMIT)
      .forEach((job) => {
        if (!job.engineId) return;
        counts.set(job.engineId, (counts.get(job.engineId) ?? 0) + 1);
      });
    let bestId: string | null = null;
    let bestCount = 0;
    counts.forEach((count, engineId) => {
      if (count > bestCount) {
        bestCount = count;
        bestId = engineId;
      }
    });
    if (!bestId) return null;
    return engineLookupById.get(bestId)?.label ?? bestId;
  }, [engineLookupById, jobs]);

  const handleRefreshJob = useCallback(async (jobId: string) => {
    try {
      const status = await getJobStatus(jobId);
      if (status.status === 'failed') {
        throw new Error(status.message ?? 'MaxVideoAI could not complete this render.');
      }
      if (status.status !== 'completed' && !status.videoUrl) {
        throw new Error('This render is still processing.');
      }
    } catch (error) {
      throw error instanceof Error ? error : new Error('Unable to refresh render status.');
    }
  }, []);

  const handleNewVideo = useCallback(() => {
    const next = resolveVideoStart();
    if (!next) return;
    router.push(`/app?engine=${encodeURIComponent(next.engineId)}&mode=${encodeURIComponent(next.mode)}`);
  }, [resolveVideoStart, router]);

  const handleNewImage = useCallback(() => {
    const next = resolveImageStart();
    if (!next) return;
    router.push('/app/image');
  }, [resolveImageStart, router]);

  const pushTemplateEntry = useCallback((entry: TemplateEntry) => {
    setTemplates((prev) => {
      const next = [entry, ...prev.filter((item) => item.id !== entry.id)].slice(0, TEMPLATE_LIMIT);
      writeTemplates(next);
      return next;
    });
  }, []);

  const handleSaveTemplate = useCallback(
    (group: GroupSummary) => {
      if (group.hero.job?.curated) return;
      const jobId = group.hero.jobId ?? group.hero.job?.jobId ?? null;
      if (!jobId) return;
      const heroJob = group.hero.job ?? null;
      const priceCents =
        typeof group.hero.priceCents === 'number'
          ? group.hero.priceCents
          : heroJob
            ? getJobCostCents(heroJob)
            : null;
      const durationSec =
        typeof group.hero.durationSec === 'number' && Number.isFinite(group.hero.durationSec)
          ? group.hero.durationSec
          : null;
      pushTemplateEntry({
        id: jobId,
        surface: heroJob?.surface ?? null,
        prompt: group.hero.prompt ?? copy.quickStarts.defaultTitle,
        engineLabel: group.hero.engineLabel ?? null,
        engineId: group.hero.engineId ?? heroJob?.engineId ?? null,
        thumbUrl: group.hero.thumbUrl ?? heroJob?.thumbUrl ?? null,
        durationSec,
        aspectRatio: group.hero.aspectRatio ?? heroJob?.aspectRatio ?? null,
        hasAudio: typeof heroJob?.hasAudio === 'boolean' ? heroJob.hasAudio : null,
        priceCents,
        currency: group.hero.currency ?? heroJob?.currency ?? null,
        createdAt: group.createdAt ?? null,
      });
    },
    [copy.quickStarts.defaultTitle, pushTemplateEntry]
  );

  const handleRemixEntry = useCallback(
    (entry: MediaLightboxEntry) => {
      const href = resolveRemixEntryHref(entry);
      if (!href) return;
      router.push(href);
    },
    [router]
  );

  const handleTemplateEntry = useCallback(
    (entry: MediaLightboxEntry) => {
      if (entry.curated) return;
      const jobId = entry.jobId ?? entry.id;
      if (!jobId) return;
      pushTemplateEntry({
        id: jobId,
        surface: entry.surface ?? null,
        prompt: entry.prompt ?? copy.quickStarts.defaultTitle,
        engineLabel: entry.engineLabel ?? null,
        engineId: entry.engineId ?? null,
        thumbUrl: entry.thumbUrl ?? null,
        durationSec: typeof entry.durationSec === 'number' ? entry.durationSec : null,
        aspectRatio: entry.aspectRatio ?? null,
        hasAudio: typeof entry.hasAudio === 'boolean' ? entry.hasAudio : null,
        priceCents: typeof entry.priceCents === 'number' ? entry.priceCents : null,
        currency: entry.currency ?? null,
        createdAt: entry.createdAt ?? null,
      });
    },
    [copy.quickStarts.defaultTitle, pushTemplateEntry]
  );

  return (
    <DashboardPageShell
      copy={copy}
      videoEngines={availableEngines}
      imageEngines={availableImageEngines}
      selectedVideoEngineId={selectedEngine?.id ?? ''}
      selectedVideoMode={selectedMode}
      selectedImageEngineId={selectedImageEngine?.id ?? ''}
      selectedImageMode={selectedImageMode}
      hasStoredVideoForm={hasStoredForm}
      hasStoredImageForm={hasStoredImageForm}
      canStartVideo={canStart}
      canStartImage={canStartImage}
      onVideoModeChange={handleVideoModeChange}
      onVideoEngineChange={handleVideoEngineChange}
      onImageModeChange={handleImageModeChange}
      onImageEngineChange={handleImageEngineChange}
      onNewVideo={handleNewVideo}
      onUseLastVideoSettings={() => router.push('/app')}
      onNewImage={handleNewImage}
      onUseLastImageSettings={() => router.push('/app/image')}
      pendingJobs={pendingJobs}
      recentGroups={recentGroups}
      isInitialLoading={isInitialLoading}
      recentIsValidating={recentIsValidating}
      hasMoreRecent={Boolean(lastRecentJobsPage?.nextCursor)}
      onOpenJob={(job) => setLightbox({ kind: 'job', job })}
      onOpenGroup={(group) => setLightbox({ kind: 'group', group })}
      onSaveTemplate={handleSaveTemplate}
      onLoadMoreRecent={() => setRecentSize((size) => size + 1)}
      recentTab={recentTab}
      onRecentTabChange={setRecentTab}
      spendToday={spendTodayDisplay}
      spend30={spend30Display}
      avgCost={avgCostDisplay}
      runway={runwaySeconds ? formatRunway(runwaySeconds) : '—'}
      runwayFallback={runwaySeconds ? null : copy.insights.runwayFallback}
      mostUsedEngine={mostUsedEngine}
      enginesError={enginesError}
      lightbox={lightbox}
      onCloseLightbox={() => setLightbox(null)}
      onRemixEntry={handleRemixEntry}
      onUseTemplate={handleTemplateEntry}
      onRefreshJob={handleRefreshJob}
    />
  );
}
