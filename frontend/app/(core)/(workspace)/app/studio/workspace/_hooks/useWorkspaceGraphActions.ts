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
  WorkspaceShotSettings,
} from '../_lib/workspace-types';
import { createWorkspaceHandleDropNode, resolveWorkspaceHandleDropDraft } from '../_lib/workspace-handle-drop';
import {
  appendSelectedWorkspaceGraphNode,
  workspaceConnectionRejectionReason,
} from '../_lib/workspace-graph-helpers';
import {
  createWorkspaceEdge,
  inferWorkspaceEdgeKind,
} from '../_lib/workspace-templates';
import {
  workspaceAssetRecordFromLibraryAsset,
  type WorkspaceLibraryAsset,
} from '../_lib/workspace-library-assets';
import type { WorkspaceEditorSurface } from '../_state/workspace-state';

type UseWorkspaceGraphActionsParams = {
  capabilities: WorkspaceModelCapability[];
  defaultModelId: string;
  edges: WorkspaceGraphEdge[];
  nodes: WorkspaceGraphNode[];
  setActiveEditorSurface: Dispatch<SetStateAction<WorkspaceEditorSurface>>;
  setAssetPickerNodeId: Dispatch<SetStateAction<string | null>>;
  setEdges: Dispatch<SetStateAction<WorkspaceGraphEdge[]>>;
  setNodes: Dispatch<SetStateAction<WorkspaceGraphNode[]>>;
  setNotice: Dispatch<SetStateAction<string | null>>;
  setSelectedNodeId: Dispatch<SetStateAction<string | null>>;
};

export function useWorkspaceGraphActions({
  capabilities,
  defaultModelId,
  edges,
  nodes,
  setActiveEditorSurface,
  setAssetPickerNodeId,
  setEdges,
  setNodes,
  setNotice,
  setSelectedNodeId,
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
      setNodes((current) =>
        current.map((node) => (node.id === nodeId ? { ...node, data: { ...node.data, ...patch } } : node))
      );
    },
    [setNodes]
  );

  const patchShot = useCallback(
    (nodeId: string, patch: Partial<WorkspaceShotSettings>) => {
      setNodes((current) =>
        current.map((node) => {
          if (node.id !== nodeId || !node.data.shot) return node;
          const nextShot = {
            ...node.data.shot,
            ...patch,
            status: patch.status ?? (node.data.shot.status === 'incompatible' ? 'draft' : node.data.shot.status),
          };
          return {
            ...node,
            data: {
              ...node.data,
              subtitle: patch.outputName ?? node.data.subtitle,
              shot: nextShot,
            },
          };
        })
      );
    },
    [setNodes]
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
      setNodes((current) =>
        current.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: {
                  ...node.data,
                  subtitle: asset.name,
                  asset: assetRecord,
                },
              }
            : node
        )
      );
      setActiveEditorSurface('canvas');
      setSelectedNodeId(nodeId);
      setAssetPickerNodeId(null);
      setNotice(`${asset.name} attached to the media block.`);
    },
    [setActiveEditorSurface, setAssetPickerNodeId, setNodes, setNotice, setSelectedNodeId]
  );

  const onNodesChange = useCallback(
    (changes: NodeChange<WorkspaceGraphNode>[]) => {
      setNodes((current) => applyNodeChanges(changes, current));
    },
    [setNodes]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange<WorkspaceGraphEdge>[]) => {
      setEdges((current) => applyEdgeChanges(changes, current));
    },
    [setEdges]
  );

  const isValidConnection = useCallback(
    (connection: Connection | WorkspaceGraphEdge) => !workspaceConnectionRejectionReason({ connection, nodes, edges, capabilities }),
    [capabilities, edges, nodes]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      const rejectionReason = workspaceConnectionRejectionReason({ connection, nodes, edges, capabilities });
      if (rejectionReason) {
        setNotice(rejectionReason);
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
      setEdges((current) => addEdge(edge, current));
      setNotice(`${edge.data?.label ?? 'Graph'} link connected.`);
    },
    [capabilities, edges, nodes, setEdges, setNotice]
  );

  const handleCreateNodeFromHandleDrop = useCallback(
    (request: WorkspaceHandleDropRequest) => {
      const draft = resolveWorkspaceHandleDropDraft(request.handleId, request.handleType);
      if (!draft) {
        setNotice('No matching block is available for this connector.');
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
          setNotice(rejectionReason);
          return;
        }
      }

      const node = createWorkspaceHandleDropNode({
        draft,
        defaultModelId,
        index: nodes.length,
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

      setNodes((current) => appendSelectedWorkspaceGraphNode(current, node));
      setEdges((current) => addEdge(edge, current));
      setActiveEditorSurface('canvas');
      setSelectedNodeId(node.id);
      setNotice(`${node.data.title} created from the ${edge.data?.label ?? 'connector'} connector.`);
    },
    [
      capabilities,
      defaultModelId,
      edges,
      nodes,
      setActiveEditorSurface,
      setEdges,
      setNodes,
      setNotice,
      setSelectedNodeId,
    ]
  );

  const handleCreateNodeFromPaletteDrop = useCallback(
    (request: WorkspacePaletteDropRequest) => {
      const node = createAdHocWorkspaceNode(request.kind, nodes.length, defaultModelId, {
        x: request.position.x - 105,
        y: request.position.y - 48,
      });
      setNodes((current) => appendSelectedWorkspaceGraphNode(current, node));
      setActiveEditorSurface('canvas');
      setSelectedNodeId(node.id);
      setNotice(`${node.data.title} dropped onto the canvas.`);
    },
    [defaultModelId, nodes.length, setActiveEditorSurface, setNodes, setNotice, setSelectedNodeId]
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
