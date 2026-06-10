'use client';

import { useCallback, useMemo, useRef, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { Maximize2, Minus, Plus } from 'lucide-react';
import { useReactFlow, useStore, type XYPosition } from '@xyflow/react';

import styles from '../../_styles/canvas-map.module.css';
import type { WorkspaceGraphEdge, WorkspaceGraphNode, WorkspaceNodeKind } from '../../_lib/workspace-types';

const CANVAS_MINI_MAP_WIDTH = 164;
const CANVAS_MINI_MAP_HEIGHT = 82;
const CANVAS_MINI_MAP_PADDING = 7;
const CANVAS_MINI_MAP_CONTENT_PADDING = 72;

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

function CanvasMiniatureNode({ node }: { node: CanvasMiniatureLayoutNode }) {
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

function CanvasMiniatureMap({
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
          <CanvasMiniatureNode key={node.id} node={node} />
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

export function CanvasMap({
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
      <CanvasMiniatureMap edges={edges} nodes={nodes} />
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
