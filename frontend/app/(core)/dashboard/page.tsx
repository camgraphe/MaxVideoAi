'use client';
/* eslint-disable @next/next/no-img-element */

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { HeaderBar } from '@/components/HeaderBar';
import { AppSidebar } from '@/components/AppSidebar';
import { getJobStatus, useEngines, useInfiniteJobs } from '@/lib/api';
import { groupJobsIntoSummaries } from '@/lib/job-groups';
import { normalizeGroupSummaries } from '@/lib/normalize-group-summary';
import type { GroupSummary } from '@/types/groups';
import type { Job } from '@/types/jobs';
import type { EngineCaps, Mode } from '@/types/engines';
import type { MediaLightboxEntry } from '@/components/MediaLightbox';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { authFetch } from '@/lib/authFetch';
import {
  readLastKnownUserId,
  writeLastKnownMember,
  writeLastKnownWallet,
} from '@/lib/last-known';
import { DEFAULT_DASHBOARD_COPY, type DashboardCopy } from './_lib/dashboard-copy';
import { formatCurrencyLocal, formatDateTime, formatRunway } from './_lib/dashboard-formatters';
import {
  buildEntriesFromGroup,
  buildEntriesFromJob,
  getJobCostCents,
  resolveDashboardJobSurface,
  resolveGroupSurface,
  resolveRemixEntryHref,
} from './_lib/dashboard-media';
import {
  persistImageSelection,
  persistVideoSelection,
  readStoredForm,
  readStoredImageForm,
  readTemplates,
  type TemplateEntry,
  writeTemplates,
} from './_lib/dashboard-storage';
import { CreateHero } from './_components/CreateHero';
import { InProgressList } from './_components/InProgressList';
import { InsightsPanel } from './_components/InsightsPanel';
import { RecentGrid, type RecentTypeTab } from './_components/RecentGrid';
import { EngineStatusCompact, ToolsPanel } from './_components/ToolsPanel';

const NEW_USER_ENGINE_ID = 'seedance-2-0';
const IN_PROGRESS_POLL_MS = 5000;
const IN_PROGRESS_LIMIT = 8;
const DASHBOARD_RECENT_PAGE_SIZE = 12;
const RECENT_SAMPLE_LIMIT = 20;
const TEMPLATE_LIMIT = 6;

