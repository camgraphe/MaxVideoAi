'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent as ReactDragEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  type DefaultEdgeOptions,
  type HandleType,
  MarkerType,
  MiniMap,
  type OnConnectEnd,
  type OnConnectStart,
  ReactFlow,
  ReactFlowProvider,
  type Connection,
  type EdgeChange,
  type NodeChange,
  useReactFlow,
  ViewportPortal,
  type XYPosition,
} from '@xyflow/react';
import styles from '../maxvideoai-editor.module.css';
import type { WorkspaceEdgeKind, WorkspaceGraphEdge, WorkspaceGraphNode, WorkspaceNodeKind } from '../_lib/workspace-types';
import {
  resolveWorkspaceHandleDropDraft,
  type WorkspaceHandleDropDirection,
  type WorkspaceHandleDropDraft,
} from '../_lib/workspace-handle-drop';
import { inferWorkspaceEdgeKind } from '../_lib/workspace-templates';
import { workspaceEdgeTypes } from './edges/workspace-smart-edge';
import { workspaceNodeTypes } from './nodes/workspace-node-types';

export type WorkspaceHandleDropRequest = {
  sourceNodeId: string;
  handleId: WorkspaceEdgeKind;
  handleType: WorkspaceHandleDropDirection;
  position: XYPosition;
};

export type WorkspacePaletteDropRequest = {
  kind: WorkspaceNodeKind;
  position: XYPosition;
};

const WORKSPACE_NODE_KINDS: readonly WorkspaceNodeKind[] = [
  'asset-image',
  'asset-video',
  'asset-audio',
  'text-prompt',
  'shot',
  'output',
];
const WORKSPACE_NODE_KIND_DRAG_TYPE = 'application/x-maxvideoai-node-kind';
const PALETTE_DRAG_START_EVENT = 'maxvideoai:palette-drag-start';

type PaletteDragPreview = {
  kind: WorkspaceNodeKind;
  title: string;
  subtitle: string;
  accent: string;
  position: XYPosition;
};

type PaletteDragStartDetail = {
  kind: WorkspaceNodeKind;
  clientX: number;
  clientY: number;
};

