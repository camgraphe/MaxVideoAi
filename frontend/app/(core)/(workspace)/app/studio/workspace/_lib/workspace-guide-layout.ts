import type { WorkspaceGuidePlacement } from './workspace-types';

export const WORKSPACE_GUIDE_DESKTOP_GAP = 28;
export const WORKSPACE_GUIDE_COMPACT_GAP = 20;
export const WORKSPACE_GUIDE_COMPACT_ZOOM = 0.65;
export const WORKSPACE_GUIDE_LEADER_END_GAP = 8;

const WORKSPACE_GUIDE_PREVIOUS_SIDE_TOLERANCE = 4;
const WORKSPACE_GUIDE_SCREEN_EPSILON = 0.000001;
const WORKSPACE_GUIDE_MAX_COORDINATE = Number.MAX_SAFE_INTEGER;
const WORKSPACE_GUIDE_FALLBACK_SIDES: WorkspaceGuidePlacement[] = ['top', 'right', 'bottom', 'left'];

export type WorkspaceGuideRect = { x: number; y: number; width: number; height: number };
export type WorkspaceGuideSize = { width: number; height: number };
export type WorkspaceGuidePoint = { x: number; y: number };
export type WorkspaceGuideSegment = { start: WorkspaceGuidePoint; end: WorkspaceGuidePoint };

export function expandWorkspaceGuideRect(rectInput: WorkspaceGuideRect, gapInput: number): WorkspaceGuideRect {
  const rect = normalizeRect(rectInput);
  const gap = normalizeDimension(gapInput);
  return {
    x: safeSubtract(rect.x, gap),
    y: safeSubtract(rect.y, gap),
    width: safeNonNegativeAdd(rect.width, gap * 2),
    height: safeNonNegativeAdd(rect.height, gap * 2),
  };
}

export type WorkspaceGuidePlacementInput = {
  anchorRect: WorkspaceGuideRect;
  calloutSize: WorkspaceGuideSize;
  preferredPlacement: WorkspaceGuidePlacement;
  viewportRect: WorkspaceGuideRect;
  protectedRects: WorkspaceGuideRect[];
  functionalEdges: WorkspaceGuideSegment[];
  gap: number;
  previousPlacement: WorkspaceGuidePlacement | null;
  manualPosition?: WorkspaceGuidePoint;
};

export type WorkspaceGuidePlacementResult = {
  rect: WorkspaceGuideRect;
  side: WorkspaceGuidePlacement;
  leader: WorkspaceGuideSegment;
  collapsed: boolean;
};

export type WorkspaceGuideCandidateScore = {
  side: WorkspaceGuidePlacement;
  crossings: number;
  distance: number;
  order: number;
};

type WorkspaceGuidePlacementCandidate = WorkspaceGuideCandidateScore & {
  rect: WorkspaceGuideRect;
  leader: WorkspaceGuideSegment;
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function normalizeCoordinate(value: number): number {
  return Number.isFinite(value)
    ? clamp(value, -WORKSPACE_GUIDE_MAX_COORDINATE, WORKSPACE_GUIDE_MAX_COORDINATE)
    : 0;
}

function normalizeDimension(value: number): number {
  return Number.isFinite(value)
    ? clamp(value, 0, WORKSPACE_GUIDE_MAX_COORDINATE)
    : 0;
}

function safeCoordinate(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value === Number.POSITIVE_INFINITY) return WORKSPACE_GUIDE_MAX_COORDINATE;
  if (value === Number.NEGATIVE_INFINITY) return -WORKSPACE_GUIDE_MAX_COORDINATE;
  return normalizeCoordinate(value);
}

function safeAdd(left: number, rightValue: number): number {
  return safeCoordinate(left + rightValue);
}

function safeSubtract(left: number, rightValue: number): number {
  return safeCoordinate(left - rightValue);
}

function safeNonNegativeAdd(left: number, rightValue: number): number {
  return normalizeDimension(left + rightValue);
}

function normalizePoint(point: WorkspaceGuidePoint): WorkspaceGuidePoint {
  return {
    x: normalizeCoordinate(point.x),
    y: normalizeCoordinate(point.y),
  };
}

function normalizeSize(size: WorkspaceGuideSize): WorkspaceGuideSize {
  return {
    width: normalizeDimension(size.width),
    height: normalizeDimension(size.height),
  };
}

