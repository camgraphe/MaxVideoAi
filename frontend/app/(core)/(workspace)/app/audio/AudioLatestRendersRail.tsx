'use client';

/* eslint-disable @next/next/no-img-element */

import deepmerge from 'deepmerge';
import { useMemo } from 'react';
import { MoreVertical, Play, Volume2 } from 'lucide-react';

import { Button, ButtonLink } from '@/components/ui/Button';
import { useInfiniteJobs } from '@/lib/api';
import { formatAudioDurationLabel } from '@/lib/audio-generation';
import { useI18n } from '@/lib/i18n/I18nProvider';
import type { Job } from '@/types/jobs';
import { UIIcon } from '@/components/ui/UIIcon';
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

function WaveformBars({ seed }: { seed: string }) {
  const bars = useMemo(() => {
    let hash = 0;
    for (let index = 0; index < seed.length; index += 1) {
      hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
    }
    return Array.from({ length: 72 }, (_, index) => {
      const value = Math.sin((hash + index * 17) * 0.19) + Math.cos((hash + index * 11) * 0.11);
      return 18 + Math.abs(value) * 23 + ((index % 9) / 9) * 12;
    });
  }, [seed]);

  return (
    <div className="flex h-12 items-center gap-[2px]" aria-hidden>
      {bars.map((height, index) => (
        <span
          key={`${seed}-wave-${index}`}
          className="w-[2px] rounded-full bg-brand shadow-[0_0_12px_rgba(46,99,216,0.22)]"
          style={{ height: `${Math.min(52, Math.max(8, height))}%` }}
        />
      ))}
    </div>
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
  const durationLabel = typeof job.durationSec === 'number' ? formatAudioDurationLabel(job.durationSec) : null;

  return (
    <article
      className={[
        'overflow-hidden rounded-[10px] border bg-surface p-3 shadow-card transition',
        active ? 'border-brand ring-1 ring-brand/30' : 'border-hairline hover:border-brand/45',
      ].join(' ')}
    >
      <button type="button" className="block w-full text-left" onClick={onSelect}>
        <div className="inline-flex rounded-[6px] border border-success-border bg-success-bg px-2 py-1 text-[10px] font-semibold uppercase tracking-micro text-success">
          {resolveStatusLabel(job, copy)}
        </div>
        <div className="mt-3 rounded-[8px] bg-[linear-gradient(180deg,var(--surface),var(--bg))] px-3 py-2">
          <WaveformBars seed={job.jobId} />
        </div>

        <div className="mt-3 flex items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-on-brand shadow-[0_10px_22px_rgba(46,99,216,0.18)]">
            <UIIcon icon={Play} size={15} />
          </span>
          <span className="text-xs font-semibold text-text-primary">0:00 / {durationLabel ?? '--'}</span>
          <span className="h-1 flex-1 rounded-full bg-surface-3" />
          <Volume2 className="h-4 w-4 shrink-0 text-text-secondary" aria-hidden />
          <MoreVertical className="h-4 w-4 shrink-0 text-text-secondary" aria-hidden />
        </div>

        <div className="mt-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-text-primary">{resolveJobLabel(job, copy)}</p>
            <p className="mt-1 truncate text-xs text-text-secondary">{resolveOutputLabel(job, copy)}</p>
          </div>
          {priceLabel ? <span className="rounded-[6px] border border-hairline bg-bg px-2 py-1 text-xs font-semibold text-text-primary">{priceLabel}</span> : null}
        </div>
        <p className="mt-3 text-xs text-text-muted">{formatDateTime(job.createdAt, locale)}</p>
      </button>

      <div className="mt-3 flex gap-2">
        <Button type="button" variant="outline" size="sm" className="flex-1" onClick={onSelect}>
          {copy.rail.open}
        </Button>
        <div className="flex">
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
      <div className="flex items-center justify-between pb-4">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">{copy.rail.title}</h2>
        </div>
        <ButtonLink href="/jobs" variant="ghost" size="sm" className="text-brand">
          {copy.rail.viewAll}
        </ButtonLink>
      </div>
      <div className={variant === 'desktop' ? 'scrollbar-rail min-h-0 flex-1 overflow-y-auto pr-1' : ''}>
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
