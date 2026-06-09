'use client';

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import {
  Background,
  BackgroundVariant,
  type DefaultEdgeOptions,
  type HandleType,
  MarkerType,
  type OnConnectEnd,
  type OnConnectStart,
  ReactFlow,
  ReactFlowProvider,
  type Connection,
  type EdgeChange,
  type NodeChange,
  useReactFlow,
  type XYPosition,
} from '@xyflow/react';
import styles from '../maxvideoai-editor.module.css';
import type { WorkspaceEdgeKind, WorkspaceGraphEdge, WorkspaceGraphNode } from '../_lib/workspace-types';
import {
  useCanvasController,
  type WorkspaceCanvasFileDropRequest,
  type WorkspaceCanvasTextPasteRequest,
  type WorkspacePaletteDropRequest,
} from '../_controllers/useCanvasController';
import {
  resolveWorkspaceHandleDropDraft,
  type WorkspaceHandleDropDirection,
} from '../_lib/workspace-handle-drop';
import { inferWorkspaceEdgeKind } from '../_lib/workspace-templates';
import { CanvasHandleDropPreview, type HandleDropPreview } from './canvas/CanvasHandleDropPreview';
import { CanvasMap } from './canvas/CanvasMap';
import { CanvasPaletteDragPreview } from './canvas/CanvasPaletteDragPreview';
import { workspaceEdgeTypes } from './edges/workspace-smart-edge';
import { workspaceNodeTypes } from './nodes/workspace-node-types';

export type {
  WorkspaceCanvasFileDropRequest,
  WorkspaceCanvasTextPasteRequest,
  WorkspacePaletteDropRequest,
} from '../_controllers/useCanvasController';

export type WorkspaceHandleDropRequest = {
  sourceNodeId: string;
  handleId: WorkspaceEdgeKind;
  handleType: WorkspaceHandleDropDirection;
  position: XYPosition;
};

type WorkspaceCanvasProps = {
  nodes: WorkspaceGraphNode[];
  edges: WorkspaceGraphEdge[];
  isKeyboardDeleteEnabled: boolean;
  onNodesChange: (changes: NodeChange<WorkspaceGraphNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<WorkspaceGraphEdge>[]) => void;
  onConnect: (connection: Connection) => void;
  isValidConnection: (connection: Connection | WorkspaceGraphEdge) => boolean;
  onCreateNodeFromHandleDrop: (request: WorkspaceHandleDropRequest) => void;
  onCreateNodeFromPaletteDrop: (request: WorkspacePaletteDropRequest) => void;
  onCanvasFileDrop: (request: WorkspaceCanvasFileDropRequest) => void;
  onCanvasTextPaste: (request: WorkspaceCanvasTextPasteRequest) => void;
  onCanvasInteraction: () => void;
  onSelectedNodeChange: (nodeId: string | null) => void;
  onSelectedNodeSync: (nodeId: string | null) => void;
};

export function WorkspaceCanvas({
  nodes,
  edges,
  isKeyboardDeleteEnabled,
  onNodesChange,
  onEdgesChange,
  onConnect,
  isValidConnection,
  onCreateNodeFromHandleDrop,
  onCreateNodeFromPaletteDrop,
  onCanvasFileDrop,
  onCanvasTextPaste,
  onCanvasInteraction,
  onSelectedNodeChange,
  onSelectedNodeSync,
}: WorkspaceCanvasProps) {
  return (
    <ReactFlowProvider>
      <WorkspaceCanvasInner
        nodes={nodes}
        edges={edges}
        isKeyboardDeleteEnabled={isKeyboardDeleteEnabled}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onCreateNodeFromHandleDrop={onCreateNodeFromHandleDrop}
        onCreateNodeFromPaletteDrop={onCreateNodeFromPaletteDrop}
        onCanvasFileDrop={onCanvasFileDrop}
        onCanvasTextPaste={onCanvasTextPaste}
        onCanvasInteraction={onCanvasInteraction}
        onSelectedNodeChange={onSelectedNodeChange}
        onSelectedNodeSync={onSelectedNodeSync}
      />
    </ReactFlowProvider>
  );
}

function pointerFromConnectionEvent(event: MouseEvent | TouchEvent): XYPosition | null {
  if ('touches' in event) {
    const touch = event.touches[0] ?? event.changedTouches[0];
    return touch ? { x: touch.clientX, y: touch.clientY } : null;
  }
  return { x: event.clientX, y: event.clientY };
}

function resolveHandleType(handleType: HandleType | null): WorkspaceHandleDropDirection | null {
  if (handleType === 'source' || handleType === 'target') return handleType;
  return null;
}

function droppedOnExistingGraphElement(event: MouseEvent | TouchEvent): boolean {
  const target = event.target;
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest('.react-flow__node, .react-flow__handle, .react-flow__edge'));
}

