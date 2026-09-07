'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import type { StudioCopy } from '../../_lib/studio-copy';
import type {
  WorkspaceGuideController,
  WorkspaceGuidePresentationController,
} from '../_hooks/useWorkspaceGuidePresentationController';
import {
  compactWorkspaceGuideAtZoom,
  expandWorkspaceGuideRect,
  rectanglesIntersect,
  resolveWorkspaceGuidePlacement,
  WORKSPACE_GUIDE_COMPACT_GAP,
  WORKSPACE_GUIDE_DESKTOP_GAP,
  WORKSPACE_GUIDE_LEADER_END_GAP,
  type WorkspaceGuidePlacementResult,
  type WorkspaceGuideRect,
  type WorkspaceGuideSize,
} from '../_lib/workspace-guide-layout';
import type { WorkspaceGuideAnnotation } from '../_lib/workspace-types';
import type { WorkspaceFocusMode } from '../_state/workspace-state';
import styles from '../_styles/canvas-guide.module.css';
import {
  CanvasGuideCallout,
  highlightWorkspaceGuideTargets,
} from './canvas/CanvasGuideCallout';

const SURFACE_CALLOUT_SIZE = { width: 210, height: 82 };
const SURFACE_BADGE_SIZE = { width: 28, height: 28 };
const SURFACE_PROTECTED_SELECTORS = [
  '#studio-project-media-panel',
  '#studio-inspector-panel',
  '[data-studio-mobile-panel-controls="true"]',
  '[data-viewer-program-controls="true"]',
  '.react-flow__node',
  '[data-canvas-guide-annotation]:not([data-guide-surface-annotation="true"])',
  '[data-canvas-miniature-map="true"]',
  '[data-canvas-floating-toolbar="true"]',
  '[data-canvas-navigator="true"]',
  '#canvas-navigator-popover',
  '[data-canvas-guide-controls="true"]',
  '#canvas-guide-menu',
  '#canvas-toolbar-image-menu',
  '#canvas-toolbar-video-menu',
  '#canvas-toolbar-audio-menu',
  '#canvas-toolbar-text-menu',
  '#canvas-toolbar-save-popover',
];

type GuideStepCopy = StudioCopy['canvas']['guide']['steps'][WorkspaceGuideAnnotation['copyKey']];

type ResolvedGuideAnnotation = {
  annotation: WorkspaceGuideAnnotation;
  stepCopy: GuideStepCopy;
};

type SurfacePlacement = WorkspaceGuidePlacementResult & {
  compactPanel: boolean;
  mobile: boolean;
};

type WorkspaceGuideSurfaceLayerProps = {
  activeMobilePanel: 'media' | 'inspector' | null;
  copy: StudioCopy['canvas']['guide'];
  focusMode: WorkspaceFocusMode;
  guide: WorkspaceGuideController;
  presentation: WorkspaceGuidePresentationController;
  timelinePanelHeight: number | null;
};

function rectFromDomRect(rect: DOMRect): WorkspaceGuideRect {
  return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
}

