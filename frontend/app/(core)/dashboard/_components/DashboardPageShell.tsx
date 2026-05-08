'use client';

import dynamic from 'next/dynamic';
import { AppSidebar } from '@/components/AppSidebar';
import { HeaderBar } from '@/components/HeaderBar';
import type { MediaLightboxEntry } from '@/components/MediaLightbox';
import type { EngineCaps, Mode } from '@/types/engines';
import type { GroupSummary } from '@/types/groups';
import type { Job } from '@/types/jobs';
import type { DashboardCopy } from '../_lib/dashboard-copy';
import { buildEntriesFromGroup, buildEntriesFromJob } from '../_lib/dashboard-media';
import { formatDateTime } from '../_lib/dashboard-formatters';
import { CreateHero } from './CreateHero';
import { InProgressList } from './InProgressList';
import { InsightsPanel } from './InsightsPanel';
import { RecentGrid, type RecentTypeTab } from './RecentGrid';
import { EngineStatusCompact, ToolsPanel } from './ToolsPanel';

const MediaLightbox = dynamic(
  () => import('@/components/MediaLightbox').then((mod) => mod.MediaLightbox),
  { ssr: false }
);

export type DashboardLightbox =
  | { kind: 'group'; group: GroupSummary }
  | { kind: 'job'; job: Job };

