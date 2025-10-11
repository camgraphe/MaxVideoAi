'use client';
/* eslint-disable @next/next/no-img-element */

import Link from 'next/link';
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { HeaderBar } from '@/components/HeaderBar';
import { AppSidebar } from '@/components/AppSidebar';
import { hideJob, useEngines, useInfiniteJobs } from '@/lib/api';
import { JobMedia } from '@/components/JobMedia';
import { groupJobsIntoSummaries, loadPersistedGroupSummaries, GROUP_SUMMARIES_UPDATED_EVENT } from '@/lib/job-groups';
import { GroupedJobCard } from '@/components/GroupedJobCard';
import type { GroupSummary } from '@/types/groups';
import type { Job } from '@/types/jobs';
import type { EngineCaps } from '@/types/engines';
import { EngineIcon } from '@/components/ui/EngineIcon';
import { supabase } from '@/lib/supabaseClient';
import { CURRENCY_LOCALE } from '@/lib/intl';
import { MediaLightbox, type MediaLightboxEntry } from '@/components/MediaLightbox';
import { getAspectRatioNumber } from '@/lib/aspect';

export default function DashboardPage() {
  const { data: enginesData, error: enginesError } = useEngines();
  const { data: jobsPages, error: jobsError, isLoading, mutate: mutateJobs } = useInfiniteJobs(9);

  const engineLookup = useMemo(() => {
    const byId = new Map<string, EngineCaps>();
    const byLabel = new Map<string, EngineCaps>();
    (enginesData?.engines ?? []).forEach((engine) => {
      byId.set(engine.id, engine);
      byLabel.set(engine.label.toLowerCase(), engine);
    });
    return { byId, byLabel };
  }, [enginesData?.engines]);

  const resolveEngine = useCallback(
    (job: Job) => {
      if (job.engineId) {
        const byId = engineLookup.byId.get(job.engineId);
        if (byId) return byId;
      }
      const labelKey = job.engineLabel?.toLowerCase();
      if (labelKey) {
        const byLabel = engineLookup.byLabel.get(labelKey);
        if (byLabel) return byLabel;
      }
      return undefined;
    },
    [engineLookup]
  );

  const jobs = useMemo(() => jobsPages?.[0]?.jobs ?? [], [jobsPages]);
  const { groups: apiGroups, ungrouped: apiUngrouped } = useMemo(() => groupJobsIntoSummaries(jobs), [jobs]);
  const [storedGroups, setStoredGroups] = useState<GroupSummary[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sync = () => setStoredGroups(loadPersistedGroupSummaries());
    sync();
    window.addEventListener(GROUP_SUMMARIES_UPDATED_EVENT, sync);
    return () => window.removeEventListener(GROUP_SUMMARIES_UPDATED_EVENT, sync);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleHidden = () => {
      void mutateJobs();
    };
    window.addEventListener('jobs:hidden', handleHidden);
    return () => window.removeEventListener('jobs:hidden', handleHidden);
  }, [mutateJobs]);

  const groupedJobs = useMemo(() => {
    const map = new Map<string, GroupSummary>();
    [...apiGroups, ...storedGroups].forEach((group) => {
      if (!group || group.count <= 1) return;
      const current = map.get(group.id);
      if (!current || Date.parse(group.createdAt) > Date.parse(current.createdAt)) {
        map.set(group.id, group);
      }
    });
    return Array.from(map.values()).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }, [apiGroups, storedGroups]);

  const ungroupedJobs = useMemo(() => {
    const groupedIds = new Set<string>();
    groupedJobs.forEach((group) => {
      group.members.forEach((member) => {
        if (member.jobId) groupedIds.add(member.jobId);
      });
    });
    return apiUngrouped.filter((job) => !groupedIds.has(job.jobId));
  }, [apiUngrouped, groupedJobs]);
  const [walletSummary, setWalletSummary] = useState<{ balance: number; currency: string } | null>(null);
  const [memberSummary, setMemberSummary] = useState<{
    tier: string;
    savingsPct: number;
    spent30?: number;
    spentToday?: number;
  } | null>(null);
  const [lightbox, setLightbox] = useState<{ kind: 'group'; group: GroupSummary } | { kind: 'job'; job: Job } | null>(null);
  const handleRemoveJob = useCallback(
    async (job: Job) => {
      try {
        await hideJob(job.jobId);
        setLightbox((current) =>
          current && current.kind === 'job' && current.job.jobId === job.jobId ? null : current
        );
        await mutateJobs(
          (pages) => {
            if (!pages) return pages;
            return pages.map((page) => ({
              ...page,
              jobs: page.jobs.filter((entry) => entry.jobId !== job.jobId),
            }));
          },
          false
        );
      } catch (error) {
        console.error('Failed to hide job', error);
      }
    },
    [mutateJobs]
  );

  const handleCopyPrompt = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {}
  }, []);

  type DashboardItem = { kind: 'group'; group: GroupSummary } | { kind: 'job'; job: Job } | { kind: 'placeholder'; id: string };
  const placeholderItems = useMemo<DashboardItem[]>(
    () =>
      Array.from({ length: 8 }, (_, index) => ({
        kind: 'placeholder',
        id: `dashboard-placeholder-${index}`,
      })),
    []
  );
  const isInitialLoading = isLoading && jobs.length === 0 && groupedJobs.length === 0;
  const itemsToRender: DashboardItem[] = useMemo(() => {
    if (isInitialLoading) return placeholderItems;
    const items: DashboardItem[] = [];
    const limitedGroups = groupedJobs.slice(0, 6);
    limitedGroups.forEach((group) => {
      items.push({ kind: 'group', group });
    });
    const remainingSlots = Math.max(0, 12 - limitedGroups.length);
    const groupedJobIds = new Set<string>();
    limitedGroups.forEach((group) => {
      group.members.forEach((member) => {
        if (member.jobId) groupedJobIds.add(member.jobId);
      });
    });
    ungroupedJobs
      .filter((job) => !groupedJobIds.has(job.jobId))
      .slice(0, remainingSlots)
      .forEach((job) => {
        items.push({ kind: 'job', job });
      });
    return items.length ? items : placeholderItems;
  }, [groupedJobs, ungroupedJobs, isInitialLoading, placeholderItems]);
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
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <HeaderBar />
      <div className="flex flex-1">
        <AppSidebar />
        <main className="flex-1 overflow-y-auto p-5 lg:p-7">
          <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <QuickAction href="/" icon="generate" label="Create a video" />
            <QuickAction href="/jobs" icon="jobs" label="View latest renders" />
            <QuickAction href="/billing" icon="wallet" label="Add funds" />
          </div>

          {/* Wallet & Member and Spend first */}
          <section className="mb-7 grid gap-4 md:grid-cols-2">
            <div className="rounded-card border border-border bg-white p-4 shadow-card">
              <h3 className="mb-2 font-semibold text-text-primary">Wallet & Member</h3>
              <div className="flex items-center justify-between text-sm text-text-secondary">
                <div>
                  <p>Current balance</p>
                  <p className="text-2xl font-semibold text-text-primary">{balanceDisplay}</p>
                </div>
                <div className="text-right">
                  <p>Member tier</p>
                  <p className="text-2xl font-semibold text-text-primary">{memberSummary?.tier ?? 'Member'}</p>
                  <p className="text-xs text-text-muted">
                    Rolling 30-day savings: {memberSummary?.savingsPct ?? 0}%
                  </p>
                </div>
              </div>
              <div className="mt-3">
                <Link href="/billing" className="rounded-input border border-border px-3 py-2 text-sm font-medium text-text-primary hover:bg-bg">Manage billing</Link>
              </div>
            </div>
            <div className="rounded-card border border-border bg-white p-4 shadow-card">
              <h3 className="mb-2 font-semibold text-text-primary">Spend at a glance</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-input border border-border bg-bg p-3">
                  <p className="text-text-muted">Today</p>
                  <p className="text-xl font-semibold text-text-primary">{spendTodayDisplay}</p>
                </div>
                <div className="rounded-input border border-border bg-bg p-3">
                  <p className="text-text-muted">Last 30 days</p>
                  <p className="text-xl font-semibold text-text-primary">{spend30Display}</p>
                </div>
              </div>
            </div>
          </section>

          {/* Latest renders below, with smaller thumbnails */}
          <section className="mb-7">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text-primary">Latest renders</h2>
              <Link href="/jobs" className="text-sm font-medium text-accent hover:underline">View all →</Link>
            </div>
            {jobsError ? (
              <div className="rounded-card border border-border bg-white p-4 text-state-warning">
                Failed to load latest renders. Please retry.
                <button
                  type="button"
                  onClick={() => location.reload()}
                  className="ml-3 rounded-input border border-border px-2 py-1 text-sm hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Retry
                </button>
              </div>
            ) : (
              <div className="flex w-full gap-4 overflow-x-auto pb-2">
                {itemsToRender.map((item) => {
                  if (item.kind === 'group') {
                    const heroEngineId = item.group.hero.engineId ?? null;
                    const heroEngineLabelKey = item.group.hero.engineLabel?.toLowerCase?.() ?? null;
                    const heroEngine = heroEngineId
                      ? engineLookup.byId.get(heroEngineId)
                      : heroEngineLabelKey
                        ? engineLookup.byLabel.get(heroEngineLabelKey)
                        : undefined;
                    const baseHeight = 225;
                    const heroAspect = getAspectRatioNumber(item.group.hero.aspectRatio);
                    const width = Math.max(110, baseHeight * heroAspect);
                    return (
                      <div
                        key={`group-${item.group.id}`}
                        className="flex-shrink-0"
                        style={{ width, minWidth: width }}
                      >
                        <GroupedJobCard
                          group={item.group}
                          engine={heroEngine}
                          actionMenu={false}
                          onOpen={(group) => setLightbox({ kind: 'group', group })}
                        />
                      </div>
                    );
                  }
                  if (item.kind === 'job') {
                    return (
                      <DashboardJobCard
                        key={item.job.jobId}
                        job={item.job}
                        onCopyPrompt={handleCopyPrompt}
                        onSelect={(job) => setLightbox({ kind: 'job', job })}
                        engine={resolveEngine(item.job)}
                        onRemove={handleRemoveJob}
                      />
                    );
                  }
                  return <DashboardJobSkeleton key={item.id} />;
                })}
              </div>
            )}
          </section>

          <section className="mb-5">
            <h3 className="mb-3 font-semibold text-text-primary">Engines status</h3>
            {enginesError ? (
              <p className="text-sm text-state-warning">Failed to load engines.</p>
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
                        <p className="mt-1 text-xs text-text-muted">queue: {e.queueDepth}</p>
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
          title={lightbox.kind === 'group' ? `Groupe ×${lightbox.group.count}` : `Rendu ${lightbox.job.jobId}`}
          subtitle={
            lightbox.kind === 'group'
              ? lightbox.group.hero.engineLabel
              : `${lightbox.job.engineLabel} • ${formatDateTime(lightbox.job.createdAt)}`
          }
          prompt={lightbox.kind === 'group' ? lightbox.group.hero.prompt ?? null : lightbox.job.prompt}
          metadata={
            lightbox.kind === 'group'
              ? [
                  { label: 'Créé le', value: formatDateTime(lightbox.group.createdAt) },
                  {
                    label: 'Durée du héros',
                    value: lightbox.group.hero.durationSec ? `${lightbox.group.hero.durationSec}s` : 'Non renseigné',
                  },
                  { label: 'Moteur', value: lightbox.group.hero.engineLabel },
                ]
              : [
                  { label: 'Durée', value: `${lightbox.job.durationSec}s` },
                  { label: 'Statut', value: lightbox.job.paymentStatus ?? 'N/A' },
                  { label: 'Créé le', value: formatDateTime(lightbox.job.createdAt) },
                ]
          }
          entries={lightbox.kind === 'group' ? buildEntriesFromGroup(lightbox.group) : buildEntriesFromJob(lightbox.job)}
          onClose={() => setLightbox(null)}
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

function DashboardJobCard({
  job,
  onCopyPrompt,
  onSelect,
  engine,
  onRemove,
}: {
  job: Job;
  onCopyPrompt: (prompt: string) => void;
  onSelect: (job: Job) => void;
  engine?: EngineCaps | undefined;
  onRemove?: (job: Job) => void;
}) {
  const baseHeight = 225;
  const ratio = getAspectRatioNumber(job.aspectRatio);
  const height = baseHeight;
  const width = Math.max(110, height * ratio);

  const handleSelect = useCallback(() => {
    onSelect(job);
  }, [job, onSelect]);

  return (
    <article
      className="group relative shrink-0 cursor-pointer overflow-hidden rounded-card border border-border bg-white shadow-card"
      style={{ width, height }}
      role="button"
      tabIndex={0}
      onClick={handleSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(job);
        }
      }}
    >
      <div className="absolute inset-0 flex items-center justify-center bg-[#EFF3FA]">
        <JobMedia
          job={job}
          className="h-full w-auto"
          objectFit="contain"
        />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="absolute right-2 top-2 flex gap-1">
        {job.canUpscale && (
          <span className="rounded-input border border-border bg-white/90 px-2 py-1 text-xs font-medium text-text-secondary">
            <Image src="/assets/icons/upscale.svg" alt="" width={14} height={14} className="inline" />
          </span>
        )}
        {job.hasAudio && (
          <span className="rounded-input border border-border bg-white/90 px-2 py-1 text-xs font-medium text-text-secondary">
            <Image src="/assets/icons/audio.svg" alt="" width={14} height={14} className="inline" />
          </span>
        )}
      </div>
      <div className="absolute bottom-2 left-2 flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-input border border-border bg-white/90 px-2.5 py-1 text-xs font-medium text-text-secondary">
          <EngineIcon engine={engine} label={job.engineLabel} size={20} className="shrink-0" />
          <span className="truncate max-w-[120px]">{job.engineLabel}</span>
        </span>
        <span className="rounded-input border border-border bg-white/90 px-2 py-1 text-xs font-medium text-text-secondary">{job.durationSec}s</span>
      </div>
      <div className="absolute bottom-2 right-2 flex gap-2">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onCopyPrompt(job.prompt);
          }}
          className="rounded-input border border-border bg-white/90 px-2 py-1 text-xs font-medium text-text-secondary transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Image src="/assets/icons/copy.svg" alt="" width={14} height={14} className="mr-1 inline" /> Copy prompt
        </button>
        {onRemove && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onRemove(job);
            }}
            className="rounded-input border border-border bg-white/90 px-2 py-1 text-xs font-medium text-text-secondary transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Retirer
          </button>
        )}
      </div>
    </article>
  );
}

