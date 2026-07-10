import type { WorkspaceGraphEdge, WorkspaceGraphNode, WorkspaceNodeData } from './workspace-types';

export type WorkspaceGraphClipboardSnapshot = {
  nodes: WorkspaceGraphNode[];
  edges: WorkspaceGraphEdge[];
};

type WorkspaceGraphClipboardParams = {
  nodes: WorkspaceGraphNode[];
  edges: WorkspaceGraphEdge[];
  selectedNodeIds: string[];
};

type PasteWorkspaceGraphClipboardParams = {
  currentNodes: WorkspaceGraphNode[];
  currentEdges: WorkspaceGraphEdge[];
  snapshot: WorkspaceGraphClipboardSnapshot | null;
  idSeed: string;
  offset?: { x: number; y: number };
};

type PasteWorkspaceGraphClipboardResult = {
  nodes: WorkspaceGraphNode[];
  edges: WorkspaceGraphEdge[];
  pastedNodeIds: string[];
};

type DuplicateWorkspaceGraphSelectionParams = WorkspaceGraphClipboardParams & {
  idSeed?: string;
  offset?: { x: number; y: number };
};

const DEFAULT_PASTE_OFFSET = { x: 36, y: 36 };

const RENDER_ONLY_NODE_DATA_KEYS = new Set<keyof WorkspaceNodeData>([
  'modelCapabilities',
  'validation',
  'pricingEstimate',
  'onGenerateShot',
  'onPatchShot',
  'onSendOutputToTimeline',
  'onPromptChange',
  'onChatDraftChange',
  'onPatchChat',
  'onRunChat',
  'onOpenAssetLibrary',
  'studioCanvasCopy',
]);

function cloneJsonSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function clipboardNodeData(data: WorkspaceNodeData): WorkspaceNodeData {
  const cleanEntries = Object.entries(data).filter(([key, value]) => (
    typeof value !== 'function' && !RENDER_ONLY_NODE_DATA_KEYS.has(key as keyof WorkspaceNodeData)
  ));
  return cloneJsonSafe(Object.fromEntries(cleanEntries)) as WorkspaceNodeData;
}

function clipboardNode(node: WorkspaceGraphNode): WorkspaceGraphNode {
  return {
    ...cloneJsonSafe({
      ...node,
      data: clipboardNodeData(node.data),
    }),
    selected: false,
  };
}

function clipboardEdge(edge: WorkspaceGraphEdge): WorkspaceGraphEdge {
  return {
    ...cloneJsonSafe(edge),
    selected: false,
  };
}

function uniqueGraphId(baseId: string, usedIds: Set<string>): string {
  if (!usedIds.has(baseId)) {
    usedIds.add(baseId);
    return baseId;
  }
  let index = 2;
  let nextId = `${baseId}-${index}`;
  while (usedIds.has(nextId)) {
    index += 1;
    nextId = `${baseId}-${index}`;
  }
  usedIds.add(nextId);
  return nextId;
}

function graphClipboardIdSeed(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createWorkspaceGraphClipboardSnapshot({
  edges,
  nodes,
  selectedNodeIds,
}: WorkspaceGraphClipboardParams): WorkspaceGraphClipboardSnapshot | null {
  if (!selectedNodeIds.length) return null;
  const selectedNodeIdSet = new Set(selectedNodeIds);
  const copiedNodes = nodes
    .filter((node) => selectedNodeIdSet.has(node.id))
    .map(clipboardNode);
  if (!copiedNodes.length) return null;
  const copiedNodeIdSet = new Set(copiedNodes.map((node) => node.id));
  const copiedEdges = edges
    .filter((edge) => copiedNodeIdSet.has(edge.source) && copiedNodeIdSet.has(edge.target))
    .map(clipboardEdge);

  return {
    edges: copiedEdges,
    nodes: copiedNodes,
  };
}

export function pasteWorkspaceGraphClipboardSnapshot({
  currentEdges,
  currentNodes,
  idSeed,
  offset = DEFAULT_PASTE_OFFSET,
  snapshot,
}: PasteWorkspaceGraphClipboardParams): PasteWorkspaceGraphClipboardResult {
  if (!snapshot?.nodes.length) {
    return {
      edges: currentEdges,
      nodes: currentNodes,
      pastedNodeIds: [],
    };
  }

  const usedNodeIds = new Set(currentNodes.map((node) => node.id));
  const usedEdgeIds = new Set(currentEdges.map((edge) => edge.id));
  const nodeIdMap = new Map<string, string>();
  const pastedNodes = snapshot.nodes.map((node) => {
    const pastedNodeId = uniqueGraphId(`${node.id}-copy-${idSeed}`, usedNodeIds);
    nodeIdMap.set(node.id, pastedNodeId);
    return {
      ...clipboardNode(node),
      id: pastedNodeId,
      position: {
        x: node.position.x + offset.x,
        y: node.position.y + offset.y,
      },
      selected: true,
    };
  });
  const pastedEdges: WorkspaceGraphEdge[] = [];
  for (const edge of snapshot.edges) {
    const source = nodeIdMap.get(edge.source);
    const target = nodeIdMap.get(edge.target);
    if (!source || !target) continue;
    pastedEdges.push({
      ...clipboardEdge(edge),
      id: uniqueGraphId(`${edge.id}-copy-${idSeed}`, usedEdgeIds),
      source,
      target,
      selected: false,
    });
  }

  return {
    edges: [
      ...currentEdges.map((edge) => ({ ...edge, selected: false })),
      ...pastedEdges,
    ],
    nodes: [
      ...currentNodes.map((node) => ({ ...node, selected: false })),
      ...pastedNodes,
    ],
    pastedNodeIds: pastedNodes.map((node) => node.id),
  };
}

export function duplicateWorkspaceGraphSelection({
  edges,
  idSeed = graphClipboardIdSeed(),
  nodes,
  offset,
  selectedNodeIds,
}: DuplicateWorkspaceGraphSelectionParams): PasteWorkspaceGraphClipboardResult {
  return pasteWorkspaceGraphClipboardSnapshot({
    currentEdges: [],
    currentNodes: [],
    idSeed,
    offset,
    snapshot: createWorkspaceGraphClipboardSnapshot({ edges, nodes, selectedNodeIds }),
  });
}
