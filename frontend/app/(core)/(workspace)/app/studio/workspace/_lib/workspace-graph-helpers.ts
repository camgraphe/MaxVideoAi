import {
  getWorkspaceModelCapability,
  getWorkspaceModelCapabilities,
  getWorkspaceShotInputConnectors,
  isWorkspaceConnectionCompatible,
  workspaceConnectionCapacity,
} from './workspace-capabilities';
import { DEFAULT_STUDIO_COPY, type StudioCopy } from '../../_lib/studio-copy';
import { GENERATED_OUTPUT_TARGET_HANDLE } from '../_state/workspace-normalizers';
import { inferWorkspaceEdgeKind } from './workspace-templates';
import type {
  WorkspaceEdgeKind,
  WorkspaceGraphEdge,
  WorkspaceGraphNode,
  WorkspaceInputConnector,
  WorkspaceTemplateId,
} from './workspace-types';

type WorkspaceConnectionLike = {
  source?: string | null;
  sourceHandle?: string | null;
  target?: string | null;
  targetHandle?: string | null;
};

export function connectedInputKinds(nodeId: string, edges: WorkspaceGraphEdge[]): WorkspaceEdgeKind[] {
  return edges
    .filter((edge) => edge.target === nodeId)
    .map((edge) => edge.data?.kind ?? inferWorkspaceEdgeKind(edge.sourceHandle, edge.targetHandle))
    .filter((kind) => kind !== 'generated_output' && kind !== 'output_to_timeline');
}

export function connectedInputCounts(nodeId: string, edges: WorkspaceGraphEdge[]): Map<WorkspaceEdgeKind, number> {
  return edges
    .filter((edge) => edge.target === nodeId)
    .reduce((counts, edge) => {
      const kind = edge.data?.kind ?? inferWorkspaceEdgeKind(edge.sourceHandle, edge.targetHandle);
      counts.set(kind, (counts.get(kind) ?? 0) + 1);
      return counts;
    }, new Map<WorkspaceEdgeKind, number>());
}

export function findGeneratedOutputNodeForShot(
  shotNodeId: string,
  nodes: WorkspaceGraphNode[],
  edges: WorkspaceGraphEdge[]
): WorkspaceGraphNode | null {
  const outputEdge = edges.find(
    (edge) =>
      edge.source === shotNodeId &&
      (edge.data?.kind === GENERATED_OUTPUT_TARGET_HANDLE || edge.targetHandle === GENERATED_OUTPUT_TARGET_HANDLE)
  );
  if (!outputEdge) return null;
  return nodes.find((node) => node.id === outputEdge.target && node.data.kind === 'output') ?? null;
}

export function outputNodeSubtitle(
  output: NonNullable<WorkspaceGraphNode['data']['output']>,
  notices: StudioCopy['notices'] = DEFAULT_STUDIO_COPY.notices
): string {
  if (output.status === 'processing') return notices.outputProcessingRender;
  if (output.status === 'placeholder') return notices.outputWaitingForMedia;
  if (output.status === 'failed') return notices.generationFailed;
  if (output.durationSec && output.aspectRatio) return `${output.durationSec}s · ${output.aspectRatio}`;
  return notices.generatedOutputSubtitle;
}

export function connectorForTarget({
  targetNode,
  targetHandle,
  capabilities,
}: {
  targetNode: WorkspaceGraphNode | null;
  targetHandle: WorkspaceEdgeKind;
  capabilities: ReturnType<typeof getWorkspaceModelCapabilities>;
}): WorkspaceInputConnector | null {
  if (!targetNode) return null;
  if (targetNode.data.kind === 'shot' && targetNode.data.shot) {
    const capability = getWorkspaceModelCapability(targetNode.data.shot.modelId, capabilities);
    return getWorkspaceShotInputConnectors(capability).find((connector) => connector.kind === targetHandle) ?? null;
  }
  if (targetNode.data.kind === 'output' && targetHandle === 'generated_output') {
    return {
      kind: 'generated_output',
      label: 'Output',
      required: true,
      maxCount: 1,
      sourceType: 'video',
    };
  }
  return null;
}

export function workspaceConnectionRejectionReason({
  connection,
  nodes,
  edges,
  capabilities,
}: {
  connection: WorkspaceConnectionLike;
  nodes: WorkspaceGraphNode[];
  edges: WorkspaceGraphEdge[];
  capabilities: ReturnType<typeof getWorkspaceModelCapabilities>;
}): string | null {
  if (!connection.source || !connection.target || !connection.sourceHandle || !connection.targetHandle) {
    return 'This link needs a source and a target connector.';
  }
  if (connection.source === connection.target) {
    return 'A block cannot link to itself.';
  }
  if (!isWorkspaceConnectionCompatible({ sourceHandle: connection.sourceHandle, targetHandle: connection.targetHandle })) {
    return 'These block connectors are not compatible.';
  }
  const targetHandle = inferWorkspaceEdgeKind(connection.sourceHandle, connection.targetHandle);
  const targetNode = nodes.find((node) => node.id === connection.target) ?? null;
  const connector = connectorForTarget({ targetNode, targetHandle, capabilities });
  if (!connector) return null;
  const capacity = workspaceConnectionCapacity({
    connector,
    connectedCount: connectedInputCounts(connection.target, edges).get(targetHandle) ?? 0,
  });
  if (capacity.isFull) {
    return `${connector.label} is full.`;
  }
  return null;
}

export function defaultSelectedNodeId(nodes: WorkspaceGraphNode[], templateId: WorkspaceTemplateId): string | null {
  if (templateId === 'product-ad' && nodes.some((node) => node.id === 'shot-03')) return 'shot-03';
  return nodes[0]?.id ?? null;
}

export function selectWorkspaceGraphNode(nodes: WorkspaceGraphNode[], nodeId: string): WorkspaceGraphNode[] {
  return nodes.map((node) => ({
    ...node,
    selected: node.id === nodeId,
  }));
}

export function appendSelectedWorkspaceGraphNode(nodes: WorkspaceGraphNode[], node: WorkspaceGraphNode): WorkspaceGraphNode[] {
  return [
    ...selectWorkspaceGraphNode(nodes, node.id),
    {
      ...node,
      selected: true,
    },
  ];
}
