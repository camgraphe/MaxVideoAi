'use client';

import {
  useCallback,
  useEffect,
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
  SelectionMode,
  type Connection,
  type EdgeChange,
  type NodeChange,
  useReactFlow,
  type XYPosition,
} from '@xyflow/react';
import styles from '../_styles/canvas.module.css';
import type { WorkspaceEdgeKind, WorkspaceGraphEdge, WorkspaceGraphNode } from '../_lib/workspace-types';
import {
  WORKSPACE_GRAPH_CLIPBOARD_TEXT,
  WORKSPACE_GRAPH_CLIPBOARD_TYPE,
  useCanvasController,
  type WorkspaceCanvasFileDropRequest,
  type WorkspaceCanvasTextPasteRequest,
  type WorkspacePaletteDropRequest,
} from '../_controllers/useCanvasController';
import {
  resolveWorkspaceHandleDropDraft,
  type WorkspaceHandleDropDirection,
} from '../_lib/workspace-handle-drop';
import { createWorkspaceGraphClipboardSnapshot } from '../_lib/workspace-graph-clipboard';
import { inferWorkspaceEdgeKind, WORKSPACE_EDGE_COLORS } from '../_lib/workspace-templates';
import { CanvasHandleDropPreview, type HandleDropPreview } from './canvas/CanvasHandleDropPreview';
import {
  CanvasFloatingToolbar,
  type CanvasFloatingToolbarProps,
  type CanvasSelectionTool,
} from './canvas/CanvasFloatingToolbar';
import {
  CanvasNavigatorPanel,
  type CanvasNavigatorPanelProps,
} from './canvas/CanvasNavigatorPanel';
import { CanvasMap } from './canvas/CanvasMap';
import { CanvasPaletteDragPreview } from './canvas/CanvasPaletteDragPreview';
import { workspaceEdgeTypes } from './edges/workspace-smart-edge';
import { workspaceNodeTypes } from './nodes/workspace-node-types';
import type { StudioCopy } from '../../_lib/studio-copy';

export type {
  WorkspaceCanvasFileDropRequest,
  WorkspaceCanvasTextPasteRequest,
  WorkspacePaletteDropRequest,
} from '../_controllers/useCanvasController';

const DEFAULT_CANVAS_NODE_CENTER_WIDTH = 210;
const DEFAULT_CANVAS_NODE_CENTER_HEIGHT = 132;

export type WorkspaceHandleDropRequest = {
  sourceNodeId: string;
  handleId: WorkspaceEdgeKind;
  handleType: WorkspaceHandleDropDirection;
  position: XYPosition;
};

type WorkspaceCanvasProps = {
  autoCenterNodeId: string | null;
  copy: StudioCopy['canvas'];
  notices: StudioCopy['notices'];
  nodes: WorkspaceGraphNode[];
  edges: WorkspaceGraphEdge[];
  isKeyboardDeleteEnabled: boolean;
  isShortcutActive: boolean;
  onNodesChange: (changes: NodeChange<WorkspaceGraphNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<WorkspaceGraphEdge>[]) => void;
  onConnect: (connection: Connection) => void;
  isValidConnection: (connection: Connection | WorkspaceGraphEdge) => boolean;
  onCreateNodeFromHandleDrop: (request: WorkspaceHandleDropRequest) => void;
  onCreateNodeFromPaletteDrop: (request: WorkspacePaletteDropRequest) => void;
  onCanvasFileDrop: (request: WorkspaceCanvasFileDropRequest) => void;
  onCopySelectedNodes: (nodeIds: string[]) => void;
  onPasteCopiedNodes: () => void;
  onCanvasTextPaste: (request: WorkspaceCanvasTextPasteRequest) => void;
  onAutoCenterNodeConsumed: () => void;
  onCanvasInteraction: () => void;
  onSelectedNodeChange: (nodeId: string | null) => void;
  onSelectedNodeSync: (nodeId: string | null) => void;
  onInspectNode: (nodeId: string | null) => void;
  toolbar: Omit<
    CanvasFloatingToolbarProps,
    'copy' | 'onDeleteSelectedNodes' | 'onSelectionToolChange' | 'selectedNodeCount' | 'selectionTool'
  >;
  canvasNavigator: Omit<CanvasNavigatorPanelProps, 'copy'>;
};

