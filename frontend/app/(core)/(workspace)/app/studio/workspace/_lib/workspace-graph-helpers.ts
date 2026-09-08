import {
  getWorkspaceModelCapability,
  getWorkspaceModelCapabilities,
  isWorkspaceConnectionCompatible,
  workspaceConnectionCapacity,
} from './workspace-capabilities';
import { DEFAULT_STUDIO_COPY, type StudioCopy } from '../../_lib/studio-copy';
import { GENERATED_OUTPUT_TARGET_HANDLE, shotOutputSourceHandle } from '../_state/workspace-normalizers';
import { inferWorkspaceEdgeKind } from './workspace-templates';
import { ALL_INPUT_KINDS } from './models/model-input-connectors';
import { resolveWorkspaceBlockPolicy } from './models/workspace-block-capability-policy';
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

export type WorkspaceConnectionRejection =
  | { code: 'missing_endpoint' }
  | { code: 'self_link' }
  | { code: 'incompatible_connectors' }
  | { code: 'connector_full'; connectorKind: WorkspaceEdgeKind; connectorLabel: string };

function persistedInputKinds(edge: WorkspaceGraphEdge): WorkspaceEdgeKind[] {
  const semanticKind = edge.data?.kind ?? inferWorkspaceEdgeKind(edge.sourceHandle, edge.targetHandle);
  const targetHandle = edge.targetHandle as WorkspaceEdgeKind | null | undefined;
  const kinds = [semanticKind];
  if (targetHandle && targetHandle !== semanticKind && ALL_INPUT_KINDS.includes(targetHandle)) {
    kinds.push(targetHandle);
  }
  return kinds;
}

export function connectedInputKinds(nodeId: string, edges: WorkspaceGraphEdge[]): WorkspaceEdgeKind[] {
  return edges
    .filter((edge) => edge.target === nodeId)
    .flatMap(persistedInputKinds)
    .filter((kind) => kind !== 'generated_output' && kind !== 'output_to_timeline');
}

