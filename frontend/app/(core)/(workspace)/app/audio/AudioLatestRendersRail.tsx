'use client';

/* eslint-disable @next/next/no-img-element */

import { useMemo } from 'react';

import { Button, ButtonLink } from '@/components/ui/Button';
import { useInfiniteJobs } from '@/lib/api';
import type { Job } from '@/types/jobs';

type AudioLatestRendersRailProps = {
  activeJobId?: string | null;
  onSelectJob: (jobId: string) => void;
  variant?: 'desktop' | 'mobile';
};

function formatCurrency(amountCents?: number | null, currency = 'USD'): string | null {
  if (typeof amountCents !== 'number') return null;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
    }).format(amountCents / 100);
  } catch {
    return `${currency} ${(amountCents / 100).toFixed(2)}`;
  }
}

function formatDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
}

function resolveAudioJobPrice(job: Job): string | null {
  return formatCurrency(job.finalPriceCents ?? job.pricingSnapshot?.totalCents ?? null, job.currency ?? job.pricingSnapshot?.currency ?? 'USD');
}

function resolveThumb(job: Job): string {
  return job.thumbUrl ?? '/assets/frames/thumb-16x9.svg';
}

function resolveOutputLabel(job: Job): string {
  if (job.videoUrl && job.audioUrl) return 'Video + audio';
  if (job.videoUrl) return 'Video render';
  if (job.audioUrl) return 'Audio file';
  return 'Pending render';
}

function AudioJobCard({
  job,
  active,
  onSelect,
}: {
  job: Job;
  active: boolean;
  onSelect: () => void;
}) {
  const priceLabel = resolveAudioJobPrice(job);
  const durationLabel = typeof job.durationSec === 'number' ? `${job.durationSec}s` : null;
  const status = job.status ?? (job.videoUrl || job.audioUrl ? 'completed' : 'pending');
  const thumb = resolveThumb(job);

  return (
    <article
      className={[
        'overflow-hidden rounded-card border bg-surface shadow-card transition',
        active ? 'border-brand ring-1 ring-brand/30' : 'border-border hover:border-border-hover',
      ].join(' ')}
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-bg">
        {job.videoUrl ? (
          <video
            controls
            src={job.videoUrl}
            poster={thumb}
            className="h-full w-full object-cover"
            playsInline
            preload="metadata"
          />
        ) : (
          <button type="button" className="block h-full w-full text-left" onClick={onSelect}>
            <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.18),_transparent_48%),linear-gradient(135deg,_rgba(15,23,42,0.98),_rgba(30,41,59,0.88))]">
              <img src={thumb} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-white/10">
                <img src="/assets/icons/audio.svg" alt="" className="h-8 w-8 opacity-90" />
              </div>
            </div>
          </button>
        )}
        <div className="absolute left-3 top-3 rounded-full bg-surface-on-media-dark-70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
          {status}
        </div>
      </div>
      <div className="space-y-3 px-3 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-text-primary">{job.engineLabel}</p>
            <p className="mt-1 text-xs text-text-secondary">{resolveOutputLabel(job)}</p>
          </div>
          {priceLabel ? <span className="text-sm font-semibold text-text-primary">{priceLabel}</span> : null}
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.12em] text-text-muted">
          {durationLabel ? <span>{durationLabel}</span> : null}
          <span>{formatDateTime(job.createdAt)}</span>
        </div>
        {!job.videoUrl && job.audioUrl ? (
          <audio
            controls
            src={job.audioUrl}
            className="w-full"
            onClick={(event) => event.stopPropagation()}
          />
        ) : null}
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" className="flex-1" onClick={onSelect}>
            Open
          </Button>
          {job.videoUrl ? (
            <ButtonLink href={job.videoUrl} target="_blank" rel="noreferrer" variant="ghost" size="sm">
              File
            </ButtonLink>
          ) : job.audioUrl ? (
            <ButtonLink href={job.audioUrl} target="_blank" rel="noreferrer" variant="ghost" size="sm">
              File
            </ButtonLink>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export default function AudioLatestRendersRail({
  activeJobId = null,
  onSelectJob,
  variant = 'desktop',
}: AudioLatestRendersRailProps) {
  const {
    data,
    error,
    isLoading,
    isValidating,
    setSize,
    stableJobs,
    mutate,
  } = useInfiniteJobs(24, { surface: 'audio' });

  const jobs = useMemo(() => {
    const source = Array.isArray(stableJobs) && stableJobs.length ? stableJobs : data?.flatMap((page) => page.jobs) ?? [];
    return source.filter((job) => job.surface === 'audio' && Boolean(job.videoUrl || job.audioUrl));
  }, [data, stableJobs]);

  const lastPage = data?.[data.length - 1];
  const hasMore = Boolean(lastPage?.nextCursor);

  return (
    <aside className={variant === 'desktop' ? 'flex h-full w-[320px] flex-col' : 'flex flex-col'}>
      <div className="flex items-center justify-between px-1 pb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">Latest renders</p>
          <h2 className="mt-1 text-lg font-semibold text-text-primary">Audio history</h2>
        </div>
        <ButtonLink href="/jobs" variant="ghost" size="sm">
          View all
        </ButtonLink>
      </div>
      <div className={variant === 'desktop' ? 'flex-1 overflow-y-auto pr-1' : ''}>
        <div className="space-y-3">
          {error ? (
            <div className="rounded-card border border-border bg-surface p-4 text-sm text-state-warning">
              Failed to load latest renders.
              <Button type="button" variant="outline" size="sm" className="ml-3" onClick={() => void mutate()}>
                Retry
              </Button>
            </div>
          ) : null}
          {!error && !jobs.length && isLoading ? (
            Array.from({ length: 3 }).map((_, index) => (
              <div key={`audio-rail-skeleton-${index}`} className="overflow-hidden rounded-card border border-border bg-surface shadow-card" aria-hidden>
                <div className="aspect-[16/9] w-full bg-skeleton" />
                <div className="space-y-2 px-3 py-3">
                  <div className="h-4 w-32 rounded-full bg-skeleton" />
                  <div className="h-3 w-24 rounded-full bg-skeleton" />
                </div>
              </div>
            ))
          ) : null}
          {!error && !jobs.length && !isLoading ? (
            <div className="rounded-card border border-border bg-surface p-4 text-sm text-text-secondary">
              No audio renders yet.
            </div>
          ) : null}
          {jobs.map((job) => (
            <AudioJobCard
              key={job.jobId}
              job={job}
              active={activeJobId === job.jobId}
              onSelect={() => onSelectJob(job.jobId)}
            />
          ))}
        </div>
        {hasMore ? (
          <div className="pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              disabled={isValidating}
              onClick={() => setSize((previous) => previous + 1)}
            >
              {isValidating ? 'Loading…' : 'Load more'}
            </Button>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