export function WorkspaceCanvas({
  autoCenterNodeId,
  copy,
  notices,
  nodes,
  edges,
  isKeyboardDeleteEnabled,
  isShortcutActive,
  onNodesChange,
  onEdgesChange,
  onConnect,
  isValidConnection,
  onCreateNodeFromHandleDrop,
  onCreateNodeFromPaletteDrop,
  onCanvasFileDrop,
  onCopySelectedNodes,
  onPasteCopiedNodes,
  onCanvasTextPaste,
  onAutoCenterNodeConsumed,
  onCanvasInteraction,
  onSelectedNodeChange,
  onSelectedNodeSync,
  onInspectNode,
  toolbar,
  canvasNavigator,
}: WorkspaceCanvasProps) {
  return (
    <ReactFlowProvider>
      <WorkspaceCanvasInner
        autoCenterNodeId={autoCenterNodeId}
        nodes={nodes}
        copy={copy}
        notices={notices}
        edges={edges}
        isKeyboardDeleteEnabled={isKeyboardDeleteEnabled}
        isShortcutActive={isShortcutActive}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onCreateNodeFromHandleDrop={onCreateNodeFromHandleDrop}
        onCreateNodeFromPaletteDrop={onCreateNodeFromPaletteDrop}
        onCanvasFileDrop={onCanvasFileDrop}
        onCopySelectedNodes={onCopySelectedNodes}
        onPasteCopiedNodes={onPasteCopiedNodes}
        onCanvasTextPaste={onCanvasTextPaste}
        onAutoCenterNodeConsumed={onAutoCenterNodeConsumed}
        onCanvasInteraction={onCanvasInteraction}
        onSelectedNodeChange={onSelectedNodeChange}
        onSelectedNodeSync={onSelectedNodeSync}
        onInspectNode={onInspectNode}
        toolbar={toolbar}
        canvasNavigator={canvasNavigator}
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

function isEditableCanvasShortcutTarget(target: EventTarget | null): boolean {
  let current = target instanceof Element ? target : null;
  while (current) {
    if (current.matches('input, textarea, select')) return true;
    if (current instanceof HTMLElement && current.isContentEditable) return true;
    const contentEditable = current.getAttribute('contenteditable');
    if (contentEditable !== null && contentEditable.toLowerCase() !== 'false') return true;
    current = current.parentElement;
  }
  return false;
}

function isCanvasDialogTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest('[role="dialog"], [aria-modal="true"]'));
}

function isCanvasCommandTarget(target: EventTarget | null): boolean {
  return isEditableCanvasShortcutTarget(target) || isCanvasDialogTarget(target) || isCanvasDialogTarget(document.activeElement);
}

function canvasShortcutLetter(event: KeyboardEvent): string {
  const key = event.key.toLowerCase();
  if (/^[a-z]$/.test(key)) return key;
  const codeMatch = event.code.match(/^Key([A-Z])$/);
  return codeMatch?.[1].toLowerCase() ?? '';
}

function canvasHistoryShortcut(event: KeyboardEvent): 'redo' | 'undo' | null {
  if (!event.metaKey && !event.ctrlKey) return null;
  const key = canvasShortcutLetter(event);
  if (key === 'z') return event.shiftKey ? 'redo' : 'undo';
  if (key === 'y') return 'redo';
  return null;
}

function renderedNodeDimension(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

function markCanvasSelectionBoxes(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>('.react-flow__selection').forEach((selectionBox) => {
    selectionBox.dataset.canvasSelectionBox = 'true';
  });
}

function areCanvasNodeIdSelectionsEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((nodeId, index) => nodeId === right[index]);
}

