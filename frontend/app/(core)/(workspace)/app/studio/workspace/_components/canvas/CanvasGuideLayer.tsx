'use client';

import {
  getNodesBounds,
  getViewportForBounds,
  useOnViewportChange,
  useReactFlow,
} from '@xyflow/react';
import { ListOrdered } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';
import type { StudioCopy } from '../../../_lib/studio-copy';
import { findGuideGeneratedOutputNodeForShot } from '../../_lib/workspace-graph-helpers';
import {
  compactWorkspaceGuideAtZoom,
  expandWorkspaceGuideRect,
  expandWorkspaceGuideFitBounds,
  rectanglesIntersect,
  resolveWorkspaceGuidePlacement,
  workspaceGuideLeaderForRect,
  WORKSPACE_GUIDE_COMPACT_GAP,
  WORKSPACE_GUIDE_DESKTOP_GAP,
  type WorkspaceGuidePlacementResult,
  type WorkspaceGuidePoint,
  type WorkspaceGuideRect,
  type WorkspaceGuideSegment,
  type WorkspaceGuideSize,
} from '../../_lib/workspace-guide-layout';
import {
  createWorkspaceCanvasGuideState,
  reconcileWorkspaceCanvasGuideState,
} from '../../_lib/workspace-guide-state';
import { createStarterWorkspaceTemplate } from '../../_lib/workspace-templates';
import type {
  WorkspaceGraphEdge,
  WorkspaceGraphNode,
  WorkspaceGuideAnnotation,
  WorkspaceGuidePlacement,
} from '../../_lib/workspace-types';
import type {
  WorkspaceGuideController,
  WorkspaceGuidePresentationController,
} from '../../_hooks/useWorkspaceGuidePresentationController';
import styles from '../../_styles/canvas-guide.module.css';
import { StudioMenu } from '../ui/StudioMenu';
import {
  CanvasGuideCallout,
  highlightWorkspaceGuideTargets,
} from './CanvasGuideCallout';

const GUIDE_CALLOUT_FALLBACK_SIZE = { width: 210, height: 82 };
const GUIDE_BADGE_SIZE = { width: 28, height: 28 };
const GUIDE_DRAG_THRESHOLD = 4;
const FUNCTIONAL_EDGE_SAMPLE_INTERVAL = 16;
const TRANSIENT_TOOLBAR_PROTECTED_SELECTORS = [
  '#canvas-toolbar-image-menu',
  '#canvas-toolbar-video-menu',
  '#canvas-toolbar-audio-menu',
  '#canvas-toolbar-text-menu',
  '#canvas-toolbar-save-popover',
];
const PROTECTED_SELECTORS = [
  '.react-flow__node',
  '.react-flow__handle',
  '[data-canvas-miniature-map="true"]',
  '[data-canvas-floating-toolbar="true"]',
  '[data-canvas-navigator="true"]',
  '[data-studio-canvas-inspector="true"]',
  '[data-canvas-guide-controls="true"]',
  '[data-studio-mobile-panel-controls="true"]',
  '#canvas-navigator-popover',
  ...TRANSIENT_TOOLBAR_PROTECTED_SELECTORS,
  '#canvas-guide-menu',
];

type GuideStepCopy = StudioCopy['canvas']['guide']['steps'][WorkspaceGuideAnnotation['copyKey']];

type ResolvedCanvasAnnotation = {
  annotation: WorkspaceGuideAnnotation;
  stepCopy: GuideStepCopy;
};

type PlacedCanvasAnnotation = ResolvedCanvasAnnotation & WorkspaceGuidePlacementResult & {
  actionTraySide: 'left' | 'right';
};

type GuideDragState = {
  annotationId: string;
  pointerId: number;
  pointerStart: WorkspaceGuidePoint;
  position: WorkspaceGuidePoint;
  rectStart: WorkspaceGuideRect;
  moved: boolean;
};

export type CanvasGuideInitialFitController = {
  isCompleted: () => boolean;
  markCompleted: () => void;
};

type CanvasGuideLayerProps = {
  canvasShellRef: RefObject<HTMLElement | null>;
  copy: StudioCopy['canvas']['guide'];
  edges: WorkspaceGraphEdge[];
  guide: WorkspaceGuideController;
  initialFit: CanvasGuideInitialFitController;
  layoutSignal: string;
  nodes: WorkspaceGraphNode[];
  onDraggingChange: (dragging: boolean) => void;
  presentation: WorkspaceGuidePresentationController;
};

function rectFromDomRect(rect: DOMRect): WorkspaceGuideRect {
  return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
}

