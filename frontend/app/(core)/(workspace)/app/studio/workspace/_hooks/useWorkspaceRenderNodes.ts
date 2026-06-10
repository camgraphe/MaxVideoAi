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

type UseWorkspaceRenderNodesOptions = {
  capabilities: WorkspaceModelCapability[];
  edges: WorkspaceGraphEdge[];
  nodes: WorkspaceGraphNode[];
  pricingEstimates: Record<string, WorkspacePricingEstimate>;
  onGenerateShot: (nodeId: string) => Promise<void> | void;
  onOpenAssetLibrary: (nodeId: string) => void;
  onPatchNodeData: (nodeId: string, patch: Partial<WorkspaceGraphNode['data']>) => void;
  onSendOutputToTimeline: (nodeId: string) => void;
};

export function useWorkspaceRenderNodes({
  capabilities,
  edges,
  nodes,
  pricingEstimates,
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
            onPromptChange: (nodeId: string, value: string) => onPatchNodeData(nodeId, { promptText: value }),
            onOpenAssetLibrary,
            onSendOutputToTimeline,
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
          connectedCount,
          remainingCount: capacity.remainingCount,
          capacityLabel: capacity.capacityLabel,
        };
      });
      return {
        ...node,
        data: {
          ...node.data,
          sourceHandles: [GENERATED_OUTPUT_TARGET_HANDLE],
          targetHandles: getWorkspaceShotTargetHandles(validation.capability),
          inputConnectors,
          validation,
          pricingEstimate: pricingEstimates[node.id],
          onGenerateShot: (nodeId: string): void => {
            void onGenerateShot(nodeId);
          },
        },
      };
    });
  }, [capabilities, edges, nodes, onGenerateShot, onOpenAssetLibrary, onPatchNodeData, onSendOutputToTimeline, pricingEstimates]);
}
