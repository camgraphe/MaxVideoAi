'use client';

import { FirstCreationState } from '@/components/FirstCreationState.client';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { AppSidebar } from '@/components/AppSidebar';
import { HeaderBar } from '@/components/HeaderBar';
import type { GroupedJobAction } from '@/components/grouped-job-card-types';
import { Button } from '@/components/ui/Button';
import type { MediaLightboxEntry } from '@/components/MediaLightbox';
import type { GroupSummary } from '@/types/groups';
import type { VideoGroup } from '@/types/video-groups';
import type { JobsCopy } from '../_lib/jobs-copy';
import type { JobsActionFeedback, JobsMutationAction } from '../_hooks/useJobsActionFeedback';
import { JOBS_SOURCES, type JobsSource, type JobsStatus } from '../_lib/jobs-page-types';
import { filterActivityGroups } from '../_lib/jobs-activity';
import { ActivityRow } from './ActivityRow.client';
import styles from './jobs-activity.module.css';

export type { GroupedJobAction };

const GroupViewerModal = dynamic(
  () => import('@/components/groups/GroupViewerModal').then((mod) => mod.GroupViewerModal),
  { ssr: false }
);

export function JobsPageShell({
  copy, actionFeedback, onRetryAction, onDismissAction, hasCuratedVideo, groups, source, status, onSourceChange, onStatusChange,
  hasMore, isInitialLoading, isValidating, error, onRetry, onLoadMore,
  onGroupOpen, onGroupAction, allowRemove, savingImageGroupIds,
  viewerGroup, onCloseViewer, onRefreshJob, onSaveLightboxEntryToLibrary,
}: {
  copy: JobsCopy;
  actionFeedback: JobsActionFeedback[];
  onRetryAction: (groupId: string, action: JobsMutationAction) => void;
  onDismissAction: (groupId: string) => void;
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
            <Link href="/app/library" className={styles.libraryLink}>{copy.activity.mediaLibrary}</Link>
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
          {actionFeedback.map(entry => <div key={entry.groupId} data-action-status={entry.status} className={styles.notice} role={entry.status === 'error' ? 'alert' : 'status'}>
            <p>{copy.actions[`${entry.action}${entry.status === 'pending' ? 'Pending' : entry.status === 'error' ? 'Error' : 'Success'}`]}</p>
            <p className="w-full truncate text-sm text-text-muted">{entry.label}</p>
            {entry.status === 'error' ? <Button variant="outline" onClick={() => onRetryAction(entry.groupId, entry.action)}>{copy.retry}</Button> : null}
            {entry.status !== 'pending' ? <Button variant="ghost" onClick={() => onDismissAction(entry.groupId)}>{copy.actions.dismiss}</Button> : null}
          </div>)}
          <section aria-label={copy.activity.title} aria-busy={isValidating}>
            {isInitialLoading ? <><p role="status" className="sr-only">{copy.loading}</p><div className={styles.list} aria-hidden="true">{Array.from({length: 8}, (_, index) => <div key={index} className={styles.skeletonRow}><span /><div><span /><span /></div></div>)}</div></> : null}
            {!isInitialLoading && !error && !visibleGroups.length ? source === 'all' && status === 'all' && !hasMore ? <FirstCreationState /> : <p role="status" className={styles.empty}>{copy.activity.filteredEmpty}</p> : null}
            {visibleGroups.length ? <ul className={styles.list}>
              {visibleGroups.map((group) => <ActivityRow key={group.id} group={group} copy={copy}
                onOpen={onGroupOpen} onAction={onGroupAction} allowRemove={allowRemove(group)}
                savingToLibrary={savingImageGroupIds.has(group.id)} />)}
            </ul> : null}
            {hasMore ? <div className={styles.more}><Button variant="outline" onClick={onLoadMore} disabled={isValidating}>{isValidating ? copy.loading : copy.loadMore}</Button></div> : null}
          </section>
        </main>
      </div>
      {viewerGroup ? <GroupViewerModal group={viewerGroup} onClose={onCloseViewer} onRefreshJob={onRefreshJob} onSaveToLibrary={onSaveLightboxEntryToLibrary} /> : null}
    </div>
  );
}
