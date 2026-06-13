import type { WorkspaceEdgeKind, WorkspaceGraphEdge, WorkspaceGraphNode } from './workspace-types';
import { isWorkspaceConnectionCompatible } from './workspace-capabilities';
import { GENERATED_OUTPUT_TARGET_HANDLE, shotOutputSourceHandle } from '../_state/workspace-normalizers';

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
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  return edges.filter((edge) => {
    const sourceHandles = nodeHandles.get(edge.source)?.source;
    const targetHandles = nodeHandles.get(edge.target)?.target;
    const sourceHandle = edge.sourceHandle as WorkspaceEdgeKind | null | undefined;
    const targetHandle = edge.targetHandle as WorkspaceEdgeKind | null | undefined;
    const sourceNode = nodeById.get(edge.source);
    const targetNode = nodeById.get(edge.target);
    const sourceAvailable = !sourceHandle || sourceHandles?.has(sourceHandle);
    const targetAvailable = !targetHandle || targetHandles?.has(targetHandle);
    const generatedOutputEdge =
      sourceNode?.data.kind === 'shot' &&
      targetNode?.data.kind === 'output' &&
      targetHandle === GENERATED_OUTPUT_TARGET_HANDLE &&
      sourceHandle === shotOutputSourceHandle(sourceNode.data.shot);
    const compatible = generatedOutputEdge || isWorkspaceConnectionCompatible({ sourceHandle, targetHandle });
    return Boolean(sourceAvailable && targetAvailable && compatible);
  });
}
