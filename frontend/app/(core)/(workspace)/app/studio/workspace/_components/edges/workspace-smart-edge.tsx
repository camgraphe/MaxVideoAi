'use client';

import { memo } from 'react';
import { BaseEdge, type EdgeProps, type EdgeTypes, useStore } from '@xyflow/react';
import type { WorkspaceGraphEdge } from '../../_lib/workspace-types';

type Point = { x: number; y: number };
type Rect = { id: string; left: number; right: number; top: number; bottom: number };

const NODE_CLEARANCE = 28;
const HANDLE_CLEARANCE = 44;
const EDGE_CORNER_RADIUS = 18;
const DEFAULT_EDGE_WIDTH = 2.35;
const SELECTED_EDGE_WIDTH = 3.4;
const SELECTED_EDGE_FILTER = 'drop-shadow(0 0 10px rgba(99, 102, 241, 0.42))';

function nodeRect(node: unknown): Rect | null {
  const candidate = node as {
    id?: string;
    hidden?: boolean;
    measured?: { width?: number; height?: number };
    width?: number;
    height?: number;
    initialWidth?: number;
    initialHeight?: number;
    internals?: { positionAbsolute?: Point };
    position?: Point;
  };
  const width = candidate.measured?.width ?? candidate.width ?? candidate.initialWidth ?? 0;
  const height = candidate.measured?.height ?? candidate.height ?? candidate.initialHeight ?? 0;
  const position = candidate.internals?.positionAbsolute ?? candidate.position;
  if (!candidate.id || candidate.hidden || !position || !width || !height) return null;
  return {
    id: candidate.id,
    left: position.x - NODE_CLEARANCE,
    right: position.x + width + NODE_CLEARANCE,
    top: position.y - NODE_CLEARANCE,
    bottom: position.y + height + NODE_CLEARANCE,
  };
}

export function segmentIntersectsRect(start: Point, end: Point, rect: Rect): boolean {
  if (start.x === end.x) {
    return start.x >= rect.left && start.x <= rect.right && Math.max(start.y, end.y) >= rect.top && Math.min(start.y, end.y) <= rect.bottom;
  }
  if (start.y === end.y) {
    return start.y >= rect.top && start.y <= rect.bottom && Math.max(start.x, end.x) >= rect.left && Math.min(start.x, end.x) <= rect.right;
  }
  return false;
}

function rectsEqual(previous: Rect[], next: Rect[]): boolean {
  if (previous.length !== next.length) return false;
  return previous.every((rect, index) => {
    const candidate = next[index];
    return (
      rect.id === candidate.id &&
      rect.left === candidate.left &&
      rect.right === candidate.right &&
      rect.top === candidate.top &&
      rect.bottom === candidate.bottom
    );
  });
}

function pathIntersections(points: Point[], rects: Rect[]): number {
  let count = 0;
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    count += rects.filter((rect) => segmentIntersectsRect(start, end, rect)).length;
  }
  return count;
}

function candidatePoints(source: Point, target: Point, laneY: number): Point[] {
  const xOut = source.x + HANDLE_CLEARANCE;
  const xIn = target.x - HANDLE_CLEARANCE;
  if (xOut < xIn) {
    return [source, { x: xOut, y: source.y }, { x: xOut, y: laneY }, { x: xIn, y: laneY }, { x: xIn, y: target.y }, target];
  }
  const outsideX = Math.max(source.x, target.x) + HANDLE_CLEARANCE * 1.6;
  return [source, { x: outsideX, y: source.y }, { x: outsideX, y: laneY }, { x: target.x - HANDLE_CLEARANCE, y: laneY }, { x: target.x - HANDLE_CLEARANCE, y: target.y }, target];
}

function routeScore(points: Point[], rects: Rect[], preferredY: number): number {
  const intersections = pathIntersections(points, rects);
  const laneY = points[Math.floor(points.length / 2)]?.y ?? preferredY;
  return intersections * 10000 + Math.abs(laneY - preferredY);
}

export function routeAvoidingNodes(params: {
  source: Point;
  target: Point;
  rects: Rect[];
}): Point[] {
  const preferredY = (params.source.y + params.target.y) / 2;
  const minY = Math.min(params.source.y, params.target.y);
  const maxY = Math.max(params.source.y, params.target.y);
  const relevantRects = params.rects.filter((rect) => rect.right >= Math.min(params.source.x, params.target.x) && rect.left <= Math.max(params.source.x, params.target.x));
  const laneCandidates = [
    preferredY,
    params.source.y,
    params.target.y,
    ...relevantRects.flatMap((rect) => [rect.top - NODE_CLEARANCE, rect.bottom + NODE_CLEARANCE]),
    minY - NODE_CLEARANCE * 2,
    maxY + NODE_CLEARANCE * 2,
  ].filter((laneY, index, lanes) => Number.isFinite(laneY) && lanes.findIndex((candidate) => Math.abs(candidate - laneY) < 1) === index);

  return laneCandidates
    .map((laneY) => candidatePoints(params.source, params.target, laneY))
    .sort((a, b) => routeScore(a, params.rects, preferredY) - routeScore(b, params.rects, preferredY))[0];
}

