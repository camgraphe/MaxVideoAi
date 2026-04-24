'use client';

/* eslint-disable @next/next/no-img-element */

import deepmerge from 'deepmerge';
import { useMemo } from 'react';

import { Button, ButtonLink } from '@/components/ui/Button';
import { useInfiniteJobs } from '@/lib/api';
import { useI18n } from '@/lib/i18n/I18nProvider';
import type { Job } from '@/types/jobs';
import { DEFAULT_AUDIO_WORKSPACE_COPY, formatAudioPackLabel, type AudioWorkspaceCopy } from './copy';

type AudioLatestRendersRailProps = {
  activeJobId?: string | null;
  onSelectJob: (jobId: string) => void;
  variant?: 'desktop' | 'mobile';
};

function formatCurrency(amountCents?: number | null, currency = 'USD', locale?: string): string | null {
  if (typeof amountCents !== 'number') return null;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
    }).format(amountCents / 100);
  } catch {
    return `${currency} ${(amountCents / 100).toFixed(2)}`;
  }
}

function formatDateTime(value: string, locale?: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
}

function resolveAudioJobPrice(job: Job, locale?: string): string | null {
  return formatCurrency(
    job.finalPriceCents ?? job.pricingSnapshot?.totalCents ?? null,
    job.currency ?? job.pricingSnapshot?.currency ?? 'USD',
    locale
  );
}

function resolveThumb(job: Job): string {
  return job.thumbUrl ?? '/assets/frames/thumb-16x9.svg';
}

function resolveOutputLabel(job: Job, copy: AudioWorkspaceCopy): string {
  if (job.videoUrl && job.audioUrl) return copy.rail.outputs.videoAndAudio;
  if (job.videoUrl) return copy.rail.outputs.video;
  if (job.audioUrl) return copy.rail.outputs.audio;
  return copy.rail.outputs.pending;
}

function resolveJobLabel(job: Job, copy: AudioWorkspaceCopy): string {
  const settingsSnapshot = (job as Job & { settingsSnapshot?: { pack?: string | null } | null }).settingsSnapshot;
  const settingsPack =
    settingsSnapshot && typeof settingsSnapshot === 'object' && 'pack' in settingsSnapshot
      ? String(settingsSnapshot.pack ?? '')
      : null;

  return (
    formatAudioPackLabel(copy, settingsPack) ??
    formatAudioPackLabel(copy, job.engineLabel) ??
    job.engineLabel
  );
}

function resolveStatusLabel(job: Job, copy: AudioWorkspaceCopy): string {
  const status = job.status ?? (job.videoUrl || job.audioUrl ? 'completed' : 'pending');
  switch (status) {
    case 'running':
      return copy.rail.statuses.running;
    case 'completed':
      return copy.rail.statuses.completed;
    case 'failed':
      return copy.rail.statuses.failed;
    default:
      return copy.rail.statuses.pending;
  }
}

function AudioJobCard({
  job,
  active,
  onSelect,
  copy,
  locale,
}: {
  job: Job;
  active: boolean;
  onSelect: () => void;
  copy: AudioWorkspaceCopy;
  locale: string;
}) {
  const priceLabel = resolveAudioJobPrice(job, locale);
  const durationLabel = typeof job.durationSec === 'number' ? `${job.durationSec}s` : null;
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
              <img src={thumb} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" loading="lazy" decoding="async" />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-white/10">
                <img src="/assets/icons/audio.svg" alt="" className="h-8 w-8 opacity-90" />
              </div>
            </div>
          </button>
        )}
        <div className="absolute left-3 top-3 rounded-full bg-surface-on-media-dark-70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
          {resolveStatusLabel(job, copy)}
        </div>
      </div>
      <div className="space-y-3 px-3 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-text-primary">{resolveJobLabel(job, copy)}</p>
            <p className="mt-1 text-xs text-text-secondary">{resolveOutputLabel(job, copy)}</p>
          </div>
          {priceLabel ? <span className="text-sm font-semibold text-text-primary">{priceLabel}</span> : null}
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.12em] text-text-muted">
          {durationLabel ? <span>{durationLabel}</span> : null}
          <span>{formatDateTime(job.createdAt, locale)}</span>
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
            {copy.rail.open}
          </Button>
          {job.videoUrl ? (
            <ButtonLink href={job.videoUrl} target="_blank" rel="noreferrer" variant="ghost" size="sm">
              {copy.rail.file}
            </ButtonLink>
          ) : job.audioUrl ? (
            <ButtonLink href={job.audioUrl} target="_blank" rel="noreferrer" variant="ghost" size="sm">
              {copy.rail.file}
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
  const { locale, t } = useI18n();
  const rawCopy = t('workspace.audio', DEFAULT_AUDIO_WORKSPACE_COPY);
  const copy = useMemo<AudioWorkspaceCopy>(() => {
    return deepmerge<AudioWorkspaceCopy>(DEFAULT_AUDIO_WORKSPACE_COPY, (rawCopy ?? {}) as Partial<AudioWorkspaceCopy>);
  }, [rawCopy]);
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
    <aside className={variant === 'desktop' ? 'flex min-h-0 w-full flex-1 flex-col' : 'flex flex-col'}>
      <div className="flex items-center justify-between px-1 pb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{copy.rail.eyebrow}</p>
          <h2 className="mt-1 text-lg font-semibold text-text-primary">{copy.rail.title}</h2>
        </div>
        <ButtonLink href="/jobs" variant="ghost" size="sm">
          {copy.rail.viewAll}
        </ButtonLink>
      </div>
      <div className={variant === 'desktop' ? 'scrollbar-rail mt-1 min-h-0 flex-1 overflow-y-auto pr-4 pt-3' : ''}>
        <div className="space-y-3">
          {error ? (
            <div className="rounded-card border border-border bg-surface p-4 text-sm text-state-warning">
              {copy.rail.loadFailed}
              <Button type="button" variant="outline" size="sm" className="ml-3" onClick={() => void mutate()}>
                {copy.rail.retry}
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
              {copy.rail.empty}
            </div>
          ) : null}
          {jobs.map((job) => (
            <AudioJobCard
              key={job.jobId}
              job={job}
              active={activeJobId === job.jobId}
              onSelect={() => onSelectJob(job.jobId)}
              copy={copy}
              locale={locale}
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
              {isValidating ? copy.rail.loading : copy.rail.loadMore}
            </Button>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
