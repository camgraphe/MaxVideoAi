'use client';

import Image from 'next/image';
import { useCallback, useMemo } from 'react';
import { HeaderBar } from '@/components/HeaderBar';
import { AppSidebar } from '@/components/AppSidebar';
import { useEngines, useInfiniteJobs } from '@/lib/api';
import { JobMedia } from '@/components/JobMedia';
import type { Job } from '@/types/jobs';
import type { EngineCaps } from '@/types/engines';
import { EngineIcon } from '@/components/ui/EngineIcon';
import { CURRENCY_LOCALE } from '@/lib/intl';

export default function JobsPage() {
  const { data: enginesData } = useEngines();
  const { data, error, isLoading, size, setSize, isValidating, mutate } = useInfiniteJobs(24);

  const pages = data ?? [];
  const jobs = pages.flatMap((p) => p.jobs);
  const hasMore = pages.length === 0 ? false : pages[pages.length - 1].nextCursor !== null;

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
      const key = job.engineLabel?.toLowerCase();
      if (key) {
        const byLabel = engineLookup.byLabel.get(key);
        if (byLabel) return byLabel;
      }
      return undefined;
    },
    [engineLookup]
  );

  const toAspectValue = useCallback((ratio?: string | null) => {
    if (typeof ratio !== 'string') return '16 / 9';
    const parts = ratio.split(':');
    if (parts.length === 2) {
      const [w, h] = parts.map((part) => Number(part));
      if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
        return `${w} / ${h}`;
      }
    }
    return '16 / 9';
  }, []);

  const handleCopyPrompt = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {}
  }, []);

  type JobsMasonryItem = { kind: 'job'; job: Job } | { kind: 'placeholder'; id: string };
  const placeholderItems = useMemo<JobsMasonryItem[]>(
    () =>
      Array.from({ length: 12 }, (_, index) => ({
        kind: 'placeholder',
        id: `jobs-placeholder-${index}`,
      })),
    []
  );
  const isInitialLoading = isLoading && jobs.length === 0;
  const masonryItems: JobsMasonryItem[] = isInitialLoading
    ? placeholderItems
    : jobs.map((job) => ({ kind: 'job', job }));

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <HeaderBar />
      <div className="flex flex-1">
        <AppSidebar />
        <main className="flex-1 overflow-y-auto p-5 lg:p-7">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-xl font-semibold text-text-primary">Jobs</h1>
          </div>

          {error ? (
            <div className="rounded-card border border-border bg-white p-4 text-state-warning">
              Failed to load jobs.
              <button
                type="button"
                onClick={() => mutate()}
                className="ml-3 rounded-input border border-border px-2 py-1 text-sm hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Retry
              </button>
            </div>
          ) : (
            <div
              className="[column-gap:12px] columns-2 sm:columns-3 xl:columns-4"
              style={{ columnWidth: '140px' }}
            >
              {masonryItems.map((item) => {
                if (item.kind === 'job') {
                  return (
                    <div key={item.job.jobId} className="mb-3 break-inside-avoid">
                      <JobsJobCard
                        job={item.job}
                        aspect={toAspectValue(item.job.aspectRatio)}
                        onCopyPrompt={handleCopyPrompt}
                        engine={resolveEngine(item.job)}
                      />
                    </div>
                  );
                }
                return (
                  <div key={item.id} className="mb-3 break-inside-avoid">
                    <JobsJobSkeleton />
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-5 flex items-center justify-center">
            {hasMore && !error && (
              <button
                type="button"
                onClick={() => setSize(size + 1)}
                disabled={isValidating}
                className="rounded-input border border-border bg-white px-4 py-2 text-sm font-medium text-text-primary shadow-card hover:bg-white/80 disabled:opacity-60"
              >
                {isValidating ? 'Loading…' : 'Load more'}
              </button>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function JobsJobCard({
  job,
  aspect,
  onCopyPrompt,
  engine,
}: {
  job: Job;
  aspect: string;
  onCopyPrompt: (prompt: string) => void;
  engine?: EngineCaps | undefined;
}) {
  const priceCents = job.finalPriceCents ?? job.pricingSnapshot?.totalCents;
  const currency = job.currency ?? job.pricingSnapshot?.currency ?? 'USD';
  let formattedPrice: string | null = null;
  if (typeof priceCents === 'number') {
    try {
      formattedPrice = new Intl.NumberFormat(CURRENCY_LOCALE, { style: 'currency', currency }).format(priceCents / 100);
    } catch {
      formattedPrice = `${currency} ${(priceCents / 100).toFixed(2)}`;
    }
  }
  const memberDiscount = job.pricingSnapshot?.discount;
  return (
    <article className="group relative overflow-hidden rounded-card border border-border bg-white shadow-card text-xs">
      <div className="relative w-full" style={{ aspectRatio: aspect }}>
        <JobMedia job={job} />
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
        <div className="absolute bottom-2 left-2 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-input border border-border bg-white/90 px-2.5 py-1 text-xs font-medium text-text-secondary">
            <EngineIcon engine={engine} label={job.engineLabel} size={20} rounded="full" className="shrink-0 border border-hairline bg-white" />
            <span className="truncate max-w-[120px]">{job.engineLabel}</span>
          </span>
          <span className="rounded-input border border-border bg-white/90 px-2 py-1 text-xs font-medium text-text-secondary">{job.durationSec}s</span>
          {formattedPrice && (
            <span className="rounded-input border border-border bg-white/90 px-2 py-1 text-xs font-semibold text-text-primary">{formattedPrice}</span>
          )}
          {memberDiscount && memberDiscount.amountCents > 0 && (
            <span className="rounded-input border border-border bg-white/90 px-2 py-1 text-xs font-medium text-text-accent">
              Member price — You save {Math.round((memberDiscount.percentApplied ?? 0) * 100)}%
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => onCopyPrompt(job.prompt)}
          className="absolute bottom-2 right-2 rounded-input border border-border bg-white/90 px-2 py-1 text-xs font-medium text-text-secondary transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Image src="/assets/icons/copy.svg" alt="" width={14} height={14} className="mr-1 inline" /> Copy prompt
        </button>
      </div>
    </article>
  );
}

function JobsJobSkeleton() {
  return (
    <article className="relative overflow-hidden rounded-card border border-border bg-white shadow-card text-xs">
      <div className="relative w-full" style={{ aspectRatio: '16 / 9' }}>
        <div className="absolute inset-0 skeleton" />
        <div className="absolute right-2 top-2 flex gap-1">
          <span className="h-6 w-12 rounded-full bg-white/70" />
          <span className="h-6 w-12 rounded-full bg-white/70" />
        </div>
        <div className="absolute bottom-2 left-2 flex flex-wrap items-center gap-2">
          <span className="h-6 w-24 rounded-full bg-white/80" />
          <span className="h-6 w-12 rounded-full bg-white/80" />
          <span className="h-6 w-20 rounded-full bg-white/80" />
        </div>
        <div className="absolute bottom-2 right-2 h-6 w-16 rounded-full bg-white/80" />
      </div>
    </article>
  );
}
