'use client';

import { useMemo } from 'react';
import {
  getWorkspaceShotInputConnectors,
  getWorkspaceShotTargetHandles,
  validateShotConnections,
  workspaceConnectionCapacity,
} from '../_lib/workspace-capabilities';
import { connectedInputCounts, connectedInputKinds } from '../_lib/workspace-graph-helpers';
import type {
  WorkspaceGraphEdge,
  WorkspaceGraphNode,
  WorkspaceModelCapability,
  WorkspacePricingEstimate,
} from '../_lib/workspace-types';
import { GENERATED_OUTPUT_TARGET_HANDLE } from '../_state/workspace-normalizers';
import {
  localizeStudioConnectorDisplayLabel,
  localizeStudioGeneratedCanvasText,
  type StudioCopy,
} from '../../_lib/studio-copy';

type UseWorkspaceRenderNodesOptions = {
  capabilities: WorkspaceModelCapability[];
  edges: WorkspaceGraphEdge[];
  nodes: WorkspaceGraphNode[];
  pricingEstimates: Record<string, WorkspacePricingEstimate>;
  studioCanvasCopy: StudioCopy['canvas'];
  onGenerateShot: (nodeId: string) => Promise<void> | void;
  onOpenAssetLibrary: (nodeId: string) => void;
  onPatchNodeData: (nodeId: string, patch: Partial<WorkspaceGraphNode['data']>) => void;
  onSendOutputToTimeline: (nodeId: string) => void;
};

function localizedOutputSubtitle(
  node: WorkspaceGraphNode,
  copy: StudioCopy['canvas']['nodes']
): string | undefined {
  const output = node.data.output;
  if (node.data.kind !== 'output' || !output) return node.data.subtitle;
  if (output.status === 'processing') return copy.outputProcessingRender;
  if (output.status === 'placeholder') return copy.outputWaitingForMedia;
  if (output.status === 'failed') return copy.failed;
  if (output.durationSec && output.aspectRatio) return `${output.durationSec}s · ${output.aspectRatio}`;
  return copy.generatedMedia;
}

function localizedNodeText(value: string | undefined, copy: StudioCopy['canvas']['nodes']): string | undefined {
  return value ? localizeStudioGeneratedCanvasText(value, copy) : value;
}

export function useWorkspaceRenderNodes({
  capabilities,
  edges,
  nodes,
  pricingEstimates,
  studioCanvasCopy,
  onGenerateShot,
  onOpenAssetLibrary,
  onPatchNodeData,
  onSendOutputToTimeline,
}: UseWorkspaceRenderNodesOptions): WorkspaceGraphNode[] {
  return useMemo(() => {
    return nodes.map((node) => {
      if (node.data.kind !== 'shot' || !node.data.shot) {
        return {
          ...node,
          data: {
            ...node.data,
            title: localizedNodeText(node.data.title, studioCanvasCopy.nodes) ?? node.data.title,
            subtitle: localizedNodeText(localizedOutputSubtitle(node, studioCanvasCopy.nodes), studioCanvasCopy.nodes),
            onPromptChange: (nodeId: string, value: string) => onPatchNodeData(nodeId, { promptText: value }),
            onOpenAssetLibrary,
            onSendOutputToTimeline,
            studioCanvasCopy,
          },
        };
      }
      const validation = validateShotConnections({
        settings: node.data.shot,
        connectedInputs: connectedInputKinds(node.id, edges),
        capabilities,
      });
      const inputCounts = connectedInputCounts(node.id, edges);
      const inputConnectors = getWorkspaceShotInputConnectors(validation.capability).map((connector) => {
        const connectedCount = inputCounts.get(connector.kind) ?? 0;
        const capacity = workspaceConnectionCapacity({ connector, connectedCount });
        return {
          ...connector,
          label: localizeStudioConnectorDisplayLabel(connector.label, studioCanvasCopy.nodes),
          connectedCount,
          remainingCount: capacity.remainingCount,
          capacityLabel: capacity.capacityLabel,
        };
      });
      return {
        ...node,
        data: {
          ...node.data,
          title: localizedNodeText(node.data.title, studioCanvasCopy.nodes) ?? node.data.title,
          subtitle: localizedNodeText(node.data.subtitle, studioCanvasCopy.nodes),
          sourceHandles: [GENERATED_OUTPUT_TARGET_HANDLE],
          targetHandles: getWorkspaceShotTargetHandles(validation.capability),
          inputConnectors,
          validation,
          pricingEstimate: pricingEstimates[node.id],
          studioCanvasCopy,
          onGenerateShot: (nodeId: string): void => {
            void onGenerateShot(nodeId);
          },
        },
      };
    });
  }, [capabilities, edges, nodes, onGenerateShot, onOpenAssetLibrary, onPatchNodeData, onSendOutputToTimeline, pricingEstimates, studioCanvasCopy]);
}
