'use client';

import type { useWorkspaceExportState } from '../_hooks/useWorkspaceExportState';
import type { useWorkspaceProjectMediaActions } from '../_hooks/useWorkspaceProjectMediaActions';
import type { useWorkspaceSequenceActions } from '../_hooks/useWorkspaceSequenceActions';
import type { useWorkspaceShellActions } from '../_hooks/useWorkspaceShellActions';
import type { useWorkspaceTimelineClipActions } from '../_hooks/useWorkspaceTimelineClipActions';
import type { WorkspaceProjectSettings } from '../_lib/workspace-types';
import type { StudioCopy } from '../../_lib/studio-copy';
import { TimelineClipInspector } from './TimelineClipInspector';

type WorkspaceTimelineInspectorPanelProps = {
  exportState: ReturnType<typeof useWorkspaceExportState>;
  projectMedia: ReturnType<typeof useWorkspaceProjectMediaActions>;
  projectSettings: WorkspaceProjectSettings;
  sequence: ReturnType<typeof useWorkspaceSequenceActions>;
  shell: ReturnType<typeof useWorkspaceShellActions>;
  studioCopy: StudioCopy;
  timelineClip: ReturnType<typeof useWorkspaceTimelineClipActions>;
};

export function WorkspaceTimelineInspectorPanel({
  exportState,
  projectMedia,
  projectSettings,
  sequence,
  shell,
  studioCopy,
  timelineClip,
}: WorkspaceTimelineInspectorPanelProps) {
  return (
    <TimelineClipInspector
      copy={studioCopy.timeline.inspector}
      canvasNodeCopy={studioCopy.canvas.nodes}
      projectMediaCopy={studioCopy.viewer.projectMedia}
      selectedAsset={exportState.selectedProjectAssetForInspector}
      selectedItem={exportState.selectedTimelineItem}
      selectedSequence={exportState.selectedSequenceForInspector}
      projectSettings={projectSettings}
      projectFps={projectSettings.fps}
      onPatchItem={timelineClip.handlePatchTimelineItem}
      onRenameProjectAsset={projectMedia.handleRenameProjectAsset}
      onRenameSequence={sequence.handleRenameActiveSequence}
      onSequenceSettingsChange={shell.handleSequenceSettingsChange}
    />
  );
}
