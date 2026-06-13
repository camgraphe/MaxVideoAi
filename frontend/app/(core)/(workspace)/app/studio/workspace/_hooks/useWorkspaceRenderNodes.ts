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
  WorkspaceEdgeKind,
  WorkspaceGraphEdge,
  WorkspaceGraphNode,
  WorkspaceModelCapability,
  WorkspacePricingEstimate,
  WorkspaceReferencePreview,
  WorkspaceShotSettings,
} from '../_lib/workspace-types';
import {
  localizeWorkspaceNodeSubtitle,
  localizeWorkspaceNodeTitle,
  localizeWorkspacePromptText,
  localizeWorkspaceShotOutputName,
} from '../_lib/workspace-generated-copy';
import { shotOutputSourceHandle } from '../_state/workspace-normalizers';
import {
  localizeStudioConnectorDisplayLabel,
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
  onPatchShot: (nodeId: string, patch: Partial<WorkspaceShotSettings>) => void;
  onRunChat: (nodeId: string) => Promise<void> | void;
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

const REFERENCE_PREVIEW_INPUTS = new Set<WorkspaceEdgeKind>([
  'reference',
  'start_image',
  'product',
  'character',
  'style',
  'composition',
  'logo',
]);

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function dimensionsFromAsset(value: string | undefined): Pick<WorkspaceReferencePreview, 'width' | 'height'> {
  if (!value) return {};
  const match = value.match(/(\d+)\s*[x×]\s*(\d+)/i);
  if (!match) return {};
  return {
    width: Number(match[1]),
    height: Number(match[2]),
  };
}

function referencePreviewFromNode(node: WorkspaceGraphNode): WorkspaceReferencePreview | null {
  const asset = node.data.asset;
  const assetUrl = stringOrNull(asset?.url) ?? stringOrNull(asset?.thumbUrl);
  if (asset && assetUrl) {
    return {
      id: asset.id,
      url: assetUrl,
      previewUrl: stringOrNull(asset.thumbUrl) ?? assetUrl,
      name: asset.filename,
      ...dimensionsFromAsset(asset.dimensions),
    };
  }

  const output = node.data.output;
  if (!output || output.status === 'placeholder' || output.status === 'processing' || output.status === 'failed') {
    return null;
  }
  const outputUrl = stringOrNull(output.url) ?? stringOrNull(output.thumbUrl);
  if (!outputUrl || output.kind === 'audio') return null;

  return {
    id: output.jobId ?? output.sourceShotId,
    url: outputUrl,
    previewUrl: stringOrNull(output.thumbUrl) ?? outputUrl,
    name: output.modelLabel,
  };
}

function referencePreviewForShotNode(
  shotNode: WorkspaceGraphNode,
  nodes: WorkspaceGraphNode[],
  edges: WorkspaceGraphEdge[]
): WorkspaceReferencePreview | null {
  for (const edge of edges) {
    if (edge.target !== shotNode.id) continue;
    const kind = edge.data?.kind ?? edge.targetHandle;
    if (typeof kind !== 'string' || !REFERENCE_PREVIEW_INPUTS.has(kind as WorkspaceEdgeKind)) continue;
    const sourceNode = nodes.find((candidate) => candidate.id === edge.source);
    if (!sourceNode) continue;
    const preview = referencePreviewFromNode(sourceNode);
    if (preview) return preview;
  }
  return null;
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
  onPatchShot,
  onRunChat,
  onSendOutputToTimeline,
}: UseWorkspaceRenderNodesOptions): WorkspaceGraphNode[] {
  return useMemo(() => {
    return nodes.map((node) => {
      if (node.data.kind !== 'shot' || !node.data.shot) {
        const subtitle = node.data.kind === 'output' && node.data.output
          ? localizedOutputSubtitle(node, studioCanvasCopy.nodes)
          : localizeWorkspaceNodeSubtitle(node, studioCanvasCopy.nodes);
        return {
          ...node,
          data: {
            ...node.data,
            title: localizeWorkspaceNodeTitle(node, studioCanvasCopy.nodes),
            subtitle,
            ...(typeof node.data.promptText === 'string'
              ? { promptText: localizeWorkspacePromptText(node, studioCanvasCopy.nodes) ?? node.data.promptText }
              : {}),
            onPromptChange: (nodeId: string, value: string) => onPatchNodeData(nodeId, { promptText: value }),
            onChatDraftChange: (nodeId: string, value: string) => {
              const chat = node.data.chat;
              if (!chat) return;
              onPatchNodeData(nodeId, {
                promptText: value,
                chat: {
                  ...chat,
                  draftMessage: value,
                },
              });
            },
            onRunChat: (nodeId: string): void => {
              void onRunChat(nodeId);
            },
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
          label: localizeStudioConnectorDisplayLabel(connector.label, studioCanvasCopy.nodes, connector.kind),
          connectedCount,
          remainingCount: capacity.remainingCount,
          capacityLabel: capacity.capacityLabel,
        };
      });
      return {
        ...node,
        data: {
          ...node.data,
          title: localizeWorkspaceNodeTitle(node, studioCanvasCopy.nodes),
          subtitle: localizeWorkspaceNodeSubtitle(node, studioCanvasCopy.nodes),
          shot: {
            ...node.data.shot,
            outputName: localizeWorkspaceShotOutputName(node, studioCanvasCopy.nodes),
          },
          sourceHandles: [shotOutputSourceHandle(node.data.shot)],
          targetHandles: getWorkspaceShotTargetHandles(validation.capability),
          inputConnectors,
          referencePreview: referencePreviewForShotNode(node, nodes, edges),
          validation,
          pricingEstimate: pricingEstimates[node.id],
          studioCanvasCopy,
          onGenerateShot: (nodeId: string): void => {
            void onGenerateShot(nodeId);
          },
          onPatchShot,
        },
      };
    });
  }, [capabilities, edges, nodes, onGenerateShot, onOpenAssetLibrary, onPatchNodeData, onPatchShot, onRunChat, onSendOutputToTimeline, pricingEstimates, studioCanvasCopy]);
}