function isVisibleProtectedElement(element: Element): element is HTMLElement | SVGElement {
  const rect = element.getBoundingClientRect();
  if (!rect.width || !rect.height || element.getAttribute('aria-hidden') === 'true') return false;
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

function protectedRectsForCanvas(canvasShell: HTMLElement): WorkspaceGuideRect[] {
  const elements = canvasShell.ownerDocument.querySelectorAll(PROTECTED_SELECTORS.join(','));
  return Array.from(elements)
    .filter(isVisibleProtectedElement)
    .map((element) => rectFromDomRect(element.getBoundingClientRect()));
}

function placementIsSafe(
  placement: WorkspaceGuidePlacementResult,
  viewportRect: WorkspaceGuideRect,
  protectedRects: readonly WorkspaceGuideRect[],
): boolean {
  const right = placement.rect.x + placement.rect.width;
  const bottom = placement.rect.y + placement.rect.height;
  return placement.rect.x >= viewportRect.x
    && placement.rect.y >= viewportRect.y
    && right <= viewportRect.x + viewportRect.width
    && bottom <= viewportRect.y + viewportRect.height
    && !protectedRects.some((protectedRect) => rectanglesIntersect(placement.rect, protectedRect));
}

function actionTraySideForPlacement(
  rect: WorkspaceGuideRect,
  viewportRect: WorkspaceGuideRect,
): 'left' | 'right' {
  const availableLeft = rect.x - viewportRect.x;
  const availableRight = viewportRect.x + viewportRect.width - (rect.x + rect.width);
  return availableRight >= availableLeft ? 'right' : 'left';
}

function findSafeCanvasBadge(params: {
  anchorRect: WorkspaceGuideRect;
  preferredPlacement: WorkspaceGuidePlacement;
  protectedRects: readonly WorkspaceGuideRect[];
  seedRect: WorkspaceGuideRect;
  viewportRect: WorkspaceGuideRect;
}): WorkspaceGuidePlacementResult | null {
  const { anchorRect, preferredPlacement, protectedRects, seedRect, viewportRect } = params;
  const maxX = viewportRect.x + viewportRect.width - GUIDE_BADGE_SIZE.width;
  const maxY = viewportRect.y + viewportRect.height - GUIDE_BADGE_SIZE.height;
  const xCandidates = [
    seedRect.x,
    viewportRect.x,
    maxX,
    anchorRect.x + anchorRect.width / 2 - GUIDE_BADGE_SIZE.width / 2,
    ...protectedRects.flatMap((rect) => [rect.x - GUIDE_BADGE_SIZE.width, rect.x + rect.width]),
  ];
  const yCandidates = [
    seedRect.y,
    viewportRect.y,
    maxY,
    anchorRect.y + anchorRect.height / 2 - GUIDE_BADGE_SIZE.height / 2,
    ...protectedRects.flatMap((rect) => [rect.y - GUIDE_BADGE_SIZE.height, rect.y + rect.height]),
  ];
  const rankCandidates = (candidates: WorkspaceGuideRect[]) => candidates
    .filter((candidate) => !protectedRects.some((protectedRect) => rectanglesIntersect(candidate, protectedRect)))
    .sort((left, right) => (
      Math.hypot(left.x - seedRect.x, left.y - seedRect.y)
      - Math.hypot(right.x - seedRect.x, right.y - seedRect.y)
    ));
  const edgeCandidates = [...new Set(xCandidates)]
    .filter((x) => x >= viewportRect.x && x <= maxX)
    .flatMap((x) => [...new Set(yCandidates)]
      .filter((y) => y >= viewportRect.y && y <= maxY)
      .map((y) => ({ x, y, ...GUIDE_BADGE_SIZE })));
  let rect = rankCandidates(edgeCandidates)[0];
  if (!rect) {
    const scanStep = GUIDE_BADGE_SIZE.width / 2;
    const scanXs = Array.from(
      { length: Math.max(1, Math.ceil((maxX - viewportRect.x) / scanStep) + 1) },
      (_, index) => Math.min(maxX, viewportRect.x + index * scanStep),
    );
    const scanYs = Array.from(
      { length: Math.max(1, Math.ceil((maxY - viewportRect.y) / scanStep) + 1) },
      (_, index) => Math.min(maxY, viewportRect.y + index * scanStep),
    );
    rect = rankCandidates(scanXs.flatMap((x) => scanYs.map((y) => ({ x, y, ...GUIDE_BADGE_SIZE }))))[0];
  }
  return rect
    ? {
        collapsed: true,
        leader: workspaceGuideLeaderForRect(rect, anchorRect),
        rect,
        side: preferredPlacement,
      }
    : null;
}

function screenPointForSvg(point: DOMPoint, matrix: DOMMatrix): WorkspaceGuidePoint {
  const transformed = point.matrixTransform(matrix);
  return { x: transformed.x, y: transformed.y };
}

function sampleFunctionalEdges(canvasShell: HTMLElement): WorkspaceGuideSegment[] {
  return Array.from(canvasShell.querySelectorAll<SVGPathElement>('.react-flow__edge-path')).flatMap((path) => {
    try {
      const totalLength = path.getTotalLength();
      const matrix = path.getScreenCTM();
      if (!matrix || !Number.isFinite(totalLength) || totalLength <= 0) return [];
      const screenScale = Math.max(Math.hypot(matrix.a, matrix.b), Math.hypot(matrix.c, matrix.d));
      const sampleCount = Math.max(1, Math.ceil((totalLength * screenScale) / FUNCTIONAL_EDGE_SAMPLE_INTERVAL));
      const points = Array.from({ length: sampleCount + 1 }, (_, index) => (
        screenPointForSvg(path.getPointAtLength((totalLength * index) / sampleCount), matrix)
      ));
      return points.slice(1).map((point, index) => ({ start: points[index]!, end: point }));
    } catch {
      return [];
    }
  });
}

function reactFlowNodeElement(canvasShell: HTMLElement, nodeId: string): HTMLElement | null {
  return Array.from(canvasShell.querySelectorAll<HTMLElement>('.react-flow__node[data-id]'))
    .find((element) => element.dataset.id === nodeId) ?? null;
}

function resolveNodeAnchorElement(
  canvasShell: HTMLElement,
  annotation: WorkspaceGuideAnnotation,
): HTMLElement | null {
  if (annotation.anchor.kind !== 'node') return null;
  const nodeElement = reactFlowNodeElement(canvasShell, annotation.anchor.nodeId);
  if (!nodeElement) return null;
  if (annotation.anchor.target === 'action') {
    const action = nodeElement.querySelector<HTMLButtonElement>('[data-shot-generation-action="true"]');
    if (action?.disabled && action.getAttribute('aria-busy') !== 'true') {
      return nodeElement.querySelector<HTMLElement>('[data-shot-generation-status="true"]') ?? action;
    }
    return action ?? nodeElement;
  }
  if (annotation.anchor.target === 'input-port') {
    return nodeElement.querySelector<HTMLElement>('.react-flow__handle-target') ?? nodeElement;
  }
  if (annotation.anchor.target === 'output-port') {
    return nodeElement.querySelector<HTMLElement>('.react-flow__handle-source') ?? nodeElement;
  }
  return nodeElement;
}

function resolveGeneratedOutputAnchorElement(
  canvasShell: HTMLElement,
  annotation: WorkspaceGuideAnnotation,
  nodes: WorkspaceGraphNode[],
  edges: WorkspaceGraphEdge[],
): HTMLElement | null {
  if (annotation.anchor.kind !== 'generated-output') return null;
  const outputNode = findGuideGeneratedOutputNodeForShot(annotation.anchor.sourceNodeId, nodes, edges);
  if (outputNode) {
    const outputElement = reactFlowNodeElement(canvasShell, outputNode.id);
    if (!outputElement) return null;
    const outputStatus = outputNode.data.output?.status;
    return outputElement.querySelector<HTMLElement>(`[data-generated-output-status="${outputStatus ?? 'ready'}"]`)
      ?? outputElement;
  }
  const sourceShot = reactFlowNodeElement(canvasShell, annotation.anchor.sourceNodeId);
  return sourceShot?.querySelector<HTMLElement>('[data-shot-generation-status="true"]') ?? sourceShot;
}

function resolveAnchorBoundaryElement(
  canvasShell: HTMLElement,
  annotation: WorkspaceGuideAnnotation,
  nodes: WorkspaceGraphNode[],
  edges: WorkspaceGraphEdge[],
): HTMLElement | null {
  if (annotation.anchor.kind === 'node') {
    return annotation.anchor.target === 'action'
      ? reactFlowNodeElement(canvasShell, annotation.anchor.nodeId)
      : resolveNodeAnchorElement(canvasShell, annotation);
  }
  if (annotation.anchor.kind !== 'generated-output') return null;
  const outputNode = findGuideGeneratedOutputNodeForShot(annotation.anchor.sourceNodeId, nodes, edges);
  return reactFlowNodeElement(canvasShell, outputNode?.id ?? annotation.anchor.sourceNodeId);
}

function resolveAnchorRect(
  canvasShell: HTMLElement,
  annotation: WorkspaceGuideAnnotation,
  nodes: WorkspaceGraphNode[],
  edges: WorkspaceGraphEdge[],
): WorkspaceGuideRect | null {
  const element = resolveAnchorBoundaryElement(canvasShell, annotation, nodes, edges);
  return element ? rectFromDomRect(element.getBoundingClientRect()) : null;
}

function localizePlacement(
  placement: WorkspaceGuidePlacementResult,
  canvasRect: DOMRect,
): WorkspaceGuidePlacementResult {
  return {
    ...placement,
    rect: {
      ...placement.rect,
      x: placement.rect.x - canvasRect.left,
      y: placement.rect.y - canvasRect.top,
    },
    leader: {
      start: {
        x: placement.leader.start.x - canvasRect.left,
        y: placement.leader.start.y - canvasRect.top,
      },
      end: {
        x: placement.leader.end.x - canvasRect.left,
        y: placement.leader.end.y - canvasRect.top,
      },
    },
  };
}

function placementsEqual(left: PlacedCanvasAnnotation[], right: PlacedCanvasAnnotation[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((placement, index) => {
    const candidate = right[index];
    return candidate?.annotation.id === placement.annotation.id
      && candidate.collapsed === placement.collapsed
      && candidate.actionTraySide === placement.actionTraySide
      && candidate.side === placement.side
      && candidate.rect.x === placement.rect.x
      && candidate.rect.y === placement.rect.y
      && candidate.rect.width === placement.rect.width
      && candidate.rect.height === placement.rect.height
      && candidate.leader.start.x === placement.leader.start.x
      && candidate.leader.start.y === placement.leader.start.y
      && candidate.leader.end.x === placement.leader.end.x
      && candidate.leader.end.y === placement.leader.end.y;
  });
}

function clampDragPosition(position: WorkspaceGuidePoint, size: WorkspaceGuideSize, canvasRect: DOMRect): WorkspaceGuidePoint {
  return {
    x: Math.min(Math.max(position.x, 0), Math.max(0, canvasRect.width - size.width)),
    y: Math.min(Math.max(position.y, 0), Math.max(0, canvasRect.height - size.height)),
  };
}

export function CanvasGuideLayer({
  canvasShellRef,
  copy,
  edges,
  guide,
  initialFit,
  layoutSignal,
  nodes,
  onDraggingChange,
  presentation,
}: CanvasGuideLayerProps) {
  const consumeFocusActivation = presentation.consumeFocusActivation;
  const focusActivation = presentation.focusActivation;
  const isMobilePresentation = presentation.isMobile;
  const reportCanvasProtectedRects = presentation.reportCanvasProtectedRects;
  const reactFlow = useReactFlow<WorkspaceGraphNode, WorkspaceGraphEdge>();
  const [guideMenuOpen, setGuideMenuOpen] = useState(false);
  const [compactMarkers, setCompactMarkers] = useState(false);
  const [placements, setPlacements] = useState<PlacedCanvasAnnotation[]>([]);
  const [dragPreview, setDragPreview] = useState<{ annotationId: string; position: WorkspaceGuidePoint } | null>(null);
  const calloutRefs = useRef(new Map<string, HTMLElement>());
  const anchorRectsRef = useRef(new Map<string, WorkspaceGuideRect>());
  const expandedSizesRef = useRef(new Map<string, WorkspaceGuideSize>());
  const previousSidesRef = useRef(new Map<string, WorkspaceGuidePlacement>());
  const warnedCopyKeysRef = useRef(new Set<string>());
  const dragStateRef = useRef<GuideDragState | null>(null);
  const measurementFrameRef = useRef<number | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const measureRef = useRef<() => void>(() => undefined);
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const canvasAnnotationsRef = useRef<ResolvedCanvasAnnotation[]>([]);
  const highlightCleanupRef = useRef<(() => void) | null>(null);
  const focusFrameRef = useRef<number | null>(null);
  const hasGuideControl = Boolean(guide.state.sourceTemplateId || guide.state.annotations.length);

  const canvasAnnotations = useMemo<ResolvedCanvasAnnotation[]>(() => {
    return [...guide.state.annotations]
      .filter((annotation) => annotation.anchor.kind !== 'surface')
      .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
      .flatMap((annotation) => {
        const stepCopy = copy.steps[annotation.copyKey] as GuideStepCopy | undefined;
        if (stepCopy) return [{ annotation, stepCopy }];
        if (process.env.NODE_ENV !== 'production' && !warnedCopyKeysRef.current.has(annotation.copyKey)) {
          warnedCopyKeysRef.current.add(annotation.copyKey);
          console.warn('[Studio guide] Missing copy', annotation.copyKey);
        }
        return [];
      });
  }, [copy.steps, guide.state.annotations]);
  const visibleAnnotationCount = useMemo(() => guide.state.annotations.filter((annotation) => (
    Boolean(copy.steps[annotation.copyKey])
  )).length, [copy.steps, guide.state.annotations]);
  const visibleAnnotationPositions = useMemo(() => new Map(
    [...guide.state.annotations]
      .filter((annotation) => Boolean(copy.steps[annotation.copyKey]))
      .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
      .map((annotation, index) => [annotation.id, index + 1]),
  ), [copy.steps, guide.state.annotations]);
  nodesRef.current = nodes;
  edgesRef.current = edges;
  canvasAnnotationsRef.current = canvasAnnotations;

  const scheduleMeasure = useCallback(() => {
    if (measurementFrameRef.current !== null) return;
    measurementFrameRef.current = window.requestAnimationFrame(() => {
      measurementFrameRef.current = null;
      measureRef.current();
    });
  }, []);

  useOnViewportChange({
    onChange: scheduleMeasure,
    onEnd: scheduleMeasure,
  });

  measureRef.current = () => {
    if (!hasGuideControl || guide.state.hidden) {
      presentation.reportCanvasProtectedRects([]);
      setPlacements((current) => current.length ? [] : current);
      return;
    }
    const canvasShell = canvasShellRef.current;
    if (!canvasShell) return;
    const canvasRect = canvasShell.getBoundingClientRect();
    if (!canvasRect.width || !canvasRect.height) return;

    for (const annotation of canvasAnnotations) {
      const callout = calloutRefs.current.get(annotation.annotation.id);
      if (!callout || callout.dataset.guideCollapsed === 'true') continue;
      const rect = callout.getBoundingClientRect();
      if (rect.width && rect.height) {
        expandedSizesRef.current.set(annotation.annotation.id, { width: rect.width, height: rect.height });
      }
    }

    const zoom = reactFlow.getZoom();
    const compact = compactMarkers || compactWorkspaceGuideAtZoom(zoom);
    const placementGap = compact || presentation.isMobile
      ? WORKSPACE_GUIDE_COMPACT_GAP
      : WORKSPACE_GUIDE_DESKTOP_GAP;
    const viewportRect = rectFromDomRect(canvasRect);
    const functionalEdges = sampleFunctionalEdges(canvasShell);
    const canvasProtectedRects = protectedRectsForCanvas(canvasShell);
    const transientToolbarProtectedRects = Array.from(canvasShell.ownerDocument.querySelectorAll(
      TRANSIENT_TOOLBAR_PROTECTED_SELECTORS.join(','),
    ))
      .filter(isVisibleProtectedElement)
      .map((element) => expandWorkspaceGuideRect(
        rectFromDomRect(element.getBoundingClientRect()),
        placementGap,
      ));
    const hasVisibleSurfaceCallout = Boolean(
      canvasShell.ownerDocument.querySelector('[data-guide-surface-annotation="true"]'),
    );
    const protectedRects = [
      ...canvasProtectedRects,
      ...transientToolbarProtectedRects,
      ...(hasVisibleSurfaceCallout && presentation.surfaceRect
        ? [expandWorkspaceGuideRect(presentation.surfaceRect, placementGap)]
        : []),
    ];
    const acceptedRects: WorkspaceGuideRect[] = [];
    const nextPlacements: PlacedCanvasAnnotation[] = [];

    for (const resolved of canvasAnnotations) {
      const measuredAnchorRect = resolveAnchorRect(canvasShell, resolved.annotation, nodes, edges);
      if (measuredAnchorRect) anchorRectsRef.current.set(resolved.annotation.id, measuredAnchorRect);
      const anchorRect = measuredAnchorRect ?? anchorRectsRef.current.get(resolved.annotation.id) ?? null;
      if (!anchorRect) continue;
      const expandedSize = expandedSizesRef.current.get(resolved.annotation.id) ?? GUIDE_CALLOUT_FALLBACK_SIZE;
      const isExpandedCompactBadge = !presentation.isMobile
        && compact
        && presentation.expandedAnnotationId === resolved.annotation.id;
      const shouldUseBadge = presentation.isMobile || (compact && !isExpandedCompactBadge);
      const calloutSize = shouldUseBadge ? GUIDE_BADGE_SIZE : expandedSize;
      const manualPosition = resolved.annotation.manualPosition
        ? reactFlow.flowToScreenPosition(resolved.annotation.manualPosition)
        : undefined;
      let placement = resolveWorkspaceGuidePlacement({
        anchorRect,
        calloutSize,
        preferredPlacement: resolved.annotation.preferredPlacement,
        viewportRect,
        protectedRects,
        functionalEdges,
        gap: placementGap,
        previousPlacement: previousSidesRef.current.get(resolved.annotation.id) ?? null,
        ...(manualPosition ? { manualPosition } : {}),
      });
      if ((!shouldUseBadge && placement.collapsed) || !placementIsSafe(placement, viewportRect, protectedRects)) {
        placement = resolveWorkspaceGuidePlacement({
          anchorRect,
          calloutSize: GUIDE_BADGE_SIZE,
          preferredPlacement: placement.side,
          viewportRect,
          protectedRects,
          functionalEdges,
          gap: placementGap,
          previousPlacement: placement.side,
          ...(manualPosition ? { manualPosition } : {}),
        });
        if (!placementIsSafe(placement, viewportRect, protectedRects)) {
          const safeBadge = findSafeCanvasBadge({
            anchorRect,
            preferredPlacement: placement.side,
            protectedRects,
            seedRect: placement.rect,
            viewportRect,
          });
          if (!safeBadge) continue;
          placement = safeBadge;
        } else {
          placement = { ...placement, collapsed: true };
        }
      } else {
        placement = { ...placement, collapsed: shouldUseBadge };
      }
      previousSidesRef.current.set(resolved.annotation.id, placement.side);
      acceptedRects.push(placement.rect);
      protectedRects.push(placement.rect);
      nextPlacements.push({
        ...resolved,
        ...localizePlacement(placement, canvasRect),
        actionTraySide: actionTraySideForPlacement(placement.rect, viewportRect),
      });
    }

    presentation.reportCanvasProtectedRects([...canvasProtectedRects, ...acceptedRects]);
    setPlacements((current) => placementsEqual(current, nextPlacements) ? current : nextPlacements);

    if (!initialFit.isCompleted() && canvasAnnotations.length && nodes.length) {
      const allNodesMeasured = nodes.every((node) => (
        (node.measured?.width ?? node.width ?? 0) > 0 && (node.measured?.height ?? node.height ?? 0) > 0
      ));
      if (allNodesMeasured) {
        initialFit.markCompleted();
        void reactFlow.setViewport(getViewportForBounds(
          expandWorkspaceGuideFitBounds(getNodesBounds(nodes), GUIDE_CALLOUT_FALLBACK_SIZE),
          canvasRect.width, canvasRect.height, 0.72, 1, 0,
        ));
      }
    }
  };

  useEffect(() => {
    if (!hasGuideControl || initialFit.isCompleted()) return;
    if (guide.state.hidden || canvasAnnotations.length === 0) initialFit.markCompleted();
  }, [canvasAnnotations.length, guide.state.hidden, hasGuideControl, initialFit]);

  useEffect(() => {
    scheduleMeasure();
  }, [
    canvasAnnotations,
    compactMarkers,
    edges,
    guide.state.hidden,
    guideMenuOpen,
    layoutSignal,
    nodes,
    presentation.expandedAnnotationId,
    presentation.isMobile,
    presentation.surfaceRect,
    scheduleMeasure,
  ]);

  useEffect(() => {
    if (layoutSignal !== 'closed') return;
    const drawerSettleTimer = window.setTimeout(scheduleMeasure, 220);
    return () => window.clearTimeout(drawerSettleTimer);
  }, [layoutSignal, scheduleMeasure]);

  useEffect(() => {
    if (!hasGuideControl || guide.state.hidden) return;
    const canvasShell = canvasShellRef.current;
    if (!canvasShell) return;
    const resizeObserver = new ResizeObserver(scheduleMeasure);
    resizeObserverRef.current = resizeObserver;
    const observedElements = [
      canvasShell,
      ...Array.from(canvasShell.ownerDocument.querySelectorAll<HTMLElement | SVGElement>(PROTECTED_SELECTORS.join(','))),
      ...calloutRefs.current.values(),
    ];
    observedElements.forEach((element) => resizeObserver.observe(element));
    const mutationObserver = new MutationObserver(scheduleMeasure);
    observedElements.forEach((element) => mutationObserver.observe(element, {
      attributes: true,
      attributeFilter: ['aria-busy', 'aria-expanded', 'aria-hidden', 'data-generated-output-status', 'disabled'],
      subtree: false,
    }));
    const transientToolbarObserver = new MutationObserver(scheduleMeasure);
    const transientToolbar = canvasShell.ownerDocument.querySelector<HTMLElement>('[data-canvas-floating-toolbar="true"]');
    if (transientToolbar) {
      transientToolbarObserver.observe(transientToolbar, {
        attributes: true,
        attributeFilter: ['aria-expanded'],
        childList: true,
        subtree: true,
      });
    }
    Array.from(canvasShell.querySelectorAll<HTMLElement>([
      '[data-shot-generation-action="true"]',
      '[data-shot-generation-status="true"]',
      '[data-generated-output-status]',
    ].join(','))).forEach((element) => mutationObserver.observe(element, {
      attributes: true,
      attributeFilter: ['aria-busy', 'aria-hidden', 'data-generated-output-status', 'disabled'],
      subtree: false,
    }));
    return () => {
      resizeObserverRef.current = null;
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      transientToolbarObserver.disconnect();
    };
  }, [canvasAnnotations, canvasShellRef, guide.state.hidden, guideMenuOpen, hasGuideControl, scheduleMeasure]);

  useEffect(() => () => {
    if (measurementFrameRef.current !== null) {
      window.cancelAnimationFrame(measurementFrameRef.current);
      measurementFrameRef.current = null;
    }
    if (focusFrameRef.current !== null) window.cancelAnimationFrame(focusFrameRef.current);
    highlightCleanupRef.current?.();
    reportCanvasProtectedRects([]);
    onDraggingChange(false);
  }, [onDraggingChange, reportCanvasProtectedRects]);

  useEffect(() => {
    const activation = focusActivation;
    if (!activation?.pendingConsumers.includes('canvas')) return;
    const requestId = activation.requestId;
    const resolved = canvasAnnotationsRef.current.find(({ annotation }) => annotation.id === activation.annotationId);
    if (!resolved || resolved.annotation.anchor.kind === 'surface' || guide.state.hidden) {
      consumeFocusActivation(requestId, 'canvas');
      return;
    }
    const canvasShell = canvasShellRef.current;
    const target = canvasShell
      ? (resolved.annotation.anchor.kind === 'node'
          ? resolveNodeAnchorElement(canvasShell, resolved.annotation)
          : resolveGeneratedOutputAnchorElement(canvasShell, resolved.annotation, nodesRef.current, edgesRef.current))
      : null;
    const centeredNode = resolved.annotation.anchor.kind === 'node'
      ? reactFlow.getNode(resolved.annotation.anchor.nodeId)
      : findGuideGeneratedOutputNodeForShot(resolved.annotation.anchor.sourceNodeId, nodesRef.current, edgesRef.current)
        ?? reactFlow.getNode(resolved.annotation.anchor.sourceNodeId);
    if (centeredNode && !isMobilePresentation) {
      const width = centeredNode.measured?.width ?? centeredNode.width ?? 0;
      const height = centeredNode.measured?.height ?? centeredNode.height ?? 0;
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      void reactFlow.setCenter(
        centeredNode.position.x + width / 2,
        centeredNode.position.y + height / 2,
        { duration: reduceMotion ? 0 : 180, zoom: reactFlow.getZoom() },
      );
    }
    highlightCleanupRef.current?.();
    highlightCleanupRef.current = highlightWorkspaceGuideTargets([target]);
    if (focusFrameRef.current !== null) window.cancelAnimationFrame(focusFrameRef.current);
    focusFrameRef.current = window.requestAnimationFrame(() => {
      focusFrameRef.current = null;
      calloutRefs.current.get(activation.annotationId)?.focus();
      scheduleMeasure();
    });
    consumeFocusActivation(requestId, 'canvas');
  }, [
    canvasShellRef,
    consumeFocusActivation,
    focusActivation,
    guide.state.hidden,
    isMobilePresentation,
    reactFlow,
    scheduleMeasure,
  ]);

  const setCalloutRef = useCallback((annotationId: string, callout: HTMLElement | null) => {
    const previousCallout = calloutRefs.current.get(annotationId);
    if (previousCallout && previousCallout !== callout) resizeObserverRef.current?.unobserve(previousCallout);
    if (callout) {
      calloutRefs.current.set(annotationId, callout);
      resizeObserverRef.current?.observe(callout);
    } else {
      calloutRefs.current.delete(annotationId);
    }
    scheduleMeasure();
  }, [scheduleMeasure]);

  const resetChangesGuide = useMemo(() => {
    if (!guide.state.sourceTemplateId) return false;
    const template = createStarterWorkspaceTemplate(guide.state.sourceTemplateId);
    const canonical = reconcileWorkspaceCanvasGuideState(createWorkspaceCanvasGuideState(template), nodes);
    return JSON.stringify(guide.state.annotations) !== JSON.stringify(canonical.annotations);
  }, [guide.state.annotations, guide.state.sourceTemplateId, nodes]);

  const handleDeleteAll = () => {
    setGuideMenuOpen(false);
    if (!guide.state.annotations.length) return;
    if (window.confirm(copy.controls.deleteAllConfirm)) guide.deleteAllAnnotations();
  };

  const handleReset = () => {
    setGuideMenuOpen(false);
    if (resetChangesGuide && !window.confirm(copy.controls.resetConfirm)) return;
    guide.resetAnnotations();
  };

  const startDrag = (annotationId: string, event: ReactPointerEvent<HTMLButtonElement>) => {
    const placement = placements.find((candidate) => candidate.annotation.id === annotationId);
    if (!placement) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      annotationId,
      pointerId: event.pointerId,
      pointerStart: { x: event.clientX, y: event.clientY },
      position: { x: placement.rect.x, y: placement.rect.y },
      rectStart: placement.rect,
      moved: false,
    };
    setDragPreview({ annotationId, position: { x: placement.rect.x, y: placement.rect.y } });
    onDraggingChange(true);
  };

  const moveDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragStateRef.current;
    const canvasRect = canvasShellRef.current?.getBoundingClientRect();
    if (!drag || drag.pointerId !== event.pointerId || !canvasRect) return;
    event.preventDefault();
    event.stopPropagation();
    const deltaX = event.clientX - drag.pointerStart.x;
    const deltaY = event.clientY - drag.pointerStart.y;
    if (!drag.moved && Math.hypot(deltaX, deltaY) < GUIDE_DRAG_THRESHOLD) return;
    drag.moved = true;
    const position = clampDragPosition({
      x: drag.rectStart.x + deltaX,
      y: drag.rectStart.y + deltaY,
    }, drag.rectStart, canvasRect);
    drag.position = position;
    setDragPreview({ annotationId: drag.annotationId, position });
  };

  const finishDrag = (
    event: ReactPointerEvent<HTMLButtonElement>,
    commit: boolean,
    releasePointerCapture = true,
  ) => {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const preview = drag.position;
    dragStateRef.current = null;
    setDragPreview(null);
    onDraggingChange(false);
    if (releasePointerCapture && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (commit && drag.moved) {
      const canvasRect = canvasShellRef.current?.getBoundingClientRect();
      if (canvasRect) {
        guide.moveAnnotation(drag.annotationId, reactFlow.screenToFlowPosition({
          x: canvasRect.left + preview.x,
          y: canvasRect.top + preview.y,
        }));
      }
    }
    scheduleMeasure();
  };

  if (!hasGuideControl) return null;

  return (
    <div className={styles.layer} data-canvas-guide-layer="true">
      <div className={styles.guideControls} data-canvas-guide-controls="true">
        <StudioMenu
          id="canvas-guide-menu"
          label={copy.controls.menu}
          open={guideMenuOpen}
          onOpenChange={setGuideMenuOpen}
          className={styles.guideMenu}
          menuClassName={styles.guideMenuItems}
          trigger={(triggerProps) => (
            <button type="button" className={styles.guideMenuTrigger} {...triggerProps}>
              <ListOrdered size={16} aria-hidden="true" />
              {guide.state.hidden ? copy.controls.show : copy.controls.hide}
            </button>
          )}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              guide.setHidden(!guide.state.hidden);
              setGuideMenuOpen(false);
            }}
          >
            {guide.state.hidden ? copy.controls.show : copy.controls.hide}
          </button>
          <button type="button" role="menuitem" onClick={() => { setCompactMarkers(!compactMarkers); setGuideMenuOpen(false); }}>
            {compactMarkers ? copy.controls.expanded : copy.controls.compact}
          </button>
          <button type="button" role="menuitem" onClick={handleDeleteAll}>
            {copy.controls.deleteAll}
          </button>
          <button type="button" role="menuitem" onClick={handleReset}>
            {copy.controls.reset}
          </button>
        </StudioMenu>
      </div>

      {guide.state.hidden ? null : (
        <>
          <svg className={styles.leaderLayer} aria-hidden="true" focusable="false">
            {placements.map((placement) => (
              <line
                key={`leader-${placement.annotation.id}`}
                className={styles.leader}
                data-guide-leader-annotation={placement.annotation.id}
                x1={placement.leader.start.x}
                y1={placement.leader.start.y}
                x2={placement.leader.end.x}
                y2={placement.leader.end.y}
              />
            ))}
          </svg>
          {placements.map((placement) => {
            const preview = dragPreview?.annotationId === placement.annotation.id ? dragPreview.position : null;
            const canvasWidth = canvasShellRef.current?.getBoundingClientRect().width ?? 0;
            const actionTraySide = preview && canvasWidth > 0
              ? actionTraySideForPlacement(
                  { ...placement.rect, x: preview.x, y: preview.y },
                  { x: 0, y: 0, width: canvasWidth, height: placement.rect.height },
                )
              : placement.actionTraySide;
            return (
              <CanvasGuideCallout
                key={placement.annotation.id}
                actionTraySide={actionTraySide}
                annotation={placement.annotation}
                calloutRef={(callout) => setCalloutRef(placement.annotation.id, callout)}
                collapsed={placement.collapsed}
                controlsCopy={copy.controls}
                guidePosition={visibleAnnotationPositions.get(placement.annotation.id) ?? 1}
                guideSize={visibleAnnotationCount}
                onActivate={() => guide.focusAnnotation(placement.annotation.id)}
                onCollapse={() => presentation.collapseAnnotation(placement.annotation.id)}
                stepCopy={placement.stepCopy}
                style={{
                  left: preview?.x ?? placement.rect.x,
                  top: preview?.y ?? placement.rect.y,
                }}
                onDelete={() => {
                  guide.deleteAnnotation(placement.annotation.id);
                }}
                onDragPointerCancel={(event) => finishDrag(event, false)}
                onDragPointerDown={(event) => startDrag(placement.annotation.id, event)}
                onDragPointerMove={moveDrag}
                onDragPointerUp={(event) => finishDrag(event, true)}
                onDragLostPointerCapture={(event) => finishDrag(event, false, false)}
              />
            );
          })}
        </>
      )}
    </div>
  );
}