function WorkspaceCanvasInner({
  nodes,
  edges,
  isKeyboardDeleteEnabled,
  onNodesChange,
  onEdgesChange,
  onConnect,
  isValidConnection,
  onCreateNodeFromHandleDrop,
  onCreateNodeFromPaletteDrop,
  onCanvasFileDrop,
  onCanvasTextPaste,
  onCanvasInteraction,
  onSelectedNodeChange,
  onSelectedNodeSync,
}: WorkspaceCanvasProps) {
  const reactFlow = useReactFlow<WorkspaceGraphNode, WorkspaceGraphEdge>();
  const canvasShellRef = useRef<HTMLElement | null>(null);
  const [handleDropPreview, setHandleDropPreview] = useState<HandleDropPreview | null>(null);
  const handleDropPreviewRef = useRef<HandleDropPreview | null>(null);
  const nodeTypes = useMemo(() => workspaceNodeTypes, []);
  const edgeTypes = useMemo(() => workspaceEdgeTypes, []);
  const defaultEdgeOptions = useMemo<DefaultEdgeOptions>(
    () => ({
      type: 'workspace-smart',
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#8b5cf6',
      },
      style: {
        strokeWidth: 2,
      },
    }),
    []
  );

  const updateHandleDropPreview = useCallback((preview: HandleDropPreview | null) => {
    handleDropPreviewRef.current = preview;
    setHandleDropPreview(preview);
  }, []);

  const {
    handleDragOver,
    handleDrop,
    paletteDragPreview,
  } = useCanvasController({
    canvasShellRef,
    onCanvasFileDrop,
    onCanvasInteraction,
    onCanvasTextPaste,
    onCreateNodeFromPaletteDrop,
  });

  const handleConnectStart = useCallback<OnConnectStart>(
    (event, params) => {
      onCanvasInteraction();
      const handleType = resolveHandleType(params.handleType);
      if (!params.nodeId || !params.handleId || !handleType) {
        updateHandleDropPreview(null);
        return;
      }

      const handleId = inferWorkspaceEdgeKind(params.handleId, params.handleId);
      const draft = resolveWorkspaceHandleDropDraft(handleId, handleType);
      const pointer = pointerFromConnectionEvent(event);
      if (!draft || !pointer) {
        updateHandleDropPreview(null);
        return;
      }

      const flowPosition = reactFlow.screenToFlowPosition(pointer);
      updateHandleDropPreview({
        sourceNodeId: params.nodeId,
        handleId,
        handleType,
        draft,
        origin: flowPosition,
        position: flowPosition,
      });
    },
    [onCanvasInteraction, reactFlow, updateHandleDropPreview]
  );

  const handlePaneMouseMove = useCallback(
    (event: ReactMouseEvent) => {
      const preview = handleDropPreviewRef.current;
      if (!preview) return;
      updateHandleDropPreview({
        ...preview,
        position: reactFlow.screenToFlowPosition({ x: event.clientX, y: event.clientY }),
      });
    },
    [reactFlow, updateHandleDropPreview]
  );

  const handleConnectEnd = useCallback<OnConnectEnd>(
    (event, connectionState) => {
      const preview = handleDropPreviewRef.current;
      updateHandleDropPreview(null);
      if (!preview || connectionState.isValid || connectionState.toHandle || droppedOnExistingGraphElement(event)) return;

      const pointer = pointerFromConnectionEvent(event);
      if (!pointer) return;
      onCreateNodeFromHandleDrop({
        sourceNodeId: preview.sourceNodeId,
        handleId: preview.handleId,
        handleType: preview.handleType,
        position: reactFlow.screenToFlowPosition(pointer),
      });
    },
    [onCreateNodeFromHandleDrop, reactFlow, updateHandleDropPreview]
  );

  return (
    <section ref={canvasShellRef} className={styles.canvasShell} aria-label="MaxVideoAI editor canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onConnectStart={handleConnectStart}
        onConnectEnd={handleConnectEnd}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onPaneMouseMove={handlePaneMouseMove}
        onNodeClick={(_, node) => {
          onCanvasInteraction();
          onSelectedNodeChange(node.id);
        }}
        onPaneClick={() => {
          onCanvasInteraction();
          onSelectedNodeChange(null);
        }}
        onSelectionChange={({ nodes: selectedNodes }) => {
          if (selectedNodes[0]?.id) {
            onSelectedNodeSync(selectedNodes[0].id);
          }
        }}
        defaultEdgeOptions={defaultEdgeOptions}
        minZoom={0.18}
        maxZoom={1.65}
        fitView
        fitViewOptions={{ padding: 0.18, includeHiddenNodes: false }}
        deleteKeyCode={isKeyboardDeleteEnabled ? ['Backspace', 'Delete'] : null}
        multiSelectionKeyCode={['Meta', 'Shift']}
        selectionKeyCode="Shift"
        panOnScroll
        selectionOnDrag
        className={styles.reactFlowCanvas}
      >
        <Background color="rgba(148, 163, 184, 0.18)" gap={24} size={1} variant={BackgroundVariant.Dots} />
        {handleDropPreview ? <CanvasHandleDropPreview preview={handleDropPreview} /> : null}
        {paletteDragPreview ? <CanvasPaletteDragPreview preview={paletteDragPreview} /> : null}
        <CanvasMap edges={edges} nodes={nodes} />
      </ReactFlow>
      {nodes.length === 0 ? (
        <div className={styles.canvasEmptyState}>
          <p>No graph yet</p>
          <span>Start from a template or add nodes from the library.</span>
        </div>
      ) : null}
    </section>
  );
}