export function DashboardPageShell({
  copy,
  videoEngines,
  imageEngines,
  selectedVideoEngineId,
  selectedVideoMode,
  selectedImageEngineId,
  selectedImageMode,
  hasStoredVideoForm,
  hasStoredImageForm,
  canStartVideo,
  canStartImage,
  onVideoModeChange,
  onVideoEngineChange,
  onImageModeChange,
  onImageEngineChange,
  onNewVideo,
  onUseLastVideoSettings,
  onNewImage,
  onUseLastImageSettings,
  pendingJobs,
  recentGroups,
  isInitialLoading,
  recentIsValidating,
  hasMoreRecent,
  onOpenJob,
  onOpenGroup,
  onSaveTemplate,
  onLoadMoreRecent,
  recentTab,
  onRecentTabChange,
  spendToday,
  spend30,
  avgCost,
  runway,
  runwayFallback,
  mostUsedEngine,
  enginesError,
  lightbox,
  onCloseLightbox,
  onRemixEntry,
  onUseTemplate,
  onRefreshJob,
}: {
  copy: DashboardCopy;
  videoEngines: EngineCaps[];
  imageEngines: EngineCaps[];
  selectedVideoEngineId: string;
  selectedVideoMode: Mode;
  selectedImageEngineId: string;
  selectedImageMode: Mode;
  hasStoredVideoForm: boolean;
  hasStoredImageForm: boolean;
  canStartVideo: boolean;
  canStartImage: boolean;
  onVideoModeChange: (mode: Mode) => void;
  onVideoEngineChange: (engineId: string) => void;
  onImageModeChange: (mode: Mode) => void;
  onImageEngineChange: (engineId: string) => void;
  onNewVideo: () => void;
  onUseLastVideoSettings: () => void;
  onNewImage: () => void;
  onUseLastImageSettings: () => void;
  pendingJobs: Job[];
  recentGroups: GroupSummary[];
  isInitialLoading: boolean;
  recentIsValidating: boolean;
  hasMoreRecent: boolean;
  onOpenJob: (job: Job) => void;
  onOpenGroup: (group: GroupSummary) => void;
  onSaveTemplate: (group: GroupSummary) => void;
  onLoadMoreRecent: () => void;
  recentTab: RecentTypeTab;
  onRecentTabChange: (tab: RecentTypeTab) => void;
  spendToday: string;
  spend30: string;
  avgCost: string;
  runway: string;
  runwayFallback: string | null;
  mostUsedEngine: string | null;
  enginesError: unknown;
  lightbox: DashboardLightbox | null;
  onCloseLightbox: () => void;
  onRemixEntry: (entry: MediaLightboxEntry) => void;
  onUseTemplate: (entry: MediaLightboxEntry) => void;
  onRefreshJob: (jobId: string) => Promise<void>;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <HeaderBar />
      <div className="flex min-h-[calc(100vh-var(--header-height))] min-w-0 flex-1">
        <AppSidebar />
        <main className="min-h-[calc(100vh-var(--header-height))] min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto grid w-full max-w-[1560px] gap-6 lg:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_372px]">
            <div className="min-w-0 stack-gap-lg">
              <CreateHero
                copy={copy}
                videoEngines={videoEngines}
                imageEngines={imageEngines}
                selectedVideoEngineId={selectedVideoEngineId}
                selectedVideoMode={selectedVideoMode}
                selectedImageEngineId={selectedImageEngineId}
                selectedImageMode={selectedImageMode}
                hasStoredVideoForm={hasStoredVideoForm}
                hasStoredImageForm={hasStoredImageForm}
                canStartVideo={canStartVideo}
                canStartImage={canStartImage}
                onVideoModeChange={onVideoModeChange}
                onVideoEngineChange={onVideoEngineChange}
                onImageModeChange={onImageModeChange}
                onImageEngineChange={onImageEngineChange}
                onNewVideo={onNewVideo}
                onUseLastVideoSettings={onUseLastVideoSettings}
                onNewImage={onNewImage}
                onUseLastImageSettings={onUseLastImageSettings}
              />

              <InProgressList
                copy={copy}
                jobs={pendingJobs}
                onOpen={onOpenJob}
              />

              <RecentGrid
                copy={copy}
                groups={recentGroups}
                isLoading={isInitialLoading}
                isValidating={recentIsValidating}
                hasMore={hasMoreRecent}
                onOpenGroup={onOpenGroup}
                onSaveTemplate={onSaveTemplate}
                onLoadMore={onLoadMoreRecent}
                tab={recentTab}
                onTabChange={onRecentTabChange}
              />
            </div>

            <div className="min-w-0 stack-gap-lg lg:sticky lg:top-0 lg:self-start">
              <InsightsPanel
                copy={copy}
                spendToday={spendToday}
                spend30={spend30}
                avgCost={avgCost}
                runway={runway}
                runwayFallback={runwayFallback}
                mostUsed={mostUsedEngine}
              />

              <ToolsPanel copy={copy} />

              <EngineStatusCompact
                copy={copy}
                engines={videoEngines}
                enginesError={enginesError}
              />
            </div>
          </div>
        </main>
      </div>

      {lightbox && (
        <MediaLightbox
          title={
            lightbox.kind === 'group'
              ? copy.lightbox.groupTitle.replace('{count}', String(lightbox.group.count))
              : copy.lightbox.jobTitle.replace('{id}', lightbox.job.jobId)
          }
          subtitle={
            lightbox.kind === 'group'
              ? lightbox.group.hero.engineLabel
              : `${lightbox.job.engineLabel} • ${formatDateTime(lightbox.job.createdAt)}`
          }
          prompt={lightbox.kind === 'group' ? lightbox.group.hero.prompt ?? null : lightbox.job.prompt}
          metadata={
            lightbox.kind === 'group'
              ? [
                  { label: copy.lightbox.metadata.created, value: formatDateTime(lightbox.group.createdAt) },
                  {
                    label: copy.lightbox.metadata.heroDuration,
                    value: lightbox.group.hero.durationSec
                      ? `${lightbox.group.hero.durationSec}s`
                      : copy.lightbox.metadata.notProvided,
                  },
                  { label: copy.lightbox.metadata.engine, value: lightbox.group.hero.engineLabel },
                ]
              : [
                  { label: copy.lightbox.metadata.duration, value: `${lightbox.job.durationSec}s` },
                  {
                    label: copy.lightbox.metadata.status,
                    value: lightbox.job.paymentStatus ?? copy.lightbox.statusFallback,
                  },
                  { label: copy.lightbox.metadata.created, value: formatDateTime(lightbox.job.createdAt) },
                ]
          }
          entries={
            lightbox.kind === 'group'
              ? buildEntriesFromGroup(lightbox.group, copy.lightbox.versionLabel)
              : buildEntriesFromJob(lightbox.job)
          }
          onClose={onCloseLightbox}
          onRemixEntry={onRemixEntry}
          remixLabel={copy.actions.remix}
          onUseTemplate={onUseTemplate}
          templateLabel={copy.actions.template}
          onRefreshEntry={(entry) => {
            const jobId = entry.jobId ?? entry.id;
            if (!jobId) return;
            return onRefreshJob(jobId);
          }}
        />
      )}
    </div>
  );
}