function WorkspaceCanvasInner({
  autoCenterNodeId,
  copy,
  notices,
  nodes,
  edges,
  isKeyboardDeleteEnabled,
  isShortcutActive,
  onNodesChange,
  onEdgesChange,
  onConnect,
  isValidConnection,
  onCreateNodeFromHandleDrop,
  onCreateNodeFromPaletteDrop,
  onCanvasFileDrop,
  onCopySelectedNodes,
  onPasteCopiedNodes,
  onCanvasTextPaste,
  onAutoCenterNodeConsumed,
  onCanvasInteraction,
  onSelectedNodeChange,
  onSelectedNodeSync,
  onInspectNode,
  toolbar,
  canvasNavigator,
}: WorkspaceCanvasProps) {
  const reactFlow = useReactFlow<WorkspaceGraphNode, WorkspaceGraphEdge>();
  const canvasShellRef = useRef<HTMLElement | null>(null);
  const selectedNodeIdRef = useRef<string | null>(null);
  const [selectionTool, setSelectionTool] = useState<CanvasSelectionTool>('pointer');
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [handleDropPreview, setHandleDropPreview] = useState<HandleDropPreview | null>(null);
  const handleDropPreviewRef = useRef<HandleDropPreview | null>(null);
  const {
    canRedo: canRedoCanvas,
    canUndo: canUndoCanvas,
    onRedo: onRedoCanvas,
    onUndo: onUndoCanvas,
  } = toolbar;
  const canvasShortcutStateRef = useRef({
    canRedo: canRedoCanvas,
    canUndo: canUndoCanvas,
    isActive: isShortcutActive,
    onRedo: onRedoCanvas,
    onUndo: onUndoCanvas,
  });
  const canvasClipboardStateRef = useRef({
    isActive: isShortcutActive,
    onCopySelectedNodes,
    onPasteCopiedNodes,
    selectedNodeIds,
  });
  const pendingGraphPasteTimerRef = useRef<number | null>(null);
  const nodeTypes = useMemo(() => workspaceNodeTypes, []);
  const edgeTypes = useMemo(() => workspaceEdgeTypes, []);
  const isMarqueeSelectionTool = selectionTool === 'marquee';
  const defaultEdgeOptions = useMemo<DefaultEdgeOptions>(
    () => ({
      type: 'workspace-smart',
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#8b5cf6',
      },
      style: {
        strokeWidth: 2.35,
      },
    }),
    []
  );

  canvasShortcutStateRef.current = {
    canRedo: canRedoCanvas,
    canUndo: canUndoCanvas,
    isActive: isShortcutActive,
    onRedo: onRedoCanvas,
    onUndo: onUndoCanvas,
  };
  canvasClipboardStateRef.current = {
    isActive: isShortcutActive,
    onCopySelectedNodes,
    onPasteCopiedNodes,
    selectedNodeIds,
  };

  const updateHandleDropPreview = useCallback((preview: HandleDropPreview | null) => {
    handleDropPreviewRef.current = preview;
    setHandleDropPreview(preview);
  }, []);

  const {
    handleDragOver,
    handleDrop,
    handlePalettePlacementCommit,
    paletteDragPreview,
  } = useCanvasController({
    canvasShellRef,
    copy: copy.nodes,
    onCanvasFileDrop,
    onCanvasGraphPaste: onPasteCopiedNodes,
    onCanvasInteraction,
    onCanvasTextPaste,
    onCreateNodeFromPaletteDrop,
  });

  useEffect(() => {
    if (!autoCenterNodeId) return;
    const autoCenterNode = nodes.find((node) => node.id === autoCenterNodeId);
    if (!autoCenterNode) {
      onAutoCenterNodeConsumed();
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const measured = autoCenterNode.measured;
      const nodeWidth = renderedNodeDimension(measured?.width ?? autoCenterNode.width, DEFAULT_CANVAS_NODE_CENTER_WIDTH);
      const nodeHeight = renderedNodeDimension(measured?.height ?? autoCenterNode.height, DEFAULT_CANVAS_NODE_CENTER_HEIGHT);
      void reactFlow.setCenter(
        autoCenterNode.position.x + nodeWidth / 2,
        autoCenterNode.position.y + nodeHeight / 2,
        {
          duration: 160,
          zoom: Math.max(reactFlow.getZoom(), 0.7),
        }
      );
      onAutoCenterNodeConsumed();
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [autoCenterNodeId, nodes, onAutoCenterNodeConsumed, reactFlow]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key.toLowerCase() !== 'i') return;
      if (isCanvasCommandTarget(event.target)) return;
      const selectedNodeId = selectedNodeIdRef.current;
      if (!selectedNodeId) return;
      event.preventDefault();
      onInspectNode(selectedNodeId);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onInspectNode]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const {
        canRedo,
        canUndo,
        isActive,
        onRedo,
        onUndo,
      } = canvasShortcutStateRef.current;
      if (!isActive) return;
      if (isCanvasCommandTarget(event.target)) return;
      const shortcut = canvasHistoryShortcut(event);
      if (!shortcut) return;

      event.preventDefault();
      if (shortcut === 'redo') {
        if (canRedo) onRedo();
        return;
      }
      if (canUndo) onUndo();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    const clearPendingGraphPaste = () => {
      if (pendingGraphPasteTimerRef.current === null) return;
      window.clearTimeout(pendingGraphPasteTimerRef.current);
      pendingGraphPasteTimerRef.current = null;
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || (!event.metaKey && !event.ctrlKey)) return;
      if (isCanvasCommandTarget(event.target)) return;
      const { isActive, onPasteCopiedNodes: pasteCopiedNodes, selectedNodeIds: copiedNodeIds } = canvasClipboardStateRef.current;
      if (!isActive) return;
      const key = canvasShortcutLetter(event);
      if (key === 'c' && copiedNodeIds.length) {
        return;
      }
      if (key !== 'v') return;
      clearPendingGraphPaste();
      pendingGraphPasteTimerRef.current = window.setTimeout(() => {
        pendingGraphPasteTimerRef.current = null;
        pasteCopiedNodes();
      }, 80);
    };
    const handlePaste = () => {
      clearPendingGraphPaste();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('paste', handlePaste, { capture: true });
    return () => {
      clearPendingGraphPaste();
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('paste', handlePaste, true);
    };
  }, []);

  useEffect(() => {
    const handleCopy = (event: ClipboardEvent) => {
      const { isActive, onCopySelectedNodes: copySelectedNodes, selectedNodeIds: copiedNodeIds } = canvasClipboardStateRef.current;
      if (!isActive || !copiedNodeIds.length) return;
      if (isCanvasCommandTarget(event.target)) return;
      const target = event.target instanceof Element ? event.target : null;
      const activeElement = document.activeElement;
      const isNeutralDocumentCopy =
        !target ||
        target === document.body ||
        target === document.documentElement ||
        activeElement === document.body ||
        activeElement === document.documentElement;
      if (target && !canvasShellRef.current?.contains(target) && !isNeutralDocumentCopy) return;
      const clipboardData = event.clipboardData;
      if (!clipboardData) return;
      const snapshot = createWorkspaceGraphClipboardSnapshot({
        edges,
        nodes,
        selectedNodeIds: copiedNodeIds,
      });
      if (!snapshot) return;
      clipboardData.setData(WORKSPACE_GRAPH_CLIPBOARD_TYPE, '1');
      clipboardData.setData('text/plain', WORKSPACE_GRAPH_CLIPBOARD_TEXT);
      event.preventDefault();
      copySelectedNodes(copiedNodeIds);
    };

    window.addEventListener('copy', handleCopy);
    return () => {
      window.removeEventListener('copy', handleCopy);
    };
  }, [edges, nodes]);

  useEffect(() => {
    const canvasShell = canvasShellRef.current;
    if (!canvasShell) return;
    markCanvasSelectionBoxes(canvasShell);

    const observer = new MutationObserver(() => {
      markCanvasSelectionBoxes(canvasShell);
    });
    observer.observe(canvasShell, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
    };
  }, []);

  const handleCanvasClickCapture = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const inspectButton = target.closest<HTMLElement>('[data-canvas-node-inspect-button]');
      if (!inspectButton || !canvasShellRef.current?.contains(inspectButton)) return;
      const nodeId = inspectButton.dataset.canvasNodeInspectButton;
      if (!nodeId) return;
      event.preventDefault();
      event.stopPropagation();
      selectedNodeIdRef.current = nodeId;
      onInspectNode(nodeId);
    },
    [onInspectNode]
  );

  const syncSelectedNodeIds = useCallback((nextSelectedNodeIds: string[]) => {
    setSelectedNodeIds((currentSelectedNodeIds) => (
      areCanvasNodeIdSelectionsEqual(currentSelectedNodeIds, nextSelectedNodeIds)
        ? currentSelectedNodeIds
        : nextSelectedNodeIds
    ));
  }, []);

  const handleDeleteSelectedNodes = useCallback(() => {
    if (!selectedNodeIds.length) return;
    void reactFlow.deleteElements({ nodes: selectedNodeIds.map((id) => ({ id })) });
    syncSelectedNodeIds([]);
    selectedNodeIdRef.current = null;
    onSelectedNodeChange(null);
    onSelectedNodeSync(null);
    onCanvasInteraction();
  }, [onCanvasInteraction, onSelectedNodeChange, onSelectedNodeSync, reactFlow, selectedNodeIds, syncSelectedNodeIds]);

  const handleConnectStart = useCallback<OnConnectStart>(
    (event, params) => {
      onCanvasInteraction();
      const handleType = resolveHandleType(params.handleType);
      if (!params.nodeId || !params.handleId || !handleType) {
        updateHandleDropPreview(null);
        return;
      }

      const handleId = inferWorkspaceEdgeKind(params.handleId, params.handleId);
      const pointer = pointerFromConnectionEvent(event);
      if (!pointer) {
        updateHandleDropPreview(null);
        return;
      }

      const draft = resolveWorkspaceHandleDropDraft(handleId, notices, handleType, copy.nodes) ?? undefined;
      const flowPosition = reactFlow.screenToFlowPosition(pointer);
      updateHandleDropPreview({
        sourceNodeId: params.nodeId,
        handleId,
        handleType,
        accent: draft?.accent ?? WORKSPACE_EDGE_COLORS[handleId] ?? '#8b5cf6',
        draft,
        origin: flowPosition,
        position: flowPosition,
      });
    },
    [copy.nodes, notices, onCanvasInteraction, reactFlow, updateHandleDropPreview]
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
      if (!preview) return;
      if (!preview.draft || connectionState.isValid || connectionState.toHandle || droppedOnExistingGraphElement(event)) return;

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
    <section
      ref={canvasShellRef}
      className={styles.canvasShell}
      data-studio-canvas-shell="true"
      aria-label={copy.ariaLabel}
      onClickCapture={handleCanvasClickCapture}
    >
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
          selectedNodeIdRef.current = node.id;
          syncSelectedNodeIds([node.id]);
          onSelectedNodeChange(node.id);
        }}
        onNodeDoubleClick={(_, node) => {
          onCanvasInteraction();
          selectedNodeIdRef.current = node.id;
          syncSelectedNodeIds([node.id]);
          onInspectNode(node.id);
        }}
        onPaneClick={(event) => {
          if (handlePalettePlacementCommit(event)) return;
          onCanvasInteraction();
          selectedNodeIdRef.current = null;
          syncSelectedNodeIds([]);
          onSelectedNodeChange(null);
        }}
        onSelectionChange={({ nodes: selectedNodes }) => {
          const nextSelectedNodeIds = selectedNodes.map((node) => node.id);
          const selectedNodeId = selectedNodes[0]?.id ?? null;
          selectedNodeIdRef.current = selectedNodeId;
          syncSelectedNodeIds(nextSelectedNodeIds);
          onSelectedNodeSync(selectedNodeId);
        }}
        defaultEdgeOptions={defaultEdgeOptions}
        minZoom={0.18}
        maxZoom={1.65}
        fitView
        fitViewOptions={{ padding: 0.18, includeHiddenNodes: false }}
        deleteKeyCode={isKeyboardDeleteEnabled ? ['Backspace', 'Delete'] : null}
        multiSelectionKeyCode={['Meta', 'Shift']}
        selectionKeyCode={isMarqueeSelectionTool ? null : 'Shift'}
        selectionMode={SelectionMode.Partial}
        panOnScroll
        panOnDrag={!isMarqueeSelectionTool}
        selectionOnDrag={isMarqueeSelectionTool}
        className={styles.reactFlowCanvas}
      >
        <Background color="rgba(148, 163, 184, 0.18)" gap={24} size={1} variant={BackgroundVariant.Dots} />
        {handleDropPreview ? <CanvasHandleDropPreview preview={handleDropPreview} /> : null}
        {paletteDragPreview ? <CanvasPaletteDragPreview preview={paletteDragPreview} /> : null}
        <CanvasMap copy={copy.map} edges={edges} nodes={nodes} />
      </ReactFlow>
      <CanvasFloatingToolbar
        {...toolbar}
        copy={copy}
        selectionTool={selectionTool}
        selectedNodeCount={selectedNodeIds.length}
        onDeleteSelectedNodes={() => {
          onCanvasInteraction();
          handleDeleteSelectedNodes();
        }}
        onSelectionToolChange={(tool) => {
          onCanvasInteraction();
          setSelectionTool(tool);
        }}
        onRedo={() => {
          onCanvasInteraction();
          toolbar.onRedo();
        }}
        onUndo={() => {
          onCanvasInteraction();
          toolbar.onUndo();
        }}
      />
      <CanvasNavigatorPanel {...canvasNavigator} copy={copy} />
      {nodes.length === 0 ? (
        <div className={styles.canvasEmptyState}>
          <p>{copy.toolbar.emptyTitle}</p>
          <span>{copy.toolbar.emptyBody}</span>
        </div>
      ) : null}
    </section>
  );
}