export function connectedInputCounts(nodeId: string, edges: WorkspaceGraphEdge[]): Map<WorkspaceEdgeKind, number> {
  return edges
    .filter((edge) => edge.target === nodeId)
    .reduce((counts, edge) => {
      for (const kind of persistedInputKinds(edge)) {
        counts.set(kind, (counts.get(kind) ?? 0) + 1);
      }
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

function outputAttemptTime(node: WorkspaceGraphNode): number {
  const createdAt = node.data.output?.createdAt;
  if (!createdAt) return Number.NEGATIVE_INFINITY;
  const timestamp = Date.parse(createdAt);
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
}

function outputAttemptOrdinal(node: WorkspaceGraphNode): number | null {
  const ordinal = node.data.output?.attemptOrdinal;
  return typeof ordinal === 'number' && Number.isSafeInteger(ordinal) && ordinal > 0 ? ordinal : null;
}

function compareOutputAttempts(left: WorkspaceGraphNode, right: WorkspaceGraphNode): number {
  const leftOrdinal = outputAttemptOrdinal(left);
  const rightOrdinal = outputAttemptOrdinal(right);
  if (leftOrdinal !== null || rightOrdinal !== null) {
    const resolvedLeft = leftOrdinal ?? Number.NEGATIVE_INFINITY;
    const resolvedRight = rightOrdinal ?? Number.NEGATIVE_INFINITY;
    return resolvedLeft === resolvedRight ? 0 : resolvedLeft > resolvedRight ? 1 : -1;
  }
  const leftTime = outputAttemptTime(left);
  const rightTime = outputAttemptTime(right);
  return leftTime === rightTime ? 0 : leftTime > rightTime ? 1 : -1;
}

function latestOutputByAttempt(candidates: WorkspaceGraphNode[]): WorkspaceGraphNode | null {
  return candidates.reduce<WorkspaceGraphNode | null>((latest, candidate) => {
    if (!latest) return candidate;
    const attemptOrder = compareOutputAttempts(candidate, latest);
    if (attemptOrder !== 0) return attemptOrder > 0 ? candidate : latest;
    const candidateIndex = candidate.data.output?.outputIndex ?? 0;
    const latestIndex = latest.data.output?.outputIndex ?? 0;
    return candidateIndex < latestIndex ? candidate : latest;
  }, null);
}

export function findGuideGeneratedOutputNodeForShot(
  shotNodeId: string,
  nodes: WorkspaceGraphNode[],
  edges: WorkspaceGraphEdge[]
): WorkspaceGraphNode | null {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const candidates = edges.flatMap((edge) => {
    if (
      edge.source !== shotNodeId
      || (edge.data?.kind !== GENERATED_OUTPUT_TARGET_HANDLE && edge.targetHandle !== GENERATED_OUTPUT_TARGET_HANDLE)
    ) return [];
    const node = nodesById.get(edge.target);
    return node?.data.kind === 'output' && node.data.output?.sourceShotId === shotNodeId ? [node] : [];
  });
  const latestAttempt = latestOutputByAttempt(candidates);
  if (!latestAttempt) return null;
  const latestAttemptCandidates = candidates.filter((node) => compareOutputAttempts(node, latestAttempt) === 0);
  const processing = latestOutputByAttempt(latestAttemptCandidates.filter((node) => node.data.output?.status === 'processing'));
  if (processing) return processing;
  const ready = latestOutputByAttempt(latestAttemptCandidates.filter((node) => (
    node.data.output?.status === 'ready'
    || (!node.data.output?.status && Boolean(node.data.output?.url))
  )));
  if (ready) return ready;
  const failed = latestOutputByAttempt(latestAttemptCandidates.filter((node) => node.data.output?.status === 'failed'));
  return failed ?? latestOutputByAttempt(latestAttemptCandidates);
}

export function outputNodeSubtitle(
  output: NonNullable<WorkspaceGraphNode['data']['output']>,
  notices: StudioCopy['notices'] = DEFAULT_STUDIO_COPY.notices
): string {
  if (output.status === 'processing') return notices.outputProcessingRender;
  if (output.status === 'placeholder') return notices.outputWaitingForMedia;
  if (output.status === 'failed') return notices.generationFailed;
  if (output.requestedSettings) {
    return `${output.requestedSettings.durationSec}s · ${output.requestedSettings.aspectRatio}`;
  }
  return notices.generatedOutputSubtitle;
}

export function connectorForTarget({
  targetNode,
  targetHandle,
  capabilities,
  connectedInputs = [],
}: {
  targetNode: WorkspaceGraphNode | null;
  targetHandle: WorkspaceEdgeKind;
  capabilities: ReturnType<typeof getWorkspaceModelCapabilities>;
  connectedInputs?: WorkspaceEdgeKind[];
}): WorkspaceInputConnector | null {
  if (!targetNode) return null;
  if (targetNode.data.kind === 'shot' && targetNode.data.shot) {
    const capability = getWorkspaceModelCapability(targetNode.data.shot.modelId, capabilities);
    return resolveWorkspaceBlockPolicy({
      settings: targetNode.data.shot,
      capability,
      connectedInputs,
    }).inputConnectors.find((connector) => connector.kind === targetHandle && !connector.disabledReason) ?? null;
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
}): WorkspaceConnectionRejection | null {
  if (!connection.source || !connection.target || !connection.sourceHandle || !connection.targetHandle) {
    return { code: 'missing_endpoint' };
  }
  if (connection.source === connection.target) {
    return { code: 'self_link' };
  }
  const sourceNode = nodes.find((node) => node.id === connection.source) ?? null;
  const targetNode = nodes.find((node) => node.id === connection.target) ?? null;
  const generatedOutputEdge =
    sourceNode?.data.kind === 'shot' &&
    targetNode?.data.kind === 'output' &&
    connection.targetHandle === GENERATED_OUTPUT_TARGET_HANDLE &&
    connection.sourceHandle === shotOutputSourceHandle(sourceNode.data.shot);
  if (!generatedOutputEdge && !isWorkspaceConnectionCompatible({ sourceHandle: connection.sourceHandle, targetHandle: connection.targetHandle })) {
    return { code: 'incompatible_connectors' };
  }
  const targetHandle = inferWorkspaceEdgeKind(connection.sourceHandle, connection.targetHandle);
  const connector = connectorForTarget({
    targetNode,
    targetHandle,
    capabilities,
    connectedInputs: connectedInputKinds(connection.target, edges),
  });
  if (!connector) {
    return targetNode?.data.kind === 'shot' ? { code: 'incompatible_connectors' } : null;
  }
  const capacity = workspaceConnectionCapacity({
    connector,
    connectedCount: connectedInputCounts(connection.target, edges).get(targetHandle) ?? 0,
  });
  if (capacity.isFull) {
    return {
      code: 'connector_full',
      connectorKind: connector.kind,
      connectorLabel: connector.label,
    };
  }
  return null;
}

export function defaultSelectedNodeId(nodes: WorkspaceGraphNode[], templateId: WorkspaceTemplateId): string | null {
  const selectedNode = nodes.find((node) => node.selected);
  if (selectedNode) return selectedNode.id;
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
