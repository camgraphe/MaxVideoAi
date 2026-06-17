'use client';

import type { useWorkspaceCanvasController } from '../_hooks/useWorkspaceCanvasController';
import type { WorkspaceGraphEdge, WorkspaceModelCapability } from '../_lib/workspace-types';
import type { StudioCopy } from '../../_lib/studio-copy';
import { NodeSettingsPanel } from './NodeSettingsPanel';

type WorkspaceCanvasInspectorPanelProps = {
  canvas: ReturnType<typeof useWorkspaceCanvasController>;
  capabilities: WorkspaceModelCapability[];
  edges: WorkspaceGraphEdge[];
  studioCopy: StudioCopy;
};

export function WorkspaceCanvasInspectorPanel({
  canvas,
  capabilities,
  edges,
  studioCopy,
}: WorkspaceCanvasInspectorPanelProps) {
  return (
    <NodeSettingsPanel
      copy={studioCopy.canvas.nodes}
      selectedNode={canvas.selectedNode}
      edges={edges}
      capabilities={capabilities}
      onPatchNodeData={canvas.patchNodeData}
      onPatchShot={canvas.patchShot}
      onGenerateShot={canvas.handleGenerateShot}
      onRunChat={canvas.handleRunChat}
      onSendOutputToTimeline={canvas.handleSendOutputToTimeline}
      onOpenAssetLibrary={canvas.handleOpenAssetLibrary}
    />
  );
}
