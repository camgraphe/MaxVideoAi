'use client';

import dynamic from 'next/dynamic';
import { AppSidebar } from '@/components/AppSidebar';
import { HeaderBar } from '@/components/HeaderBar';
import { GroupedJobCard, type GroupedJobAction } from '@/components/GroupedJobCard';
import { Button } from '@/components/ui/Button';
import type { MediaLightboxEntry } from '@/components/MediaLightbox';
import type { EngineCaps } from '@/types/engines';
import type { GroupSummary } from '@/types/groups';
import type { VideoGroup } from '@/types/video-groups';
import type { JobsCopy } from '../_lib/jobs-copy';
import { JOBS_SOURCES, type JobsSource, type JobsStatus } from '../_lib/jobs-page-types';
import { activityGroupStatus, filterActivityGroups } from '../_lib/jobs-activity';
import { resolveClientJobSurface, resolveWorkspaceJobHref } from '../_lib/jobs-page-helpers';
import { renderSkeletonCards } from './jobs-skeleton-cards';
import styles from './jobs-activity.module.css';

export type { GroupedJobAction };

const GroupViewerModal = dynamic(
  () => import('@/components/groups/GroupViewerModal').then((mod) => mod.GroupViewerModal),
  { ssr: false }
);

export function JobsPageShell({
  copy, hasCuratedVideo, groups, source, status, onSourceChange, onStatusChange,
  hasMore, isInitialLoading, isValidating, error, onRetry, onLoadMore,
  engineLookupById, onGroupOpen, onGroupAction, allowRemove, savingImageGroupIds,
  viewerGroup, onCloseViewer, onRefreshJob, onSaveLightboxEntryToLibrary,
}: {
  copy: JobsCopy;
  hasCuratedVideo: boolean;
  groups: GroupSummary[];
  source: JobsSource;
  status: JobsStatus;
  onSourceChange: (source: JobsSource) => void;
  onStatusChange: (status: JobsStatus) => void;
  hasMore: boolean;
  isInitialLoading: boolean;
  isValidating: boolean;
  error: unknown;
  onRetry: () => void;
  onLoadMore: () => void;
  engineLookupById: Map<string, EngineCaps>;
  onGroupOpen: (group: GroupSummary) => void;
  onGroupAction: (group: GroupSummary, action: GroupedJobAction) => void;
  allowRemove: (group: GroupSummary) => boolean;
  savingImageGroupIds: Set<string>;
  viewerGroup: VideoGroup | null;
  onCloseViewer: () => void;
  onRefreshJob: (jobId: string) => Promise<void>;
  onSaveLightboxEntryToLibrary: (entry: MediaLightboxEntry) => Promise<void>;
}) {
  const visibleGroups = filterActivityGroups(groups, status);
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <HeaderBar />
      <div className="flex min-w-0 flex-1">
        <AppSidebar />
        <main className={styles.activity}>
          <header className={styles.heading}>
            <div><h1>{copy.activity.title}</h1><p>{copy.activity.description}</p></div>
            <Button variant="outline" onClick={onRetry} disabled={isValidating}>
              {isValidating ? copy.loading : copy.activity.refresh}
            </Button>
          </header>
          <div className={styles.filters}>
            <label><span>{copy.activity.source}</span>
              <select value={source} onChange={(event) => onSourceChange(event.target.value as JobsSource)}>
                {JOBS_SOURCES.map((value) => <option key={value} value={value}>{copy.activity.sources[value]}</option>)}
              </select>
            </label>
            <label><span className="sr-only">{copy.activity.status}</span>
              <select value={status} onChange={(event) => onStatusChange(event.target.value as JobsStatus)} aria-describedby={status !== 'all' ? 'activity-status-hint' : undefined}>
                {(['all', 'pending', 'completed', 'failed'] as const).map((value) => <option key={value} value={value}>{copy.activity.statuses[value]}</option>)}
              </select>
            </label>
          </div>
          {status !== 'all' ? <p id="activity-status-hint" className={styles.note}>{hasMore ? copy.activity.statusHint : copy.activity.status}</p> : null}
          {hasCuratedVideo ? <p className={styles.note}>{copy.curated}</p> : null}
          {error ? <div role="alert" className={styles.notice}>{copy.error}<Button variant="outline" onClick={onRetry} disabled={isValidating}>{copy.retry}</Button></div> : null}
          <section aria-label={copy.activity.title} aria-busy={isValidating}>
            {isInitialLoading ? <><p role="status" className="sr-only">{copy.loading}</p><div className={styles.grid}>{renderSkeletonCards(4, 'activity')}</div></> : null}
            {!isInitialLoading && !error && !visibleGroups.length ? <p role="status" className={styles.empty}>{status === 'all' ? copy.empty : copy.activity.filteredEmpty}</p> : null}
            {visibleGroups.length ? <div className={styles.grid}>
              {visibleGroups.map((group) => {
                const surface = group.hero.job ? resolveClientJobSurface(group.hero.job) : 'video';
                const isImageGroup = ['image', 'storyboard', 'character', 'angle'].includes(surface);
                const heroJobId = group.hero.jobId ?? group.hero.job?.jobId;
                const groupStatus = activityGroupStatus(group);
                return <article key={group.id} className={styles.item}>
                  <GroupedJobCard
                    group={group} engine={engineLookupById.get(group.hero.engineId ?? '')}
                    onOpen={onGroupOpen} onAction={onGroupAction} allowRemove={allowRemove(group)}
                    isImageGroup={isImageGroup} savingToLibrary={savingImageGroupIds.has(group.id)}
                    imageLibraryLabel={copy.actions.addToLibrary} imageLibrarySavingLabel={copy.actions.saving}
                    recreateHref={heroJobId && surface !== 'background-removal' ? resolveWorkspaceJobHref(heroJobId, surface, isImageGroup) : undefined}
                    recreateLabel={copy.actions.recreate} openLabel={copy.actions.openDetails}
                    actionMenuLabel={copy.actions.actions} menuVariant="activity"
                  />
                  <div className={styles.caption}><span>{copy.activity.sources[surface]}</span><span data-status={groupStatus}>{copy.activity.statuses[groupStatus]}</span></div>
                  <time className={styles.date} dateTime={group.createdAt} title={new Date(group.createdAt).toLocaleString()}>{new Date(group.createdAt).toLocaleDateString()}</time>
                </article>;
              })}
            </div> : null}
            {hasMore ? <div className={styles.more}><Button variant="outline" onClick={onLoadMore} disabled={isValidating}>{isValidating ? copy.loading : copy.loadMore}</Button></div> : null}
          </section>
        </main>
      </div>
      {viewerGroup ? <GroupViewerModal group={viewerGroup} onClose={onCloseViewer} onRefreshJob={onRefreshJob} onSaveToLibrary={onSaveLightboxEntryToLibrary} /> : null}
    </div>
  );
}
