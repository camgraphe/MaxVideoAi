'use client';

import type { ComponentProps } from 'react';
import type { WorkspaceEditorAssetLibraryState } from '../_hooks/useWorkspaceEditorAssetLibrary';
import type { WorkspaceGraphNode } from '../_lib/workspace-types';
import { WorkspaceAssetLibraryModal } from './WorkspaceAssetLibraryModal';
import { WorkspaceExportDialog } from './WorkspaceExportDialog';
import { WorkspaceProjectMediaLibraryModal } from './WorkspaceProjectMediaLibraryModal';
import type { StudioCopy } from '../../_lib/studio-copy';

type WorkspaceExportDialogProps = ComponentProps<typeof WorkspaceExportDialog>;
type WorkspaceProjectMediaLibraryModalProps = ComponentProps<typeof WorkspaceProjectMediaLibraryModal>;

type WorkspaceRuntimeModalsProps = {
  assetLibraryCopy: StudioCopy['assetLibrary'];
  exportDialogCopy: StudioCopy['exportDialog'];
  activeExportJob: WorkspaceExportDialogProps['activeExportJob'];
  assetPickerLibrary: WorkspaceEditorAssetLibraryState;
  assetPickerNode: WorkspaceGraphNode | null;
  exportEstimate: WorkspaceExportDialogProps['exportEstimate'];
  exportQuota: WorkspaceExportDialogProps['exportQuota'];
  exportQualityPreset: WorkspaceExportDialogProps['exportQualityPreset'];
  exportRangeMode: WorkspaceExportDialogProps['exportRangeMode'];
  exportVideoFeedback: string | null;
  inPointSec: number | null;
  isExportDialogOpen: boolean;
  isExportEstimateLoading: boolean;
  isExportVideoStarting: boolean;
  isProjectMediaPickerOpen: boolean;
  manifest: WorkspaceExportDialogProps['manifest'];
  outPointSec: number | null;
  projectMediaLibrary: WorkspaceEditorAssetLibraryState;
  readinessLabel: string;
  sequenceDurationSec: number;
  onAssetPickerClose: () => void;
  onCloseExportDialog: () => void;
  onExportEdl: () => void;
  onExportVideo: () => void;
  onPrepareRender: () => void;
  onProjectMediaPickerClose: () => void;
  onQualityPresetChange: WorkspaceExportDialogProps['onQualityPresetChange'];
  onRangeModeChange: WorkspaceExportDialogProps['onRangeModeChange'];
  onSelectAsset: ComponentProps<typeof WorkspaceAssetLibraryModal>['onImportAssets'];
  onSelectProjectMediaAsset: WorkspaceProjectMediaLibraryModalProps['onSelectAsset'];
  onSelectProjectMediaAssets: WorkspaceProjectMediaLibraryModalProps['onSelectAssets'];
};

export function WorkspaceRuntimeModals({
  assetLibraryCopy,
  exportDialogCopy,
  activeExportJob,
  assetPickerLibrary,
  assetPickerNode,
  exportEstimate,
  exportQuota,
  exportQualityPreset,
  exportRangeMode,
  exportVideoFeedback,
  inPointSec,
  isExportDialogOpen,
  isExportEstimateLoading,
  isExportVideoStarting,
  isProjectMediaPickerOpen,
  manifest,
  outPointSec,
  projectMediaLibrary,
  readinessLabel,
  sequenceDurationSec,
  onAssetPickerClose,
  onCloseExportDialog,
  onExportEdl,
  onExportVideo,
  onPrepareRender,
  onProjectMediaPickerClose,
  onQualityPresetChange,
  onRangeModeChange,
  onSelectAsset,
  onSelectProjectMediaAsset,
  onSelectProjectMediaAssets,
}: WorkspaceRuntimeModalsProps) {
  return (
    <>
      <WorkspaceExportDialog
        copy={exportDialogCopy}
        activeExportJob={activeExportJob}
        exportEstimate={exportEstimate}
        exportQuota={exportQuota}
        exportRangeMode={exportRangeMode}
        exportQualityPreset={exportQualityPreset}
        exportVideoFeedback={exportVideoFeedback}
        inPointSec={inPointSec}
        isEstimateLoading={isExportEstimateLoading}
        isExportStarting={isExportVideoStarting}
        isOpen={isExportDialogOpen}
        manifest={manifest}
        outPointSec={outPointSec}
        readinessLabel={readinessLabel}
        sequenceDurationSec={sequenceDurationSec}
        onClose={onCloseExportDialog}
        onExportEdl={onExportEdl}
        onExportVideo={onExportVideo}
        onPrepareRender={onPrepareRender}
        onQualityPresetChange={onQualityPresetChange}
        onRangeModeChange={onRangeModeChange}
      />
      <WorkspaceAssetLibraryModal
        copy={assetLibraryCopy}
        node={assetPickerNode}
        assets={assetPickerLibrary.assets}
        hasMore={assetPickerLibrary.hasMore}
        isLoading={assetPickerLibrary.isLoading}
        isLoadingMore={assetPickerLibrary.isLoadingMore}
        error={assetPickerLibrary.error}
        usingFallback={assetPickerLibrary.usingFallback}
        source={assetPickerLibrary.source}
        sourceOptions={assetPickerLibrary.sourceOptions}
        sourceLabels={assetPickerLibrary.sourceLabels}
        searchQuery={assetPickerLibrary.searchQuery}
        selectedAssetIds={assetPickerLibrary.selectedAssetIds}
        onClose={onAssetPickerClose}
        onLoadMore={assetPickerLibrary.loadMore}
        onImportAssets={onSelectAsset}
        onSearchQueryChange={assetPickerLibrary.setSearchQuery}
        onSourceChange={assetPickerLibrary.setSource}
        onToggleAssetSelection={assetPickerLibrary.toggleAssetSelection}
      />
      <WorkspaceProjectMediaLibraryModal
        copy={assetLibraryCopy}
        isOpen={isProjectMediaPickerOpen}
        assets={projectMediaLibrary.assets}
        hasMore={projectMediaLibrary.hasMore}
        isLoading={projectMediaLibrary.isLoading}
        isLoadingMore={projectMediaLibrary.isLoadingMore}
        error={projectMediaLibrary.error}
        mediaKindFilter={projectMediaLibrary.kindFilter}
        usingFallback={projectMediaLibrary.usingFallback}
        source={projectMediaLibrary.source}
        sourceOptions={projectMediaLibrary.sourceOptions}
        sourceLabels={projectMediaLibrary.sourceLabels}
        onClose={onProjectMediaPickerClose}
        onLoadMore={projectMediaLibrary.loadMore}
        onMediaKindFilterChange={projectMediaLibrary.setKindFilter}
        onSelectAsset={onSelectProjectMediaAsset}
        onSelectAssets={onSelectProjectMediaAssets}
        onSourceChange={projectMediaLibrary.setSource}
      />
    </>
  );
}
