'use client';
/* eslint-disable @next/next/no-img-element */

import Link from 'next/link';
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { HeaderBar } from '@/components/HeaderBar';
import { AppSidebar } from '@/components/AppSidebar';
import { getJobStatus, useEngines, useInfiniteJobs } from '@/lib/api';
import { groupJobsIntoSummaries } from '@/lib/job-groups';
import { GroupedJobCard } from '@/components/GroupedJobCard';
import { normalizeGroupSummaries } from '@/lib/normalize-group-summary';
import type { GroupSummary } from '@/types/groups';
import type { Job } from '@/types/jobs';
import type { EngineCaps } from '@/types/engines';
import { supabase } from '@/lib/supabaseClient';
import { CURRENCY_LOCALE } from '@/lib/intl';
import { MediaLightbox, type MediaLightboxEntry } from '@/components/MediaLightbox';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useI18n } from '@/lib/i18n/I18nProvider';

const DEFAULT_DASHBOARD_COPY = {
  quickActions: {
    create: 'Create a video',
    jobs: 'View latest renders',
    billing: 'Add funds',
  },
  wallet: {
    title: 'Wallet & Member',
    balanceLabel: 'Current balance',
    tierLabel: 'Member tier',
    savingsLabel: 'Rolling 30-day savings: {percent}%',
    manageCta: 'Manage billing',
    memberFallback: 'Member',
  },
  spend: {
    title: 'Spend at a glance',
    today: 'Today',
    last30: 'Last 30 days',
  },
  latest: {
    title: 'Latest renders',
    viewAll: 'View all →',
    error: 'Failed to load latest renders. Please retry.',
    retry: 'Retry',
    curatedHint: 'Starter renders curated by the MaxVideo team appear here until you create your own.',
    emptyHint: 'Start a generation to populate your latest renders.',
  },
  engines: {
    title: 'Engines status',
    error: 'Failed to load engines.',
    queueLabel: 'queue: {count}',
  },
  actions: {
    retry: 'Retry',
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

export default function DashboardPage() {
  const { t } = useI18n();
  const copy = t('workspace.dashboard', DEFAULT_DASHBOARD_COPY) as DashboardCopy;
  const { data: enginesData, error: enginesError } = useEngines();
  const { data: jobsPages, error: jobsError, isLoading, mutate: mutateJobs } = useInfiniteJobs(9, {
    type: 'video',
  });
  const { loading: authLoading } = useRequireAuth();

  const engineLookup = useMemo(() => {
    const byId = new Map<string, EngineCaps>();
    const byLabel = new Map<string, EngineCaps>();
    (enginesData?.engines ?? []).forEach((engine) => {
      byId.set(engine.id, engine);
      byLabel.set(engine.label.toLowerCase(), engine);
    });
    return { byId, byLabel };
  }, [enginesData?.engines]);


  const jobs = useMemo(() => jobsPages?.[0]?.jobs ?? [], [jobsPages]);
  const hasCuratedJobs = useMemo(() => jobs.some((job) => job.curated), [jobs]);
  const { groups: apiGroups } = useMemo(
    () => groupJobsIntoSummaries(jobs, { includeSinglesAsGroups: true }),
    [jobs]
  );
  const quickActions = useMemo(
    () => [
      { id: 'create', href: '/app', icon: 'generate' },
      { id: 'jobs', href: '/jobs', icon: 'jobs' },
      { id: 'billing', href: '/billing', icon: 'wallet' },
    ],
    []
  );

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleHidden = () => {
      void mutateJobs();
    };
    window.addEventListener('jobs:hidden', handleHidden);
    return () => window.removeEventListener('jobs:hidden', handleHidden);
  }, [mutateJobs]);

  const groupedJobs = useMemo(
    () =>
      [...apiGroups]
        .filter((group) => group.members.length > 0)
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    [apiGroups]
  );

  const normalizedGroupedJobs = useMemo(() => normalizeGroupSummaries(groupedJobs), [groupedJobs]);
  const [walletSummary, setWalletSummary] = useState<{ balance: number; currency: string } | null>(null);
  const [memberSummary, setMemberSummary] = useState<{
    tier: string;
    savingsPct: number;
    spent30?: number;
    spentToday?: number;
  } | null>(null);
  const [lightbox, setLightbox] = useState<{ kind: 'group'; group: GroupSummary } | { kind: 'job'; job: Job } | null>(null);
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
  const placeholderIds = useMemo(() => Array.from({ length: 6 }, (_, index) => `dashboard-placeholder-${index}`), []);
  const isInitialLoading = isLoading && jobs.length === 0 && groupedJobs.length === 0;
  const latestGroups = useMemo(() => normalizedGroupedJobs.slice(0, 12), [normalizedGroupedJobs]);
  const latestSkeletonCount =
    isInitialLoading || (isLoading && latestGroups.length === 0) ? placeholderIds.length : 0;
  const showEmptyLatest = !isLoading && latestGroups.length === 0;
  const formatCurrency = useCallback((amount: number, currencyCode?: string) => {
    const safeCurrency = currencyCode ?? 'USD';
    try {
      return new Intl.NumberFormat(CURRENCY_LOCALE, { style: 'currency', currency: safeCurrency }).format(amount);
    } catch {
      return `${safeCurrency} ${amount.toFixed(2)}`;
    }
  }, []);
  const currencyCode = walletSummary?.currency ?? 'USD';
  const balanceDisplay = formatCurrency(walletSummary?.balance ?? 0, currencyCode);
  const spendTodayDisplay = formatCurrency(memberSummary?.spentToday ?? 0, currencyCode);
  const spend30Display = formatCurrency(memberSummary?.spent30 ?? 0, currencyCode);

  useEffect(() => {
    if (authLoading) return;

    let mounted = true;

    const fetchAccountState = async (token?: string | null) => {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      try {
        const [walletRes, memberRes] = await Promise.all([
          fetch('/api/wallet', { headers }).then((r) => {
            if (!r.ok) throw new Error('wallet request failed');
            return r.json();
          }),
          fetch('/api/member-status', { headers }).then((r) => {
            if (!r.ok) throw new Error('member status request failed');
            return r.json();
          }),
        ]);
        if (!mounted) return;
        setWalletSummary({
          balance:
            typeof walletRes.balance === 'number'
              ? walletRes.balance
              : Number(walletRes.balance ?? 0),
          currency:
            typeof walletRes.currency === 'string'
              ? walletRes.currency.toUpperCase()
              : 'USD',
        });
        setMemberSummary({
          tier: typeof memberRes.tier === 'string' ? memberRes.tier : 'Member',
          savingsPct:
            typeof memberRes.savingsPct === 'number' ? memberRes.savingsPct : 0,
          spent30:
            typeof memberRes.spent30 === 'number' ? memberRes.spent30 : undefined,
          spentToday:
            typeof memberRes.spentToday === 'number'
              ? memberRes.spentToday
              : undefined,
        });
      } catch {
        if (!mounted) return;
        setWalletSummary(null);
        setMemberSummary(null);
      }
    };

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      void fetchAccountState(data.session?.access_token);
    });

    const { data: authSubscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        void fetchAccountState(session?.access_token);
      }
    );

    const handleInvalidate = async () => {
      const { data } = await supabase.auth.getSession();
      await fetchAccountState(data.session?.access_token);
    };
    window.addEventListener('wallet:invalidate', handleInvalidate);

    return () => {
      mounted = false;
      authSubscription?.subscription.unsubscribe();
      window.removeEventListener('wallet:invalidate', handleInvalidate);
    };
  }, [authLoading]);

  if (authLoading) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <HeaderBar />
      <div className="flex flex-1">
        <AppSidebar />
        <main className="flex-1 overflow-y-auto p-5 lg:p-7">
          <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {quickActions.map((action) => (
              <QuickAction
                key={action.id}
                href={action.href}
                icon={action.icon}
                label={copy.quickActions[action.id as keyof DashboardCopy['quickActions']]}
              />
            ))}
          </div>

          {/* Wallet & Member and Spend first */}
          <section className="mb-7 grid gap-4 md:grid-cols-2">
            <div className="rounded-card border border-border bg-white p-4 shadow-card">
              <h3 className="mb-2 font-semibold text-text-primary">{copy.wallet.title}</h3>
              <div className="flex items-center justify-between text-sm text-text-secondary">
                <div>
                  <p>{copy.wallet.balanceLabel}</p>
                  <p className="text-2xl font-semibold text-text-primary">{balanceDisplay}</p>
                </div>
                <div className="text-right">
                  <p>{copy.wallet.tierLabel}</p>
                  <p className="text-2xl font-semibold text-text-primary">{memberSummary?.tier ?? copy.wallet.memberFallback}</p>
                  <p className="text-xs text-text-muted">
                    {copy.wallet.savingsLabel.replace('{percent}', String(memberSummary?.savingsPct ?? 0))}
                  </p>
                </div>
              </div>
              <div className="mt-3">
                <Link href="/billing" className="rounded-input border border-border px-3 py-2 text-sm font-medium text-text-primary hover:bg-bg">
                  {copy.wallet.manageCta}
                </Link>
              </div>
            </div>
            <div className="rounded-card border border-border bg-white p-4 shadow-card">
              <h3 className="mb-2 font-semibold text-text-primary">{copy.spend.title}</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-input border border-border bg-bg p-3">
                  <p className="text-text-muted">{copy.spend.today}</p>
                  <p className="text-xl font-semibold text-text-primary">{spendTodayDisplay}</p>
                </div>
                <div className="rounded-input border border-border bg-bg p-3">
                  <p className="text-text-muted">{copy.spend.last30}</p>
                  <p className="text-xl font-semibold text-text-primary">{spend30Display}</p>
                </div>
              </div>
            </div>
          </section>

          {/* Latest renders below, with smaller thumbnails */}
          <section className="mb-7">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text-primary">{copy.latest.title}</h2>
              <Link href="/jobs" className="text-sm font-medium text-accent hover:underline">
                {copy.latest.viewAll}
              </Link>
            </div>
            {jobsError ? (
              <div className="rounded-card border border-border bg-white p-4 text-state-warning">
                {copy.latest.error}
                <button
                  type="button"
                  onClick={() => location.reload()}
                  className="ml-3 rounded-input border border-border px-2 py-1 text-sm hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {copy.actions.retry}
                </button>
              </div>
            ) : (
              <div className="flex w-full gap-4 overflow-x-auto pb-2">
                {(showEmptyLatest || latestSkeletonCount > 0) &&
                  placeholderIds
                    .slice(0, showEmptyLatest ? placeholderIds.length : latestSkeletonCount)
                    .map((id) => (
                      <div
                        key={id}
                        className="flex h-full min-w-[280px] flex-shrink-0 flex-col overflow-hidden rounded-card border border-border bg-white/60"
                      >
                        <div className="relative" style={{ aspectRatio: '16 / 9' }}>
                        <div className="skeleton absolute inset-0" />
                      </div>
                      <div className="border-t border-border bg-white/70 px-3 py-2">
                        <div className="h-3 w-24 rounded-full bg-neutral-200" />
                      </div>
                    </div>
                  ))}
                {latestGroups.map((group) => {
                  const heroEngineId = group.hero.engineId ?? null;
                  const heroEngineLabelKey = group.hero.engineLabel?.toLowerCase?.() ?? null;
                  const heroEngine = heroEngineId
                    ? engineLookup.byId.get(heroEngineId)
                    : heroEngineLabelKey
                      ? engineLookup.byLabel.get(heroEngineLabelKey)
                      : undefined;
                  return (
                    <div key={`group-${group.id}`} className="min-w-[280px] flex-shrink-0 md:min-w-[320px]">
                      <GroupedJobCard
                        group={group}
                        engine={heroEngine}
                        actionMenu={false}
                        onOpen={(nextGroup) => setLightbox({ kind: 'group', group: nextGroup })}
                      />
                    </div>
                  );
                })}
              </div>
            )}
            {hasCuratedJobs ? (
              <p className="mt-2 text-sm text-text-secondary">
                {copy.latest.curatedHint}
              </p>
            ) : null}
            {showEmptyLatest ? (
              <p className="mt-2 text-sm text-text-secondary">
                {copy.latest.emptyHint}
              </p>
            ) : null}
          </section>

          <section className="mb-5">
            <h3 className="mb-3 font-semibold text-text-primary">{copy.engines.title}</h3>
            {enginesError ? (
              <p className="text-sm text-state-warning">{copy.engines.error}</p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {(enginesData?.engines ?? []).map((e) => (
                  <li key={e.id} className="flex items-center justify-between rounded-card border border-border bg-white p-2 text-sm shadow-card">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-text-primary">{e.label}</p>
                      <p className="truncate text-xs text-text-muted">{e.latencyTier} • v{e.version ?? '—'}</p>
                    </div>
                    <div className="text-right">
                      <span className="rounded-input border border-border bg-bg px-2 py-1 text-xs text-text-secondary">{e.status}</span>
                      {typeof e.queueDepth === 'number' && (
                        <p className="mt-1 text-xs text-text-muted">
                          {copy.engines.queueLabel.replace('{count}', String(e.queueDepth))}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
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

function QuickAction({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-card border border-border bg-white p-4 text-sm font-medium text-text-primary shadow-card hover:bg-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-card border border-border bg-bg">
        <Image src={`/assets/icons/${icon}.svg`} alt="" width={18} height={18} />
      </span>
      <span>{label}</span>
    </Link>
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
      durationSec: job.durationSec,
      createdAt: job.createdAt,
      hasAudio: Boolean(job.hasAudio),
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
    durationSec: member.durationSec,
    createdAt: member.createdAt,
    hasAudio: Boolean(member.job?.hasAudio),
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