function normalizeRect(rect: WorkspaceGuideRect): WorkspaceGuideRect {
  return {
    ...normalizePoint(rect),
    ...normalizeSize(rect),
  };
}

function normalizeSegment(segment: WorkspaceGuideSegment): WorkspaceGuideSegment {
  return {
    start: normalizePoint(segment.start),
    end: normalizePoint(segment.end),
  };
}

function normalizePlacement(side: WorkspaceGuidePlacement): WorkspaceGuidePlacement {
  return WORKSPACE_GUIDE_FALLBACK_SIDES.includes(side) ? side : 'top';
}

function normalizePlacementInput(input: WorkspaceGuidePlacementInput): WorkspaceGuidePlacementInput {
  return {
    anchorRect: normalizeRect(input.anchorRect),
    calloutSize: normalizeSize(input.calloutSize),
    preferredPlacement: normalizePlacement(input.preferredPlacement),
    viewportRect: normalizeRect(input.viewportRect),
    protectedRects: input.protectedRects.map(normalizeRect),
    functionalEdges: input.functionalEdges.map(normalizeSegment),
    gap: normalizeDimension(input.gap),
    previousPlacement: input.previousPlacement ? normalizePlacement(input.previousPlacement) : null,
    ...(input.manualPosition ? { manualPosition: normalizePoint(input.manualPosition) } : {}),
  };
}

function right(rect: WorkspaceGuideRect): number {
  return safeAdd(rect.x, rect.width);
}

function bottom(rect: WorkspaceGuideRect): number {
  return safeAdd(rect.y, rect.height);
}

function center(rect: WorkspaceGuideRect): WorkspaceGuidePoint {
  return {
    x: safeAdd(rect.x, rect.width / 2),
    y: safeAdd(rect.y, rect.height / 2),
  };
}

function midpoint(minimum: number, maximum: number): number {
  return safeAdd(minimum, (maximum - minimum) / 2);
}

function overlapMidpoint(
  firstMinimum: number,
  firstMaximum: number,
  secondMinimum: number,
  secondMaximum: number,
): number {
  return midpoint(Math.max(firstMinimum, secondMinimum), Math.min(firstMaximum, secondMaximum));
}

function closestAxisPoints(
  firstMinimum: number,
  firstMaximum: number,
  secondMinimum: number,
  secondMaximum: number,
): { first: number; second: number; separated: boolean } {
  if (firstMaximum < secondMinimum) {
    return { first: firstMaximum, second: secondMinimum, separated: true };
  }
  if (firstMinimum > secondMaximum) {
    return { first: firstMinimum, second: secondMaximum, separated: true };
  }
  const overlap = overlapMidpoint(firstMinimum, firstMaximum, secondMinimum, secondMaximum);
  return { first: overlap, second: overlap, separated: false };
}

function overlappingLeaderPoints(
  rect: WorkspaceGuideRect,
  anchorRect: WorkspaceGuideRect,
): { start: WorkspaceGuidePoint; target: WorkspaceGuidePoint } {
  const overlapX = overlapMidpoint(rect.x, right(rect), anchorRect.x, right(anchorRect));
  const overlapY = overlapMidpoint(rect.y, bottom(rect), anchorRect.y, bottom(anchorRect));
  const candidates = [
    {
      start: { x: overlapX, y: rect.y },
      target: { x: overlapX, y: bottom(anchorRect) },
      order: 0,
    },
    {
      start: { x: right(rect), y: overlapY },
      target: { x: anchorRect.x, y: overlapY },
      order: 1,
    },
    {
      start: { x: overlapX, y: bottom(rect) },
      target: { x: overlapX, y: anchorRect.y },
      order: 2,
    },
    {
      start: { x: rect.x, y: overlapY },
      target: { x: right(anchorRect), y: overlapY },
      order: 3,
    },
  ];
  return candidates.sort((left, rightCandidate) => (
    Math.hypot(left.start.x - left.target.x, left.start.y - left.target.y) -
      Math.hypot(rightCandidate.start.x - rightCandidate.target.x, rightCandidate.start.y - rightCandidate.target.y) ||
    left.order - rightCandidate.order
  ))[0]!;
}

