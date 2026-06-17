'use client';

import type { useWorkspaceCanvasController } from '../_hooks/useWorkspaceCanvasController';
import type { useWorkspaceProjectMediaActions } from '../_hooks/useWorkspaceProjectMediaActions';
import type { useWorkspaceSelectionActions } from '../_hooks/useWorkspaceSelectionActions';
import type { useWorkspaceSequenceActions } from '../_hooks/useWorkspaceSequenceActions';
import type { useWorkspaceSequenceSnapshots } from '../_hooks/useWorkspaceSequenceSnapshots';
import type { WorkspaceAssetRecord, WorkspaceProjectMediaFolder, WorkspaceTimelineItem } from '../_lib/workspace-types';
import type { StudioCopy } from '../../_lib/studio-copy';
import { TimelineProjectSidebar } from './TimelineProjectSidebar';

type WorkspaceProjectMediaPanelProps = {
  activeTemplateName: string;
  canvas: ReturnType<typeof useWorkspaceCanvasController>;
  projectAssets: WorkspaceAssetRecord[];
  projectMedia: ReturnType<typeof useWorkspaceProjectMediaActions>;
  projectMediaFolders: WorkspaceProjectMediaFolder[];
  selection: ReturnType<typeof useWorkspaceSelectionActions>;
  sequence: ReturnType<typeof useWorkspaceSequenceActions>;
  sequenceSnapshots: ReturnType<typeof useWorkspaceSequenceSnapshots>;
  studioCopy: StudioCopy;
  timelineItems: WorkspaceTimelineItem[];
};

export function WorkspaceProjectMediaPanel({
  activeTemplateName,
  canvas,
  projectAssets,
  projectMedia,
  projectMediaFolders,
  selection,
  sequence,
  sequenceSnapshots,
  studioCopy,
  timelineItems,
}: WorkspaceProjectMediaPanelProps) {
  return (
    <TimelineProjectSidebar
      studioCanvasNodeCopy={studioCopy.canvas.nodes}
      copy={studioCopy.viewer.projectMedia}
      nodes={canvas.renderNodes}
      projectAssets={projectAssets}
      projectMediaFolders={projectMediaFolders}
      projectName={activeTemplateName}
      sequences={sequenceSnapshots.sequenceSummaries}
      timelineItems={timelineItems}
      onDeleteGeneratedClip={projectMedia.handleDeleteGeneratedClip}
      onDeleteGeneratedClips={projectMedia.handleDeleteGeneratedClips}
      onDeleteProjectAsset={projectMedia.handleDeleteProjectAsset}
      onDeleteProjectAssets={projectMedia.handleDeleteProjectAssets}
      onDeleteProjectMediaFolder={projectMedia.handleDeleteProjectMediaFolder}
      onDeleteProjectMediaFolders={projectMedia.handleDeleteProjectMediaFolders}
      onDeleteSequence={sequence.handleDeleteSequence}
      onDeleteSequences={sequence.handleDeleteSequences}
      onDuplicateSequence={sequence.handleDuplicateSequence}
      onImportMedia={projectMedia.handleImportProjectMedia}
      onImportLocalMediaFiles={projectMedia.handleImportLocalProjectMediaFiles}
      onInspectProjectAsset={selection.handleInspectProjectAsset}
      onInspectSequence={selection.handleInspectSequence}
      onInsertGeneratedClip={canvas.handleSendOutputToTimeline}
      onInsertProjectAsset={projectMedia.handleInsertProjectAssetToTimeline}
      onMoveGeneratedClipToFolder={projectMedia.handleMoveGeneratedClipToFolder}
      onMoveProjectAssetToFolder={projectMedia.handleMoveProjectAssetToFolder}
      onNewFolder={projectMedia.handleCreateProjectMediaFolder}
      onNewSequence={sequence.handleCreateSequence}
      onRenameProjectMediaFolder={projectMedia.handleRenameProjectMediaFolder}
      onSelectSequence={sequence.handleSelectSequence}
      onClearProjectMediaInspector={selection.handleClearProjectMediaInspector}
    />
  );
}
