'use client';

import type { ComponentProps, ReactNode } from 'react';
import dynamic from 'next/dynamic';
import type { GalleryRailProps } from '@/components/GalleryRail';
import type { EngineCaps, Mode } from '@/types/engines';
import type { GroupSummary } from '@/types/groups';
import type { VideoGroup } from '@/types/video-groups';
import { GalleryRailSkeleton } from './WorkspaceBootSkeletons';
import { WorkspaceCenterGallery } from './WorkspaceCenterGallery';
import { WorkspaceChrome } from './WorkspaceChrome';
import { WorkspacePreviewDock } from './WorkspacePreviewDock';

const GalleryRail = dynamic<GalleryRailProps>(
  () => import('@/components/GalleryRail').then((mod) => mod.GalleryRail),
  {
    ssr: false,
    loading: () => <GalleryRailSkeleton />,
  }
);

type CenterGalleryProps = ComponentProps<typeof WorkspaceCenterGallery>;
type PreviewDockProps = ComponentProps<typeof WorkspacePreviewDock>;

type WorkspaceAppShellProps = {
  isDesktopLayout: boolean;
  selectedEngine: EngineCaps;
  engines: EngineCaps[];
  normalizedPendingGroups: GroupSummary[];
  openGroupViaGallery: GalleryRailProps['onOpenGroup'];
  handleGalleryGroupAction: GalleryRailProps['onGroupAction'];
  handleGalleryFeedStateChange: GalleryRailProps['onFeedStateChange'];
  notice: string | null;
  showCenterGallery: boolean;
  engineMap: ReadonlyMap<string, EngineCaps>;
  isGenerationLoading: boolean;
  generationSkeletonCount: number;
  galleryEmptyLabel: string;
  handleActiveGroupOpen: CenterGalleryProps['onOpenGroup'];
  handleActiveGroupAction: CenterGalleryProps['onGroupAction'];
  displayCompositeGroup: VideoGroup | null;
  previewAutoPlayRequestId: PreviewDockProps['autoPlayRequestId'];
  sharedPrompt: string | null;
  hasSharedVideoSettings: boolean;
  handleCopySharedPrompt: () => void;
  guidedNavigation: PreviewDockProps['guidedNavigation'];
  engineId: string;
  selectedEngineId: string;
  activeMode: Mode;
  engineModeOptions: Mode[] | undefined;
  modeLabelLocale: string;
  handleEngineChange: (engineId: string) => void;
  handleModeChange: (mode: Mode) => void;
  renderGroups: PreviewDockProps['renderGroups'];
  compositeOverrideSummary: PreviewDockProps['compositeOverrideSummary'];
  setViewerTarget: PreviewDockProps['setViewerTarget'];
  composerSurface: ReactNode;
};

export function WorkspaceAppShell({
  isDesktopLayout,
  selectedEngine,
  engines,
  normalizedPendingGroups,
  openGroupViaGallery,
  handleGalleryGroupAction,
  handleGalleryFeedStateChange,
  notice,
  showCenterGallery,
  engineMap,
  isGenerationLoading,
  generationSkeletonCount,
  galleryEmptyLabel,
  handleActiveGroupOpen,
  handleActiveGroupAction,
  displayCompositeGroup,
  previewAutoPlayRequestId,
  sharedPrompt,
  hasSharedVideoSettings,
  handleCopySharedPrompt,
  guidedNavigation,
  engineId,
  selectedEngineId,
  activeMode,
  engineModeOptions,
  modeLabelLocale,
  handleEngineChange,
  handleModeChange,
  renderGroups,
  compositeOverrideSummary,
  setViewerTarget,
  composerSurface,
}: WorkspaceAppShellProps) {
  return (
    <WorkspaceChrome
      isDesktopLayout={isDesktopLayout}
      desktopRail={
        <GalleryRail
          engine={selectedEngine}
          engineRegistry={engines}
          activeGroups={normalizedPendingGroups}
          onOpenGroup={openGroupViaGallery}
          onGroupAction={handleGalleryGroupAction}
          onFeedStateChange={handleGalleryFeedStateChange}
          variant="desktop"
        />
      }
      mobileRail={
        <GalleryRail
          engine={selectedEngine}
          engineRegistry={engines}
          activeGroups={normalizedPendingGroups}
          onOpenGroup={openGroupViaGallery}
          onGroupAction={handleGalleryGroupAction}
          onFeedStateChange={handleGalleryFeedStateChange}
          variant="mobile"
        />
      }
    >
      {notice && (
        <div className="rounded-card border border-warning-border bg-warning-bg px-4 py-2 text-sm text-warning shadow-card">
          {notice}
        </div>
      )}
      <div className="stack-gap-lg">
        <WorkspaceCenterGallery
          show={showCenterGallery}
          groups={normalizedPendingGroups}
          engineMap={engineMap}
          isGenerationLoading={isGenerationLoading}
          generationSkeletonCount={generationSkeletonCount}
          emptyLabel={galleryEmptyLabel}
          onOpenGroup={handleActiveGroupOpen}
          onGroupAction={handleActiveGroupAction}
        />
        <WorkspacePreviewDock
          group={displayCompositeGroup}
          isLoading={isGenerationLoading && !displayCompositeGroup}
          autoPlayRequestId={previewAutoPlayRequestId}
          sharedPrompt={sharedPrompt}
          hasSharedVideoSettings={hasSharedVideoSettings}
          onCopySharedPrompt={handleCopySharedPrompt}
          guidedNavigation={guidedNavigation}
          engines={engines}
          engineId={engineId}
          selectedEngineId={selectedEngineId}
          activeMode={activeMode}
          engineModeOptions={engineModeOptions}
          modeLabelLocale={modeLabelLocale}
          onEngineChange={handleEngineChange}
          onModeChange={handleModeChange}
          renderGroups={renderGroups}
          compositeOverrideSummary={compositeOverrideSummary}
          setViewerTarget={setViewerTarget}
        />
        {composerSurface}
      </div>
    </WorkspaceChrome>
  );
}
