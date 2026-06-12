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
import type { StudioCopy } from '../../_lib/studio-copy';

function formatNotice(value: string, replacements: Record<string, string | number>): string {
  return Object.entries(replacements).reduce(
    (current, [key, replacement]) => current.replaceAll(`{${key}}`, String(replacement)),
    value
  );
}

function localizedConnectionRejectionReason(reason: string, notices: StudioCopy['notices']): string {
  if (reason === 'This link needs a source and a target connector.') return notices.linkNeedsSourceAndTarget;
  if (reason === 'A block cannot link to itself.') return notices.blockCannotLinkToItself;
  if (reason === 'These block connectors are not compatible.') return notices.connectorsNotCompatible;
  const fullConnectorMatch = reason.match(/^(.+) is full\.$/);
  if (fullConnectorMatch) {
    return formatNotice(notices.connectorFull, { connector: fullConnectorMatch[1] });
  }
  return reason;
}

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
  studioNotices: StudioCopy['notices'];
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
      setNotice(formatNotice(studioNotices.assetAttachedToMediaBlock, { name: asset.name }));
    },
    [setActiveEditorSurface, setAssetPickerNodeId, setNodes, setNotice, setSelectedNodeId, studioNotices.assetAttachedToMediaBlock]
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
        setNotice(localizedConnectionRejectionReason(rejectionReason, studioNotices));
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
      setNotice(formatNotice(studioNotices.graphLinkConnected, { label: edge.data?.label ?? studioNotices.graphFallbackLabel }));
    },
    [
      capabilities,
      edges,
      nodes,
      setEdges,
      setNotice,
      studioNotices,
    ]
  );

  const handleCreateNodeFromHandleDrop = useCallback(
    (request: WorkspaceHandleDropRequest) => {
      const draft = resolveWorkspaceHandleDropDraft(request.handleId, studioNotices, request.handleType);
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
          setNotice(localizedConnectionRejectionReason(rejectionReason, studioNotices));
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

      setNodes((current) => appendSelectedWorkspaceGraphNode(current, node));
      setEdges((current) => addEdge(edge, current));
      setActiveEditorSurface('canvas');
      setSelectedNodeId(node.id);
      setNotice(formatNotice(studioNotices.nodeCreatedFromConnector, {
        title: node.data.title,
        connector: edge.data?.label ?? studioNotices.connectorFallbackLabel,
      }));
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
      studioNotices,
    ]
  );

  const handleCreateNodeFromPaletteDrop = useCallback(
    (request: WorkspacePaletteDropRequest) => {
      const node = createAdHocWorkspaceNode(request.kind, nodes.length, defaultModelId, studioNotices, {
        x: request.position.x - 105,
        y: request.position.y - 48,
      });
      setNodes((current) => appendSelectedWorkspaceGraphNode(current, node));
      setActiveEditorSurface('canvas');
      setSelectedNodeId(node.id);
      setNotice(formatNotice(studioNotices.nodeDroppedOntoCanvas, { title: node.data.title }));
    },
    [defaultModelId, nodes.length, setActiveEditorSurface, setNodes, setNotice, setSelectedNodeId, studioNotices]
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
