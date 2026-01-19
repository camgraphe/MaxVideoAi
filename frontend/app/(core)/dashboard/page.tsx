'use client';
/* eslint-disable @next/next/no-img-element */

import clsx from 'clsx';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { forwardRef, type Ref, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { HeaderBar } from '@/components/HeaderBar';
import { AppSidebar } from '@/components/AppSidebar';
import { getJobStatus, useEngines, useInfiniteJobs } from '@/lib/api';
import { groupJobsIntoSummaries } from '@/lib/job-groups';
import { normalizeGroupSummaries } from '@/lib/normalize-group-summary';
import type { GroupSummary } from '@/types/groups';
import type { Job } from '@/types/jobs';
import type { EngineCaps, Mode } from '@/types/engines';
import { CURRENCY_LOCALE } from '@/lib/intl';
import type { MediaLightboxEntry } from '@/components/MediaLightbox';
import { EngineSelect } from '@/components/ui/EngineSelect';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { authFetch } from '@/lib/authFetch';
import { Button, ButtonLink } from '@/components/ui/Button';
import {
  readLastKnownMember,
  readLastKnownUserId,
  readLastKnownWallet,
  writeLastKnownMember,
  writeLastKnownWallet,
} from '@/lib/last-known';

const NEW_USER_ENGINE_ID = 'sora-2';
const STORAGE_KEYS = {
  form: 'maxvideoai.generate.form.v1',
  imageForm: 'maxvideoai.image.composer.v1',
  templates: 'maxvideoai.dashboard.templates.v1',
} as const;
const MODE_OPTIONS: Mode[] = ['t2v', 'i2v', 'r2v'];
const IMAGE_MODE_OPTIONS: Mode[] = ['t2i', 'i2i'];
const IN_PROGRESS_POLL_MS = 5000;
const IN_PROGRESS_LIMIT = 8;
const RECENT_SAMPLE_LIMIT = 20;
const TEMPLATE_LIMIT = 6;

const MediaLightbox = dynamic(
  () => import('@/components/MediaLightbox').then((mod) => mod.MediaLightbox),
  { ssr: false }
);

const DEFAULT_DASHBOARD_COPY = {
  create: {
    title: 'Create',
    subtitle: 'Start a new render or pick up where you left off.',
    videoTitle: 'Create video',
    videoSubtitle: 'Choose your engine and mode, then start a render.',
    imageTitle: 'Create image',
    imageSubtitle: 'Generate stills or edits with the image engines.',
    engineLabel: 'Engine',
    newVideo: 'New video',
    useLastVideo: 'Use last video settings',
    startVideoTemplate: 'Start from template',
    newImage: 'New image',
    useLastImage: 'Use last image settings',
    startImageTemplate: 'Start from template',
  },
  modes: {
    t2v: 'T2V',
    i2v: 'I2V',
    r2v: 'Reference',
    t2i: 'Create',
    i2i: 'Edit',
  },
  inProgress: {
    title: 'In progress',
    empty: 'No active renders right now.',
    etaLabel: 'ETA',
    progressLabel: 'Progress',
    open: 'Open',
    remix: 'Remix',
  },
  recent: {
    title: 'Recent renders',
    viewAll: 'Open Library',
    empty: 'No renders yet. Start a generation to populate your library.',
    tabs: {
      all: 'All',
      completed: 'Completed',
      failed: 'Failed',
    },
  },
  insights: {
    title: 'Insights',
    spendToday: 'Spend today',
    spend30: 'Spend 30d',
    avgCost: 'Avg cost',
    runway: 'Runway',
    runwayFallback: 'Runway estimate needs completed renders.',
    mostUsed: 'Most used',
  },
  quickStarts: {
    title: 'Quick starts',
    empty: 'Save a render as a template to reuse it here.',
    use: 'Use',
    manage: 'Open Library',
    remove: 'Remove',
    defaultTitle: 'Template',
    meta: {
      engine: 'Engine',
      format: 'Format',
      duration: 'Duration',
      audio: 'Audio',
      audioOn: 'On',
      audioOff: 'Off',
      audioUnknown: '—',
      price: 'Price',
      formatAuto: 'Auto',
    },
  },
  engines: {
    title: 'Engine status',
    allOk: 'All engines operational',
    error: 'Failed to load engines.',
    queueLabel: 'queue: {count}',
  },
  actions: {
    retry: 'Retry',
    loadMore: 'Load more',
    download: 'Download',
    remix: 'Remix',
    template: 'Use as template',
    noPreview: 'No preview',
  },
  lightbox: {
    groupTitle: 'Group ×{count}',
    jobTitle: 'Render {id}',
    metadata: {
      created: 'Created',
      heroDuration: 'Hero duration',
      engine: 'Engine',
      duration: 'Duration',
      status: 'Status',
      notProvided: 'Not provided',
    },
    statusFallback: 'N/A',
    versionLabel: 'Version {index}',
  },
} as const;

type DashboardCopy = typeof DEFAULT_DASHBOARD_COPY;

type TemplateEntry = {
  id: string;
  prompt: string;
  engineLabel?: string | null;
  engineId?: string | null;
  thumbUrl?: string | null;
  durationSec?: number | null;
  aspectRatio?: string | null;
  hasAudio?: boolean | null;
  priceCents?: number | null;
  currency?: string | null;
  createdAt?: string | null;
};

export default function DashboardPage() {
  const { t } = useI18n();
  const copy = t('workspace.dashboard', DEFAULT_DASHBOARD_COPY) as DashboardCopy;
  const router = useRouter();
  const { loading: authLoading } = useRequireAuth();
  const { data: enginesData, error: enginesError } = useEngines();
  const { data: imageEnginesData } = useEngines('image');
  const {
    data: jobsPages,
    isLoading,
    setSize,
    isValidating,
    mutate: mutateJobs,
    stableJobs,
  } = useInfiniteJobs(25, { type: 'video' });
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
  const [templates, setTemplates] = useState<TemplateEntry[]>([]);
  const [walletSummary, setWalletSummary] = useState<{ balance: number; currency: string } | null>(() => {
    const stored = readLastKnownWallet();
    if (!stored) return null;
    return {
      balance: stored.balance,
      currency: typeof stored.currency === 'string' ? stored.currency.toUpperCase() : 'USD',
    };
  });
  const [memberSummary, setMemberSummary] = useState<{ spentToday?: number; spent30?: number } | null>(() => {
    const stored = readLastKnownMember();
    if (!stored) return null;
    return { spentToday: stored.spentToday, spent30: stored.spent30 };
  });
  const [recentTab, setRecentTab] = useState<'all' | 'completed' | 'failed'>('all');
  const [lightbox, setLightbox] = useState<{ kind: 'group'; group: GroupSummary } | { kind: 'job'; job: Job } | null>(null);
  const quickStartRef = useRef<HTMLDivElement | null>(null);

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

  const latestRealJob = useMemo(() => jobs.find((job) => !job.curated && job.engineId), [jobs]);
  const imageJobs = useMemo(() => {
    if (Array.isArray(stableImageJobs) && stableImageJobs.length) return stableImageJobs;
    return [];
  }, [stableImageJobs]);
  const latestImageJob = useMemo(() => imageJobs.find((job) => !job.curated && job.engineId), [imageJobs]);
  const lastJobsPage = jobsPages && jobsPages.length ? jobsPages[jobsPages.length - 1] : null;

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
  }, [authLoading]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleHidden = () => {
      void mutateJobs();
    };
    window.addEventListener('jobs:hidden', handleHidden);
    return () => window.removeEventListener('jobs:hidden', handleHidden);
  }, [mutateJobs]);

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
    }, IN_PROGRESS_POLL_MS);
    return () => window.clearInterval(interval);
  }, [mutateJobs, pendingJobs.length]);

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
    const { groups } = groupJobsIntoSummaries(jobs, { includeSinglesAsGroups: true });
    return [...groups]
      .filter((group) => group.members.length > 0)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }, [jobs]);

  const normalizedGroups = useMemo(() => normalizeGroupSummaries(groupedJobs), [groupedJobs]);

  const recentGroups = useMemo(() => {
    const filtered = normalizedGroups.filter((group) => {
      const status = group.hero.status ?? 'completed';
      if (status === 'pending') return false;
      if (recentTab === 'failed') return status === 'failed';
      if (recentTab === 'completed') return status !== 'failed';
      return true;
    });
    return filtered;
  }, [normalizedGroups, recentTab]);

  const isInitialLoading = isLoading && jobs.length === 0 && normalizedGroups.length === 0;

  const formatCurrency = useCallback((amount: number, currencyCode?: string) => {
    const safeCurrency = currencyCode ?? 'USD';
    try {
      return new Intl.NumberFormat(CURRENCY_LOCALE, { style: 'currency', currency: safeCurrency }).format(amount);
    } catch {
      return `${safeCurrency} ${amount.toFixed(2)}`;
    }
  }, []);

  const currencyCode =
    walletSummary?.currency ??
    jobs.find((job) => typeof job.currency === 'string')?.currency ??
    'USD';

  const spendTodayDisplay =
    typeof memberSummary?.spentToday === 'number' ? formatCurrency(memberSummary.spentToday, currencyCode) : '--';
  const spend30Display =
    typeof memberSummary?.spent30 === 'number' ? formatCurrency(memberSummary.spent30, currencyCode) : '--';

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

  const avgCostDisplay = avgCostCents != null ? formatCurrency(avgCostCents / 100, currencyCode) : '—';

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

  const handleUseTemplate = useCallback(
    (template: TemplateEntry) => {
      router.push(`/app?job=${encodeURIComponent(template.id)}`);
    },
    [router]
  );

  const handleDeleteTemplate = useCallback((templateId: string) => {
    setTemplates((prev) => {
      const next = prev.filter((item) => item.id !== templateId);
      writeTemplates(next);
      return next;
    });
  }, []);

  const handleRemixEntry = useCallback(
    (entry: MediaLightboxEntry) => {
      const jobId = entry.jobId ?? entry.id;
      if (!jobId) return;
      router.push(`/app?job=${encodeURIComponent(jobId)}`);
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

  if (authLoading) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <HeaderBar />
      <div className="flex flex-1 min-w-0">
        <AppSidebar />
        <main className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto p-5 lg:p-7">
          <div className="grid grid-gap lg:grid-cols-12">
            <div className="min-w-0 space-y-6 lg:col-span-8">
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
                groups={recentGroups}
                isLoading={isInitialLoading}
                isValidating={isValidating}
                hasMore={Boolean(lastJobsPage?.nextCursor)}
                onOpenGroup={(group) => setLightbox({ kind: 'group', group })}
                onSaveTemplate={handleSaveTemplate}
                onLoadMore={() => setSize((size) => size + 1)}
                tab={recentTab}
                onTabChange={setRecentTab}
              />
            </div>

            <div className="min-w-0 space-y-6 lg:col-span-4">
              <InsightsPanel
                copy={copy}
                spendToday={spendTodayDisplay}
                spend30={spend30Display}
                avgCost={avgCostDisplay}
                runway={runwayDisplay}
                runwayFallback={runwaySeconds ? null : copy.insights.runwayFallback}
                mostUsed={mostUsedEngine}
              />

              <QuickStarts
                copy={copy}
                templates={templates}
                onUseTemplate={handleUseTemplate}
                onDeleteTemplate={handleDeleteTemplate}
                ref={quickStartRef}
              />

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

function CreateHero({
  copy,
  videoEngines,
  imageEngines,
  selectedVideoEngineId,
  selectedVideoMode,
  selectedImageEngineId,
  selectedImageMode,
  hasStoredVideoForm,
  hasStoredImageForm,
  canStartVideo,
  canStartImage,
  onVideoModeChange,
  onVideoEngineChange,
  onImageModeChange,
  onImageEngineChange,
  onNewVideo,
  onUseLastVideoSettings,
  onNewImage,
  onUseLastImageSettings,
}: {
  copy: DashboardCopy;
  videoEngines: EngineCaps[];
  imageEngines: EngineCaps[];
  selectedVideoEngineId: string;
  selectedVideoMode: Mode;
  selectedImageEngineId: string;
  selectedImageMode: Mode;
  hasStoredVideoForm: boolean;
  hasStoredImageForm: boolean;
  canStartVideo: boolean;
  canStartImage: boolean;
  onVideoModeChange: (mode: Mode) => void;
  onVideoEngineChange: (engineId: string) => void;
  onImageModeChange: (mode: Mode) => void;
  onImageEngineChange: (engineId: string) => void;
  onNewVideo: () => void;
  onUseLastVideoSettings: () => void;
  onNewImage: () => void;
  onUseLastImageSettings: () => void;
}) {
  return (
    <section className="rounded-card border border-border bg-white p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">{copy.create.title}</h1>
          <p className="mt-1 text-sm text-text-secondary">{copy.create.subtitle}</p>
        </div>
      </div>

      <div className="mt-5 grid grid-gap lg:grid-cols-2">
        <CreateVideoCard
          copy={copy}
          engines={videoEngines}
          selectedEngineId={selectedVideoEngineId}
          selectedMode={selectedVideoMode}
          hasStoredForm={hasStoredVideoForm}
          canStart={canStartVideo}
          onModeChange={onVideoModeChange}
          onEngineChange={onVideoEngineChange}
          onNew={onNewVideo}
          onUseLast={onUseLastVideoSettings}
        />
        <CreateImageCard
          copy={copy}
          engines={imageEngines}
          selectedEngineId={selectedImageEngineId}
          selectedMode={selectedImageMode}
          hasStoredForm={hasStoredImageForm}
          canStart={canStartImage}
          onModeChange={onImageModeChange}
          onEngineChange={onImageEngineChange}
          onNew={onNewImage}
          onUseLast={onUseLastImageSettings}
        />
      </div>
    </section>
  );
}

function CreateVideoCard({
  copy,
  engines,
  selectedEngineId,
  selectedMode,
  hasStoredForm,
  canStart,
  onModeChange,
  onEngineChange,
  onNew,
  onUseLast,
}: {
  copy: DashboardCopy;
  engines: EngineCaps[];
  selectedEngineId: string;
  selectedMode: Mode;
  hasStoredForm: boolean;
  canStart: boolean;
  onModeChange: (mode: Mode) => void;
  onEngineChange: (engineId: string) => void;
  onNew: () => void;
  onUseLast: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">{copy.create.videoTitle}</h2>
          <p className="mt-1 text-sm text-text-secondary">{copy.create.videoSubtitle}</p>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <div className="min-w-0">
          <EngineSelect
            engines={engines}
            engineId={selectedEngineId}
            onEngineChange={onEngineChange}
            mode={selectedMode}
            onModeChange={onModeChange}
            modeOptions={MODE_OPTIONS}
            modeLabelOverrides={{
              t2v: copy.modes.t2v,
              i2v: copy.modes.i2v,
              r2v: copy.modes.r2v,
            }}
            showModeSelect={false}
            variant="bar"
          />
        </div>
        <Button
          type="button"
          onClick={onNew}
          disabled={!canStart}
          size="md"
          className={clsx(
            'w-full px-5 py-3 text-base font-semibold',
            !canStart && 'bg-neutral-200 text-text-muted hover:bg-neutral-200 disabled:opacity-100'
          )}
        >
          {copy.create.newVideo}
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {hasStoredForm ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onUseLast}
            className="border-border px-4 text-sm font-semibold text-text-secondary hover:border-text-muted hover:bg-surface-2 hover:text-text-primary"
          >
            {copy.create.useLastVideo}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function CreateImageCard({
  copy,
  engines,
  selectedEngineId,
  selectedMode,
  hasStoredForm,
  canStart,
  onModeChange,
  onEngineChange,
  onNew,
  onUseLast,
}: {
  copy: DashboardCopy;
  engines: EngineCaps[];
  selectedEngineId: string;
  selectedMode: Mode;
  hasStoredForm: boolean;
  canStart: boolean;
  onModeChange: (mode: Mode) => void;
  onEngineChange: (engineId: string) => void;
  onNew: () => void;
  onUseLast: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">{copy.create.imageTitle}</h2>
          <p className="mt-1 text-sm text-text-secondary">{copy.create.imageSubtitle}</p>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <div className="min-w-0">
          <EngineSelect
            engines={engines}
            engineId={selectedEngineId}
            onEngineChange={onEngineChange}
            mode={selectedMode}
            onModeChange={onModeChange}
            modeOptions={IMAGE_MODE_OPTIONS}
            modeLabelOverrides={{
              t2i: copy.modes.t2i,
              i2i: copy.modes.i2i,
            }}
            showBillingNote={false}
            showModeSelect={false}
            variant="bar"
          />
        </div>
        <Button
          type="button"
          onClick={onNew}
          disabled={!canStart}
          size="md"
          className={clsx(
            'w-full px-5 py-3 text-base font-semibold',
            !canStart && 'bg-neutral-200 text-text-muted hover:bg-neutral-200 disabled:opacity-100'
          )}
        >
          {copy.create.newImage}
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {hasStoredForm ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onUseLast}
            className="border-border px-4 text-sm font-semibold text-text-secondary hover:border-text-muted hover:bg-surface-2 hover:text-text-primary"
          >
            {copy.create.useLastImage}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function InProgressList({
  copy,
  jobs,
  onOpen,
}: {
  copy: DashboardCopy;
  jobs: Job[];
  onOpen: (job: Job) => void;
}) {
  return (
    <section className="rounded-card border border-border bg-white p-5 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary">{copy.inProgress.title}</h2>
      </div>
      {!jobs.length ? (
        <p className="text-sm text-text-secondary">{copy.inProgress.empty}</p>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <InProgressRow key={job.jobId} job={job} copy={copy} onOpen={onOpen} />
          ))}
        </div>
      )}
    </section>
  );
}

function InProgressRow({
  job,
  copy,
  onOpen,
}: {
  job: Job;
  copy: DashboardCopy;
  onOpen: (job: Job) => void;
}) {
  const progress = typeof job.progress === 'number' ? Math.max(0, Math.min(100, Math.round(job.progress))) : 0;
  const eta = formatEta(job.etaLabel, job.etaSeconds);
  const priceCents = getJobCostCents(job);
  const price = priceCents != null ? formatCurrencyLocal(priceCents / 100, job.currency) : null;
  const prompt = job.prompt ? truncate(job.prompt, 140) : '';

  return (
    <div className="flex flex-col gap-3 rounded-card border border-border bg-bg/60 p-3 sm:flex-row sm:items-center">
      <div className="relative h-16 w-full overflow-hidden rounded-input border border-border bg-white sm:h-14 sm:w-24">
        {job.thumbUrl ? (
          <Image src={job.thumbUrl} alt="" fill className="object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-text-muted">{copy.actions.noPreview}</div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <p className="truncate text-sm font-semibold text-text-primary">{job.engineLabel}</p>
          {price ? <span className="text-xs font-semibold text-text-primary">{price}</span> : null}
        </div>
        <p className="mt-1 truncate text-xs text-text-muted">{prompt}</p>
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white">
          <div className="h-full rounded-full bg-brand" style={{ width: `${progress}%` }} />
        </div>
        <div className="mt-1 flex items-center justify-between text-xs text-text-muted">
          <span>{copy.inProgress.progressLabel}: {progress}%</span>
          <span>{copy.inProgress.etaLabel}: {eta}</span>
        </div>
      </div>
      <div className="flex flex-shrink-0 items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onOpen(job)}
          className="border-border px-3 py-1.5 text-xs font-semibold text-text-secondary hover:bg-surface-2 hover:text-text-primary"
        >
          {copy.inProgress.open}
        </Button>
        <ButtonLink
          href={`/app?job=${encodeURIComponent(job.jobId)}`}
          variant="outline"
          size="sm"
          className="border-border px-3 py-1.5 text-xs font-semibold text-text-secondary hover:bg-surface-2 hover:text-text-primary"
        >
          {copy.inProgress.remix}
        </ButtonLink>
      </div>
    </div>
  );
}

function RecentGrid({
  copy,
  groups,
  isLoading,
  isValidating,
  hasMore,
  onOpenGroup,
  onSaveTemplate,
  onLoadMore,
  tab,
  onTabChange,
}: {
  copy: DashboardCopy;
  groups: GroupSummary[];
  isLoading: boolean;
  isValidating: boolean;
  hasMore: boolean;
  onOpenGroup: (group: GroupSummary) => void;
  onSaveTemplate: (group: GroupSummary) => void;
  onLoadMore: () => void;
  tab: 'all' | 'completed' | 'failed';
  onTabChange: (tab: 'all' | 'completed' | 'failed') => void;
}) {
  return (
    <section className="rounded-card border border-border bg-white p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-text-primary">{copy.recent.title}</h2>
        <ButtonLink
          href="/jobs"
          prefetch={false}
          variant="outline"
          size="sm"
          className="border-border px-3 py-1 text-xs font-semibold text-text-secondary hover:bg-surface-2 hover:text-text-primary"
        >
          {copy.recent.viewAll}
        </ButtonLink>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {(['all', 'completed', 'failed'] as const).map((value) => (
          <Button
            key={value}
            type="button"
            variant={tab === value ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => onTabChange(value)}
            className={clsx(
              'px-3 py-1 text-xs font-semibold',
              tab === value
                ? 'border border-brand shadow-card'
                : 'border border-border bg-white text-text-secondary hover:border-text-muted hover:bg-surface-2 hover:text-text-primary'
            )}
          >
            {copy.recent.tabs[value]}
          </Button>
        ))}
      </div>

      {isLoading && !groups.length ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={`recent-skeleton-${index}`} className="h-56 rounded-card border border-border bg-bg/60" />
          ))}
        </div>
      ) : !groups.length ? (
        <p className="mt-4 text-sm text-text-secondary">{copy.recent.empty}</p>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {groups.map((group) => {
            const isCurated = Boolean(group.hero.job?.curated);
            const jobId = group.hero.jobId ?? group.hero.id;
            return (
              <div key={group.id} className="flex flex-col gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => onOpenGroup(group)}
                  className="relative min-h-0 h-auto w-full aspect-video overflow-hidden rounded-card border border-border bg-bg p-0"
                >
                  {group.hero.thumbUrl ? (
                    <Image src={group.hero.thumbUrl} alt="" fill className="object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-text-muted">{copy.actions.noPreview}</div>
                  )}
                  <div className="absolute left-3 top-3 rounded-pill bg-black/60 px-2 py-1 text-[11px] font-semibold text-white">
                    {group.hero.engineLabel}
                  </div>
                </Button>
                  <div className="flex flex-wrap gap-2">
                    {group.hero.videoUrl ? (
                      <ButtonLink
                        linkComponent="a"
                        href={group.hero.videoUrl}
                        target="_blank"
                        rel="noreferrer"
                        variant="outline"
                        size="sm"
                        className="border-border px-3 py-1 text-xs font-semibold text-text-secondary hover:bg-surface-2 hover:text-text-primary"
                      >
                        {copy.actions.download}
                      </ButtonLink>
                    ) : null}
                    {!isCurated ? (
                      <ButtonLink
                        href={`/app?job=${encodeURIComponent(jobId)}`}
                        variant="outline"
                        size="sm"
                        className="border-border px-3 py-1 text-xs font-semibold text-text-secondary hover:bg-surface-2 hover:text-text-primary"
                      >
                        {copy.actions.remix}
                      </ButtonLink>
                    ) : null}
                    {!isCurated ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onSaveTemplate(group)}
                        className="border-border px-3 py-1 text-xs font-semibold text-text-secondary hover:bg-surface-2 hover:text-text-primary"
                      >
                        {copy.actions.template}
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
          })}
        </div>
      )}

      {hasMore ? (
        <div className="mt-4 flex justify-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onLoadMore}
            className="border-border px-4 text-sm font-semibold text-text-secondary hover:bg-surface-2 hover:text-text-primary"
            disabled={isValidating}
          >
            {copy.actions.loadMore}
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function InsightsPanel({
  copy,
  spendToday,
  spend30,
  avgCost,
  runway,
  runwayFallback,
  mostUsed,
}: {
  copy: DashboardCopy;
  spendToday: string;
  spend30: string;
  avgCost: string;
  runway: string;
  runwayFallback: string | null;
  mostUsed: string | null;
}) {
  return (
    <section className="rounded-card border border-border bg-white p-5 shadow-card">
      <h3 className="text-lg font-semibold text-text-primary">{copy.insights.title}</h3>
      <div className="mt-4 grid gap-3 text-sm">
        <InsightRow label={copy.insights.spendToday} value={spendToday} />
        <InsightRow label={copy.insights.spend30} value={spend30} />
        <InsightRow label={copy.insights.avgCost} value={avgCost} />
        <InsightRow label={copy.insights.runway} value={runway} />
      </div>
      {runwayFallback ? (
        <p className="mt-3 text-xs text-text-muted">{runwayFallback}</p>
      ) : null}
      {mostUsed ? (
        <p className="mt-3 text-xs text-text-muted">
          {copy.insights.mostUsed}: <span className="font-semibold text-text-primary">{mostUsed}</span>
        </p>
      ) : null}
    </section>
  );
}

function InsightRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-input border border-border bg-bg px-3 py-2">
      <span className="text-text-muted">{label}</span>
      <span className="font-semibold text-text-primary">{value}</span>
    </div>
  );
}

  const QuickStarts = forwardRef(function QuickStarts(
  {
    copy,
    templates,
    onUseTemplate,
    onDeleteTemplate,
  }: {
    copy: DashboardCopy;
    templates: TemplateEntry[];
    onUseTemplate: (template: TemplateEntry) => void;
    onDeleteTemplate: (templateId: string) => void;
  },
  ref: Ref<HTMLDivElement>
) {
  return (
    <section ref={ref} className="rounded-card border border-border bg-white p-5 shadow-card">
      <h3 className="text-lg font-semibold text-text-primary">{copy.quickStarts.title}</h3>
      {!templates.length ? (
        <p className="mt-3 text-sm text-text-secondary">{copy.quickStarts.empty}</p>
      ) : (
        <div className="mt-4 space-y-3">
          {templates.map((template) => (
            <div key={template.id} className="rounded-input border border-border bg-bg px-3 py-3">
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative h-16 w-full overflow-hidden rounded-input border border-border bg-white sm:h-16 sm:w-28">
                  {template.thumbUrl ? (
                    <Image src={template.thumbUrl} alt="" fill className="object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[11px] text-text-muted">
                      {copy.actions.noPreview}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-text-primary">
                        {template.engineLabel ?? copy.create.engineLabel}
                      </p>
                      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-text-muted">
                        <span>
                          {copy.quickStarts.meta.format}: {template.aspectRatio ?? copy.quickStarts.meta.formatAuto}
                        </span>
                        <span>
                          {copy.quickStarts.meta.duration}: {formatDurationShort(template.durationSec)}
                        </span>
                        <span>
                          {copy.quickStarts.meta.audio}: {formatAudioLabel(template.hasAudio, copy)}
                        </span>
                        <span>
                          {copy.quickStarts.meta.price}: {formatTemplatePrice(template)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onUseTemplate(template)}
                        className="border-border px-2 py-1 text-xs font-semibold text-text-secondary hover:bg-surface-2 hover:text-text-primary"
                      >
                        {copy.quickStarts.use}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onDeleteTemplate(template.id)}
                        className="border-border px-2 py-1 text-xs font-semibold text-text-muted hover:bg-surface-2 hover:text-text-primary"
                      >
                        {copy.quickStarts.remove}
                      </Button>
                    </div>
                  </div>
                  {template.prompt ? (
                    <p className="mt-2 text-xs text-text-muted">
                      {truncate(template.prompt, 110)}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <Link href="/jobs" prefetch={false} className="mt-4 inline-flex text-xs font-semibold text-brand hover:underline">
        {copy.quickStarts.manage}
      </Link>
    </section>
  );
});
QuickStarts.displayName = 'QuickStarts';

function EngineStatusCompact({
  copy,
  engines,
  enginesError,
}: {
  copy: DashboardCopy;
  engines: EngineCaps[];
  enginesError: unknown;
}) {
  if (enginesError) {
    return (
      <section className="rounded-card border border-border bg-white p-5 shadow-card">
        <h3 className="text-lg font-semibold text-text-primary">{copy.engines.title}</h3>
        <p className="mt-2 text-sm text-state-warning">{copy.engines.error}</p>
      </section>
    );
  }

  const flagged = engines.filter((engine) => isEngineAlert(engine));

  return (
    <section className="rounded-card border border-border bg-white p-5 shadow-card">
      <h3 className="text-lg font-semibold text-text-primary">{copy.engines.title}</h3>
      {flagged.length === 0 ? (
        <p className="mt-2 text-sm text-text-secondary">{copy.engines.allOk}</p>
      ) : (
        <div className="mt-3 space-y-2">
          {flagged.map((engine) => (
            <div key={engine.id} className="flex items-center justify-between rounded-input border border-border bg-bg px-3 py-2 text-xs">
              <span className="font-semibold text-text-primary">{engine.label}</span>
              <span className="text-text-muted">
                {engine.status}
                {typeof engine.queueDepth === 'number'
                  ? ` · ${copy.engines.queueLabel.replace('{count}', String(engine.queueDepth))}`
                  : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function buildEntriesFromJob(job: Job): MediaLightboxEntry[] {
  return [
    {
      id: job.jobId,
      jobId: job.jobId,
      label: job.engineLabel,
      videoUrl: job.videoUrl ?? undefined,
      thumbUrl: job.thumbUrl ?? undefined,
      aspectRatio: job.aspectRatio ?? undefined,
      status: (job.status as MediaLightboxEntry['status']) ?? 'completed',
      progress: typeof job.progress === 'number' ? job.progress : null,
      message: job.message ?? null,
      engineLabel: job.engineLabel,
      engineId: job.engineId ?? null,
      durationSec: job.durationSec,
      createdAt: job.createdAt,
      hasAudio: Boolean(job.hasAudio),
      prompt: job.prompt ?? null,
      priceCents: getJobCostCents(job),
      currency: job.currency ?? null,
      curated: Boolean(job.curated),
    },
  ];
}

function buildEntriesFromGroup(group: GroupSummary, versionLabel: string): MediaLightboxEntry[] {
  return group.members.map((member) => ({
    id: member.id,
    jobId: member.jobId ?? member.id,
    label:
      typeof member.iterationIndex === 'number'
        ? versionLabel.replace('{index}', String(member.iterationIndex + 1))
        : member.engineLabel ?? member.id,
    videoUrl: member.videoUrl ?? undefined,
    thumbUrl: member.thumbUrl ?? undefined,
    aspectRatio: member.aspectRatio ?? undefined,
    status: member.status ?? 'completed',
    progress: typeof member.progress === 'number' ? member.progress : null,
    message: member.message ?? null,
    engineLabel: member.engineLabel,
    engineId: member.engineId ?? null,
    durationSec: member.durationSec,
    createdAt: member.createdAt,
    hasAudio: Boolean(member.job?.hasAudio),
    prompt: member.prompt ?? group.hero.prompt ?? null,
    priceCents: typeof member.priceCents === 'number' ? member.priceCents : null,
    currency: member.currency ?? group.currency ?? null,
    curated: Boolean(member.job?.curated),
  }));
}

function formatDateTime(value: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function isEngineAvailable(engine: EngineCaps): boolean {
  const availability = engine.availability ?? 'available';
  return availability !== 'paused';
}

function supportsImageModes(engine: EngineCaps): boolean {
  return engine.modes.some((mode) => mode === 't2i' || mode === 'i2i');
}

function isEngineAlert(engine: EngineCaps): boolean {
  const status = engine.status ?? 'live';
  const availability = engine.availability ?? 'available';
  const okStatus = status === 'live' || status === 'busy' || status === 'early_access';
  const okAvailability = availability === 'available' || availability === 'limited';
  return !(okStatus && okAvailability);
}

function readStoredForm(): { engineId: string; mode?: Mode } | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(STORAGE_KEYS.form);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { engineId?: unknown; mode?: unknown };
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.engineId !== 'string') return null;
    const mode = typeof parsed.mode === 'string' && MODE_OPTIONS.includes(parsed.mode as Mode)
      ? (parsed.mode as Mode)
      : undefined;
    return { engineId: parsed.engineId, mode };
  } catch {
    return null;
  }
}

function readStoredImageForm(): { engineId: string; mode?: Mode } | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(STORAGE_KEYS.imageForm);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { engineId?: unknown; mode?: unknown; version?: unknown } | null;
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.version === 'number' && parsed.version !== 1) return null;
    if (typeof parsed.engineId !== 'string' || !parsed.engineId.trim()) return null;
    const mode = parsed.mode === 't2i' || parsed.mode === 'i2i' ? parsed.mode : undefined;
    return { engineId: parsed.engineId, mode };
  } catch {
    return null;
  }
}

function persistVideoSelection(engineId: string, mode: Mode): void {
  if (typeof window === 'undefined') return;
  const payload: Record<string, unknown> = {
    engineId,
    mode,
    updatedAt: Date.now(),
  };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.form);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        Object.assign(payload, parsed);
        payload.engineId = engineId;
        payload.mode = mode;
        payload.updatedAt = Date.now();
      }
    }
  } catch {
    // ignore storage parse failures
  }
  try {
    window.localStorage.setItem(STORAGE_KEYS.form, JSON.stringify(payload));
  } catch {
    // ignore storage failures
  }
}

function persistImageSelection(engineId: string, mode: Mode): void {
  if (typeof window === 'undefined') return;
  const payload: Record<string, unknown> = {
    version: 1,
    engineId,
    mode: mode === 't2i' || mode === 'i2i' ? mode : 't2i',
    prompt: '',
    numImages: 1,
    aspectRatio: null,
    resolution: null,
    referenceSlots: [],
  };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.imageForm);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        Object.assign(payload, parsed);
        payload.version = 1;
        payload.engineId = engineId;
        payload.mode = mode === 't2i' || mode === 'i2i' ? mode : 't2i';
      }
    }
  } catch {
    // ignore storage parse failures
  }
  try {
    window.localStorage.setItem(STORAGE_KEYS.imageForm, JSON.stringify(payload));
  } catch {
    // ignore storage failures
  }
}

function readTemplates(): TemplateEntry[] {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(STORAGE_KEYS.templates);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as TemplateEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry) => typeof entry.id === 'string' && entry.id.length > 0)
      .map((entry) => ({
        id: entry.id,
        prompt: typeof entry.prompt === 'string' ? entry.prompt : '',
        engineLabel: typeof entry.engineLabel === 'string' ? entry.engineLabel : null,
        engineId: typeof entry.engineId === 'string' ? entry.engineId : null,
        thumbUrl: typeof entry.thumbUrl === 'string' ? entry.thumbUrl : null,
        durationSec:
          typeof entry.durationSec === 'number' && Number.isFinite(entry.durationSec)
            ? entry.durationSec
            : null,
        aspectRatio: typeof entry.aspectRatio === 'string' ? entry.aspectRatio : null,
        hasAudio: typeof entry.hasAudio === 'boolean' ? entry.hasAudio : null,
        priceCents:
          typeof entry.priceCents === 'number' && Number.isFinite(entry.priceCents) ? entry.priceCents : null,
        currency: typeof entry.currency === 'string' ? entry.currency : null,
        createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : null,
      }));
  } catch {
    return [];
  }
}

function writeTemplates(templates: TemplateEntry[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEYS.templates, JSON.stringify(templates));
}

function getJobCostCents(job: Job): number | null {
  if (typeof job.finalPriceCents === 'number') return job.finalPriceCents;
  const pricing = job.pricingSnapshot as { totalCents?: number } | undefined;
  if (typeof pricing?.totalCents === 'number') return pricing.totalCents;
  return null;
}

function formatCurrencyLocal(amount: number, currencyCode?: string): string {
  const safeCurrency = currencyCode ?? 'USD';
  try {
    return new Intl.NumberFormat(CURRENCY_LOCALE, { style: 'currency', currency: safeCurrency }).format(amount);
  } catch {
    return `${safeCurrency} ${amount.toFixed(2)}`;
  }
}

function formatRunway(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—';
  if (seconds >= 3600) {
    return `${(seconds / 3600).toFixed(1)}h`;
  }
  if (seconds >= 60) {
    return `${Math.round(seconds / 60)}m`;
  }
  return `${Math.round(seconds)}s`;
}

function formatEta(label?: string | null, seconds?: number | null): string {
  if (label && label.trim().length) return label;
  if (typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0) {
    if (seconds >= 60) {
      return `${Math.round(seconds / 60)}m`;
    }
    return `${Math.round(seconds)}s`;
  }
  return '—';
}

function formatDurationShort(value?: number | null): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return '—';
  return `${Math.round(value)}s`;
}

function formatAudioLabel(value: boolean | null | undefined, copy: DashboardCopy): string {
  if (value === true) return copy.quickStarts.meta.audioOn;
  if (value === false) return copy.quickStarts.meta.audioOff;
  return copy.quickStarts.meta.audioUnknown;
}

function formatTemplatePrice(template: TemplateEntry): string {
  if (typeof template.priceCents === 'number' && Number.isFinite(template.priceCents)) {
    return formatCurrencyLocal(template.priceCents / 100, template.currency ?? undefined);
  }
  return '—';
}

function truncate(value: string, limit: number): string {
  if (value.length <= limit) return value;
  const slice = value.slice(0, limit - 1).trimEnd();
  return `${slice}…`;
}