function leaderForRect(rect: WorkspaceGuideRect, anchorRect: WorkspaceGuideRect): WorkspaceGuideSegment {
  const xPoints = closestAxisPoints(rect.x, right(rect), anchorRect.x, right(anchorRect));
  const yPoints = closestAxisPoints(rect.y, bottom(rect), anchorRect.y, bottom(anchorRect));
  const points = xPoints.separated || yPoints.separated
    ? {
      start: { x: xPoints.first, y: yPoints.first },
      target: { x: xPoints.second, y: yPoints.second },
    }
    : overlappingLeaderPoints(rect, anchorRect);
  const distance = Math.hypot(points.start.x - points.target.x, points.start.y - points.target.y);
  const endGap = Math.min(WORKSPACE_GUIDE_LEADER_END_GAP, distance);
  const end = distance > 0
    ? {
      x: safeAdd(points.target.x, ((points.start.x - points.target.x) / distance) * endGap),
      y: safeAdd(points.target.y, ((points.start.y - points.target.y) / distance) * endGap),
    }
    : points.target;

  return { start: points.start, end };
}

export function workspaceGuideLeaderForRect(
  rectInput: WorkspaceGuideRect,
  anchorRectInput: WorkspaceGuideRect,
): WorkspaceGuideSegment {
  return leaderForRect(normalizeRect(rectInput), normalizeRect(anchorRectInput));
}

function placementRect(
  anchorRect: WorkspaceGuideRect,
  calloutSize: WorkspaceGuideSize,
  side: WorkspaceGuidePlacement,
  gap: number,
): WorkspaceGuideRect {
  const anchorCenter = center(anchorRect);
  if (side === 'top') {
    return {
      x: safeSubtract(anchorCenter.x, calloutSize.width / 2),
      y: safeSubtract(safeSubtract(anchorRect.y, gap), calloutSize.height),
      ...calloutSize,
    };
  }
  if (side === 'right') {
    return {
      x: safeAdd(right(anchorRect), gap),
      y: safeSubtract(anchorCenter.y, calloutSize.height / 2),
      ...calloutSize,
    };
  }
  if (side === 'bottom') {
    return {
      x: safeSubtract(anchorCenter.x, calloutSize.width / 2),
      y: safeAdd(bottom(anchorRect), gap),
      ...calloutSize,
    };
  }
  return {
    x: safeSubtract(safeSubtract(anchorRect.x, gap), calloutSize.width),
    y: safeSubtract(anchorCenter.y, calloutSize.height / 2),
    ...calloutSize,
  };
}

function placementOrder(preferredPlacement: WorkspaceGuidePlacement): WorkspaceGuidePlacement[] {
  return [preferredPlacement, ...WORKSPACE_GUIDE_FALLBACK_SIDES.filter((side) => side !== preferredPlacement)];
}

function rectangleIsInViewport(rect: WorkspaceGuideRect, viewportRect: WorkspaceGuideRect): boolean {
  return (
    rect.x >= viewportRect.x &&
    rect.y >= viewportRect.y &&
    right(rect) <= right(viewportRect) &&
    bottom(rect) <= bottom(viewportRect)
  );
}

function rectangleViewportOverflow(rect: WorkspaceGuideRect, viewportRect: WorkspaceGuideRect): number {
  return [
    Math.max(viewportRect.x - rect.x, 0),
    Math.max(viewportRect.y - rect.y, 0),
    Math.max(right(rect) - right(viewportRect), 0),
    Math.max(bottom(rect) - bottom(viewportRect), 0),
  ].reduce(safeNonNegativeAdd, 0);
}

function clampRectToViewport(rect: WorkspaceGuideRect, viewportRect: WorkspaceGuideRect): WorkspaceGuideRect {
  return {
    ...rect,
    x: clamp(rect.x, viewportRect.x, Math.max(viewportRect.x, safeSubtract(right(viewportRect), rect.width))),
    y: clamp(rect.y, viewportRect.y, Math.max(viewportRect.y, safeSubtract(bottom(viewportRect), rect.height))),
  };
}

function orientation(
  start: WorkspaceGuidePoint,
  end: WorkspaceGuidePoint,
  point: WorkspaceGuidePoint,
): -1 | 0 | 1 {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const cross = deltaX * (point.y - start.y) - deltaY * (point.x - start.x);
  const tolerance = WORKSPACE_GUIDE_SCREEN_EPSILON * Math.max(1, Math.hypot(deltaX, deltaY));
  if (Math.abs(cross) <= tolerance) return 0;
  return cross < 0 ? -1 : 1;
}

