'use client';

import { useId, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { recentMediaCopy } from '@/components/library/recent-media-copy';
import { AppGlyph } from '@/components/app/AppGlyph';
import type { RecentReferenceDropProps } from './WorkspaceRecentReferences.client';
import dynamic from 'next/dynamic';
import { focusWorkspaceRecentTarget } from '../_lib/workspace-recent-focus';
import { WorkspaceCreationHeading } from './WorkspaceCreationHeading';
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
    loading: () => <GalleryRailSkeleton responsive />,
  }
);

type CenterGalleryProps = ComponentProps<typeof WorkspaceCenterGallery>;
type PreviewDockProps = ComponentProps<typeof WorkspacePreviewDock>;

type WorkspaceAppShellProps = {
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
  disabledEngineReasons?: Record<string, string>;
  engineScores?: Record<string, number>;
  renderGroups: PreviewDockProps['renderGroups'];
  compositeOverrideSummary: PreviewDockProps['compositeOverrideSummary'];
  setViewerTarget: PreviewDockProps['setViewerTarget'];
  composerSurface: ReactNode;
  modelReviewCommands?: ReactNode;
  recentMedia?: ReactNode;
  onOpenRecentMedia?: () => void;
  recentDropProps?: RecentReferenceDropProps;
};

export function WorkspaceAppShell({
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
  disabledEngineReasons,
  engineScores,
  renderGroups,
  compositeOverrideSummary,
  setViewerTarget,
  composerSurface,
  modelReviewCommands,
  recentMedia,
  onOpenRecentMedia,
  recentDropProps,
}: WorkspaceAppShellProps) {
  const [railView, setRailView] = useState<'activity' | 'recent'>('activity');
  const [mobileRecentOpen, setMobileRecentOpen] = useState(false);
  const recentPanelRef = useRef<HTMLDivElement>(null);
  const recentOpenerRef = useRef<HTMLButtonElement>(null);
  const recentPanelId = useId();
  const copy = recentMediaCopy(modeLabelLocale);
  const closeMobileRecent = () => {
    setMobileRecentOpen(false);
    setRailView('activity');
    if (window.matchMedia('(min-width: 768px)').matches) return;
    requestAnimationFrame(() => {
      const opener = recentOpenerRef.current;
      focusWorkspaceRecentTarget(opener, opener?.closest<HTMLElement>('.app-creation-heading') ?? opener);
    });
  };
  const openRecentMedia = () => {
    if (railView !== 'recent') onOpenRecentMedia?.();
    setRailView('recent');
    setMobileRecentOpen(true);
  };
  return (
    <WorkspaceChrome
      rail={
        <div className="app-media-rail">
          {recentMedia ? <div className="app-media-rail-switch" aria-label={copy.title}>
            <button type="button" aria-pressed={railView === 'activity'} onClick={() => { setRailView('activity'); setMobileRecentOpen(false); }}>{copy.activity}</button>
            <button type="button" aria-pressed={railView === 'recent'} onClick={openRecentMedia}>{copy.title}</button>
          </div> : null}
          <div hidden={railView !== 'activity'}>
        <GalleryRail
          engine={selectedEngine}
          engineRegistry={engines}
          activeGroups={normalizedPendingGroups}
          selectedGroupId={compositeOverrideSummary?.id ?? null}
          onOpenGroup={openGroupViaGallery}
          onGroupAction={handleGalleryGroupAction}
          onFeedStateChange={handleGalleryFeedStateChange}
          variant="responsive"
        />
          </div>
          {recentMedia ? <div id={recentPanelId} ref={recentPanelRef} tabIndex={-1} hidden={railView !== 'recent'}
            className={`app-recent-rail-panel${mobileRecentOpen ? ' is-mobile-open' : ''}`}
            onKeyDown={(event) => { if (event.key === 'Escape') { closeMobileRecent(); } }}>
            <button className="app-recent-mobile-close" type="button" onClick={closeMobileRecent}>{copy.close}</button>
            {recentMedia}
          </div> : null}
        </div>
      }
    >
      <WorkspaceCreationHeading action={recentMedia ? <button ref={recentOpenerRef} className="app-recent-mobile-open" type="button" aria-expanded={mobileRecentOpen} aria-controls={recentPanelId}
        onClick={() => { openRecentMedia(); requestAnimationFrame(() => { focusWorkspaceRecentTarget(recentPanelRef.current); }); }}><AppGlyph name="library" />{copy.title}</button> : null} />
      {notice && (
        <div className="rounded-card border border-warning-border bg-warning-bg px-4 py-2 text-sm text-warning shadow-card">
          {notice}
        </div>
      )}
      <div className="flex flex-col gap-2 sm:gap-3">
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
          modelReviewCommands={modelReviewCommands}
          onModeChange={handleModeChange}
          disabledEngineReasons={disabledEngineReasons}
          engineScores={engineScores}
          renderGroups={renderGroups}
          compositeOverrideSummary={compositeOverrideSummary}
          setViewerTarget={setViewerTarget}
        />
        <div {...recentDropProps}>{composerSurface}</div>
      </div>
    </WorkspaceChrome>
  );
}
