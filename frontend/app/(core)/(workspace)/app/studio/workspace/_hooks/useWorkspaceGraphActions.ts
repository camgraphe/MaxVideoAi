import { useCallback, type Dispatch, type SetStateAction } from 'react';
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from '@xyflow/react';
import type {
  WorkspaceHandleDropRequest,
  WorkspacePaletteDropRequest,
} from '../_components/WorkspaceCanvas.client';
import { createAdHocWorkspaceNode } from '../_lib/workspace-canvas-imports';
import type {
  WorkspaceGraphEdge,
  WorkspaceGraphNode,
  WorkspaceModelCapability,
  WorkspaceNodeGeneratedCopy,
  WorkspaceShotSettings,
} from '../_lib/workspace-types';
import { clearWorkspaceGeneratedCopyReferences } from '../_lib/workspace-generated-copy';
import { createWorkspaceHandleDropNode, resolveWorkspaceHandleDropDraft } from '../_lib/workspace-handle-drop';
import {
  appendSelectedWorkspaceGraphNode,
  workspaceConnectionRejectionReason,
  type WorkspaceConnectionRejection,
} from '../_lib/workspace-graph-helpers';
import {
  createWorkspaceEdge,
  inferWorkspaceEdgeKind,
} from '../_lib/workspace-templates';
import {
  workspaceAssetRecordFromLibraryAsset,
  type WorkspaceLibraryAsset,
} from '../_lib/workspace-library-assets';
import type { CanvasGraphHistorySnapshot, WorkspaceEditorSurface } from '../_state/workspace-state';
import { localizeStudioEdgeKindLabel, type StudioCopy } from '../../_lib/studio-copy';

function formatNotice(value: string, replacements: Record<string, string | number>): string {
  return Object.entries(replacements).reduce(
    (current, [key, replacement]) => current.replaceAll(`{${key}}`, String(replacement)),
    value
  );
}

function localizedConnectionRejectionReason(
  reason: WorkspaceConnectionRejection,
  notices: StudioCopy['notices'],
  studioCanvasNodeCopy: StudioCopy['canvas']['nodes']
): string {
  if (reason.code === 'missing_endpoint') return notices.linkNeedsSourceAndTarget;
  if (reason.code === 'self_link') return notices.blockCannotLinkToItself;
  if (reason.code === 'incompatible_connectors') return notices.connectorsNotCompatible;
  if (reason.code === 'connector_full') {
    return formatNotice(notices.connectorFull, {
      connector: localizeStudioEdgeKindLabel(reason.connectorKind, studioCanvasNodeCopy),
    });
  }
  return notices.connectorsNotCompatible;
}

function generatedCopyAfterNodeDataPatch(
  node: WorkspaceGraphNode,
  patch: Partial<WorkspaceGraphNode['data']>
): WorkspaceNodeGeneratedCopy | undefined {
  if (patch.generatedCopy) return patch.generatedCopy;
  const clearedFields: Array<keyof WorkspaceNodeGeneratedCopy> = [];
  if ('title' in patch) clearedFields.push('title');
  if ('subtitle' in patch) clearedFields.push('subtitle');
  if ('promptText' in patch) clearedFields.push('promptText');
  return clearedFields.length
    ? clearWorkspaceGeneratedCopyReferences(node.data.generatedCopy, clearedFields)
    : node.data.generatedCopy;
}

type UseWorkspaceGraphActionsParams = {
  capabilities: WorkspaceModelCapability[];
  commitCanvasGraph: (
    updater: (current: CanvasGraphHistorySnapshot) => CanvasGraphHistorySnapshot,
    options?: { gesture?: boolean; history?: boolean }
  ) => void;
  defaultModelId: string;
  edges: WorkspaceGraphEdge[];
  nodes: WorkspaceGraphNode[];
  setActiveEditorSurface: Dispatch<SetStateAction<WorkspaceEditorSurface>>;
  setAssetPickerNodeId: Dispatch<SetStateAction<string | null>>;
  setNotice: Dispatch<SetStateAction<string | null>>;
  setSelectedNodeId: Dispatch<SetStateAction<string | null>>;
  studioCanvasNodeCopy: StudioCopy['canvas']['nodes'];
  studioNotices: StudioCopy['notices'];
};

function nodeChangesAffectGraphHistory(changes: NodeChange<WorkspaceGraphNode>[]): boolean {
  return changes.some((change) => {
    if (change.type === 'select') return false;
    if (change.type === 'dimensions' && !change.resizing) return false;
    return true;
  });
}

function edgeChangesAffectGraphHistory(changes: EdgeChange<WorkspaceGraphEdge>[]): boolean {
  return changes.some((change) => change.type !== 'select');
}