function isVisibleElement(element: Element | null): element is HTMLElement | SVGElement {
  if (!element) return false;
  const rect = element.getBoundingClientRect();
  if (!rect.width || !rect.height || element.getAttribute('aria-hidden') === 'true') return false;
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

function currentCanvasZoom(): number {
  const viewport = document.querySelector<HTMLElement>('.react-flow__viewport');
  if (!viewport) return 1;
  const transform = window.getComputedStyle(viewport).transform;
  if (!transform || transform === 'none') return 1;
  return new DOMMatrixReadOnly(transform).a;
}

function placementsEqual(left: SurfacePlacement | null, right: SurfacePlacement | null): boolean {
  if (!left || !right) return left === right;
  return left.mobile === right.mobile
    && left.compactPanel === right.compactPanel
    && left.collapsed === right.collapsed
    && left.side === right.side
    && left.rect.x === right.rect.x
    && left.rect.y === right.rect.y
    && left.rect.width === right.rect.width
    && left.rect.height === right.rect.height
    && left.leader.start.x === right.leader.start.x
    && left.leader.start.y === right.leader.start.y
    && left.leader.end.x === right.leader.end.x
    && left.leader.end.y === right.leader.end.y;
}

function placementIsSafe(
  placement: WorkspaceGuidePlacementResult,
  viewportRect: WorkspaceGuideRect,
  protectedRects: readonly WorkspaceGuideRect[],
): boolean {
  return placement.rect.x >= viewportRect.x
    && placement.rect.y >= viewportRect.y
    && placement.rect.x + placement.rect.width <= viewportRect.x + viewportRect.width
    && placement.rect.y + placement.rect.height <= viewportRect.y + viewportRect.height
    && !protectedRects.some((protectedRect) => rectanglesIntersect(placement.rect, protectedRect));
}

function leaderForSurfaceRect(
  rect: WorkspaceGuideRect,
  anchorRect: WorkspaceGuideRect,
): WorkspaceGuidePlacementResult['leader'] {
  const target = {
    x: anchorRect.x + anchorRect.width / 2,
    y: anchorRect.y + anchorRect.height / 2,
  };
  const start = {
    x: Math.min(Math.max(target.x, rect.x), rect.x + rect.width),
    y: Math.min(Math.max(target.y, rect.y), rect.y + rect.height),
  };
  if (start.x > rect.x && start.x < rect.x + rect.width && start.y > rect.y && start.y < rect.y + rect.height) {
    start.y = target.y < rect.y + rect.height / 2 ? rect.y : rect.y + rect.height;
  }
  const distance = Math.hypot(start.x - target.x, start.y - target.y);
  const endGap = Math.min(WORKSPACE_GUIDE_LEADER_END_GAP, distance);
  return {
    start,
    end: distance > 0
      ? {
          x: target.x + ((start.x - target.x) / distance) * endGap,
          y: target.y + ((start.y - target.y) / distance) * endGap,
        }
      : target,
  };
}

function findSafeSurfaceSlot(params: {
  anchorRect: WorkspaceGuideRect;
  calloutSize: WorkspaceGuideSize;
  collapsed: boolean;
  preferredPlacement: WorkspaceGuidePlacementResult['side'];
  protectedRects: readonly WorkspaceGuideRect[];
  seedRect: WorkspaceGuideRect;
  viewportRect: WorkspaceGuideRect;
}): WorkspaceGuidePlacementResult | null {
  const { anchorRect, calloutSize, collapsed, preferredPlacement, protectedRects, seedRect, viewportRect } = params;
  if (calloutSize.width > viewportRect.width || calloutSize.height > viewportRect.height) return null;
  const maxX = viewportRect.x + viewportRect.width - calloutSize.width;
  const maxY = viewportRect.y + viewportRect.height - calloutSize.height;
  const xCandidates = [
    seedRect.x,
    viewportRect.x,
    maxX,
    anchorRect.x + anchorRect.width / 2 - calloutSize.width / 2,
    ...protectedRects.flatMap((rect) => [rect.x - calloutSize.width, rect.x + rect.width]),
  ];
  const yCandidates = [
    seedRect.y,
    viewportRect.y,
    maxY,
    anchorRect.y + anchorRect.height / 2 - calloutSize.height / 2,
    ...protectedRects.flatMap((rect) => [rect.y - calloutSize.height, rect.y + rect.height]),
  ];
  const candidates = [...new Set(xCandidates)]
    .filter((x) => x >= viewportRect.x && x <= maxX)
    .flatMap((x) => [...new Set(yCandidates)]
      .filter((y) => y >= viewportRect.y && y <= maxY)
      .map((y) => ({ x, y, ...calloutSize })))
    .filter((rect) => !protectedRects.some((protectedRect) => rectanglesIntersect(rect, protectedRect)))
    .sort((left, right) => (
      Math.hypot(left.x - seedRect.x, left.y - seedRect.y)
      - Math.hypot(right.x - seedRect.x, right.y - seedRect.y)
    ));
  const rect = candidates[0];
  return rect
    ? {
        collapsed,
        leader: leaderForSurfaceRect(rect, anchorRect),
        rect,
        side: preferredPlacement,
      }
    : null;
}

function collectProtectedRects(sharedRects: readonly WorkspaceGuideRect[], gap: number): WorkspaceGuideRect[] {
  const domRects = Array.from(document.querySelectorAll<HTMLElement | SVGElement>(SURFACE_PROTECTED_SELECTORS.join(',')))
    .filter(isVisibleElement)
    .map((element) => rectFromDomRect(element.getBoundingClientRect()));
  return [...sharedRects, ...domRects].map((rect) => expandWorkspaceGuideRect(rect, gap));
}

function mobileSurfacePlacement(
  topbarRect: DOMRect,
  timelineRect: DOMRect,
  calloutSize: WorkspaceGuideSize,
  protectedRects: readonly WorkspaceGuideRect[],
): SurfacePlacement | null {
  const viewportRect = {
    x: 12,
    y: topbarRect.bottom + WORKSPACE_GUIDE_COMPACT_GAP,
    width: Math.max(0, window.innerWidth - 24),
    height: Math.max(0, timelineRect.top - topbarRect.bottom - WORKSPACE_GUIDE_COMPACT_GAP * 2),
  };
  const anchorRect = {
    x: timelineRect.left + timelineRect.width / 2 - 1,
    y: timelineRect.top,
    width: 2,
    height: 2,
  };
  const fullSize = {
    width: Math.min(calloutSize.width, viewportRect.width),
    height: calloutSize.height,
  };
  const fullSeed = {
    x: anchorRect.x + anchorRect.width / 2 - fullSize.width / 2,
    y: anchorRect.y - WORKSPACE_GUIDE_COMPACT_GAP - fullSize.height,
    ...fullSize,
  };
  const fullPanel = findSafeSurfaceSlot({
    anchorRect,
    calloutSize: fullSize,
    collapsed: false,
    preferredPlacement: 'top',
    protectedRects,
    seedRect: fullSeed,
    viewportRect,
  });
  if (fullPanel) return { ...fullPanel, compactPanel: false, mobile: true };

  const compactSize = {
    width: Math.min(150, viewportRect.width),
    height: Math.min(52, viewportRect.height),
  };
  const compactSeed = {
    x: viewportRect.x,
    y: viewportRect.y,
    ...compactSize,
  };
  const compactPanel = findSafeSurfaceSlot({
    anchorRect,
    calloutSize: compactSize,
    collapsed: false,
    preferredPlacement: 'top',
    protectedRects,
    seedRect: compactSeed,
    viewportRect,
  });
  if (compactPanel) {
    return { ...compactPanel, compactPanel: true, mobile: true };
  }

  const resolvedBadge = resolveWorkspaceGuidePlacement({
    anchorRect,
    calloutSize: SURFACE_BADGE_SIZE,
    preferredPlacement: 'top',
    viewportRect,
    protectedRects: [...protectedRects],
    functionalEdges: [],
    gap: WORKSPACE_GUIDE_COMPACT_GAP,
    previousPlacement: null,
  });
  const badge = placementIsSafe(resolvedBadge, viewportRect, protectedRects)
    ? resolvedBadge
    : findSafeSurfaceSlot({
        anchorRect,
        calloutSize: SURFACE_BADGE_SIZE,
        collapsed: true,
        preferredPlacement: resolvedBadge.side,
        protectedRects,
        seedRect: resolvedBadge.rect,
        viewportRect,
      });
  return badge
    ? { ...badge, collapsed: true, compactPanel: false, mobile: true }
    : null;
}

export function WorkspaceGuideSurfaceLayer({
  activeMobilePanel,
  copy,
  focusMode,
  guide,
  presentation,
  timelinePanelHeight,
}: WorkspaceGuideSurfaceLayerProps) {
  const consumeFocusActivation = presentation.consumeFocusActivation;
  const focusActivation = presentation.focusActivation;
  const reportSurfaceRect = presentation.reportSurfaceRect;
  const [placement, setPlacement] = useState<SurfacePlacement | null>(null);
  const layerRef = useRef<HTMLDivElement | null>(null);
  const calloutRef = useRef<HTMLElement | null>(null);
  const activePanelRef = useRef<HTMLDivElement | null>(null);
  const measurementFrameRef = useRef<number | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const focusFrameRef = useRef<number | null>(null);
  const highlightCleanupRef = useRef<(() => void) | null>(null);
  const measureCountRef = useRef(0);
  const warnedCopyKeysRef = useRef(new Set<string>());
  const measureRef = useRef<() => void>(() => undefined);

  const visibleAnnotations = useMemo<ResolvedGuideAnnotation[]>(() => (
    [...guide.state.annotations]
      .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
      .flatMap((annotation) => {
        const stepCopy = copy.steps[annotation.copyKey] as GuideStepCopy | undefined;
        if (stepCopy) return [{ annotation, stepCopy }];
        if (process.env.NODE_ENV !== 'production' && !warnedCopyKeysRef.current.has(annotation.copyKey)) {
          warnedCopyKeysRef.current.add(annotation.copyKey);
          console.warn('[Studio guide] Missing copy', annotation.copyKey);
        }
        return [];
      })
  ), [copy.steps, guide.state.annotations]);
  const visiblePositions = useMemo(() => new Map(
    visibleAnnotations.map(({ annotation }, index) => [annotation.id, index + 1]),
  ), [visibleAnnotations]);
  const canonicalSurfaceAnnotation = visibleAnnotations.find(({ annotation }) => annotation.anchor.kind === 'surface') ?? null;
  const activeAnnotation = visibleAnnotations.find(({ annotation }) => (
    annotation.id === presentation.activeAnnotationId
  )) ?? null;
  const surfaceAnnotation = canonicalSurfaceAnnotation;
  const activePanelAnnotation = activeAnnotation ?? canonicalSurfaceAnnotation;
  const visibleAnnotationsRef = useRef(visibleAnnotations);
  visibleAnnotationsRef.current = visibleAnnotations;

  const scheduleMeasure = useCallback(() => {
    if (measurementFrameRef.current !== null) return;
    measurementFrameRef.current = window.requestAnimationFrame(() => {
      measurementFrameRef.current = null;
      measureRef.current();
    });
  }, []);

  const updatePlacement = useCallback((next: SurfacePlacement | null) => {
    layerRef.current?.setAttribute('data-guide-surface-suppressed', next ? 'false' : 'true');
    setPlacement((current) => placementsEqual(current, next) ? current : next);
    const measuredElement = next?.mobile && !next.collapsed ? activePanelRef.current : calloutRef.current;
    const actualRect = next && measuredElement
      ? rectFromDomRect(measuredElement.getBoundingClientRect())
      : null;
    reportSurfaceRect(actualRect?.width && actualRect.height ? actualRect : next?.rect ?? null);
  }, [reportSurfaceRect]);

  measureRef.current = () => {
    measureCountRef.current += 1;
    layerRef.current?.setAttribute('data-guide-measure-count', String(measureCountRef.current));
    if (guide.state.hidden || !surfaceAnnotation || activeMobilePanel) {
      updatePlacement(null);
      return;
    }
    const timeline = document.querySelector<HTMLElement>('[data-studio-guide-anchor="timeline"]');
    const topbar = document.querySelector<HTMLElement>('header');
    if (!timeline || !topbar) {
      updatePlacement(null);
      return;
    }
    const timelineRect = timeline.getBoundingClientRect();
    const topbarRect = topbar.getBoundingClientRect();
    const expandedElement = presentation.isMobile ? activePanelRef.current : calloutRef.current;
    const expandedSize = expandedElement && !placement?.collapsed && !placement?.compactPanel
      ? rectFromDomRect(expandedElement.getBoundingClientRect())
      : null;
    const measuredCalloutSize = expandedSize?.width && expandedSize.height
      ? { width: expandedSize.width, height: expandedSize.height }
      : SURFACE_CALLOUT_SIZE;

    if (presentation.isMobile) {
      const protectedRects = collectProtectedRects(
        presentation.canvasProtectedRects,
        WORKSPACE_GUIDE_COMPACT_GAP,
      );
      updatePlacement(mobileSurfacePlacement(topbarRect, timelineRect, measuredCalloutSize, protectedRects));
      return;
    }

    const playbackControls = document.querySelector<HTMLElement>('[data-viewer-playback-controls="true"]');
    const anchorRect = focusMode === 'viewer' && playbackControls
      ? rectFromDomRect(playbackControls.getBoundingClientRect())
      : {
          x: timelineRect.left + timelineRect.width / 2 - 1,
          y: timelineRect.top,
          width: 2,
          height: 2,
        };
    const compactCanvas = focusMode === 'canvas' && compactWorkspaceGuideAtZoom(currentCanvasZoom());
    const shouldCollapse = presentation.expandedAnnotationId !== surfaceAnnotation.annotation.id
      && (compactCanvas || focusMode === 'viewer');
    const placementGap = WORKSPACE_GUIDE_DESKTOP_GAP;
    const protectedRects = collectProtectedRects(presentation.canvasProtectedRects, placementGap);
    const viewportTop = topbarRect.bottom + 12;
    const viewportRect = {
      x: 12,
      y: viewportTop,
      width: Math.max(0, window.innerWidth - 24),
      height: Math.max(1, timelineRect.top - viewportTop - placementGap),
    };
    const requestedSize = shouldCollapse ? SURFACE_BADGE_SIZE : measuredCalloutSize;
    const resolvedPlacement = resolveWorkspaceGuidePlacement({
      anchorRect,
      calloutSize: requestedSize,
      preferredPlacement: focusMode === 'viewer' ? 'right' : 'top',
      viewportRect,
      protectedRects,
      functionalEdges: [],
      gap: placementGap,
      previousPlacement: placement?.side ?? null,
    });
    let next = placementIsSafe(resolvedPlacement, viewportRect, protectedRects)
      && (shouldCollapse || !resolvedPlacement.collapsed)
      ? { ...resolvedPlacement, collapsed: shouldCollapse }
      : findSafeSurfaceSlot({
          anchorRect,
          calloutSize: requestedSize,
          collapsed: shouldCollapse,
          preferredPlacement: resolvedPlacement.side,
          protectedRects,
          seedRect: resolvedPlacement.rect,
          viewportRect,
        });
    if (!next && !shouldCollapse) {
      const badgePlacement = resolveWorkspaceGuidePlacement({
        anchorRect,
        calloutSize: SURFACE_BADGE_SIZE,
        preferredPlacement: resolvedPlacement.side,
        viewportRect,
        protectedRects,
        functionalEdges: [],
        gap: placementGap,
        previousPlacement: resolvedPlacement.side,
      });
      next = placementIsSafe(badgePlacement, viewportRect, protectedRects)
        ? { ...badgePlacement, collapsed: true }
        : findSafeSurfaceSlot({
            anchorRect,
            calloutSize: SURFACE_BADGE_SIZE,
            collapsed: true,
            preferredPlacement: badgePlacement.side,
            protectedRects,
            seedRect: badgePlacement.rect,
            viewportRect,
          });
    }
    updatePlacement(next ? { ...next, compactPanel: false, mobile: false } : null);
  };

  useEffect(() => {
    measureRef.current();
    scheduleMeasure();
  }, [
    activeMobilePanel,
    focusMode,
    guide.state.hidden,
    presentation.canvasProtectedRects,
    presentation.expandedAnnotationId,
    presentation.isMobile,
    scheduleMeasure,
    activePanelAnnotation,
    surfaceAnnotation,
    timelinePanelHeight,
  ]);

  useEffect(() => {
    if (activeMobilePanel !== null) return;
    const drawerSettleTimer = window.setTimeout(scheduleMeasure, 220);
    return () => window.clearTimeout(drawerSettleTimer);
  }, [activeMobilePanel, scheduleMeasure]);

  useEffect(() => {
    if (guide.state.hidden || !surfaceAnnotation) return;
    const editorShell = document.querySelector<HTMLElement>('[data-active-editor-surface]');
    if (!editorShell) return;
    const explicitElements = [
      editorShell,
      document.querySelector<HTMLElement>('header'),
      document.querySelector<HTMLElement>('[data-studio-guide-anchor="timeline"]'),
      document.querySelector<HTMLElement>('[data-viewer-playback-controls="true"]'),
      document.querySelector<HTMLElement>('[data-viewer-program-controls="true"]'),
      document.querySelector<HTMLElement>('[data-studio-mobile-panel-controls="true"]'),
      ...Array.from(document.querySelectorAll<HTMLElement | SVGElement>(SURFACE_PROTECTED_SELECTORS.join(','))),
      calloutRef.current,
      activePanelRef.current,
    ].filter((element): element is HTMLElement | SVGElement => Boolean(element));
    const resizeObserver = new ResizeObserver(scheduleMeasure);
    resizeObserverRef.current = resizeObserver;
    explicitElements.forEach((element) => resizeObserver.observe(element));
    const mutationObserver = new MutationObserver(scheduleMeasure);
    explicitElements.forEach((element) => mutationObserver.observe(element, {
      attributes: true,
      attributeFilter: ['aria-expanded', 'aria-hidden', 'data-active-editor-surface', 'data-mobile-panel'],
      subtree: false,
    }));
    const canvasViewportObserver = new MutationObserver(scheduleMeasure);
    const canvasViewport = document.querySelector<HTMLElement>('.react-flow__viewport');
    if (canvasViewport) {
      canvasViewportObserver.observe(canvasViewport, {
        attributes: true,
        attributeFilter: ['style'],
      });
    }
    const transientToolbarObserver = new MutationObserver(scheduleMeasure);
    const transientToolbar = document.querySelector<HTMLElement>('[data-canvas-floating-toolbar="true"]');
    if (transientToolbar) {
      transientToolbarObserver.observe(transientToolbar, {
        attributes: true,
        attributeFilter: ['aria-expanded'],
        childList: true,
        subtree: true,
      });
    }
    const transitioningPanels = [
      document.querySelector<HTMLElement>('#studio-project-media-panel'),
      document.querySelector<HTMLElement>('#studio-inspector-panel'),
    ].filter((element): element is HTMLElement => Boolean(element));
    transitioningPanels.forEach((element) => element.addEventListener('transitionend', scheduleMeasure));
    window.addEventListener('resize', scheduleMeasure);
    window.addEventListener('scroll', scheduleMeasure, true);
    return () => {
      resizeObserverRef.current = null;
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      canvasViewportObserver.disconnect();
      transientToolbarObserver.disconnect();
      transitioningPanels.forEach((element) => element.removeEventListener('transitionend', scheduleMeasure));
      window.removeEventListener('resize', scheduleMeasure);
      window.removeEventListener('scroll', scheduleMeasure, true);
    };
  }, [focusMode, guide.state.hidden, scheduleMeasure, surfaceAnnotation]);

  useEffect(() => () => {
    if (measurementFrameRef.current !== null) window.cancelAnimationFrame(measurementFrameRef.current);
    if (focusFrameRef.current !== null) window.cancelAnimationFrame(focusFrameRef.current);
    highlightCleanupRef.current?.();
    reportSurfaceRect(null);
  }, [reportSurfaceRect]);

  useEffect(() => {
    const activation = focusActivation;
    if (!activation?.pendingConsumers.includes('surface')) return;
    const requestId = activation.requestId;
    const resolved = visibleAnnotationsRef.current.find(({ annotation }) => annotation.id === activation.annotationId);
    if (!resolved || guide.state.hidden) {
      consumeFocusActivation(requestId, 'surface');
      return;
    }
    highlightCleanupRef.current?.();
    highlightCleanupRef.current = resolved.annotation.anchor.kind === 'surface'
      ? highlightWorkspaceGuideTargets([
          document.querySelector<HTMLElement>('[data-studio-guide-anchor="viewer-tab"]'),
          document.querySelector<HTMLElement>('[data-studio-guide-anchor="timeline"]'),
        ])
      : null;
    if (focusFrameRef.current !== null) window.cancelAnimationFrame(focusFrameRef.current);
    focusFrameRef.current = window.requestAnimationFrame(() => {
      focusFrameRef.current = null;
      if (resolved.annotation.anchor.kind === 'surface') calloutRef.current?.focus();
      scheduleMeasure();
    });
    consumeFocusActivation(requestId, 'surface');
  }, [
    consumeFocusActivation,
    focusActivation,
    guide.state.hidden,
    scheduleMeasure,
  ]);

  const setCalloutRef = useCallback((callout: HTMLElement | null) => {
    const previousCallout = calloutRef.current;
    if (previousCallout && previousCallout !== callout) {
      resizeObserverRef.current?.unobserve(previousCallout);
    }
    calloutRef.current = callout;
    if (callout) resizeObserverRef.current?.observe(callout);
    scheduleMeasure();
  }, [scheduleMeasure]);

  const setActivePanelRef = useCallback((panel: HTMLDivElement | null) => {
    const previousPanel = activePanelRef.current;
    if (previousPanel && previousPanel !== panel) {
      resizeObserverRef.current?.unobserve(previousPanel);
    }
    activePanelRef.current = panel;
    if (panel) resizeObserverRef.current?.observe(panel);
    scheduleMeasure();
  }, [scheduleMeasure]);

  if (!guide.state.sourceTemplateId && !guide.state.annotations.length) return null;

  const hideVisualCallout = guide.state.hidden || activeMobilePanel !== null || !surfaceAnnotation || !placement;
  const calloutStyle = placement
    ? ({ left: placement.rect.x, top: placement.rect.y } satisfies CSSProperties)
    : undefined;
  const suppressed = !guide.state.hidden && activeMobilePanel === null && Boolean(surfaceAnnotation) && !placement;
  const showMobileActivePanel = Boolean(
    placement?.mobile && !placement.collapsed && activePanelAnnotation,
  );

  return (
    <div
      ref={layerRef}
      className={styles.surfaceLayer}
      data-workspace-guide-surface-layer="true"
      data-guide-measure-count={measureCountRef.current}
      data-guide-surface-compact={placement?.compactPanel ? 'true' : 'false'}
      data-guide-surface-suppressed={suppressed ? 'true' : 'false'}
    >
      {hideVisualCallout ? null : (
        <>
          <svg className={styles.surfaceLeaderLayer} aria-hidden="true" focusable="false">
            <line
              className={styles.leader}
              x1={placement.leader.start.x}
              y1={placement.leader.start.y}
              x2={placement.leader.end.x}
              y2={placement.leader.end.y}
            />
          </svg>
          {showMobileActivePanel && activePanelAnnotation ? (
            <div
              ref={setActivePanelRef}
              className={`${styles.mobileSurfacePanel} ${placement.compactPanel ? styles.mobileSurfacePanelCompact : ''}`}
              data-guide-active-panel="true"
              data-guide-active-step={activePanelAnnotation.annotation.order}
              style={calloutStyle}
            >
              <CanvasGuideCallout
                annotation={surfaceAnnotation.annotation}
                calloutRef={setCalloutRef}
                className={styles.mobileSurfaceBadge}
                collapsed
                controlsCopy={copy.controls}
                draggable={false}
                guidePosition={visiblePositions.get(surfaceAnnotation.annotation.id) ?? 1}
                guideSize={visibleAnnotations.length}
                onActivate={() => guide.focusAnnotation(surfaceAnnotation.annotation.id)}
                onCollapse={() => presentation.collapseAnnotation(surfaceAnnotation.annotation.id)}
                onDelete={() => guide.deleteAnnotation(surfaceAnnotation.annotation.id)}
                stepCopy={surfaceAnnotation.stepCopy}
                surface
              />
              <div className={styles.annotationCopy} aria-atomic="true" aria-live="polite">
                <strong>{activePanelAnnotation.stepCopy.title}</strong>
                <p>{activePanelAnnotation.stepCopy.body}</p>
              </div>
            </div>
          ) : (
            <CanvasGuideCallout
              annotation={surfaceAnnotation.annotation}
              activeStep={surfaceAnnotation.annotation.order}
              calloutRef={setCalloutRef}
              className={styles.surfaceCallout}
              collapsed={placement.collapsed}
              controlsCopy={copy.controls}
              draggable={false}
              guidePosition={visiblePositions.get(surfaceAnnotation.annotation.id) ?? 1}
              guideSize={visibleAnnotations.length}
              onActivate={() => guide.focusAnnotation(surfaceAnnotation.annotation.id)}
              onCollapse={() => presentation.collapseAnnotation(surfaceAnnotation.annotation.id)}
              onDelete={() => guide.deleteAnnotation(surfaceAnnotation.annotation.id)}
              stepCopy={surfaceAnnotation.stepCopy}
              style={calloutStyle}
              surface
            />
          )}
        </>
      )}
      {guide.state.hidden ? null : (
        <ol
          className={styles.screenReaderGuide}
          aria-label={copy.controls.listLabel}
          data-studio-guide-list="true"
        >
          {visibleAnnotations.map(({ annotation, stepCopy }) => (
            <li key={annotation.id}>{`${stepCopy.title}. ${stepCopy.body}`}</li>
          ))}
        </ol>
      )}
    </div>
  );
}
