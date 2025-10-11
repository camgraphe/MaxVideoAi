'use client';

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
import { CURRENCY_LOCALE } from '@/lib/intl';
import { MediaLightbox, type MediaLightboxEntry } from '@/components/MediaLightbox';
import { getAspectRatioString } from '@/lib/aspect';

export default function JobsPage() {
  const { data: enginesData } = useEngines();
  const { data, error, isLoading, size, setSize, isValidating, mutate } = useInfiniteJobs(24);

  const pages = data ?? [];
  const jobs = pages.flatMap((p) => p.jobs);
  const hasMore = pages.length === 0 ? false : pages[pages.length - 1].nextCursor !== null;

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
      void mutate();
    };
    window.addEventListener('jobs:hidden', handleHidden);
    return () => window.removeEventListener('jobs:hidden', handleHidden);
  }, [mutate]);

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

  const toAspectValue = useCallback((ratio?: string | null) => getAspectRatioString(ratio), []);

  const handleCopyPrompt = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {}
  }, []);

  type JobsMasonryItem = { kind: 'group'; group: GroupSummary } | { kind: 'job'; job: Job } | { kind: 'placeholder'; id: string };
  const placeholderItems = useMemo<JobsMasonryItem[]>(
    () =>
      Array.from({ length: 12 }, (_, index) => ({
        kind: 'placeholder',
        id: `jobs-placeholder-${index}`,
      })),
    []
  );
  const [lightbox, setLightbox] = useState<{ kind: 'group'; group: GroupSummary } | { kind: 'job'; job: Job } | null>(null);
  const handleRemoveJob = useCallback(
    async (job: Job) => {
      try {
        await hideJob(job.jobId);
        setLightbox((current) =>
          current && current.kind === 'job' && current.job.jobId === job.jobId ? null : current
        );
        await mutate(
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
    [mutate]
  );
  const isInitialLoading = isLoading && jobs.length === 0 && groupedJobs.length === 0;
  const masonryItems: JobsMasonryItem[] = useMemo(() => {
    if (isInitialLoading) return placeholderItems;
    const items: JobsMasonryItem[] = [];
    groupedJobs.forEach((group) => {
      items.push({ kind: 'group', group });
    });
    ungroupedJobs.forEach((job) => {
      items.push({ kind: 'job', job });
    });
    return items.length ? items : placeholderItems;
  }, [groupedJobs, ungroupedJobs, isInitialLoading, placeholderItems]);

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
                if (item.kind === 'group') {
                  const heroEngineId = item.group.hero.engineId ?? null;
                  const heroEngineLabelKey = item.group.hero.engineLabel?.toLowerCase?.() ?? null;
                  const heroEngine = heroEngineId
                    ? engineLookup.byId.get(heroEngineId)
                    : heroEngineLabelKey
                      ? engineLookup.byLabel.get(heroEngineLabelKey)
                      : undefined;
                  return (
                    <div key={`group-${item.group.id}`} className="mb-3 break-inside-avoid">
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
                    <div key={item.job.jobId} className="mb-3 break-inside-avoid">
                      <JobsJobCard
                        job={item.job}
                        aspect={toAspectValue(item.job.aspectRatio)}
                        onCopyPrompt={handleCopyPrompt}
                        engine={resolveEngine(item.job)}
                        onOpen={() => setLightbox({ kind: 'job', job: item.job })}
                        onRemove={handleRemoveJob}
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
                  { label: 'Créé le', value: formatDateTime(lightbox.job.createdAt) },
                  { label: 'Durée', value: `${lightbox.job.durationSec}s` },
                  { label: 'Moteur', value: lightbox.job.engineLabel },
                ]
          }
          entries={lightbox.kind === 'group' ? buildEntriesFromGroup(lightbox.group) : buildEntriesFromJob(lightbox.job)}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}

function JobsJobCard({
  job,
  aspect,
  onCopyPrompt,
  engine,
  onOpen,
  onRemove,
}: {
  job: Job;
  aspect: string;
  onCopyPrompt: (prompt: string) => void;
  engine?: EngineCaps | undefined;
  onOpen?: () => void;
  onRemove?: (job: Job) => void;
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
      <div
        className="relative w-full cursor-pointer"
        style={{ aspectRatio: aspect }}
        onClick={() => onOpen?.()}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onOpen?.();
          }
        }}
      >
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
            <EngineIcon engine={engine} label={job.engineLabel} size={20} className="shrink-0" />
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