export function useWorkspaceGraphActions({
  capabilities,
  commitCanvasGraph,
  defaultModelId,
  edges,
  nodes,
  setActiveEditorSurface,
  setAssetPickerNodeId,
  setNotice,
  setSelectedNodeId,
  studioCanvasNodeCopy,
  studioNotices,
}: UseWorkspaceGraphActionsParams): {
  handleCreateNodeFromHandleDrop: (request: WorkspaceHandleDropRequest) => void;
  handleCreateNodeFromPaletteDrop: (request: WorkspacePaletteDropRequest) => void;
  handleOpenAssetLibrary: (nodeId: string) => void;
  handleSelectLibraryAsset: (nodeId: string, asset: WorkspaceLibraryAsset) => void;
  isValidConnection: (connection: Connection | WorkspaceGraphEdge) => boolean;
  onConnect: (connection: Connection) => void;
  onEdgesChange: (changes: EdgeChange<WorkspaceGraphEdge>[]) => void;
  onNodesChange: (changes: NodeChange<WorkspaceGraphNode>[]) => void;
  patchNodeData: (nodeId: string, patch: Partial<WorkspaceGraphNode['data']>) => void;
  patchShot: (nodeId: string, patch: Partial<WorkspaceShotSettings>) => void;
} {
  const patchNodeData = useCallback(
    (nodeId: string, patch: Partial<WorkspaceGraphNode['data']>) => {
      commitCanvasGraph(({ nodes: currentNodes, edges: currentEdges }) => ({
        edges: currentEdges,
        nodes: currentNodes.map((node) => {
          if (node.id !== nodeId) return node;
          return {
            ...node,
            data: {
              ...node.data,
              ...patch,
              generatedCopy: generatedCopyAfterNodeDataPatch(node, patch),
            },
          };
        }),
      }), { history: false });
    },
    [commitCanvasGraph]
  );

  const patchShot = useCallback(
    (nodeId: string, patch: Partial<WorkspaceShotSettings>) => {
      commitCanvasGraph(({ nodes: currentNodes, edges: currentEdges }) => ({
        edges: currentEdges,
        nodes: currentNodes.map((node) => {
          if (node.id !== nodeId || !node.data.shot) return node;
          const nextShot = {
            ...node.data.shot,
            ...patch,
            status: patch.status ?? (node.data.shot.status === 'incompatible' ? 'draft' : node.data.shot.status),
          };
          const generatedCopy = 'outputName' in patch
            ? clearWorkspaceGeneratedCopyReferences(node.data.generatedCopy, ['subtitle', 'shotOutputName'])
            : node.data.generatedCopy;
          return {
            ...node,
            data: {
              ...node.data,
              generatedCopy,
              subtitle: patch.outputName ?? node.data.subtitle,
              shot: nextShot,
            },
          };
        }),
      }), { history: false });
    },
    [commitCanvasGraph]
  );

  const handleOpenAssetLibrary = useCallback(
    (nodeId: string) => {
      setActiveEditorSurface('canvas');
      setSelectedNodeId(nodeId);
      setAssetPickerNodeId(nodeId);
    },
    [setActiveEditorSurface, setAssetPickerNodeId, setSelectedNodeId]
  );

  const handleSelectLibraryAsset = useCallback(
    (nodeId: string, asset: WorkspaceLibraryAsset) => {
      const assetRecord = workspaceAssetRecordFromLibraryAsset(asset);
      commitCanvasGraph(({ nodes: currentNodes, edges: currentEdges }) => ({
        edges: currentEdges,
        nodes: currentNodes.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: {
                  ...node.data,
                  generatedCopy: clearWorkspaceGeneratedCopyReferences(node.data.generatedCopy, ['subtitle']),
                  subtitle: asset.name,
                  asset: assetRecord,
                },
              }
            : node
        ),
      }));
      setActiveEditorSurface('canvas');
      setSelectedNodeId(nodeId);
      setAssetPickerNodeId(null);
      setNotice(formatNotice(studioNotices.assetAttachedToMediaBlock, { name: asset.name }));
    },
    [commitCanvasGraph, setActiveEditorSurface, setAssetPickerNodeId, setNotice, setSelectedNodeId, studioNotices.assetAttachedToMediaBlock]
  );

  const onNodesChange = useCallback(
    (changes: NodeChange<WorkspaceGraphNode>[]) => {
      const shouldTrackHistory = nodeChangesAffectGraphHistory(changes);
      commitCanvasGraph(({ nodes: currentNodes, edges: currentEdges }) => ({
        edges: currentEdges,
        nodes: applyNodeChanges(changes, currentNodes),
      }), { gesture: shouldTrackHistory, history: shouldTrackHistory });
    },
    [commitCanvasGraph]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange<WorkspaceGraphEdge>[]) => {
      const shouldTrackHistory = edgeChangesAffectGraphHistory(changes);
      commitCanvasGraph(({ nodes: currentNodes, edges: currentEdges }) => ({
        edges: applyEdgeChanges(changes, currentEdges),
        nodes: currentNodes,
      }), { gesture: shouldTrackHistory, history: shouldTrackHistory });
    },
    [commitCanvasGraph]
  );

  const isValidConnection = useCallback(
    (connection: Connection | WorkspaceGraphEdge) => !workspaceConnectionRejectionReason({ connection, nodes, edges, capabilities }),
    [capabilities, edges, nodes]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      const rejectionReason = workspaceConnectionRejectionReason({ connection, nodes, edges, capabilities });
      if (rejectionReason) {
        setNotice(localizedConnectionRejectionReason(rejectionReason, studioNotices, studioCanvasNodeCopy));
        return;
      }
      if (!connection.source || !connection.target) return;
      const kind = inferWorkspaceEdgeKind(connection.sourceHandle, connection.targetHandle);
      const edge = createWorkspaceEdge({
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle ?? kind,
        targetHandle: connection.targetHandle ?? kind,
        kind,
      });
      commitCanvasGraph(({ nodes: currentNodes, edges: currentEdges }) => ({
        edges: addEdge(edge, currentEdges),
        nodes: currentNodes,
      }));
      setNotice(formatNotice(studioNotices.graphLinkConnected, {
        label: localizeStudioEdgeKindLabel(edge.data?.kind ?? kind, studioCanvasNodeCopy),
      }));
    },
    [
      capabilities,
      commitCanvasGraph,
      edges,
      nodes,
      setNotice,
      studioCanvasNodeCopy,
      studioNotices,
    ]
  );

  const handleCreateNodeFromHandleDrop = useCallback(
    (request: WorkspaceHandleDropRequest) => {
      const draft = resolveWorkspaceHandleDropDraft(request.handleId, studioNotices, request.handleType, studioCanvasNodeCopy);
      if (!draft) {
        setNotice(studioNotices.noMatchingBlockForConnector);
        return;
      }
      if (request.handleType === 'target') {
        const rejectionReason = workspaceConnectionRejectionReason({
          connection: {
            source: 'pending-node',
            target: request.sourceNodeId,
            sourceHandle: draft.sourceHandle,
            targetHandle: request.handleId,
          },
          nodes,
          edges,
          capabilities,
        });
        if (rejectionReason) {
          setNotice(localizedConnectionRejectionReason(rejectionReason, studioNotices, studioCanvasNodeCopy));
          return;
        }
      }

      const node = createWorkspaceHandleDropNode({
        draft,
        defaultModelId,
        index: nodes.length,
        notices: studioNotices,
        position: {
          x: request.position.x - 110,
          y: request.position.y - 48,
        },
      });
      const edge =
        request.handleType === 'target'
          ? createWorkspaceEdge({
              source: node.id,
              target: request.sourceNodeId,
              sourceHandle: draft.sourceHandle,
              targetHandle: request.handleId,
              kind: request.handleId,
            })
          : createWorkspaceEdge({
              source: request.sourceNodeId,
              target: node.id,
              sourceHandle: request.handleId,
              targetHandle: draft.targetHandle,
              kind: request.handleId,
            });

      commitCanvasGraph(({ nodes: currentNodes, edges: currentEdges }) => ({
        edges: addEdge(edge, currentEdges),
        nodes: appendSelectedWorkspaceGraphNode(currentNodes, node),
      }));
      setActiveEditorSurface('canvas');
      setSelectedNodeId(node.id);
      setNotice(formatNotice(studioNotices.nodeCreatedFromConnector, {
        title: node.data.title,
        connector: localizeStudioEdgeKindLabel(edge.data?.kind ?? request.handleId, studioCanvasNodeCopy),
      }));
    },
    [
      capabilities,
      commitCanvasGraph,
      defaultModelId,
      edges,
      nodes,
      setActiveEditorSurface,
      setNotice,
      setSelectedNodeId,
      studioCanvasNodeCopy,
      studioNotices,
    ]
  );

  const handleCreateNodeFromPaletteDrop = useCallback(
    (request: WorkspacePaletteDropRequest) => {
      const node = createAdHocWorkspaceNode(request.kind, nodes.length, defaultModelId, studioNotices, {
        x: request.position.x - 105,
        y: request.position.y - 48,
      });
      commitCanvasGraph(({ nodes: currentNodes, edges: currentEdges }) => ({
        edges: currentEdges,
        nodes: appendSelectedWorkspaceGraphNode(currentNodes, node),
      }));
      setActiveEditorSurface('canvas');
      setSelectedNodeId(node.id);
      setNotice(formatNotice(studioNotices.nodeDroppedOntoCanvas, { title: node.data.title }));
    },
    [commitCanvasGraph, defaultModelId, nodes.length, setActiveEditorSurface, setNotice, setSelectedNodeId, studioNotices]
  );

  return {
    handleCreateNodeFromHandleDrop,
    handleCreateNodeFromPaletteDrop,
    handleOpenAssetLibrary,
    handleSelectLibraryAsset,
    isValidConnection,
    onConnect,
    onEdgesChange,
    onNodesChange,
    patchNodeData,
    patchShot,
  };
}
