import type { Connection } from '@xyflow/react';
import type { WorkspaceEdgeKind, WorkspaceGraphNode, WorkspacePricingEstimate, WorkspaceShotStatus } from './workspace-types';

export function workspaceConnectionCandidates(
  nodes: WorkspaceGraphNode[],
  target: string,
  targetHandle: WorkspaceEdgeKind,
  isValidConnection: (connection: Connection) => boolean
) {
  return nodes.flatMap((node) => node.id === target ? [] : (node.data.sourceHandles ?? []).flatMap((sourceHandle) => {
    const connection = { source: node.id, sourceHandle, target, targetHandle };
    return isValidConnection(connection) ? [{ connection, title: node.data.title, kind: node.data.kind }] : [];
  }));
}

export function workspaceGenerationActionReady(canGenerate: boolean, status: WorkspaceShotStatus, quote?: WorkspacePricingEstimate, mockMode = false): boolean {
  return canGenerate && status !== 'generating' && (mockMode || quote?.status === 'ready');
}