function pointIsOnSegment(point: WorkspaceGuidePoint, segment: WorkspaceGuideSegment): boolean {
  if (orientation(segment.start, segment.end, point) !== 0) return false;
  return (
    point.x >= Math.min(segment.start.x, segment.end.x) - WORKSPACE_GUIDE_SCREEN_EPSILON &&
    point.x <= Math.max(segment.start.x, segment.end.x) + WORKSPACE_GUIDE_SCREEN_EPSILON &&
    point.y >= Math.min(segment.start.y, segment.end.y) - WORKSPACE_GUIDE_SCREEN_EPSILON &&
    point.y <= Math.max(segment.start.y, segment.end.y) + WORKSPACE_GUIDE_SCREEN_EPSILON
  );
}

export function workspaceGuideSegmentsIntersect(
  firstInput: WorkspaceGuideSegment,
  secondInput: WorkspaceGuideSegment,
): boolean {
  const first = normalizeSegment(firstInput);
  const second = normalizeSegment(secondInput);
  const firstStart = orientation(first.start, first.end, second.start);
  const firstEnd = orientation(first.start, first.end, second.end);
  const secondStart = orientation(second.start, second.end, first.start);
  const secondEnd = orientation(second.start, second.end, first.end);

  if (firstStart === 0 && pointIsOnSegment(second.start, first)) return true;
  if (firstEnd === 0 && pointIsOnSegment(second.end, first)) return true;
  if (secondStart === 0 && pointIsOnSegment(first.start, second)) return true;
  if (secondEnd === 0 && pointIsOnSegment(first.end, second)) return true;
  return firstStart !== firstEnd && secondStart !== secondEnd;
}

function candidateFor(
  input: WorkspaceGuidePlacementInput,
  side: WorkspaceGuidePlacement,
  order: number,
): WorkspaceGuidePlacementCandidate {
  const rect = placementRect(input.anchorRect, input.calloutSize, side, input.gap);
  const leader = leaderForRect(rect, input.anchorRect);
  return {
    rect,
    side,
    leader,
    crossings: input.functionalEdges.filter((edge) => workspaceGuideSegmentsIntersect(leader, edge)).length,
    distance: Math.hypot(
      leader.start.x - leader.end.x,
      leader.start.y - leader.end.y,
    ),
    order,
  };
}

function normalizedScore(value: number): number {
  return Number.isFinite(value) && value >= 0 ? value : WORKSPACE_GUIDE_MAX_COORDINATE;
}

function compareCandidates(left: WorkspaceGuideCandidateScore, rightCandidate: WorkspaceGuideCandidateScore): number {
  return (
    normalizedScore(left.crossings) - normalizedScore(rightCandidate.crossings) ||
    normalizedScore(left.distance) - normalizedScore(rightCandidate.distance) ||
    normalizedScore(left.order) - normalizedScore(rightCandidate.order)
  );
}

export function selectWorkspaceGuideCandidate<T extends WorkspaceGuideCandidateScore>(
  candidates: readonly T[],
  previousPlacement: WorkspaceGuidePlacement | null,
): T | undefined {
  const bestCandidate = candidates.reduce<T | undefined>((best, candidate) => (
    !best || compareCandidates(candidate, best) < 0 ? candidate : best
  ), undefined);
  if (!bestCandidate || !previousPlacement) return bestCandidate;

  const previousCandidate = candidates.find((candidate) => candidate.side === previousPlacement);
  if (
    previousCandidate &&
    normalizedScore(previousCandidate.crossings) === normalizedScore(bestCandidate.crossings) &&
    normalizedScore(previousCandidate.distance) <=
      normalizedScore(bestCandidate.distance) + WORKSPACE_GUIDE_PREVIOUS_SIDE_TOLERANCE
  ) {
    return previousCandidate;
  }
  return bestCandidate;
}

function resultForCandidate(candidate: WorkspaceGuidePlacementCandidate, collapsed: boolean): WorkspaceGuidePlacementResult {
  return {
    rect: candidate.rect,
    side: candidate.side,
    leader: candidate.leader,
    collapsed,
  };
}

function calloutFitsViewport(calloutSize: WorkspaceGuideSize, viewportRect: WorkspaceGuideRect): boolean {
  return (
    calloutSize.width > 0 &&
    calloutSize.height > 0 &&
    viewportRect.width > 0 &&
    viewportRect.height > 0 &&
    calloutSize.width <= viewportRect.width &&
    calloutSize.height <= viewportRect.height
  );
}