type HandleDropPreview = {
  sourceNodeId: string;
  handleId: WorkspaceEdgeKind;
  handleType: WorkspaceHandleDropDirection;
  draft: WorkspaceHandleDropDraft;
  origin: XYPosition;
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

function isWorkspaceNodeKind(value: string): value is WorkspaceNodeKind {
  return WORKSPACE_NODE_KINDS.includes(value as WorkspaceNodeKind);
}

function palettePreviewForKind(kind: WorkspaceNodeKind, position: XYPosition): PaletteDragPreview {
  if (kind === 'asset-image') return { kind, title: 'Image reference', subtitle: 'Empty media block', accent: '#8b5cf6', position };
  if (kind === 'asset-video') return { kind, title: 'Video reference', subtitle: 'Empty media block', accent: '#2563eb', position };
  if (kind === 'asset-audio') return { kind, title: 'Audio reference', subtitle: 'Empty media block', accent: '#22c55e', position };
  if (kind === 'text-prompt') return { kind, title: 'Prompt block', subtitle: 'Text source', accent: '#60a5fa', position };
  if (kind === 'output') return { kind, title: 'Output block', subtitle: 'Generated result', accent: '#f97316', position };
  return { kind, title: 'Generate block', subtitle: 'Unified video model', accent: '#f97316', position };
}

function WorkspaceHandleDropPreview({ preview }: { preview: HandleDropPreview }) {
  const x1 = preview.origin.x;
  const y1 = preview.origin.y;
  const x2 = preview.position.x;
  const y2 = preview.position.y;
  const controlOffset = Math.max(48, Math.min(180, Math.abs(x2 - x1) * 0.45));
  const path = `M ${x1} ${y1} C ${x1 + controlOffset} ${y1}, ${x2 - controlOffset} ${y2}, ${x2} ${y2}`;
  const ghostStyle = {
    '--node-accent': preview.draft.accent,
    transform: `translate(${x2 + 20}px, ${y2 - 44}px)`,
  } as CSSProperties;
  const linkStyle = {
    '--node-accent': preview.draft.accent,
  } as CSSProperties;

  return (
    <ViewportPortal>
      <svg className={styles.workspaceGhostLink} style={linkStyle} aria-hidden="true">
        <path d={path} stroke={preview.draft.accent} />
      </svg>
      <div className={styles.workspaceGhostNode} style={ghostStyle} aria-hidden="true">
        <strong>{preview.draft.title}</strong>
        <span>{preview.draft.subtitle}</span>
      </div>
    </ViewportPortal>
  );
}

function WorkspacePaletteDropPreview({ preview }: { preview: PaletteDragPreview }) {
  const ghostStyle = {
    '--node-accent': preview.accent,
    transform: `translate(${preview.position.x + 20}px, ${preview.position.y - 44}px)`,
  } as CSSProperties;

  return (
    <ViewportPortal>
      <div className={styles.workspaceGhostNode} style={ghostStyle} aria-hidden="true">
        <strong>{preview.title}</strong>
        <span>{preview.subtitle}</span>
      </div>
    </ViewportPortal>
  );
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
  onCanvasInteraction,
  onSelectedNodeChange,
  onSelectedNodeSync,
}: WorkspaceCanvasProps) {
  const reactFlow = useReactFlow<WorkspaceGraphNode, WorkspaceGraphEdge>();
  const [handleDropPreview, setHandleDropPreview] = useState<HandleDropPreview | null>(null);
  const [paletteDragPreview, setPaletteDragPreview] = useState<PaletteDragPreview | null>(null);
  const handleDropPreviewRef = useRef<HandleDropPreview | null>(null);
  const paletteDragPreviewRef = useRef<PaletteDragPreview | null>(null);
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

  const updatePaletteDragPreview = useCallback((preview: PaletteDragPreview | null) => {
    paletteDragPreviewRef.current = preview;
    setPaletteDragPreview(preview);
  }, []);

  useEffect(() => {
    const handlePaletteDragStart = (event: Event) => {
      const detail = (event as CustomEvent<PaletteDragStartDetail>).detail;
      if (!detail || !isWorkspaceNodeKind(detail.kind)) return;
      const position = reactFlow.screenToFlowPosition({ x: detail.clientX, y: detail.clientY });
      updatePaletteDragPreview(palettePreviewForKind(detail.kind, position));
    };

    window.addEventListener(PALETTE_DRAG_START_EVENT, handlePaletteDragStart);
    return () => {
      window.removeEventListener(PALETTE_DRAG_START_EVENT, handlePaletteDragStart);
    };
  }, [reactFlow, updatePaletteDragPreview]);

  const isPaletteDragging = Boolean(paletteDragPreview);

  useEffect(() => {
    if (!isPaletteDragging) return;

    const handleMove = (event: MouseEvent) => {
      const preview = paletteDragPreviewRef.current;
      if (!preview) return;
      updatePaletteDragPreview({
        ...preview,
        position: reactFlow.screenToFlowPosition({ x: event.clientX, y: event.clientY }),
      });
    };
    const handleUp = (event: MouseEvent) => {
      const preview = paletteDragPreviewRef.current;
      updatePaletteDragPreview(null);
      if (!preview) return;
      const target = document.elementFromPoint(event.clientX, event.clientY);
      if (!(target instanceof Element) || !target.closest('[aria-label="MaxVideoAI editor canvas"]')) return;
      onCreateNodeFromPaletteDrop({
        kind: preview.kind,
        position: reactFlow.screenToFlowPosition({ x: event.clientX, y: event.clientY }),
      });
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isPaletteDragging, onCreateNodeFromPaletteDrop, reactFlow, updatePaletteDragPreview]);

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

  const handleDragOver = useCallback((event: ReactDragEvent) => {
    const dragTypes = Array.from(event.dataTransfer.types);
    if (!dragTypes.includes(WORKSPACE_NODE_KIND_DRAG_TYPE) && !dragTypes.includes('text/plain')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback(
    (event: ReactDragEvent) => {
      const nodeKind = event.dataTransfer.getData(WORKSPACE_NODE_KIND_DRAG_TYPE) || event.dataTransfer.getData('text/plain');
      if (!isWorkspaceNodeKind(nodeKind)) return;
      event.preventDefault();
      onCanvasInteraction();
      onCreateNodeFromPaletteDrop({
        kind: nodeKind,
        position: reactFlow.screenToFlowPosition({ x: event.clientX, y: event.clientY }),
      });
    },
    [onCanvasInteraction, onCreateNodeFromPaletteDrop, reactFlow]
  );

  return (
    <section className={styles.canvasShell} aria-label="MaxVideoAI editor canvas">
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
        <MiniMap
          className={styles.minimap}
          pannable
          zoomable
          nodeStrokeWidth={3}
          nodeColor={(node) => (typeof node.data.accent === 'string' ? node.data.accent : '#8b5cf6')}
          maskColor="rgba(2, 6, 23, 0.72)"
        />
        {handleDropPreview ? <WorkspaceHandleDropPreview preview={handleDropPreview} /> : null}
        {paletteDragPreview ? <WorkspacePaletteDropPreview preview={paletteDragPreview} /> : null}
        <Controls className={styles.flowControls} showInteractive={false} position="bottom-right" />
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
