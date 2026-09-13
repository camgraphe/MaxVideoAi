'use client';

import type { XYPosition } from '@xyflow/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { WorkspaceGuideRect } from '../_lib/workspace-guide-layout';
import type {
  WorkspaceCanvasGuideState,
  WorkspaceGuideFocusRequest,
} from '../_lib/workspace-types';

const STUDIO_MOBILE_QUERY = '(max-width: 1120px)';

export type WorkspaceGuideController = {
  state: WorkspaceCanvasGuideState;
  focusRequest: WorkspaceGuideFocusRequest | null;
  consumeFocusRequest: (requestId: number) => void;
  deleteAnnotation: (annotationId: string) => void;
  deleteAllAnnotations: () => void;
  focusAnnotation: (annotationId: string) => void;
  moveAnnotation: (annotationId: string, position: XYPosition) => void;
  resetAnnotations: () => void;
  setHidden: (hidden: boolean) => void;
};

export type WorkspaceGuideFocusConsumer = 'canvas' | 'surface';

export type WorkspaceGuideFocusActivation = WorkspaceGuideFocusRequest & {
  pendingConsumers: readonly WorkspaceGuideFocusConsumer[];
};

export type WorkspaceGuidePresentationController = {
  activeAnnotationId: string | null;
  canvasProtectedRects: readonly WorkspaceGuideRect[];
  collapseAnnotation: (annotationId: string) => void;
  consumeFocusActivation: (requestId: number, consumer: WorkspaceGuideFocusConsumer) => void;
  expandedAnnotationId: string | null;
  focusActivation: WorkspaceGuideFocusActivation | null;
  isMobile: boolean;
  reportCanvasProtectedRects: (rects: readonly WorkspaceGuideRect[]) => void;
  reportSurfaceRect: (rect: WorkspaceGuideRect | null) => void;
  surfaceRect: WorkspaceGuideRect | null;
};

function rectEqual(left: WorkspaceGuideRect, right: WorkspaceGuideRect): boolean {
  return left.x === right.x
    && left.y === right.y
    && left.width === right.width
    && left.height === right.height;
}

function rectListEqual(left: readonly WorkspaceGuideRect[], right: readonly WorkspaceGuideRect[]): boolean {
  return left.length === right.length && left.every((rect, index) => {
    const candidate = right[index];
    return Boolean(candidate) && rectEqual(rect, candidate!);
  });
}

function defaultActiveAnnotationId(state: WorkspaceCanvasGuideState): string | null {
  const ordered = [...state.annotations].sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));
  return ordered.find((annotation) => annotation.anchor.kind === 'surface')?.id ?? ordered[0]?.id ?? null;
}

export function useWorkspaceGuidePresentationController(
  guide: WorkspaceGuideController,
): WorkspaceGuidePresentationController {
  const [isMobile, setIsMobile] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia(STUDIO_MOBILE_QUERY).matches
  ));
  const [activeAnnotationId, setActiveAnnotationId] = useState<string | null>(() => (
    defaultActiveAnnotationId(guide.state)
  ));
  const [explicitExpandedAnnotationId, setExplicitExpandedAnnotationId] = useState<string | null>(null);
  const [focusActivation, setFocusActivation] = useState<WorkspaceGuideFocusActivation | null>(null);
  const [canvasProtectedRects, setCanvasProtectedRects] = useState<readonly WorkspaceGuideRect[]>([]);
  const [surfaceRect, setSurfaceRect] = useState<WorkspaceGuideRect | null>(null);
  const handledRequestIdRef = useRef(0);

  useEffect(() => {
    const media = window.matchMedia(STUDIO_MOBILE_QUERY);
    const handleChange = () => setIsMobile(media.matches);
    handleChange();
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    const request = guide.focusRequest;
    if (!request || request.requestId <= handledRequestIdRef.current) return;
    handledRequestIdRef.current = request.requestId;
    const annotation = guide.state.annotations.find((candidate) => candidate.id === request.annotationId);
    guide.consumeFocusRequest(request.requestId);
    if (!annotation) return;

    setActiveAnnotationId(annotation.id);
    setExplicitExpandedAnnotationId(annotation.id);
    setFocusActivation({
      ...request,
      pendingConsumers: annotation.anchor.kind === 'surface'
        ? ['surface']
        : isMobile
          ? ['canvas', 'surface']
          : ['canvas'],
    });
  }, [guide, guide.focusRequest?.requestId, isMobile]);

  useEffect(() => {
    const annotationIds = new Set(guide.state.annotations.map((annotation) => annotation.id));
    setActiveAnnotationId((current) => current && annotationIds.has(current)
      ? current
      : defaultActiveAnnotationId(guide.state));
    setExplicitExpandedAnnotationId((current) => current && annotationIds.has(current) ? current : null);
    setFocusActivation((current) => current && annotationIds.has(current.annotationId) ? current : null);
  }, [guide.state]);

  const consumeFocusActivation = useCallback((requestId: number, consumer: WorkspaceGuideFocusConsumer) => {
    setFocusActivation((current) => {
      if (!current || current.requestId !== requestId || !current.pendingConsumers.includes(consumer)) return current;
      const pendingConsumers = current.pendingConsumers.filter((candidate) => candidate !== consumer);
      return pendingConsumers.length ? { ...current, pendingConsumers } : null;
    });
  }, []);

  const collapseAnnotation = useCallback((annotationId: string) => {
    setExplicitExpandedAnnotationId((current) => current === annotationId ? null : current);
  }, []);

  const reportCanvasProtectedRects = useCallback((rects: readonly WorkspaceGuideRect[]) => {
    setCanvasProtectedRects((current) => rectListEqual(current, rects) ? current : [...rects]);
  }, []);

  const reportSurfaceRect = useCallback((rect: WorkspaceGuideRect | null) => {
    setSurfaceRect((current) => {
      if (current === null && rect === null) return current;
      if (current && rect && rectEqual(current, rect)) return current;
      return rect;
    });
  }, []);

  return useMemo(() => ({
    activeAnnotationId,
    canvasProtectedRects,
    collapseAnnotation,
    consumeFocusActivation,
    expandedAnnotationId: isMobile ? activeAnnotationId : explicitExpandedAnnotationId,
    focusActivation,
    isMobile,
    reportCanvasProtectedRects,
    reportSurfaceRect,
    surfaceRect,
  }), [
    activeAnnotationId,
    canvasProtectedRects,
    collapseAnnotation,
    consumeFocusActivation,
    explicitExpandedAnnotationId,
    focusActivation,
    isMobile,
    reportCanvasProtectedRects,
    reportSurfaceRect,
    surfaceRect,
  ]);
}
