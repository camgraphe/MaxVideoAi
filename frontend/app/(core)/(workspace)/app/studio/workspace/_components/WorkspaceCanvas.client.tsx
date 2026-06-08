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
  type PointerEvent as ReactPointerEvent,
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
  useStore,
  useReactFlow,
  ViewportPortal,
  type XYPosition,
} from '@xyflow/react';
import { Maximize2, Minus, Plus } from 'lucide-react';
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

export type WorkspaceCanvasFileDropRequest = {
  files: File[];
  position: XYPosition;
  targetNodeId: string | null;
};

export type WorkspaceCanvasTextPasteRequest = {
  text: string;
  position: XYPosition;
  targetNodeId: string | null;
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
const CANVAS_MINI_MAP_WIDTH = 164;
const CANVAS_MINI_MAP_HEIGHT = 82;
const CANVAS_MINI_MAP_PADDING = 7;
const CANVAS_MINI_MAP_CONTENT_PADDING = 72;

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

type CanvasMiniatureNode = {
  id: string;
  kind: WorkspaceNodeKind;
  title: string;
  accent: string;
  x: number;
  y: number;
  width: number;
  height: number;
  thumbUrl: string | null;
};

type CanvasMiniatureLayoutNode = CanvasMiniatureNode & {
  mapX: number;
  mapY: number;
  mapWidth: number;
  mapHeight: number;
};

type CanvasMiniatureEdge = {
  id: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
};

type CanvasMiniatureViewport = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type CanvasMiniatureLayout = {
  bounds: { x: number; y: number; width: number; height: number };
  contentCenter: XYPosition;
  mapEdges: CanvasMiniatureEdge[];
  mapNodes: CanvasMiniatureLayoutNode[];
  offsetX: number;
  offsetY: number;
  scale: number;
  viewport: CanvasMiniatureViewport | null;
};

type CanvasMiniatureDragState = {
  offsetX: number;
  offsetY: number;
  pointerId: number;
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

function isWorkspaceNodeKind(value: string): value is WorkspaceNodeKind {
  return WORKSPACE_NODE_KINDS.includes(value as WorkspaceNodeKind);
}

function targetNodeIdFromEventTarget(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null;
  return target.closest('.react-flow__node')?.getAttribute('data-id') ?? null;
}

function isEditablePasteTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"], audio, video'));
}

function palettePreviewForKind(kind: WorkspaceNodeKind, position: XYPosition): PaletteDragPreview {
  if (kind === 'asset-image') return { kind, title: 'Image reference', subtitle: 'Empty media block', accent: '#8b5cf6', position };
  if (kind === 'asset-video') return { kind, title: 'Video reference', subtitle: 'Empty media block', accent: '#2563eb', position };
  if (kind === 'asset-audio') return { kind, title: 'Audio reference', subtitle: 'Empty media block', accent: '#22c55e', position };
  if (kind === 'text-prompt') return { kind, title: 'Prompt block', subtitle: 'Text source', accent: '#60a5fa', position };
  if (kind === 'output') return { kind, title: 'Output block', subtitle: 'Generated result', accent: '#f97316', position };
  return { kind, title: 'Generate block', subtitle: 'Unified video model', accent: '#f97316', position };
}

function fallbackNodeSize(kind: WorkspaceNodeKind): { width: number; height: number } {
  if (kind === 'shot') return { width: 230, height: 286 };
  if (kind === 'text-prompt') return { width: 220, height: 138 };
  if (kind === 'asset-audio') return { width: 220, height: 132 };
  return { width: 220, height: 168 };
}

function measuredNodeSize(node: WorkspaceGraphNode): { width: number; height: number } {
  const fallback = fallbackNodeSize(node.data.kind);
  const measured = 'measured' in node && typeof node.measured === 'object' ? node.measured : null;
  return {
    width: typeof node.width === 'number' ? node.width : typeof measured?.width === 'number' ? measured.width : fallback.width,
    height: typeof node.height === 'number' ? node.height : typeof measured?.height === 'number' ? measured.height : fallback.height,
  };
}

function miniatureThumbUrl(data: WorkspaceGraphNode['data']): string | null {
  const asset = data.asset;
  if (asset?.thumbUrl) return asset.thumbUrl;
  if ((asset?.kind === 'image' || asset?.kind === 'logo') && asset.url) return asset.url;
  const output = data.output;
  if (output?.thumbUrl) return output.thumbUrl;
  if (output?.kind === 'image' && output.url) return output.url;
  return null;
}

function buildCanvasMiniatureNodes(nodes: WorkspaceGraphNode[]): CanvasMiniatureNode[] {
  return nodes.map((node) => {
    const size = measuredNodeSize(node);
    return {
      id: node.id,
      kind: node.data.kind,
      title: node.data.title,
      accent: typeof node.data.accent === 'string' ? node.data.accent : '#8b5cf6',
      x: node.position.x,
      y: node.position.y,
      width: size.width,
      height: size.height,
      thumbUrl: miniatureThumbUrl(node.data),
    };
  });
}

function calculateCanvasMiniatureBounds(nodes: CanvasMiniatureNode[]): { x: number; y: number; width: number; height: number } {
  if (!nodes.length) return { x: -120, y: -80, width: 240, height: 160 };
  const minX = Math.min(...nodes.map((node) => node.x));
  const minY = Math.min(...nodes.map((node) => node.y));
  const maxX = Math.max(...nodes.map((node) => node.x + node.width));
  const maxY = Math.max(...nodes.map((node) => node.y + node.height));
  return {
    x: minX - CANVAS_MINI_MAP_CONTENT_PADDING,
    y: minY - CANVAS_MINI_MAP_CONTENT_PADDING,
    width: Math.max(1, maxX - minX + CANVAS_MINI_MAP_CONTENT_PADDING * 2),
    height: Math.max(1, maxY - minY + CANVAS_MINI_MAP_CONTENT_PADDING * 2),
  };
}

function clampMiniatureViewport(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function mapPointFromMiniaturePointer(svg: SVGSVGElement, clientX: number, clientY: number): XYPosition {
  const rect = svg.getBoundingClientRect();
  if (!rect.width || !rect.height) return { x: CANVAS_MINI_MAP_WIDTH / 2, y: CANVAS_MINI_MAP_HEIGHT / 2 };
  return {
    x: ((clientX - rect.left) / rect.width) * CANVAS_MINI_MAP_WIDTH,
    y: ((clientY - rect.top) / rect.height) * CANVAS_MINI_MAP_HEIGHT,
  };
}

function WorkspaceCanvasMiniatureNode({ node }: { node: CanvasMiniatureLayoutNode }) {
  const radius = Math.max(2, Math.min(5, Math.min(node.mapWidth, node.mapHeight) * 0.18));
  const headerHeight = Math.max(2, Math.min(7, node.mapHeight * 0.18));
  const previewX = node.mapX + Math.max(2, node.mapWidth * 0.08);
  const previewY = node.mapY + headerHeight + Math.max(2, node.mapHeight * 0.08);
  const previewWidth = Math.max(2, node.mapWidth - Math.max(4, node.mapWidth * 0.16));
  const previewHeight = Math.max(2, node.mapHeight - headerHeight - Math.max(5, node.mapHeight * 0.18));
  const lineGap = Math.max(2, previewHeight * 0.22);

  return (
    <g data-canvas-mini-node={node.id}>
      <rect className={styles.canvasMiniMapNode} x={node.mapX} y={node.mapY} width={node.mapWidth} height={node.mapHeight} rx={radius} />
      <rect className={styles.canvasMiniMapNodeHeader} x={node.mapX} y={node.mapY} width={node.mapWidth} height={headerHeight} rx={radius} fill={node.accent} />
      {node.thumbUrl ? (
        <image
          className={styles.canvasMiniMapNodeMedia}
          href={node.thumbUrl}
          x={previewX}
          y={previewY}
          width={previewWidth}
          height={previewHeight}
          preserveAspectRatio="xMidYMid slice"
        />
      ) : node.kind === 'shot' ? (
        <rect
          className={styles.canvasMiniMapShotWell}
          x={previewX}
          y={previewY}
          width={previewWidth}
          height={previewHeight}
          rx={Math.max(1, radius - 1)}
        />
      ) : node.kind === 'asset-audio' ? (
        Array.from({ length: 5 }, (_, index) => {
          const barWidth = Math.max(1, previewWidth / 9);
          const barHeight = previewHeight * (0.32 + (index % 3) * 0.18);
          return (
            <rect
              key={`audio-bar-${node.id}-${index}`}
              className={styles.canvasMiniMapAudioBar}
              x={previewX + index * barWidth * 1.65}
              y={previewY + (previewHeight - barHeight) / 2}
              width={barWidth}
              height={barHeight}
              rx={barWidth / 2}
            />
          );
        })
      ) : (
        <>
          <line className={styles.canvasMiniMapTextLine} x1={previewX} y1={previewY + lineGap} x2={previewX + previewWidth} y2={previewY + lineGap} />
          <line className={styles.canvasMiniMapTextLine} x1={previewX} y1={previewY + lineGap * 2} x2={previewX + previewWidth * 0.72} y2={previewY + lineGap * 2} />
        </>
      )}
    </g>
  );
}

function WorkspaceCanvasMiniatureMap({
  edges,
  nodes,
}: {
  edges: WorkspaceGraphEdge[];
  nodes: WorkspaceGraphNode[];
}) {
  const reactFlow = useReactFlow<WorkspaceGraphNode, WorkspaceGraphEdge>();
  const transform = useStore((store) => store.transform);
  const flowWidth = useStore((store) => store.width);
  const flowHeight = useStore((store) => store.height);
  const dragStateRef = useRef<CanvasMiniatureDragState | null>(null);
  const zoom = transform[2] || 1;

  const layout = useMemo<CanvasMiniatureLayout>(() => {
    const miniatureNodes = buildCanvasMiniatureNodes(nodes);
    const bounds = calculateCanvasMiniatureBounds(miniatureNodes);
    const availableWidth = CANVAS_MINI_MAP_WIDTH - CANVAS_MINI_MAP_PADDING * 2;
    const availableHeight = CANVAS_MINI_MAP_HEIGHT - CANVAS_MINI_MAP_PADDING * 2;
    const scale = Math.min(availableWidth / bounds.width, availableHeight / bounds.height);
    const contentWidth = bounds.width * scale;
    const contentHeight = bounds.height * scale;
    const offsetX = (CANVAS_MINI_MAP_WIDTH - contentWidth) / 2;
    const offsetY = (CANVAS_MINI_MAP_HEIGHT - contentHeight) / 2;
    const toMapX = (x: number) => offsetX + (x - bounds.x) * scale;
    const toMapY = (y: number) => offsetY + (y - bounds.y) * scale;
    const byId = new Map(miniatureNodes.map((node) => [node.id, node]));
    const layoutNodes = miniatureNodes.map((node) => ({
      ...node,
      mapX: toMapX(node.x),
      mapY: toMapY(node.y),
      mapWidth: Math.max(3, node.width * scale),
      mapHeight: Math.max(3, node.height * scale),
    }));
    const contentCenter = layoutNodes.length
      ? {
          x: (Math.min(...layoutNodes.map((node) => node.mapX)) + Math.max(...layoutNodes.map((node) => node.mapX + node.mapWidth))) / 2,
          y: (Math.min(...layoutNodes.map((node) => node.mapY)) + Math.max(...layoutNodes.map((node) => node.mapY + node.mapHeight))) / 2,
        }
      : { x: CANVAS_MINI_MAP_WIDTH / 2, y: CANVAS_MINI_MAP_HEIGHT / 2 };
    const layoutEdges = edges.flatMap((edge): CanvasMiniatureEdge[] => {
      const source = byId.get(edge.source);
      const target = byId.get(edge.target);
      if (!source || !target) return [];
      return [{
        id: edge.id,
        sourceX: toMapX(source.x + source.width),
        sourceY: toMapY(source.y + source.height / 2),
        targetX: toMapX(target.x),
        targetY: toMapY(target.y + target.height / 2),
      }];
    });
    const viewportBounds = flowWidth > 0 && flowHeight > 0
      ? {
          x: -transform[0] / zoom,
          y: -transform[1] / zoom,
          width: flowWidth / zoom,
          height: flowHeight / zoom,
        }
      : null;
    const viewportRect: CanvasMiniatureViewport | null = viewportBounds
      ? {
          x: clampMiniatureViewport(toMapX(viewportBounds.x), 0, CANVAS_MINI_MAP_WIDTH),
          y: clampMiniatureViewport(toMapY(viewportBounds.y), 0, CANVAS_MINI_MAP_HEIGHT),
          width: Math.max(4, Math.min(CANVAS_MINI_MAP_WIDTH, viewportBounds.width * scale)),
          height: Math.max(4, Math.min(CANVAS_MINI_MAP_HEIGHT, viewportBounds.height * scale)),
      }
      : null;

    return {
      bounds,
      contentCenter,
      mapEdges: layoutEdges,
      mapNodes: layoutNodes,
      offsetX,
      offsetY,
      scale,
      viewport: viewportRect,
    };
  }, [edges, flowHeight, flowWidth, nodes, transform, zoom]);

  const panToMiniaturePoint = useCallback(
    (svg: SVGSVGElement, clientX: number, clientY: number, dragOffset: Pick<CanvasMiniatureDragState, 'offsetX' | 'offsetY'>) => {
      if (!layout.viewport || !layout.scale) return;
      const pointer = mapPointFromMiniaturePointer(svg, clientX, clientY);
      const maxViewportX = Math.max(0, CANVAS_MINI_MAP_WIDTH - layout.viewport.width);
      const maxViewportY = Math.max(0, CANVAS_MINI_MAP_HEIGHT - layout.viewport.height);
      const nextViewportX = clampMiniatureViewport(pointer.x - dragOffset.offsetX, 0, maxViewportX);
      const nextViewportY = clampMiniatureViewport(pointer.y - dragOffset.offsetY, 0, maxViewportY);
      const nextFlowX = layout.bounds.x + (nextViewportX - layout.offsetX) / layout.scale;
      const nextFlowY = layout.bounds.y + (nextViewportY - layout.offsetY) / layout.scale;
      void reactFlow.setViewport({ x: -nextFlowX * zoom, y: -nextFlowY * zoom, zoom }, { duration: 0 });
    },
    [layout, reactFlow, zoom]
  );

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      if (!layout.viewport) return;
      event.preventDefault();
      event.stopPropagation();
      const pointer = mapPointFromMiniaturePointer(event.currentTarget, event.clientX, event.clientY);
      const isViewportDrag = event.target instanceof Element && Boolean(event.target.closest('[data-canvas-mini-viewport="true"]'));
      const dragOffset = isViewportDrag
        ? {
            offsetX: pointer.x - layout.viewport.x,
            offsetY: pointer.y - layout.viewport.y,
          }
        : {
            offsetX: layout.viewport.width / 2,
            offsetY: layout.viewport.height / 2,
          };
      dragStateRef.current = {
        pointerId: event.pointerId,
        ...dragOffset,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      panToMiniaturePoint(event.currentTarget, event.clientX, event.clientY, dragOffset);
    },
    [layout.viewport, panToMiniaturePoint]
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      const dragState = dragStateRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) return;
      event.preventDefault();
      event.stopPropagation();
      panToMiniaturePoint(event.currentTarget, event.clientX, event.clientY, dragState);
    },
    [panToMiniaturePoint]
  );

  const handlePointerEnd = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    if (dragStateRef.current?.pointerId !== event.pointerId) return;
    dragStateRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  return (
    <svg
      className={styles.canvasMiniMap}
      role="application"
      aria-label="Canvas map. Drag the visible area to pan the canvas."
      data-canvas-miniature-map="true"
      data-content-center-x={layout.contentCenter.x.toFixed(2)}
      data-content-center-y={layout.contentCenter.y.toFixed(2)}
      data-edge-count={layout.mapEdges.length}
      data-node-count={layout.mapNodes.length}
      data-viewport-x={layout.viewport ? layout.viewport.x.toFixed(2) : undefined}
      data-viewport-y={layout.viewport ? layout.viewport.y.toFixed(2) : undefined}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onLostPointerCapture={handlePointerEnd}
      viewBox={`0 0 ${CANVAS_MINI_MAP_WIDTH} ${CANVAS_MINI_MAP_HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
    >
      <rect className={styles.canvasMiniMapBackdrop} x="0" y="0" width={CANVAS_MINI_MAP_WIDTH} height={CANVAS_MINI_MAP_HEIGHT} rx="8" />
      <g data-canvas-mini-content="true">
        {layout.mapEdges.map((edge) => (
          <line
            key={edge.id}
            className={styles.canvasMiniMapEdge}
            data-canvas-mini-edge={edge.id}
            x1={edge.sourceX}
            y1={edge.sourceY}
            x2={edge.targetX}
            y2={edge.targetY}
          />
        ))}
        {layout.mapNodes.map((node) => (
          <WorkspaceCanvasMiniatureNode key={node.id} node={node} />
        ))}
      </g>
      {layout.viewport ? (
        <rect
          className={styles.canvasMiniMapViewport}
          data-canvas-mini-viewport="true"
          x={layout.viewport.x}
          y={layout.viewport.y}
          width={layout.viewport.width}
          height={layout.viewport.height}
          rx="3"
        />
      ) : null}
    </svg>
  );
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

function WorkspaceCanvasNavigator({
  edges,
  nodes,
}: {
  edges: WorkspaceGraphEdge[];
  nodes: WorkspaceGraphNode[];
}) {
  const reactFlow = useReactFlow<WorkspaceGraphNode, WorkspaceGraphEdge>();

  const handleZoomOut = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      void reactFlow.zoomOut({ duration: 160 });
    },
    [reactFlow]
  );

  const handleFitView = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      void reactFlow.fitView({ duration: 180, padding: 0.18, includeHiddenNodes: false });
    },
    [reactFlow]
  );

  const handleZoomIn = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      void reactFlow.zoomIn({ duration: 160 });
    },
    [reactFlow]
  );

  return (
    <div
      className={`${styles.canvasNavigator} nodrag nopan`}
      data-canvas-navigator="true"
      aria-label="Canvas navigation"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div className={styles.canvasNavigatorHeader}>
        <span>Canvas map</span>
      </div>
      <WorkspaceCanvasMiniatureMap edges={edges} nodes={nodes} />
      <div className={styles.canvasNavigatorControls} role="group" aria-label="Canvas zoom controls">
        <button type="button" onClick={handleZoomOut} aria-label="Zoom out canvas" title="Zoom out canvas">
          <Minus size={13} strokeWidth={2.4} />
        </button>
        <button type="button" onClick={handleFitView} aria-label="Fit canvas" title="Fit canvas">
          <Maximize2 size={13} strokeWidth={2.2} />
        </button>
        <button type="button" onClick={handleZoomIn} aria-label="Zoom in canvas" title="Zoom in canvas">
          <Plus size={13} strokeWidth={2.4} />
        </button>
      </div>
    </div>
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
  onCanvasFileDrop,
  onCanvasTextPaste,
  onCanvasInteraction,
  onSelectedNodeChange,
  onSelectedNodeSync,
}: WorkspaceCanvasProps) {
  const reactFlow = useReactFlow<WorkspaceGraphNode, WorkspaceGraphEdge>();
  const canvasShellRef = useRef<HTMLElement | null>(null);
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

  const canvasCenterFlowPosition = useCallback(() => {
    const rect = canvasShellRef.current?.getBoundingClientRect();
    if (!rect) return reactFlow.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    return reactFlow.screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
  }, [reactFlow]);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      if (isEditablePasteTarget(event.target)) return;
      const target = event.target instanceof Element ? event.target : null;
      const activeElement = document.activeElement;
      const isNeutralDocumentPaste =
        !target ||
        target === document.body ||
        target === document.documentElement ||
        activeElement === document.body ||
        activeElement === document.documentElement;
      if (target && !canvasShellRef.current?.contains(target) && !isNeutralDocumentPaste) return;
      const clipboardData = event.clipboardData;
      if (!clipboardData) return;
      const files = Array.from(clipboardData.files);
      const text = clipboardData.getData('text/plain').trim();
      if (!files.length && !text) return;

      event.preventDefault();
      onCanvasInteraction();
      const requestBase = {
        position: canvasCenterFlowPosition(),
        targetNodeId: targetNodeIdFromEventTarget(event.target),
      };
      if (files.length) {
        onCanvasFileDrop({
          ...requestBase,
          files,
        });
        return;
      }
      onCanvasTextPaste({
        ...requestBase,
        text,
      });
    };

    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [canvasCenterFlowPosition, onCanvasFileDrop, onCanvasInteraction, onCanvasTextPaste]);

  const isPaletteDragging = Boolean(paletteDragPreview);

  useEffect(() => {
    if (!isPaletteDragging) return;

    const clearPaletteDragPreview = () => {
      updatePaletteDragPreview(null);
    };
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
      clearPaletteDragPreview();
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
    window.addEventListener('dragend', clearPaletteDragPreview);
    window.addEventListener('drop', clearPaletteDragPreview);
    window.addEventListener('blur', clearPaletteDragPreview);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('dragend', clearPaletteDragPreview);
      window.removeEventListener('drop', clearPaletteDragPreview);
      window.removeEventListener('blur', clearPaletteDragPreview);
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
    if (
      !event.dataTransfer.files.length &&
      !dragTypes.includes('Files') &&
      !dragTypes.includes(WORKSPACE_NODE_KIND_DRAG_TYPE) &&
      !dragTypes.includes('text/plain')
    ) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback(
    (event: ReactDragEvent) => {
      updatePaletteDragPreview(null);
      const files = Array.from(event.dataTransfer.files);
      if (files.length) {
        event.preventDefault();
        onCanvasInteraction();
        onCanvasFileDrop({
          files,
          position: reactFlow.screenToFlowPosition({ x: event.clientX, y: event.clientY }),
          targetNodeId: targetNodeIdFromEventTarget(event.target),
        });
        return;
      }

      const nodeKind = event.dataTransfer.getData(WORKSPACE_NODE_KIND_DRAG_TYPE) || event.dataTransfer.getData('text/plain');
      if (!isWorkspaceNodeKind(nodeKind)) {
        const text = event.dataTransfer.getData('text/plain').trim();
        if (!text) return;
        event.preventDefault();
        onCanvasInteraction();
        onCanvasTextPaste({
          text,
          position: reactFlow.screenToFlowPosition({ x: event.clientX, y: event.clientY }),
          targetNodeId: targetNodeIdFromEventTarget(event.target),
        });
        return;
      }
      event.preventDefault();
      onCanvasInteraction();
      onCreateNodeFromPaletteDrop({
        kind: nodeKind,
        position: reactFlow.screenToFlowPosition({ x: event.clientX, y: event.clientY }),
      });
    },
    [onCanvasFileDrop, onCanvasInteraction, onCanvasTextPaste, onCreateNodeFromPaletteDrop, reactFlow, updatePaletteDragPreview]
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
        {handleDropPreview ? <WorkspaceHandleDropPreview preview={handleDropPreview} /> : null}
        {paletteDragPreview ? <WorkspacePaletteDropPreview preview={paletteDragPreview} /> : null}
        <WorkspaceCanvasNavigator edges={edges} nodes={nodes} />
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