function pointDistance(start: Point, end: Point): number {
  return Math.abs(start.x - end.x) + Math.abs(start.y - end.y);
}

function pointToward(from: Point, to: Point, distance: number): Point {
  if (from.x === to.x) {
    return { x: from.x, y: from.y + Math.sign(to.y - from.y) * distance };
  }
  if (from.y === to.y) {
    return { x: from.x + Math.sign(to.x - from.x) * distance, y: from.y };
  }
  return from;
}

function roundedPolylinePath(points: Point[]): string {
  if (points.length < 2) return '';
  const lastPoint = points[points.length - 1];
  const commands = [`M ${points[0].x} ${points[0].y}`];
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const next = points[index + 1];
    const previousLength = pointDistance(previous, current);
    const nextLength = pointDistance(current, next);
    const radius = Math.min(EDGE_CORNER_RADIUS, previousLength / 2, nextLength / 2);
    if (
      !radius ||
      (previous.x !== current.x && previous.y !== current.y) ||
      (current.x !== next.x && current.y !== next.y)
    ) {
      commands.push(`L ${current.x} ${current.y}`);
      continue;
    }
    const cornerStart = pointToward(current, previous, radius);
    const cornerEnd = pointToward(current, next, radius);
    commands.push(`L ${cornerStart.x} ${cornerStart.y}`, `Q ${current.x} ${current.y} ${cornerEnd.x} ${cornerEnd.y}`);
  }
  commands.push(`L ${lastPoint.x} ${lastPoint.y}`);
  return commands.join(' ');
}

function pathLabelPosition(points: Point[]): Point {
  const lengths = points.slice(1).map((point, index) => Math.abs(point.x - points[index].x) + Math.abs(point.y - points[index].y));
  const halfLength = lengths.reduce((total, length) => total + length, 0) / 2;
  let walked = 0;
  for (let index = 1; index < points.length; index += 1) {
    const segmentLength = lengths[index - 1];
    if (walked + segmentLength >= halfLength) {
      const start = points[index - 1];
      const end = points[index];
      const ratio = segmentLength ? (halfLength - walked) / segmentLength : 0;
      return {
        x: start.x + (end.x - start.x) * ratio,
        y: start.y + (end.y - start.y) * ratio,
      };
    }
    walked += segmentLength;
  }
  return points[Math.floor(points.length / 2)] ?? points[0];
}

function edgeStyle(
  style: EdgeProps<WorkspaceGraphEdge>['style'],
  selected: boolean
): EdgeProps<WorkspaceGraphEdge>['style'] {
  const strokeWidth = typeof style?.strokeWidth === 'number'
    ? Math.max(style.strokeWidth, DEFAULT_EDGE_WIDTH)
    : DEFAULT_EDGE_WIDTH;
  return {
    ...style,
    stroke: style?.stroke ?? '#a78bfa',
    strokeWidth: selected ? SELECTED_EDGE_WIDTH : strokeWidth,
    opacity: selected ? 1 : style?.opacity ?? 0.9,
    filter: selected ? SELECTED_EDGE_FILTER : style?.filter,
  };
}

function selectedEdgeStyle(style: EdgeProps<WorkspaceGraphEdge>['style']): EdgeProps<WorkspaceGraphEdge>['style'] {
  return edgeStyle(style, true);
}

export function WorkspaceSmartEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  label,
  labelStyle,
  labelShowBg,
  labelBgStyle,
  labelBgPadding,
  labelBgBorderRadius,
  markerEnd,
  markerStart,
  style,
  interactionWidth,
  selected,
}: EdgeProps<WorkspaceGraphEdge>) {
  const rects = useStore(
    (state) =>
      Array.from(state.nodeLookup.values())
        .filter((node) => node.id !== source && node.id !== target)
        .map(nodeRect)
        .filter((rect): rect is Rect => Boolean(rect)),
    rectsEqual
  );
  const points = routeAvoidingNodes({
    source: { x: sourceX, y: sourceY },
    target: { x: targetX, y: targetY },
    rects,
  });
  const labelPosition = pathLabelPosition(points);
  return (
    <BaseEdge
      id={id}
      path={roundedPolylinePath(points)}
      label={label}
      labelX={labelPosition.x}
      labelY={labelPosition.y}
      labelStyle={labelStyle}
      labelShowBg={labelShowBg}
      labelBgStyle={labelBgStyle}
      labelBgPadding={labelBgPadding}
      labelBgBorderRadius={labelBgBorderRadius}
      markerEnd={markerEnd}
      markerStart={markerStart}
      style={selected ? selectedEdgeStyle(style) : edgeStyle(style, false)}
      interactionWidth={selected ? Math.max(interactionWidth ?? 16, 22) : interactionWidth}
    />
  );
}

export const workspaceEdgeTypes: EdgeTypes = {
  'workspace-smart': memo(WorkspaceSmartEdge),
};
