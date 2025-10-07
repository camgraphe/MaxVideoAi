'use client';
/* eslint-disable @next/next/no-img-element */

import Link from 'next/link';
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MouseEvent } from 'react';
import { HeaderBar } from '@/components/HeaderBar';
import { AppSidebar } from '@/components/AppSidebar';
import { useEngines, useInfiniteJobs } from '@/lib/api';
import { JobMedia } from '@/components/JobMedia';
import type { Job } from '@/types/jobs';
import type { EngineCaps } from '@/types/engines';
import { EngineIcon } from '@/components/ui/EngineIcon';
import { supabase } from '@/lib/supabaseClient';
import { CURRENCY_LOCALE } from '@/lib/intl';

export default function DashboardPage() {
  const { data: enginesData, error: enginesError } = useEngines();
  const { data: jobsPages, error: jobsError, isLoading } = useInfiniteJobs(9);

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

  const jobs = jobsPages?.[0]?.jobs ?? [];
  const [walletSummary, setWalletSummary] = useState<{ balance: number; currency: string } | null>(null);
  const [memberSummary, setMemberSummary] = useState<{
    tier: string;
    savingsPct: number;
    spent30?: number;
    spentToday?: number;
  } | null>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  const handleCopyPrompt = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {}
  }, []);

  const handleSelectJob = useCallback((job: Job) => {
    setSelectedJob(job);
  }, []);

  const handleCloseJobDetails = useCallback(() => {
    setSelectedJob(null);
  }, []);

  type DashboardItem = { kind: 'job'; job: Job } | { kind: 'placeholder'; id: string };
  const placeholderItems = useMemo<DashboardItem[]>(
    () =>
      Array.from({ length: 8 }, (_, index) => ({
        kind: 'placeholder',
        id: `dashboard-placeholder-${index}`,
      })),
    []
  );
  const isInitialLoading = isLoading && jobs.length === 0;
  const itemsToRender: DashboardItem[] = isInitialLoading
    ? placeholderItems
    : jobs.slice(0, 12).map((job) => ({ kind: 'job', job }));
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
                  if (item.kind === 'job') {
                    return (
                      <DashboardJobCard
                        key={item.job.jobId}
                        job={item.job}
                        onCopyPrompt={handleCopyPrompt}
                        onSelect={handleSelectJob}
                        engine={resolveEngine(item.job)}
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
      {selectedJob && <JobDetailsOverlay job={selectedJob} onClose={handleCloseJobDetails} engine={resolveEngine(selectedJob)} />}
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
}: {
  job: Job;
  onCopyPrompt: (prompt: string) => void;
  onSelect: (job: Job) => void;
  engine?: EngineCaps | undefined;
}) {
  const baseHeight = 225;
  const ratio = (() => {
    if (job.aspectRatio === '9:16') return 9 / 16;
    if (job.aspectRatio === '1:1') return 1;
    if (job.aspectRatio === '4:5') return 4 / 5;
    if (typeof job.aspectRatio === 'string') {
      const [w, h] = job.aspectRatio.split(':').map((value) => Number(value));
      if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
        return w / h;
      }
    }
    return 16 / 9;
  })();
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
          <EngineIcon engine={engine} label={job.engineLabel} size={20} rounded="full" className="shrink-0 border border-hairline bg-white" />
          <span className="truncate max-w-[120px]">{job.engineLabel}</span>
        </span>
        <span className="rounded-input border border-border bg-white/90 px-2 py-1 text-xs font-medium text-text-secondary">{job.durationSec}s</span>
      </div>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onCopyPrompt(job.prompt);
        }}
        className="absolute bottom-2 right-2 rounded-input border border-border bg-white/90 px-2 py-1 text-xs font-medium text-text-secondary transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Image src="/assets/icons/copy.svg" alt="" width={14} height={14} className="mr-1 inline" /> Copy prompt
      </button>
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

type JobRequestMeta = {
  engineId?: string;
  engineLabel?: string;
  mode?: string;
  durationSec?: number;
  aspectRatio?: string;
  resolution?: string;
  fps?: number;
  addons?: {
    audio?: boolean;
    upscale4k?: boolean;
  };
};

type AttachmentSummary = {
  label: string;
  url?: string;
};

function parseRequestMeta(job: Job): { settings: JobRequestMeta | null; attachments: AttachmentSummary[] } {
  const snapshotMeta = job.pricingSnapshot?.meta;
  if (!snapshotMeta || typeof snapshotMeta !== 'object') {
    return { settings: null, attachments: [] };
  }

  const request = (snapshotMeta as Record<string, unknown>).request;
  if (!request || typeof request !== 'object') {
    return { settings: null, attachments: [] };
  }

  const record = request as Record<string, unknown>;
  const settings: JobRequestMeta = {
    engineId: typeof record.engineId === 'string' ? record.engineId : undefined,
    engineLabel: typeof record.engineLabel === 'string' ? record.engineLabel : undefined,
    mode: typeof record.mode === 'string' ? record.mode : undefined,
    durationSec: typeof record.durationSec === 'number' ? record.durationSec : undefined,
    aspectRatio: typeof record.aspectRatio === 'string' ? record.aspectRatio : undefined,
    resolution: typeof record.resolution === 'string' ? record.resolution : undefined,
    fps: typeof record.fps === 'number' ? record.fps : undefined,
  };

  const addonsValue = record.addons;
  if (addonsValue && typeof addonsValue === 'object') {
    const addonsRecord = addonsValue as Record<string, unknown>;
    settings.addons = {
      audio: Boolean(addonsRecord.audio),
      upscale4k: Boolean(addonsRecord.upscale4k),
    };
  }

  const attachmentsSources = [
    record.attachments,
    record.inputs,
    record.inputAssets,
    record.referenceImages,
  ];
  const attachments: AttachmentSummary[] = [];
  attachmentsSources.forEach((source) => {
    if (!Array.isArray(source)) return;
    source.forEach((entry) => {
      if (typeof entry === 'string') {
        attachments.push({ label: entry });
        return;
      }
      if (entry && typeof entry === 'object') {
        const entryRecord = entry as Record<string, unknown>;
        const label =
          (typeof entryRecord.name === 'string' && entryRecord.name) ||
          (typeof entryRecord.filename === 'string' && entryRecord.filename) ||
          (typeof entryRecord.label === 'string' && entryRecord.label) ||
          (typeof entryRecord.url === 'string' && entryRecord.url) ||
          `Attachment ${attachments.length + 1}`;
        const url = typeof entryRecord.url === 'string' ? entryRecord.url : undefined;
        attachments.push({ label, url });
        return;
      }
      attachments.push({ label: `Attachment ${attachments.length + 1}` });
    });
  });

  return { settings, attachments };
}

