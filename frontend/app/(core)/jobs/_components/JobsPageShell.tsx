'use client';

import dynamic from 'next/dynamic';
import { ChevronDown } from 'lucide-react';
import { useCallback } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { HeaderBar } from '@/components/HeaderBar';
import { GroupedJobCard, type GroupedJobAction } from '@/components/GroupedJobCard';
import { Button } from '@/components/ui/Button';
import type { MediaLightboxEntry } from '@/components/MediaLightbox';
import type { EngineCaps } from '@/types/engines';
import type { GroupSummary } from '@/types/groups';
import type { VideoGroup } from '@/types/video-groups';
import type { JobsCopy } from '../_lib/jobs-copy';
import type { JobsPageSection, JobsSectionKey } from '../_lib/jobs-page-types';
import { resolveClientJobSurface, resolveWorkspaceJobHref } from '../_lib/jobs-page-helpers';
import { CollapsedGroupRail, CollapsedGroupRailSkeleton } from './jobs-collapsed-rail';
import { renderSkeletonCards } from './jobs-skeleton-cards';

export type { GroupedJobAction };

const GroupViewerModal = dynamic(
  () => import('@/components/groups/GroupViewerModal').then((mod) => mod.GroupViewerModal),
  { ssr: false }
);

export function JobsPageShell({
  copy,
  hasCuratedVideo,
  sections,
  collapsedSections,
  onToggleSection,
  engineLookupById,
  onGroupOpen,
  onGroupAction,
  allowRemove,
  savingImageGroupIds,
  onSaveGroupToLibrary,
  viewerGroup,
  onCloseViewer,
  onRefreshJob,
  onSaveLightboxEntryToLibrary,
}: {
  copy: JobsCopy;
  hasCuratedVideo: boolean;
  sections: JobsPageSection[];
  collapsedSections: Record<JobsSectionKey, boolean>;
  onToggleSection: (section: JobsSectionKey) => void;
  engineLookupById: Map<string, EngineCaps>;
  onGroupOpen: (group: GroupSummary) => void;
  onGroupAction: (group: GroupSummary, action: GroupedJobAction) => void;
  allowRemove: (group: GroupSummary) => boolean;
  savingImageGroupIds: Set<string>;
  onSaveGroupToLibrary: (group: GroupSummary) => void;
  viewerGroup: VideoGroup | null;
  onCloseViewer: () => void;
  onRefreshJob: (jobId: string) => Promise<void>;
  onSaveLightboxEntryToLibrary: (entry: MediaLightboxEntry) => Promise<void>;
}) {
  const renderGroupGrid = useCallback(
    (
      groups: GroupSummary[],
      emptyCopy: string,
      prefix: string,
      options: {
        forceImageGroup: boolean;
        hasMore: boolean;
        isInitialLoading: boolean;
        isValidating: boolean;
        error?: unknown;
        onRetry: () => void;
      }
    ) => {
      if (options.error) {
        return (
          <div className="rounded-card border border-border bg-surface p-4 text-state-warning">
            {copy.error}
            <Button type="button" variant="outline" size="sm" onClick={options.onRetry} className="ml-3 px-2 text-sm">
              {copy.retry}
            </Button>
          </div>
        );
      }
      if (!groups.length) {
        if (options.isInitialLoading) {
          return (
            <div className="grid grid-gap-sm sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {renderSkeletonCards(4, `${prefix}-initial`)}
            </div>
          );
        }
        return (
          <div className="rounded-card border border-border bg-surface p-6 text-center text-sm text-text-secondary">
            {emptyCopy}
          </div>
        );
      }
      return (
        <div className="grid grid-gap-sm sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {groups.map((group) => {
            const engineId = group.hero.engineId;
            const engine = engineId ? engineLookupById.get(engineId) ?? null : null;
            const heroJobId = group.hero.jobId ?? group.hero.job?.jobId ?? null;
            const heroSurface = group.hero.job ? resolveClientJobSurface(group.hero.job) : options.forceImageGroup ? 'image' : 'video';
            const recreateHref =
              heroJobId
                ? resolveWorkspaceJobHref(heroJobId, heroSurface, options.forceImageGroup)
                : undefined;
            return (
              <GroupedJobCard
                key={group.id}
                group={group}
                engine={engine ?? undefined}
                onOpen={onGroupOpen}
                onAction={onGroupAction}
                allowRemove={allowRemove(group)}
                isImageGroup={options.forceImageGroup}
                savingToLibrary={savingImageGroupIds.has(group.id)}
                imageLibraryLabel={copy.actions.addToLibrary}
                imageLibrarySavingLabel={copy.actions.saving}
                showLibraryCta
                recreateHref={recreateHref}
                recreateLabel={copy.actions.recreate}
                openLabel={copy.actions.openDetails}
                actionMenuLabel={copy.actions.actions}
                menuVariant="compact"
              />
            );
          })}
          {options.isValidating && options.hasMore && renderSkeletonCards(2, `${prefix}-more`)}
        </div>
      );
    },
    [
      allowRemove,
      copy.actions.actions,
      copy.actions.addToLibrary,
      copy.actions.openDetails,
      copy.actions.recreate,
      copy.actions.saving,
      copy.error,
      copy.retry,
      engineLookupById,
      onGroupAction,
      onGroupOpen,
      savingImageGroupIds,
    ]
  );

  const renderCollapsedRail = useCallback(
    (groups: GroupSummary[], emptyCopy: string, isInitialLoading: boolean) => {
      if (!groups.length) {
        if (isInitialLoading) {
          return <CollapsedGroupRailSkeleton />;
        }
        return (
          <div className="rounded-card border border-border bg-surface p-4 text-center text-sm text-text-secondary">
            {emptyCopy}
          </div>
        );
      }

      return (
        <CollapsedGroupRail
          groups={groups}
          onOpen={onGroupOpen}
          onSaveToLibrary={onSaveGroupToLibrary}
          savingIds={savingImageGroupIds}
          addLabel={copy.actions.addToLibrary}
          savingLabel={copy.actions.saving}
        />
      );
    },
    [copy.actions.addToLibrary, copy.actions.saving, onGroupOpen, onSaveGroupToLibrary, savingImageGroupIds]
  );

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <HeaderBar />
      <div className="flex flex-1 min-w-0">
        <AppSidebar />
        <main className="flex-1 min-w-0 overflow-y-auto p-5 lg:p-7">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-xl font-semibold text-text-primary">{copy.title}</h1>
          </div>

          {hasCuratedVideo ? (
            <div className="mb-4 rounded-card border border-hairline bg-surface p-4 text-sm text-text-secondary">
              {copy.curated}
            </div>
          ) : null}

          {sections.map((section, index) => (
            <section key={section.key} className={index < sections.length - 1 ? 'mb-8' : undefined}>
              <div className="mb-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onToggleSection(section.key)}
                  aria-label={`${collapsedSections[section.key] ? copy.actions.expandSection : copy.actions.collapseSection} ${section.title}`}
                  className="w-full justify-between gap-3 rounded-card border border-border bg-surface px-3 py-2 text-sm font-semibold text-text-primary shadow-card hover:bg-surface-glass-80"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-text-secondary transition-transform ${collapsedSections[section.key] ? '-rotate-90' : 'rotate-0'}`}
                      aria-hidden="true"
                    />
                    <span className="truncate text-left">{section.title}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-text-secondary">
                    <span className="rounded-pill border border-hairline bg-bg px-2 py-0.5">{section.groups.length}</span>
                    <span className="hidden font-semibold sm:inline">
                      {collapsedSections[section.key] ? copy.actions.expandSection : copy.actions.collapseSection}
                    </span>
                  </span>
                </Button>
              </div>
              {section.error ? (
                renderGroupGrid(section.groups, section.empty, section.key, {
                  forceImageGroup: section.forceImageGroup,
                  hasMore: section.hasMore,
                  isInitialLoading: section.isInitialLoading,
                  isValidating: section.isValidating,
                  error: section.error,
                  onRetry: section.onRetry,
                })
              ) : collapsedSections[section.key] ? (
                renderCollapsedRail(section.groups, section.empty, section.isInitialLoading)
              ) : (
                <>
                  {renderGroupGrid(section.groups, section.empty, section.key, {
                    forceImageGroup: section.forceImageGroup,
                    hasMore: section.hasMore,
                    isInitialLoading: section.isInitialLoading,
                    isValidating: section.isValidating,
                    onRetry: section.onRetry,
                  })}
                  {section.groups.length > 0 && section.hasMore ? (
                    <div className="mt-4 flex justify-center">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={section.onLoadMore}
                        disabled={section.isValidating}
                        className="border-border bg-surface px-4 text-sm font-medium text-text-primary shadow-card hover:bg-surface-glass-80"
                      >
                        {section.isValidating ? copy.loading : copy.loadMore}
                      </Button>
                    </div>
                  ) : null}
                </>
              )}
            </section>
          ))}
        </main>
      </div>
      {viewerGroup ? (
        <GroupViewerModal
          group={viewerGroup}
          onClose={onCloseViewer}
          onRefreshJob={onRefreshJob}
          onSaveToLibrary={onSaveLightboxEntryToLibrary}
        />
      ) : null}
    </div>
  );
}
