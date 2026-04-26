'use client';
/* eslint-disable @next/next/no-img-element */

import clsx from 'clsx';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  AudioWaveform,
  Camera,
  CalendarDays,
  Clock3,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { HeaderBar } from '@/components/HeaderBar';
import { AppSidebar } from '@/components/AppSidebar';
import { getJobStatus, useEngines, useInfiniteJobs } from '@/lib/api';
import { groupJobsIntoSummaries } from '@/lib/job-groups';
import { normalizeGroupSummaries } from '@/lib/normalize-group-summary';
import { deriveJobSurface } from '@/lib/job-surface';
import type { GroupSummary } from '@/types/groups';
import type { Job } from '@/types/jobs';
import type { JobSurface } from '@/types/billing';
import type { EngineCaps, Mode } from '@/types/engines';
import { CURRENCY_LOCALE } from '@/lib/intl';
import type { MediaLightboxEntry } from '@/components/MediaLightbox';
import { EngineSelect } from '@/components/ui/EngineSelect';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { authFetch } from '@/lib/authFetch';
import { Button, ButtonLink } from '@/components/ui/Button';
import {
  readLastKnownUserId,
  writeLastKnownMember,
  writeLastKnownWallet,
} from '@/lib/last-known';

const NEW_USER_ENGINE_ID = 'seedance-2-0';
const STORAGE_KEYS = {
  form: 'maxvideoai.generate.form.v1',
  imageForm: 'maxvideoai.image.composer.v1',
  templates: 'maxvideoai.dashboard.templates.v1',
} as const;
const MODE_OPTIONS: Mode[] = ['t2v', 'i2v', 'ref2v', 'fl2v', 'extend', 'a2v', 'retake', 'r2v'];
const IMAGE_MODE_OPTIONS: Mode[] = ['t2i', 'i2i'];
const IN_PROGRESS_POLL_MS = 5000;
const IN_PROGRESS_LIMIT = 8;
const RECENT_SAMPLE_LIMIT = 20;
const TEMPLATE_LIMIT = 6;
const DASHBOARD_ROW_THUMB_SIZES = '(max-width: 640px) calc(100vw - 48px), 112px';
const DASHBOARD_CARD_THUMB_SIZES = '(max-width: 640px) calc(100vw - 48px), (max-width: 1280px) 50vw, 360px';
const DASHBOARD_TOOL_THUMB_SIZES = '104px';

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
    generateAudio: 'Generate audio',
    useLastVideo: 'Use last video settings',
    startVideoTemplate: 'Start from template',
    newImage: 'New image',
    useLastImage: 'Use last image settings',
    startImageTemplate: 'Start from template',
  },
  modes: {
    t2v: 'T2V',
    i2v: 'I2V',
    ref2v: 'REF',
    fl2v: 'F/L',
    a2v: 'A2V',
    extend: 'Extend',
    retake: 'Retake',
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
      video: 'Video',
      image: 'Image',
      character: 'Character',
      angle: 'Angle',
      upscale: 'Upscale',
      audio: 'Audio',
    },
  },
  insights: {
    title: 'Insights',
    spendToday: 'Spend today',
    spend30: 'Spend 30d',
    avgCost: 'Avg cost',
    runway: 'Runway',
    today: 'Today',
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
  tools: {
    title: 'Tools',
    subtitle: 'Prepare stronger source assets before you generate.',
    allTools: 'Open all tools',
    characterTitle: 'Create a character',
    characterBody: 'Build a reusable character reference for image and video workflows.',
    characterBadge: 'Character reference',
    angleTitle: 'Change angle view',
    angleBody: 'Generate a better camera angle from an existing image.',
    angleBadge: 'New viewpoint',
  },
  engines: {
    title: 'Engine status',
    allOk: 'All engines operational',
    viewStatus: 'View status',
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
type RecentTypeTab = 'all' | JobSurface;

const RECENT_TYPE_TABS: readonly RecentTypeTab[] = ['all', 'video', 'image', 'character', 'angle', 'audio'];
const TOOL_CHARACTER_PREVIEW_URL = '/assets/tools/character-builder-workspace.png';
const TOOL_ANGLE_PREVIEW_URL = '/assets/tools/angle-workspace.png';

type TemplateEntry = {
  id: string;
  surface?: JobSurface | null;
  href?: string | null;
  demo?: boolean;
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

function resolveWorkspaceJobHref(jobId: string, surface?: JobSurface | null): string {
  return surface === 'audio'
    ? `/app/audio?job=${encodeURIComponent(jobId)}`
    : `/app?job=${encodeURIComponent(jobId)}`;
}

function resolveRemixEntryHref(entry: MediaLightboxEntry): string | null {
  const jobId = entry.jobId ?? entry.id;
  if (!jobId) return null;
  if (entry.curated && entry.videoUrl) {
    return `/app?from=${encodeURIComponent(jobId)}`;
  }
  return resolveWorkspaceJobHref(jobId, entry.surface);
}

function resolveDashboardJobSurface(job: Job): JobSurface {
  return deriveJobSurface({
    surface: job.surface,
    jobId: job.jobId,
    engineId: job.engineId ?? null,
    videoUrl: job.videoUrl ?? null,
    renderIds: job.renderIds,
  });
}

function resolveGroupSurface(group: GroupSummary): JobSurface {
  if (group.hero.job) {
    return resolveDashboardJobSurface(group.hero.job);
  }
  if (group.hero.audioUrl) return 'audio';
  if (group.hero.videoUrl) return 'video';
  return 'image';
}

export default function DashboardPage() {
  const { t } = useI18n();
  const copy = t('workspace.dashboard', DEFAULT_DASHBOARD_COPY) as DashboardCopy;
  const router = useRouter();
  const { loading: authLoading, user } = useRequireAuth({ redirectIfLoggedOut: false });
  const { data: enginesData, error: enginesError } = useEngines('video', { includeAverages: false });
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
  const [, setTemplates] = useState<TemplateEntry[]>([]);
  const [walletSummary, setWalletSummary] = useState<{ balance: number; currency: string } | null>(null);
  const [memberSummary, setMemberSummary] = useState<{ spentToday?: number; spent30?: number } | null>(null);
  const [recentTab, setRecentTab] = useState<RecentTypeTab>('all');
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
      if (recentTab !== 'all') return resolveGroupSurface(group) === recentTab;
      return true;
    });
    return filtered;
  }, [normalizedGroups, recentTab]);

  const displayRecentGroups = recentGroups;

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
                isValidating={isValidating}
                hasMore={Boolean(lastJobsPage?.nextCursor)}
                onOpenGroup={(group) => setLightbox({ kind: 'group', group })}
                onSaveTemplate={handleSaveTemplate}
                onLoadMore={() => setSize((size) => size + 1)}
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
    <section className="rounded-card border border-hairline bg-surface p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">{copy.create.title}</h1>
          <p className="mt-1 text-sm text-text-secondary">{copy.create.subtitle}</p>
        </div>
        <ButtonLink
          href="/app/audio"
          prefetch={false}
          variant="outline"
          size="sm"
          className="border-[var(--brand-border)] px-4 text-brand hover:bg-[var(--brand-soft)] hover:text-brand"
        >
          <AudioWaveform className="h-4 w-4" aria-hidden />
          {copy.create.generateAudio ?? DEFAULT_DASHBOARD_COPY.create.generateAudio}
        </ButtonLink>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <CreateVideoCard
          copy={copy}
          engines={videoEngines}
          selectedEngineId={selectedVideoEngineId}
          selectedMode={selectedVideoMode}
          hasStoredForm={hasStoredVideoForm}
          reserveLastSettingsSlot={hasStoredVideoForm || hasStoredImageForm}
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
          reserveLastSettingsSlot={hasStoredVideoForm || hasStoredImageForm}
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
  reserveLastSettingsSlot,
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
  reserveLastSettingsSlot: boolean;
  canStart: boolean;
  onModeChange: (mode: Mode) => void;
  onEngineChange: (engineId: string) => void;
  onNew: () => void;
  onUseLast: () => void;
}) {
  return (
    <div className="flex h-full min-h-[312px] flex-col rounded-card border border-hairline bg-surface-2/60 p-4">
      <div className="min-h-[58px]">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">{copy.create.videoTitle}</h2>
          <p className="mt-1 text-sm text-text-secondary">{copy.create.videoSubtitle}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-1 flex-col">
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
              a2v: copy.modes.a2v,
              extend: copy.modes.extend,
              retake: copy.modes.retake,
              r2v: copy.modes.r2v,
            }}
            showModeSelect={false}
            variant="bar"
          />
        </div>
        <div className="mt-auto pt-3">
          <Button
            type="button"
            onClick={onNew}
            disabled={!canStart}
            size="md"
            className={clsx(
              'w-full px-5 py-3 text-base font-semibold',
              !canStart && '!bg-surface-disabled text-text-muted shadow-none hover:!bg-surface-disabled disabled:opacity-100'
            )}
          >
            <Sparkles className="h-4 w-4" aria-hidden />
            {copy.create.newVideo}
          </Button>
          {reserveLastSettingsSlot ? (
            <div className="mt-2 min-h-[36px]">
              {hasStoredForm ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onUseLast}
                  className="min-h-[36px] border-hairline px-4 text-sm font-semibold text-text-secondary hover:border-text-muted hover:bg-surface-2 hover:text-text-primary"
                >
                  <Clock3 className="h-4 w-4" aria-hidden />
                  {copy.create.useLastVideo}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
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
  reserveLastSettingsSlot,
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
  reserveLastSettingsSlot: boolean;
  canStart: boolean;
  onModeChange: (mode: Mode) => void;
  onEngineChange: (engineId: string) => void;
  onNew: () => void;
  onUseLast: () => void;
}) {
  return (
    <div className="flex h-full min-h-[312px] flex-col rounded-card border border-hairline bg-surface-2/60 p-4">
      <div className="min-h-[58px]">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">{copy.create.imageTitle}</h2>
          <p className="mt-1 text-sm text-text-secondary">{copy.create.imageSubtitle}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-1 flex-col">
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
        <div className="mt-auto pt-3">
          <Button
            type="button"
            onClick={onNew}
            disabled={!canStart}
            size="md"
            className={clsx(
              'w-full px-5 py-3 text-base font-semibold',
              !canStart && '!bg-surface-disabled text-text-muted shadow-none hover:!bg-surface-disabled disabled:opacity-100'
            )}
          >
            <Sparkles className="h-4 w-4" aria-hidden />
            {copy.create.newImage}
          </Button>
          {reserveLastSettingsSlot ? (
            <div className="mt-2 min-h-[36px]">
              {hasStoredForm ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onUseLast}
                  className="min-h-[36px] border-hairline px-4 text-sm font-semibold text-text-secondary hover:border-text-muted hover:bg-surface-2 hover:text-text-primary"
                >
                  <Clock3 className="h-4 w-4" aria-hidden />
                  {copy.create.useLastImage}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SectionGlyph({ tone = 'brand' }: { tone?: 'brand' | 'success' | 'warning' }) {
  return (
    <span
      className={clsx(
        'flex h-6 w-6 shrink-0 items-center justify-center',
        tone === 'brand' && 'text-brand',
        tone === 'success' && 'text-success',
        tone === 'warning' && 'text-warning'
      )}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
        <path
          d="M5.5 5.5v13"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.28"
        />
        <path
          d="M10 7h8.5M10 12h6.5M10 17h8.5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

function MetricDot({ tone = 'brand' }: { tone?: 'brand' | 'accent' | 'success' | 'muted' }) {
  return (
    <span
      className={clsx(
        'h-1.5 w-1.5 shrink-0 rounded-full',
        tone === 'brand' && 'bg-brand',
        tone === 'accent' && 'bg-accent',
        tone === 'success' && 'bg-success',
        tone === 'muted' && 'bg-text-muted'
      )}
      aria-hidden
    />
  );
}

function InProgressVisual() {
  return (
    <div className="relative hidden h-28 w-72 shrink-0 sm:block" aria-hidden>
      <svg viewBox="0 0 360 180" className="h-full w-full overflow-visible">
        <defs>
          <linearGradient id="dashboardProgressGlow" x1="36" x2="326" y1="121" y2="129" gradientUnits="userSpaceOnUse">
            <stop stopColor="#F4F8FF" stopOpacity="0.12" />
            <stop offset="0.22" stopColor="#CADAF5" stopOpacity="0.58" />
            <stop offset="0.68" stopColor="#AFC6EC" stopOpacity="0.72" />
            <stop offset="1" stopColor="#D8E7FF" stopOpacity="0.34" />
          </linearGradient>
          <linearGradient id="dashboardProgressCard" x1="101" x2="278" y1="42" y2="142" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FBFDFF" />
            <stop offset="0.34" stopColor="#DCE7F8" />
            <stop offset="0.72" stopColor="#AFC3E4" />
            <stop offset="1" stopColor="#7895C1" />
          </linearGradient>
          <linearGradient id="dashboardProgressCardEdge" x1="99" x2="272" y1="63" y2="151" gradientUnits="userSpaceOnUse">
            <stop stopColor="#A8BFE2" stopOpacity="0.88" />
            <stop offset="1" stopColor="#506D99" stopOpacity="0.96" />
          </linearGradient>
          <linearGradient id="dashboardProgressPlay" x1="126" x2="193" y1="65" y2="111" gradientUnits="userSpaceOnUse">
            <stop stopColor="#7FA0D4" />
            <stop offset="1" stopColor="#4F6F9D" />
          </linearGradient>
          <linearGradient id="dashboardProgressImageCard" x1="253" x2="331" y1="78" y2="137" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FBFDFF" />
            <stop offset="0.56" stopColor="#DCE7F8" />
            <stop offset="1" stopColor="#AFC3E4" />
          </linearGradient>
          <linearGradient id="dashboardProgressMiniPlayer" x1="85" x2="300" y1="35" y2="119" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFFFFF" stopOpacity="0.92" />
            <stop offset="0.52" stopColor="#D7E1F3" stopOpacity="0.86" />
            <stop offset="1" stopColor="#8EA8CF" stopOpacity="0.9" />
          </linearGradient>
          <radialGradient id="dashboardProgressOrb" cx="0" cy="0" r="1" gradientTransform="matrix(27 0 0 27 77 121)" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFFFFF" stopOpacity="0.92" />
            <stop offset="0.34" stopColor="#A0B9DD" />
            <stop offset="1" stopColor="#6685B7" />
          </radialGradient>
          <filter
            id="dashboardProgressSoftShadow"
            x="24"
            y="22"
            width="314"
            height="146"
            filterUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
          >
            <feDropShadow dx="0" dy="14" stdDeviation="10" floodColor="#637FA8" floodOpacity="0.22" />
          </filter>
          <filter
            id="dashboardProgressTinyShadow"
            x="48"
            y="20"
            width="276"
            height="116"
            filterUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
          >
            <feDropShadow dx="0" dy="9" stdDeviation="7" floodColor="#637FA8" floodOpacity="0.16" />
          </filter>
          <filter
            id="dashboardProgressGlowBlur"
            x="0"
            y="88"
            width="360"
            height="86"
            filterUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>
        <ellipse cx="178" cy="132" rx="152" ry="27" fill="url(#dashboardProgressGlow)" filter="url(#dashboardProgressGlowBlur)" />
        <ellipse cx="178" cy="129" rx="136" ry="22" fill="url(#dashboardProgressGlow)" opacity="0.72" />
        <g filter="url(#dashboardProgressTinyShadow)">
          <g transform="rotate(-16 130 70)" opacity="0.42">
            <rect x="82" y="42" width="105" height="62" rx="16" fill="url(#dashboardProgressMiniPlayer)" stroke="#8FACD7" strokeOpacity="0.24" strokeWidth="2" />
            <rect x="97" y="58" width="36" height="24" rx="7" fill="#6686BD" opacity="0.72" />
            <path d="M112 64v12l11-6Z" fill="#FFFFFF" opacity="0.88" />
            <path d="M143 64h26" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" opacity="0.52" />
            <path d="M100 91h67" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" opacity="0.7" />
            <path d="M100 91h35" stroke="#4F6E9B" strokeWidth="4" strokeLinecap="round" opacity="0.74" />
          </g>
          <g transform="rotate(10 250 61)" opacity="0.5">
            <rect x="198" y="36" width="112" height="64" rx="17" fill="url(#dashboardProgressMiniPlayer)" stroke="#8FACD7" strokeOpacity="0.28" strokeWidth="2" />
            <rect x="214" y="52" width="39" height="26" rx="7" fill="#6686BD" opacity="0.74" />
            <path d="M230 58v13l12-6.5Z" fill="#FFFFFF" opacity="0.9" />
            <path d="M263 58h28" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" opacity="0.52" />
            <path d="M217 88h70" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" opacity="0.72" />
            <path d="M217 88h42" stroke="#4F6E9B" strokeWidth="4" strokeLinecap="round" opacity="0.78" />
          </g>
          <g transform="rotate(-2 199 44)" opacity="0.34">
            <rect x="146" y="23" width="104" height="54" rx="15" fill="url(#dashboardProgressMiniPlayer)" stroke="#8FACD7" strokeOpacity="0.2" strokeWidth="2" />
            <rect x="160" y="37" width="34" height="22" rx="7" fill="#6686BD" opacity="0.62" />
            <path d="M174 42v11l10-5.5Z" fill="#FFFFFF" opacity="0.86" />
            <path d="M202 43h27" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" opacity="0.48" />
            <path d="M162 67h59" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" opacity="0.62" />
            <path d="M162 67h31" stroke="#4F6E9B" strokeWidth="3.5" strokeLinecap="round" opacity="0.7" />
          </g>
        </g>
        <circle cx="77" cy="121" r="25" fill="url(#dashboardProgressOrb)" opacity="0.95" />
        <circle cx="69" cy="112" r="7" fill="#FFFFFF" opacity="0.55" />
        <g filter="url(#dashboardProgressSoftShadow)" transform="rotate(-7 186 91)">
          <rect x="105" y="50" width="173" height="94" rx="23" fill="url(#dashboardProgressCardEdge)" />
          <path
            d="M119 42h139c12 0 22 10 22 22v57c0 12-10 22-22 22H119c-12 0-22-10-22-22V64c0-12 10-22 22-22Z"
            fill="url(#dashboardProgressCard)"
            stroke="#8FACD7"
            strokeOpacity="0.42"
            strokeWidth="2.4"
          />
          <path
            d="M123 48h128c11 0 20 9 20 20v7c-38 8-102 9-164-2v-5c0-11 6-20 16-20Z"
            fill="#FFFFFF"
            opacity="0.22"
          />
          <rect
            x="126"
            y="66"
            width="66"
            height="45"
            rx="10"
            fill="url(#dashboardProgressPlay)"
            stroke="#FFFFFF"
            strokeOpacity="0.76"
            strokeWidth="2"
          />
          <path d="M152 78v21l20-10.5Z" fill="#FFFFFF" opacity="0.94" />
          <path d="M130 122h96" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round" opacity="0.92" />
          <path d="M130 122h58" stroke="#4F6E9B" strokeWidth="6" strokeLinecap="round" opacity="0.9" />
          <path d="M199 122h21" stroke="#4F6E9B" strokeWidth="6" strokeLinecap="round" opacity="0.42" />
          <path d="M205 86h38" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" opacity="0.7" />
          <path d="M207 99h28" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" opacity="0.46" />
          <circle cx="232" cy="68" r="5.4" fill="#FFFFFF" opacity="0.74" />
          <circle cx="252" cy="70" r="4.4" fill="#D8E7FF" opacity="0.8" />
          <circle cx="242" cy="79" r="3" fill="#FFFFFF" opacity="0.46" />
        </g>
        <g filter="url(#dashboardProgressSoftShadow)" transform="rotate(4 292 105)">
          <rect
            x="253"
            y="79"
            width="78"
            height="59"
            rx="13"
            fill="url(#dashboardProgressImageCard)"
            stroke="#8FACD7"
            strokeOpacity="0.36"
            strokeWidth="2"
          />
          <path d="M265 125l23-26 18 21 10-11 7 16Z" fill="#B6C9E9" opacity="0.92" />
          <path d="M268 125l20-22 15 17 8-8 10 13Z" fill="#FFFFFF" opacity="0.34" />
          <circle cx="272" cy="92" r="5.5" fill="#FFFFFF" opacity="0.9" />
          <path
            d="m312 88 5 3 5-3-3 5 3 5-5-3-5 3 3-5Z"
            fill="#FFFFFF"
            opacity="0.9"
          />
        </g>
        <circle cx="49" cy="105" r="2.7" fill="var(--brand)" opacity="0.68" />
        <path d="M57 99h10M62 94v10" stroke="#C4D4EF" strokeWidth="2.1" strokeLinecap="round" opacity="0.72" />
        <circle cx="291" cy="50" r="2.2" fill="#FFFFFF" opacity="0.64" />
        <circle cx="306" cy="47" r="1.7" fill="var(--brand)" opacity="0.5" />
        <path
          d="M329 104c8 1 13 5 14 12 1 7-3 13-9 16-7 3-14 0-17-6-4-8 2-17 12-22Z"
          fill="#D5E5FF"
          opacity="0.78"
        />
        <path
          d="M330 108c5 1 9 4 9 9s-3 9-8 11c-5 1-10-1-12-6-2-6 3-12 11-14Z"
          fill="#FFFFFF"
          opacity="0.45"
        />
      </svg>
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
  if (!jobs.length) {
    return (
      <section className="overflow-hidden rounded-card border border-hairline bg-surface p-4 shadow-card sm:p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <SectionGlyph />
              <h2 className="text-lg font-semibold text-text-primary">{copy.inProgress.title}</h2>
            </div>
            <p className="mt-1 text-sm text-text-secondary">{copy.inProgress.empty}</p>
          </div>
          <InProgressVisual />
        </div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-card border border-hairline bg-surface shadow-card">
      <div className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <SectionGlyph />
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-text-primary">{copy.inProgress.title}</h2>
            <p className="mt-0.5 text-sm text-text-secondary">
              {`${jobs.length} active render${jobs.length > 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
        <span className="hidden items-center gap-1.5 rounded-pill border border-hairline bg-surface-2 px-2.5 py-1 text-xs font-semibold text-text-secondary sm:inline-flex">
          Live queue
        </span>
      </div>
      <div className="stack-gap-sm px-4 py-3">
        {jobs.map((job) => (
          <InProgressRow key={job.jobId} job={job} copy={copy} onOpen={onOpen} />
        ))}
      </div>
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
    <div className="flex flex-col gap-3 rounded-input border border-hairline bg-surface-2/70 p-2.5 sm:flex-row sm:items-center">
      <div className="relative h-20 w-full overflow-hidden rounded-input border border-hairline bg-surface sm:h-16 sm:w-28">
        {job.thumbUrl ? (
          <Image src={job.thumbUrl} alt="" fill className="object-cover" sizes={DASHBOARD_ROW_THUMB_SIZES} />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-text-muted">{copy.actions.noPreview}</div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-sm font-semibold text-text-primary">{job.engineLabel}</p>
            <span className="shrink-0 rounded-pill border border-[var(--brand-border)] bg-[var(--brand-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-micro text-brand">
              {job.status ?? 'running'}
            </span>
          </div>
          {price ? <span className="text-xs font-semibold text-text-primary">{price}</span> : null}
        </div>
        <p className="mt-1 truncate text-xs text-text-muted">{prompt}</p>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface">
          <div className="h-full rounded-full bg-[image:var(--brand-gradient)]" style={{ width: `${progress}%` }} />
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
          className="border-hairline px-3 py-1.5 text-xs font-semibold text-text-secondary hover:bg-surface-2 hover:text-text-primary"
        >
          {copy.inProgress.open}
        </Button>
        <ButtonLink
          href={resolveWorkspaceJobHref(job.jobId, job.surface)}
          variant="outline"
          size="sm"
          className="border-hairline px-3 py-1.5 text-xs font-semibold text-text-secondary hover:bg-surface-2 hover:text-text-primary"
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
  tab: RecentTypeTab;
  onTabChange: (tab: RecentTypeTab) => void;
}) {
  return (
    <section className="rounded-card border border-hairline bg-surface p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-text-primary">{copy.recent.title}</h2>
        <ButtonLink
          href="/jobs"
          prefetch={false}
          variant="outline"
          size="sm"
          className="border-hairline px-3 py-1 text-xs font-semibold text-text-secondary hover:bg-surface-2 hover:text-text-primary"
        >
          {copy.recent.viewAll}
        </ButtonLink>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {RECENT_TYPE_TABS.map((value) => (
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
                : 'border border-hairline bg-surface text-text-secondary hover:border-text-muted hover:bg-surface-2 hover:text-text-primary'
            )}
          >
            {copy.recent.tabs[value]}
          </Button>
        ))}
      </div>

      {isLoading && !groups.length ? (
        <div className="mt-4 grid grid-gap-sm sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={`recent-skeleton-${index}`} className="h-[138px] rounded-card border border-hairline bg-surface-2/70" />
          ))}
        </div>
      ) : !groups.length ? (
        <p className="mt-4 text-sm text-text-secondary">{copy.recent.empty}</p>
      ) : (
        <div className="mt-4 grid grid-gap-sm sm:grid-cols-2 xl:grid-cols-3">
          {groups.map((group) => {
            const isCurated = Boolean(group.hero.job?.curated);
            const jobId = group.hero.jobId ?? group.hero.id;
            return (
              <div key={group.id} className="flex flex-col gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => onOpenGroup(group)}
                  className="relative min-h-0 h-auto w-full aspect-[1.9/1] overflow-hidden rounded-card border border-hairline bg-[#05070d] p-0"
                >
                  {group.hero.thumbUrl ? (
                    <Image src={group.hero.thumbUrl} alt="" fill className="object-contain" sizes={DASHBOARD_CARD_THUMB_SIZES} />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-text-muted">{copy.actions.noPreview}</div>
                  )}
                  <div className="absolute left-3 top-3 rounded-pill bg-surface-on-media-dark-60 px-2 py-1 text-[11px] font-semibold text-on-inverse">
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
                        className="border-hairline px-3 py-1 text-xs font-semibold text-text-secondary hover:bg-surface-2 hover:text-text-primary"
                      >
                        {copy.actions.download}
                      </ButtonLink>
                    ) : null}
                    {!isCurated ? (
                      <ButtonLink
                        href={resolveWorkspaceJobHref(jobId, group.hero.job?.surface ?? null)}
                        variant="outline"
                        size="sm"
                        className="border-hairline px-3 py-1 text-xs font-semibold text-text-secondary hover:bg-surface-2 hover:text-text-primary"
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
                        className="border-hairline px-3 py-1 text-xs font-semibold text-text-secondary hover:bg-surface-2 hover:text-text-primary"
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
            className="border-hairline px-4 text-sm font-semibold text-text-secondary hover:bg-surface-2 hover:text-text-primary"
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
  const metrics: Array<{ label: string; value: string; tone: 'brand' | 'accent' | 'success' | 'muted' }> = [
    { label: copy.insights.spendToday, value: spendToday, tone: 'brand' },
    { label: copy.insights.spend30, value: spend30, tone: 'accent' },
    { label: copy.insights.avgCost, value: avgCost, tone: 'muted' },
    { label: copy.insights.runway, value: runway, tone: 'success' },
  ];

  return (
    <section className="overflow-hidden rounded-card border border-hairline bg-surface shadow-card">
      <div className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-3">
        <div className="flex items-center gap-2.5">
          <SectionGlyph />
          <h3 className="text-lg font-semibold text-text-primary">{copy.insights.title}</h3>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-input border border-hairline bg-surface-2 px-2.5 py-1 text-xs font-semibold text-text-primary">
          {copy.insights.today ?? DEFAULT_DASHBOARD_COPY.insights.today}
          <CalendarDays className="h-3.5 w-3.5 text-text-muted" aria-hidden />
        </span>
      </div>
      <div className="grid gap-2 px-4 py-3 text-sm">
        {metrics.map((metric) => (
          <InsightRow
            key={metric.label}
            label={metric.label}
            value={metric.value}
            tone={metric.tone}
          />
        ))}
      </div>
      <div className="border-t border-hairline px-4 py-3">
        {runwayFallback ? (
          <p className="text-xs text-text-muted">{runwayFallback}</p>
        ) : null}
        {mostUsed ? (
          <div className="mt-2 flex items-center gap-2 text-xs text-text-muted">
            <MetricDot tone="brand" />
            <span>
              {copy.insights.mostUsed}: <span className="font-semibold text-text-primary">{mostUsed}</span>
            </span>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function InsightRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'brand' | 'accent' | 'success' | 'muted';
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-input border border-hairline bg-surface-2/70 px-3 py-2">
      <div className="flex min-w-0 items-center gap-2.5">
        <MetricDot tone={tone} />
        <span className="truncate text-text-muted">{label}</span>
      </div>
      <span className="shrink-0 font-semibold text-text-primary">{value}</span>
    </div>
  );
}

function ToolsPanel({ copy }: { copy: DashboardCopy }) {
  const tools = [
    {
      href: '/app/tools/character-builder',
      title: copy.tools.characterTitle,
      body: copy.tools.characterBody,
      badge: copy.tools.characterBadge,
      imageUrl: TOOL_CHARACTER_PREVIEW_URL,
      Icon: UserRound,
    },
    {
      href: '/app/tools/angle',
      title: copy.tools.angleTitle,
      body: copy.tools.angleBody,
      badge: copy.tools.angleBadge,
      imageUrl: TOOL_ANGLE_PREVIEW_URL,
      Icon: Camera,
    },
  ];

  return (
    <section className="overflow-hidden rounded-card border border-hairline bg-surface shadow-card">
      <div className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-3">
        <div className="flex items-center gap-2.5">
          <SectionGlyph />
          <h3 className="text-lg font-semibold text-text-primary">{copy.tools.title}</h3>
        </div>
        <span className="rounded-pill border border-hairline bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-text-muted">
          {tools.length}
        </span>
      </div>
      <div className="px-4 py-3">
        <p className="text-sm leading-5 text-text-secondary">{copy.tools.subtitle}</p>
        <div className="mt-3 flex flex-col gap-2">
          {tools.map(({ href, title, body, badge, imageUrl, Icon }) => (
            <Link
              key={href}
              href={href}
              prefetch={false}
              className="group flex gap-3 rounded-input border border-hairline bg-surface-2/70 p-2.5 transition-colors hover:border-border-hover hover:bg-surface"
            >
              <div className="relative h-[74px] w-[104px] shrink-0 overflow-hidden rounded-[6px] bg-[#05070d]">
                <Image
                  src={imageUrl}
                  alt=""
                  fill
                  className="object-cover object-top transition-transform duration-200 group-hover:scale-[1.03]"
                  sizes={DASHBOARD_TOOL_THUMB_SIZES}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-text-primary">
                      <Icon className="h-3.5 w-3.5 shrink-0 text-brand" aria-hidden />
                      <span className="line-clamp-2">{title}</span>
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs leading-4 text-text-muted">{body}</p>
                  </div>
                  <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-brand" aria-hidden />
                </div>
                <span className="mt-2 inline-flex rounded-pill border border-hairline bg-surface px-2 py-0.5 text-[11px] font-semibold text-text-secondary">
                  {badge}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
      <div className="border-t border-hairline px-4 py-3">
        <Link href="/app/tools" prefetch={false} className="inline-flex items-center gap-2 text-xs font-semibold text-brand hover:underline">
          {copy.tools.allTools}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
    </section>
  );
}

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
      <section className="overflow-hidden rounded-card border border-warning-border bg-surface shadow-card">
        <div className="flex items-center gap-2.5 border-b border-warning-border px-4 py-3">
          <SectionGlyph tone="warning" />
          <h3 className="text-lg font-semibold text-text-primary">{copy.engines.title}</h3>
        </div>
        <p className="px-4 py-3 text-sm text-warning">{copy.engines.error}</p>
      </section>
    );
  }

  const flagged = engines.filter((engine) => isEngineAlert(engine));

  return (
    <section className="overflow-hidden rounded-card border border-hairline bg-surface shadow-card">
      <div className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-3">
        <div className="flex items-center gap-2.5">
          <SectionGlyph tone="success" />
          <h3 className="text-lg font-semibold text-text-primary">{copy.engines.title}</h3>
        </div>
      </div>
      {flagged.length === 0 ? (
        <div className="px-4 py-3">
          <div className="flex items-center justify-between gap-3 rounded-input border border-success-border bg-success-bg px-3 py-2.5">
            <p className="flex items-center gap-2 text-sm font-medium text-text-primary">
              <MetricDot tone="success" />
              {copy.engines.allOk}
            </p>
            <span className="rounded-pill bg-surface px-2 py-1 text-[11px] font-semibold text-success">OK</span>
          </div>
        </div>
      ) : (
        <div className="space-y-2 px-4 py-3">
          {flagged.map((engine) => (
            <div key={engine.id} className="flex items-center justify-between gap-3 rounded-input border border-hairline bg-surface-2/70 px-3 py-2 text-xs">
              <span className="min-w-0 truncate font-semibold text-text-primary">{engine.label}</span>
              <span className="inline-flex shrink-0 items-center gap-1 text-text-muted">
                <span>
                  {engine.status}
                  {typeof engine.queueDepth === 'number'
                    ? ` · ${copy.engines.queueLabel.replace('{count}', String(engine.queueDepth))}`
                    : ''}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function buildEntriesFromJob(job: Job): MediaLightboxEntry[] {
  const imageUrl =
    Array.isArray(job.renderIds) && job.renderIds.length
      ? job.renderIds.find((value): value is string => typeof value === 'string' && value.length > 0) ?? undefined
      : undefined;

  return [
    {
      id: job.jobId,
      jobId: job.jobId,
      surface: job.surface ?? null,
      label: job.engineLabel,
      videoUrl: job.videoUrl ?? undefined,
      imageUrl,
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
  return group.members.map((member) => {
    const imageUrl =
      Array.isArray(member.job?.renderIds) && member.job.renderIds.length
        ? member.job.renderIds.find((value): value is string => typeof value === 'string' && value.length > 0) ?? undefined
        : undefined;

    return {
      id: member.id,
      jobId: member.jobId ?? member.id,
      surface: member.job?.surface ?? null,
      label:
        typeof member.iterationIndex === 'number'
          ? versionLabel.replace('{index}', String(member.iterationIndex + 1))
          : member.engineLabel ?? member.id,
      videoUrl: member.videoUrl ?? undefined,
      imageUrl,
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
    };
  });
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
    version: 2,
    engineId,
    mode: mode === 't2i' || mode === 'i2i' ? mode : 't2i',
    prompt: '',
    numImages: 1,
    aspectRatio: null,
    resolution: null,
    seed: null,
    outputFormat: null,
    enableWebSearch: false,
    thinkingLevel: null,
    limitGenerations: false,
    referenceSlots: [],
    characterReferences: [],
  };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.imageForm);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const record = parsed as Record<string, unknown>;
        if (typeof record.prompt === 'string') {
          payload.prompt = record.prompt;
        }
        if (typeof record.numImages === 'number' && Number.isFinite(record.numImages)) {
          payload.numImages = Math.round(record.numImages);
        }
        if (typeof record.aspectRatio === 'string' || record.aspectRatio === null) {
          payload.aspectRatio = record.aspectRatio;
        }
        if (typeof record.resolution === 'string' || record.resolution === null) {
          payload.resolution = record.resolution;
        }
        if (typeof record.seed === 'number' && Number.isFinite(record.seed)) {
          payload.seed = Math.round(record.seed);
        }
        if (typeof record.outputFormat === 'string' || record.outputFormat === null) {
          payload.outputFormat = record.outputFormat;
        }
        if (record.enableWebSearch === true) {
          payload.enableWebSearch = true;
        }
        if (typeof record.thinkingLevel === 'string' || record.thinkingLevel === null) {
          payload.thinkingLevel = record.thinkingLevel;
        }
        if (record.limitGenerations === true) {
          payload.limitGenerations = true;
        }
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

function truncate(value: string, limit: number): string {
  if (value.length <= limit) return value;
  const slice = value.slice(0, limit - 1).trimEnd();
  return `${slice}…`;
}