function JobDetailsOverlay({ job, onClose, engine }: { job: Job; onClose: () => void; engine?: EngineCaps | undefined }) {
  const { settings, attachments } = useMemo(() => parseRequestMeta(job), [job]);
  const priceCents = job.finalPriceCents ?? job.pricingSnapshot?.totalCents;
  const currency = job.currency ?? job.pricingSnapshot?.currency ?? 'USD';
  const formattedPrice =
    typeof priceCents === 'number'
      ? (() => {
          try {
            return new Intl.NumberFormat(CURRENCY_LOCALE, { style: 'currency', currency }).format(priceCents / 100);
          } catch {
            return `${currency} ${(priceCents / 100).toFixed(2)}`;
          }
        })()
      : null;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const handleBackdropClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  const handleCopyPrompt = useCallback(() => {
    if (navigator?.clipboard) {
      void navigator.clipboard.writeText(job.prompt).catch(() => undefined);
    }
  }, [job.prompt]);

  const createdAtDisplay = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(job.createdAt));
    } catch {
      return job.createdAt;
    }
  }, [job.createdAt]);

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/40 px-4 py-6"
      role="dialog"
      aria-modal="true"
      onClick={handleBackdropClick}
    >
      <div className="relative max-h-full w-full max-w-3xl overflow-y-auto rounded-[16px] border border-border bg-white p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-input border border-border bg-white px-3 py-1 text-sm font-medium text-text-secondary hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Fermer
        </button>

        <header className="pr-16">
          <div className="flex items-start gap-3">
            <EngineIcon engine={engine} label={settings?.engineLabel ?? job.engineLabel} size={52} className="shrink-0 border border-hairline bg-white" />
            <div>
              <p className="text-xs uppercase tracking-micro text-text-muted">Render #{job.jobId}</p>
              <h2 className="mt-1 text-xl font-semibold text-text-primary">{settings?.engineLabel ?? job.engineLabel}</h2>
              <p className="text-sm text-text-secondary">
                Créé le {createdAtDisplay}
                {formattedPrice ? ` • ${formattedPrice}` : ''}
              </p>
            </div>
          </div>
        </header>

        <section className="mt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-micro text-text-muted">Prompt</h3>
            <button
              type="button"
              onClick={handleCopyPrompt}
              className="rounded-input border border-border bg-white px-3 py-1 text-xs font-medium text-text-secondary hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Copier
            </button>
          </div>
          <div className="mt-2 rounded-input border border-border bg-bg px-4 py-3 text-sm text-text-primary">
            <pre className="whitespace-pre-wrap break-words font-sans">{job.prompt}</pre>
          </div>
        </section>

        <section className="mt-6">
          <h3 className="text-sm font-semibold uppercase tracking-micro text-text-muted">Réglages</h3>
          {settings ? (
            <dl className="mt-2 grid grid-cols-1 gap-3 text-sm text-text-secondary sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-micro text-text-muted">Mode</dt>
                <dd className="mt-1 text-text-primary">{settings.mode ?? 'N/A'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-micro text-text-muted">Durée</dt>
                <dd className="mt-1 text-text-primary">{(settings.durationSec ?? job.durationSec) ? `${settings.durationSec ?? job.durationSec}s` : 'N/A'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-micro text-text-muted">Aspect ratio</dt>
                <dd className="mt-1 text-text-primary">{settings.aspectRatio ?? job.aspectRatio ?? 'N/A'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-micro text-text-muted">Résolution</dt>
                <dd className="mt-1 text-text-primary">{settings.resolution ?? 'N/A'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-micro text-text-muted">Images par seconde</dt>
                <dd className="mt-1 text-text-primary">{settings.fps ?? 'N/A'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-micro text-text-muted">Audio</dt>
                <dd className="mt-1 text-text-primary">{settings.addons?.audio ? 'Activé' : 'Désactivé'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-micro text-text-muted">Upscale 4K</dt>
                <dd className="mt-1 text-text-primary">{settings.addons?.upscale4k ? 'Activé' : 'Désactivé'}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-2 text-sm text-text-muted">Réglages indisponibles pour ce rendu.</p>
          )}
        </section>

        <section className="mt-6">
          <h3 className="text-sm font-semibold uppercase tracking-micro text-text-muted">Pièces jointes</h3>
          {attachments.length > 0 ? (
            <ul className="mt-2 space-y-2 text-sm text-text-primary">
              {attachments.map((attachment, index) => (
                <li key={`${attachment.label}-${index}`}>
                  {attachment.url ? (
                    <a
                      href={attachment.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-accent hover:underline"
                    >
                      {attachment.label}
                    </a>
                  ) : (
                    <span>{attachment.label}</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-text-muted">Aucune pièce jointe pour ce rendu.</p>
          )}
        </section>
      </div>
    </div>
  );
}