function collapsedResult(input: WorkspaceGuidePlacementInput): WorkspaceGuidePlacementResult {
  const fittedSize = {
    width: Math.min(input.calloutSize.width, input.viewportRect.width),
    height: Math.min(input.calloutSize.height, input.viewportRect.height),
  };
  const desiredRect = input.manualPosition
    ? { ...input.manualPosition, ...fittedSize }
    : placementRect(input.anchorRect, fittedSize, input.preferredPlacement, input.gap);
  const rect = clampRectToViewport(desiredRect, input.viewportRect);
  return {
    rect,
    side: input.preferredPlacement,
    leader: leaderForRect(rect, input.anchorRect),
    collapsed: true,
  };
}

export function rectanglesIntersect(aInput: WorkspaceGuideRect, bInput: WorkspaceGuideRect): boolean {
  const a = normalizeRect(aInput);
  const b = normalizeRect(bInput);
  return (
    a.width > 0 &&
    a.height > 0 &&
    b.width > 0 &&
    b.height > 0 &&
    a.x < right(b) &&
    right(a) > b.x &&
    a.y < bottom(b) &&
    bottom(a) > b.y
  );
}

export function compactWorkspaceGuideAtZoom(zoom: number): boolean {
  return normalizeCoordinate(zoom) < WORKSPACE_GUIDE_COMPACT_ZOOM;
}

export function resolveWorkspaceGuidePlacement(
  rawInput: WorkspaceGuidePlacementInput,
): WorkspaceGuidePlacementResult {
  const input = normalizePlacementInput(rawInput);
  if (!calloutFitsViewport(input.calloutSize, input.viewportRect)) {
    return collapsedResult(input);
  }

  if (input.manualPosition) {
    const rect = clampRectToViewport({ ...input.manualPosition, ...input.calloutSize }, input.viewportRect);
    return {
      rect,
      side: input.preferredPlacement,
      leader: leaderForRect(rect, input.anchorRect),
      collapsed: false,
    };
  }

  const candidates = placementOrder(input.preferredPlacement).map((side, order) => candidateFor(input, side, order));
  const safeCandidates = candidates.filter((candidate) => (
    rectangleIsInViewport(candidate.rect, input.viewportRect) &&
    !input.protectedRects.some((protectedRect) => rectanglesIntersect(candidate.rect, protectedRect))
  ));

  const selectedCandidate = selectWorkspaceGuideCandidate(safeCandidates, input.previousPlacement);
  if (selectedCandidate) return resultForCandidate(selectedCandidate, false);

  const fallbackCandidate = [...candidates].sort((left, rightCandidate) => (
    input.protectedRects.filter((protectedRect) => rectanglesIntersect(left.rect, protectedRect)).length -
      input.protectedRects.filter((protectedRect) => rectanglesIntersect(rightCandidate.rect, protectedRect)).length ||
    rectangleViewportOverflow(left.rect, input.viewportRect) - rectangleViewportOverflow(rightCandidate.rect, input.viewportRect) ||
    compareCandidates(left, rightCandidate)
  ))[0]!;
  const rect = clampRectToViewport(fallbackCandidate.rect, input.viewportRect);
  return {
    rect,
    side: fallbackCandidate.side,
    leader: leaderForRect(rect, input.anchorRect),
    collapsed: true,
  };
}

export function expandWorkspaceGuideFitBounds(
  nodeBoundsInput: WorkspaceGuideRect,
  calloutSizeInput: WorkspaceGuideSize,
  gapInput = WORKSPACE_GUIDE_DESKTOP_GAP,
): WorkspaceGuideRect {
  const nodeBounds = normalizeRect(nodeBoundsInput);
  const calloutSize = normalizeSize(calloutSizeInput);
  const gap = normalizeDimension(gapInput);
  const horizontalPadding = safeNonNegativeAdd(calloutSize.width, gap);
  const verticalPadding = safeNonNegativeAdd(calloutSize.height, gap);
  return {
    x: safeSubtract(nodeBounds.x, horizontalPadding),
    y: safeSubtract(nodeBounds.y, verticalPadding),
    width: safeNonNegativeAdd(nodeBounds.width, safeNonNegativeAdd(horizontalPadding, horizontalPadding)),
    height: safeNonNegativeAdd(nodeBounds.height, safeNonNegativeAdd(verticalPadding, verticalPadding)),
  };
}