const MediaLightbox = dynamic(
  () => import('@/components/MediaLightbox').then((mod) => mod.MediaLightbox),
  { ssr: false }
);

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
  const recentFeedOptions = recentTab === 'all' ? { type: 'all' as const } : { surface: recentTab };
  const {
    data: recentJobsPages,
    isLoading: recentIsLoading,
    setSize: setRecentSize,
    isValidating: recentIsValidating,
    mutate: mutateRecentJobs,
    stableJobs: stableRecentJobs,
  } = useInfiniteJobs(DASHBOARD_RECENT_PAGE_SIZE, recentFeedOptions);
  const { stableJobs: stableImageJobs } = useInfiniteJobs(1, { type: 'image' });

  const [selectedEngineId, setSelectedEngineId] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<Mode>('t2v');
  const [hasStoredForm, setHasStoredForm] = useState(false);
  const [selectionResolved, setSelectionResolved] = useState(false);
  const [selectedImageEngineId, setSelectedImageEngineId] = useState<string | null>(null);
  const [selectedImageMode, setSelectedImageMode] = useState<Mode>('t2i');
  const [hasStoredImageForm, setHasStoredImageForm] = useState(false);
  const [imageSelectionResolved, setImageSelectionResolved] = useState(false);
  const [exportsSummary, setExportsSummary] = useState<{ total: number } | null>(null);
  const [, setTemplates] = useState<TemplateEntry[]>([]);
  const [walletSummary, setWalletSummary] = useState<{ balance: number; currency: string } | null>(null);
  const [memberSummary, setMemberSummary] = useState<{ spentToday?: number; spent30?: number } | null>(null);
  const [lightbox, setLightbox] = useState<{ kind: 'group'; group: GroupSummary } | { kind: 'job'; job: Job } | null>(null);

  const availableEngines = useMemo(() => {
    return (enginesData?.engines ?? []).filter((engine) => isEngineAvailable(engine));
  }, [enginesData?.engines]);

  const imageEngines = useMemo(() => imageEnginesData?.engines ?? [], [imageEnginesData?.engines]);
  const availableImageEngines = useMemo(() => {
    return imageEngines.filter((engine) => isEngineAvailable(engine) && supportsImageModes(engine));
  }, [imageEngines]);

  const engineLookup = useMemo(() => {
    const byId = new Map<string, EngineCaps>();
    (enginesData?.engines ?? []).forEach((engine) => {
      byId.set(engine.id, engine);
    });
    return { byId };
  }, [enginesData?.engines]);

  const imageEngineLookup = useMemo(() => {
    const byId = new Map<string, EngineCaps>();
    imageEngines.forEach((engine) => {
      byId.set(engine.id, engine);
    });
    return { byId };
  }, [imageEngines]);

  const jobs = useMemo(() => {
    if (Array.isArray(stableJobs) && stableJobs.length) return stableJobs;
    return jobsPages?.flatMap((page) => page.jobs) ?? [];
  }, [jobsPages, stableJobs]);
  const recentJobs = useMemo(() => {
    if (Array.isArray(stableRecentJobs) && stableRecentJobs.length) return stableRecentJobs;
    return recentJobsPages?.flatMap((page) => page.jobs) ?? [];
  }, [recentJobsPages, stableRecentJobs]);

  const latestRealJob = useMemo(
    () => jobs.find((job) => !job.curated && job.engineId && resolveDashboardJobSurface(job) === 'video'),
    [jobs]
  );
  const imageJobs = useMemo(() => {
    if (Array.isArray(stableImageJobs) && stableImageJobs.length) return stableImageJobs;
    return [];
  }, [stableImageJobs]);
  const latestImageJob = useMemo(() => imageJobs.find((job) => !job.curated && job.engineId), [imageJobs]);
  const lastRecentJobsPage = recentJobsPages && recentJobsPages.length ? recentJobsPages[recentJobsPages.length - 1] : null;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = readStoredForm();
    if (stored?.engineId) {
      setSelectedEngineId(stored.engineId);
      setSelectedMode(stored.mode ?? 't2v');
      setHasStoredForm(true);
      setSelectionResolved(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = readStoredImageForm();
    if (stored?.engineId) {
      setSelectedImageEngineId(stored.engineId);
      setSelectedImageMode(stored.mode ?? 't2i');
      setHasStoredImageForm(true);
      setImageSelectionResolved(true);
    }
  }, []);

  useEffect(() => {
    if (authLoading || hasStoredForm || exportsSummary) return;
    let mounted = true;
    authFetch('/api/user/exports/summary')
      .then(async (response) => {
        if (!response.ok) return null;
        const payload = (await response.json().catch(() => null)) as { total?: number } | null;
        if (!mounted || !payload) return null;
        setExportsSummary({ total: Number(payload.total ?? 0) });
        return null;
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, [authLoading, hasStoredForm, exportsSummary]);

  useEffect(() => {
    if (selectionResolved || hasStoredForm || !exportsSummary || !availableEngines.length) return;
    if (exportsSummary.total === 0) {
      setSelectedEngineId(NEW_USER_ENGINE_ID);
      setSelectionResolved(true);
      return;
    }
    if (exportsSummary.total > 0) {
      const fallback = latestRealJob?.engineId ?? availableEngines[0]?.id ?? null;
      if (fallback) {
        setSelectedEngineId(fallback);
        setSelectionResolved(true);
      }
    }
  }, [availableEngines, exportsSummary, hasStoredForm, latestRealJob, selectionResolved]);

  useEffect(() => {
    if (imageSelectionResolved || hasStoredImageForm || !availableImageEngines.length) return;
    const total = exportsSummary?.total;
    if (typeof total === 'number') {
      if (total === 0) {
        setSelectedImageEngineId(availableImageEngines[0]?.id ?? null);
        setImageSelectionResolved(true);
        return;
      }
      if (total > 0) {
        const fallback = latestImageJob?.engineId ?? availableImageEngines[0]?.id ?? null;
        if (fallback) {
          setSelectedImageEngineId(fallback);
          setImageSelectionResolved(true);
        }
        return;
      }
    }
    const fallback = latestImageJob?.engineId ?? availableImageEngines[0]?.id ?? null;
    if (fallback) {
      setSelectedImageEngineId(fallback);
      setImageSelectionResolved(true);
    }
  }, [
    availableImageEngines,
    exportsSummary?.total,
    hasStoredImageForm,
    imageSelectionResolved,
    latestImageJob,
  ]);

  useEffect(() => {
    if (!availableEngines.length || !selectedEngineId) return;
    const isAvailable = availableEngines.some((engine) => engine.id === selectedEngineId);
    if (!isAvailable) {
      setSelectedEngineId(availableEngines[0]?.id ?? selectedEngineId);
    }
  }, [availableEngines, selectedEngineId]);

  useEffect(() => {
    if (!availableImageEngines.length || !selectedImageEngineId) return;
    const isAvailable = availableImageEngines.some((engine) => engine.id === selectedImageEngineId);
    if (!isAvailable) {
      setSelectedImageEngineId(availableImageEngines[0]?.id ?? selectedImageEngineId);
    }
  }, [availableImageEngines, selectedImageEngineId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setTemplates(readTemplates());
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setWalletSummary(null);
      setMemberSummary(null);
      return;
    }
    let mounted = true;

    const fetchAccountState = async () => {
      try {
        const [walletRes, memberRes] = await Promise.all([
          authFetch('/api/wallet', { cache: 'no-store' }),
          authFetch('/api/member-status', { cache: 'no-store' }),
        ]);
        if (!mounted) return;
        const wallet = (await walletRes.json().catch(() => null)) as { balance?: number; currency?: string } | null;
        const member = (await memberRes.json().catch(() => null)) as { spentToday?: number; spent30?: number } | null;
        if (walletRes.ok) {
          const nextBalance = typeof wallet?.balance === 'number' ? wallet.balance : null;
          if (nextBalance !== null) {
            const nextSummary = {
              balance: nextBalance,
              currency: typeof wallet?.currency === 'string' ? wallet.currency.toUpperCase() : 'USD',
            };
            setWalletSummary(nextSummary);
            writeLastKnownWallet(nextSummary, readLastKnownUserId());
          }
        }
        if (memberRes.ok) {
          const memberPayload = member as {
            tier?: string;
            spentToday?: number;
            spent30?: number;
            savingsPct?: number;
          } | null;
          const nextMember = {
            tier: typeof memberPayload?.tier === 'string' ? memberPayload.tier : undefined,
            spentToday: typeof memberPayload?.spentToday === 'number' ? memberPayload.spentToday : undefined,
            spent30: typeof memberPayload?.spent30 === 'number' ? memberPayload.spent30 : undefined,
            savingsPct: typeof memberPayload?.savingsPct === 'number' ? memberPayload.savingsPct : undefined,
          };
          setMemberSummary({ spentToday: nextMember.spentToday, spent30: nextMember.spent30 });
          writeLastKnownMember(nextMember, readLastKnownUserId());
        }
      } catch {
        // Keep last known values on transient failures.
      }
    };

    void fetchAccountState();

    const handleInvalidate = () => {
      void fetchAccountState();
    };
    window.addEventListener('wallet:invalidate', handleInvalidate);

    return () => {
      mounted = false;
      window.removeEventListener('wallet:invalidate', handleInvalidate);
    };
  }, [authLoading, user]);

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

  const selectedEngine = useMemo(() => {
    if (!selectedEngineId) return availableEngines[0] ?? enginesData?.engines?.[0] ?? null;
    return engineLookup.byId.get(selectedEngineId) ?? availableEngines[0] ?? enginesData?.engines?.[0] ?? null;
  }, [availableEngines, engineLookup.byId, enginesData?.engines, selectedEngineId]);
  const canStart = Boolean(selectedEngine);

  const selectedImageEngine = useMemo(() => {
    if (!selectedImageEngineId) return availableImageEngines[0] ?? imageEngines[0] ?? null;
    return imageEngineLookup.byId.get(selectedImageEngineId) ?? availableImageEngines[0] ?? imageEngines[0] ?? null;
  }, [availableImageEngines, imageEngines, imageEngineLookup.byId, selectedImageEngineId]);
  const canStartImage = Boolean(selectedImageEngine);

  useEffect(() => {
    if (!selectedEngine) return;
    if (!selectedEngine.modes.includes(selectedMode)) {
      setSelectedMode(selectedEngine.modes[0] ?? 't2v');
    }
  }, [selectedEngine, selectedMode]);

  useEffect(() => {
    if (!selectedImageEngine) return;
    if (!selectedImageEngine.modes.includes(selectedImageMode)) {
      const fallbackMode =
        selectedImageEngine.modes.find((mode) => mode === 't2i' || mode === 'i2i') ?? 't2i';
      setSelectedImageMode(fallbackMode);
    }
  }, [selectedImageEngine, selectedImageMode]);

  const groupedJobs = useMemo(() => {
    const { groups } = groupJobsIntoSummaries(recentJobs, { includeSinglesAsGroups: true });
    return [...groups]
      .filter((group) => group.members.length > 0)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }, [recentJobs]);

  const normalizedGroups = useMemo(() => normalizeGroupSummaries(groupedJobs), [groupedJobs]);

  const recentGroups = useMemo(() => {
    const filtered = normalizedGroups.filter((group) => {
      const status = group.hero.status ?? 'completed';
      if (status === 'pending') return false;
      if (recentTab !== 'all') return resolveGroupSurface(group) === recentTab;
      return true;
    });
    return filtered;
  }, [normalizedGroups, recentTab]);

  const displayRecentGroups = recentGroups;

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

  const runwayDisplay = runwaySeconds ? formatRunway(runwaySeconds) : '—';

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
    return engineLookup.byId.get(bestId)?.label ?? bestId;
  }, [engineLookup.byId, jobs]);

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

  const handleVideoModeChange = useCallback((mode: Mode) => {
    setSelectedMode(mode);
  }, []);

  const handleVideoEngineChange = useCallback((engineId: string) => {
    setSelectedEngineId(engineId);
    setSelectionResolved(true);
  }, []);

  const handleImageModeChange = useCallback((mode: Mode) => {
    setSelectedImageMode(mode);
  }, []);

  const handleImageEngineChange = useCallback((engineId: string) => {
    setSelectedImageEngineId(engineId);
    setImageSelectionResolved(true);
  }, []);

  const handleNewVideo = useCallback(() => {
    if (!selectedEngine) return;
    const nextMode = selectedEngine.modes.includes(selectedMode)
      ? selectedMode
      : selectedEngine.modes[0] ?? 't2v';
    if (typeof window !== 'undefined') {
      persistVideoSelection(selectedEngine.id, nextMode);
    }
    router.push(`/app?engine=${encodeURIComponent(selectedEngine.id)}&mode=${encodeURIComponent(nextMode)}`);
  }, [router, selectedEngine, selectedMode]);

  const handleNewImage = useCallback(() => {
    if (!selectedImageEngine) return;
    const nextMode = selectedImageEngine.modes.includes(selectedImageMode)
      ? selectedImageMode
      : selectedImageEngine.modes.find((mode) => mode === 't2i' || mode === 'i2i') ?? 't2i';
    if (typeof window !== 'undefined') {
      persistImageSelection(selectedImageEngine.id, nextMode);
    }
    router.push(`/app/image`);
  }, [router, selectedImageEngine, selectedImageMode]);

  const handleUseLastVideoSettings = useCallback(() => {
    router.push('/app');
  }, [router]);

  const handleUseLastImageSettings = useCallback(() => {
    router.push('/app/image');
  }, [router]);

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
      const entry: TemplateEntry = {
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
      };
      pushTemplateEntry(entry);
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
      const template: TemplateEntry = {
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
      };
      pushTemplateEntry(template);
    },
    [copy.quickStarts.defaultTitle, pushTemplateEntry]
  );

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <HeaderBar />
      <div className="flex min-h-[calc(100vh-var(--header-height))] min-w-0 flex-1">
        <AppSidebar />
        <main className="min-h-[calc(100vh-var(--header-height))] min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto grid w-full max-w-[1560px] gap-6 lg:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_372px]">
            <div className="min-w-0 stack-gap-lg">
              <CreateHero
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
                onUseLastVideoSettings={handleUseLastVideoSettings}
                onNewImage={handleNewImage}
                onUseLastImageSettings={handleUseLastImageSettings}
              />

              <InProgressList
                copy={copy}
                jobs={pendingJobs}
                onOpen={(job) => setLightbox({ kind: 'job', job })}
              />

              <RecentGrid
                copy={copy}
                groups={displayRecentGroups}
                isLoading={isInitialLoading}
                isValidating={recentIsValidating}
                hasMore={Boolean(lastRecentJobsPage?.nextCursor)}
                onOpenGroup={(group) => setLightbox({ kind: 'group', group })}
                onSaveTemplate={handleSaveTemplate}
                onLoadMore={() => setRecentSize((size) => size + 1)}
                tab={recentTab}
                onTabChange={setRecentTab}
              />
            </div>

            <div className="min-w-0 stack-gap-lg lg:sticky lg:top-0 lg:self-start">
              <InsightsPanel
                copy={copy}
                spendToday={spendTodayDisplay}
                spend30={spend30Display}
                avgCost={avgCostDisplay}
                runway={runwayDisplay}
                runwayFallback={runwaySeconds ? null : copy.insights.runwayFallback}
                mostUsed={mostUsedEngine}
              />

              <ToolsPanel copy={copy} />

              <EngineStatusCompact
                copy={copy}
                engines={availableEngines}
                enginesError={enginesError}
              />
            </div>
          </div>
        </main>
      </div>

      {lightbox && (
        <MediaLightbox
          title={
            lightbox.kind === 'group'
              ? copy.lightbox.groupTitle.replace('{count}', String(lightbox.group.count))
              : copy.lightbox.jobTitle.replace('{id}', lightbox.job.jobId)
          }
          subtitle={
            lightbox.kind === 'group'
              ? lightbox.group.hero.engineLabel
              : `${lightbox.job.engineLabel} • ${formatDateTime(lightbox.job.createdAt)}`
          }
          prompt={lightbox.kind === 'group' ? lightbox.group.hero.prompt ?? null : lightbox.job.prompt}
          metadata={
            lightbox.kind === 'group'
              ? [
                  { label: copy.lightbox.metadata.created, value: formatDateTime(lightbox.group.createdAt) },
                  {
                    label: copy.lightbox.metadata.heroDuration,
                    value: lightbox.group.hero.durationSec
                      ? `${lightbox.group.hero.durationSec}s`
                      : copy.lightbox.metadata.notProvided,
                  },
                  { label: copy.lightbox.metadata.engine, value: lightbox.group.hero.engineLabel },
                ]
              : [
                  { label: copy.lightbox.metadata.duration, value: `${lightbox.job.durationSec}s` },
                  {
                    label: copy.lightbox.metadata.status,
                    value: lightbox.job.paymentStatus ?? copy.lightbox.statusFallback,
                  },
                  { label: copy.lightbox.metadata.created, value: formatDateTime(lightbox.job.createdAt) },
                ]
          }
          entries={
            lightbox.kind === 'group'
              ? buildEntriesFromGroup(lightbox.group, copy.lightbox.versionLabel)
              : buildEntriesFromJob(lightbox.job)
          }
          onClose={() => setLightbox(null)}
          onRemixEntry={handleRemixEntry}
          remixLabel={copy.actions.remix}
          onUseTemplate={handleTemplateEntry}
          templateLabel={copy.actions.template}
          onRefreshEntry={(entry) => {
            const jobId = entry.jobId ?? entry.id;
            if (!jobId) return;
            return handleRefreshJob(jobId);
          }}
        />
      )}
    </div>
  );
}

function isEngineAvailable(engine: EngineCaps): boolean {
  const availability = engine.availability ?? 'available';
  return availability !== 'paused';
}

function supportsImageModes(engine: EngineCaps): boolean {
  return engine.modes.some((mode) => mode === 't2i' || mode === 'i2i');
}