function DashboardJobSkeleton() {
  const baseHeight = 225;
  const ratio = 16 / 9;
  const height = baseHeight;
  const width = height * ratio;
  return (
    <article
      className="relative shrink-0 overflow-hidden rounded-card border border-border bg-white shadow-card"
      style={{ width, height }}
    >
      <div className="absolute inset-0">
        <div className="absolute inset-0 skeleton" />
        <div className="absolute right-2 top-2 flex gap-1">
          <span className="h-6 w-12 rounded-full bg-white/70" />
          <span className="h-6 w-12 rounded-full bg-white/70" />
        </div>
        <div className="absolute bottom-2 left-2 flex items-center gap-2">
          <span className="h-6 w-24 rounded-full bg-white/80" />
          <span className="h-6 w-12 rounded-full bg-white/80" />
        </div>
        <div className="absolute bottom-2 right-2 h-6 w-16 rounded-full bg-white/80" />
      </div>
    </article>
  );
}

function buildEntriesFromJob(job: Job): MediaLightboxEntry[] {
  return [
    {
      id: job.jobId,
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
    },
  ];
}

function buildEntriesFromGroup(group: GroupSummary): MediaLightboxEntry[] {
  return group.members.map((member) => ({
    id: member.id,
    label:
      typeof member.iterationIndex === 'number'
        ? `Version ${member.iterationIndex + 1}`
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
