import { useState } from 'react';
import clsx from 'clsx';
import { Button, ButtonLink } from '@/components/ui/Button';
import { GroupPreviewMedia } from '@/components/GroupedJobCard';
import type { JobSurface } from '@/types/billing';
import type { GroupSummary } from '@/types/groups';
import { resolveWorkspaceJobHref, shouldFillDashboardPreview } from '../_lib/dashboard-media';
import type { DashboardCopy } from '../_lib/dashboard-copy';

export type RecentTypeTab = 'all' | JobSurface;

const RECENT_TYPE_TABS: readonly RecentTypeTab[] = ['all', 'video', 'image', 'character', 'angle', 'upscale', 'audio'];

export function RecentGrid({
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
                <DashboardRecentPreviewCard
                  group={group}
                  noPreviewLabel={copy.actions.noPreview}
                  onOpen={() => onOpenGroup(group)}
                />
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

function DashboardRecentPreviewCard({
  group,
  noPreviewLabel,
  onOpen,
}: {
  group: GroupSummary;
  noPreviewLabel: string;
  onOpen: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [isPreviewWarm, setIsPreviewWarm] = useState(false);
  const previewCount = Math.max(1, Math.min(4, group.count));
  const previews = group.previews.length >= 4 ? group.previews.slice(0, 4) : group.previews;
  const previewGridClass =
    previewCount === 1
      ? 'grid-cols-1'
      : previewCount === 3
        ? 'grid-cols-3'
        : 'grid-cols-2';
  const hasAnyPreview = previews.some((preview) => preview?.previewVideoUrl || preview?.videoUrl || preview?.thumbUrl);

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      onClick={onOpen}
      onPointerEnter={() => {
        setIsPreviewWarm(true);
        setHovered(true);
      }}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => {
        setIsPreviewWarm(true);
        setHovered(true);
      }}
      onBlur={() => setHovered(false)}
      className="group relative min-h-0 h-auto w-full overflow-hidden rounded-card border border-transparent bg-transparent p-0 shadow-none hover:bg-transparent"
    >
      <div className="relative w-full overflow-hidden rounded-[inherit]" style={{ aspectRatio: '16 / 9' }}>
        <div
          className={clsx(
            'absolute inset-0 grid overflow-hidden rounded-[inherit] bg-surface',
            previewGridClass,
            previewCount === 1 ? 'p-0' : 'gap-1 p-1'
          )}
        >
          {Array.from({ length: previewCount }).map((_, index) => {
            const preview = previews[index];
            const member = preview ? group.members.find((entry) => entry.id === preview.id) : undefined;
            const memberAudioUrl = member?.audioUrl ?? member?.job?.audioUrl ?? null;
            const shouldFillPreview = shouldFillDashboardPreview(
              preview?.aspectRatio ?? member?.aspectRatio ?? member?.job?.aspectRatio ?? group.hero.aspectRatio
            );
            return (
              <div
                key={preview?.id ? `${preview.id}-${index}` : `dashboard-preview-${group.id}-${index}`}
                className={clsx(
                  'relative flex items-center justify-center overflow-hidden',
                  shouldFillPreview ? 'bg-surface' : 'bg-[#05070d]',
                  previewCount === 1 ? 'rounded-[inherit]' : 'rounded-card'
                )}
              >
                {preview ? (
                  <GroupPreviewMedia
                    preview={preview}
                    audioUrl={memberAudioUrl}
                    audioLabel={preview.previewVideoUrl || preview.videoUrl ? null : 'Audio'}
                    shouldPlay={hovered}
                    shouldWarm={isPreviewWarm || hovered}
                    fit={shouldFillPreview ? 'cover' : 'contain'}
                  />
                ) : null}
              </div>
            );
          })}
          {!hasAnyPreview ? (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-text-muted">
              {noPreviewLabel}
            </div>
          ) : null}
        </div>
      </div>
      <div className="pointer-events-none absolute inset-0 z-[1] rounded-[inherit] bg-black/0 transition-colors duration-150 group-hover:bg-black/10 group-focus-visible:bg-black/10" />
      <div className="absolute left-3 top-3 z-[2] max-w-[calc(100%-1.5rem)] truncate rounded-pill bg-surface-on-media-dark-60 px-2 py-1 text-[11px] font-semibold text-on-inverse">
        {group.hero.engineLabel}
      </div>
    </Button>
  );
}

