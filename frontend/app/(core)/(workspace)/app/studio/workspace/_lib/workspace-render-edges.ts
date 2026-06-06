import type { WorkspaceEdgeKind, WorkspaceGraphEdge, WorkspaceGraphNode } from './workspace-types';
import { isWorkspaceConnectionCompatible } from './workspace-capabilities';

function handleSet(handles: WorkspaceGraphNode['data']['sourceHandles'] | WorkspaceGraphNode['data']['targetHandles']): Set<WorkspaceEdgeKind> {
  return new Set(Array.isArray(handles) ? handles : []);
}

export function filterRenderableWorkspaceEdges(nodes: WorkspaceGraphNode[], edges: WorkspaceGraphEdge[]): WorkspaceGraphEdge[] {
  const nodeHandles = new Map(
    nodes.map((node) => [
      node.id,
      {
        source: handleSet(node.data.sourceHandles),
        target: handleSet(node.data.targetHandles),
      },
    ])
  );

  return edges.filter((edge) => {
    const sourceHandles = nodeHandles.get(edge.source)?.source;
    const targetHandles = nodeHandles.get(edge.target)?.target;
    const sourceHandle = edge.sourceHandle as WorkspaceEdgeKind | null | undefined;
    const targetHandle = edge.targetHandle as WorkspaceEdgeKind | null | undefined;
    const sourceAvailable = !sourceHandle || sourceHandles?.has(sourceHandle);
    const targetAvailable = !targetHandle || targetHandles?.has(targetHandle);
    const compatible = isWorkspaceConnectionCompatible({ sourceHandle, targetHandle });
    return Boolean(sourceAvailable && targetAvailable && compatible);
  });
}
