'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { XYPosition } from '@xyflow/react';
import type { AppLocale } from '@/i18n/locales';
import {
  dispatchWorkspaceGuideAnalytics,
  workspaceGuideViewportClass,
  type WorkspaceGuideAnalyticsEvent,
} from '../_lib/workspace-guide-analytics';
import {
  createWorkspaceCanvasGuideState,
  deleteAllWorkspaceGuideAnnotations,
  deleteWorkspaceGuideAnnotation,
  moveWorkspaceGuideAnnotation,
  resetWorkspaceCanvasGuideState,
} from '../_lib/workspace-guide-state';
import { createStarterWorkspaceTemplate } from '../_lib/workspace-templates';
import type {
  WorkspaceCanvasGuideState,
  WorkspaceGraphNode,
  WorkspaceGuideFocusRequest,
  WorkspaceGuideStepId,
  WorkspaceTimelineItem,
} from '../_lib/workspace-types';
import type { CommitCanvasGuideState } from './useWorkspaceCanvasHistory';
import type { Dispatch, SetStateAction } from 'react';

export function useWorkspaceCanvasGuideController(params: {
  activeCanvasId: string;
  commitCanvasGuideState: CommitCanvasGuideState;
  guideState: WorkspaceCanvasGuideState;
  locale: AppLocale;
  nodes: WorkspaceGraphNode[];
  setGuideState: Dispatch<SetStateAction<WorkspaceCanvasGuideState>>;
  setGuideFocusRequest: Dispatch<SetStateAction<WorkspaceGuideFocusRequest | null>>;
  timelineItems: WorkspaceTimelineItem[];
}): {
  deleteAnnotation: (annotationId: string) => void;
  deleteAllAnnotations: () => void;
  consumeFocusRequest: (requestId: number) => void;
  focusAnnotation: (annotationId: string) => void;
  moveAnnotation: (annotationId: string, position: XYPosition) => void;
  resetAnnotations: () => void;
  setHidden: (hidden: boolean) => void;
} {
  const {
    activeCanvasId,
    commitCanvasGuideState,
    guideState,
    locale,
    nodes,
    setGuideFocusRequest,
    setGuideState,
    timelineItems,
  } = params;
  const latestFocusRequestIdRef = useRef(0);
  const starterOpenedAtRef = useRef(new Map<string, number>());
  const startedKeysRef = useRef(new Set<string>());
  const milestonesRef = useRef(new Map<string, {
    generationCompleted: boolean;
    outputNodeId?: string;
    timelineInsertCompleted: boolean;
  }>());
  const sourceTemplateId = guideState.sourceTemplateId;
  const analyticsKey = sourceTemplateId ? `${activeCanvasId}:${sourceTemplateId}` : null;
  const guidedSourceShotIds = useMemo(() => {
    if (!sourceTemplateId) return new Set<string>();
    const template = createStarterWorkspaceTemplate(sourceTemplateId);
    return new Set((template.guideAnnotations ?? []).flatMap((annotation) => (
      annotation.anchor.kind === 'generated-output' ? [annotation.anchor.sourceNodeId] : []
    )));
  }, [sourceTemplateId]);

  const dispatchGuideAnalytics = useCallback((
    event: WorkspaceGuideAnalyticsEvent,
    stepId: WorkspaceGuideStepId | 'all'
  ) => {
    if (!analyticsKey || !sourceTemplateId) return;
    const now = Date.now();
    const openedAt = starterOpenedAtRef.current.get(analyticsKey) ?? now;
    starterOpenedAtRef.current.set(analyticsKey, openedAt);
    const viewportClass = workspaceGuideViewportClass(
      typeof window === 'undefined' ? 0 : window.innerWidth
    );
    dispatchWorkspaceGuideAnalytics(event, {
      templateId: sourceTemplateId,
      stepId,
      elapsedMs: now - openedAt,
      locale,
      viewportClass,
    });
  }, [analyticsKey, locale, sourceTemplateId]);

  const stepIdForAnnotation = useCallback((annotationId: string): WorkspaceGuideStepId | null => {
    const copyKey = guideState.annotations.find((annotation) => annotation.id === annotationId)?.copyKey;
    if (!copyKey) return null;
    const stepId = copyKey.slice(copyKey.lastIndexOf(':') + 1);
    if (
      stepId === 'reference' ||
      stepId === 'prompt' ||
      stepId === 'generate' ||
      stepId === 'output' ||
      stepId === 'timeline'
    ) {
      return stepId;
    }
    return null;
  }, [guideState.annotations]);

  useEffect(() => {
    if (!analyticsKey || !sourceTemplateId || startedKeysRef.current.has(analyticsKey)) return;
    const now = Date.now();
    starterOpenedAtRef.current.set(analyticsKey, now);
    startedKeysRef.current.add(analyticsKey);
    const viewportClass = workspaceGuideViewportClass(
      typeof window === 'undefined' ? 0 : window.innerWidth
    );
    dispatchWorkspaceGuideAnalytics('studio_guided_template_started', {
      templateId: sourceTemplateId,
      stepId: 'all',
      elapsedMs: 0,
      locale,
      viewportClass,
    });
  }, [analyticsKey, locale, sourceTemplateId]);

  useEffect(() => {
    if (!analyticsKey || !sourceTemplateId || guidedSourceShotIds.size === 0) return;
    const progress = milestonesRef.current.get(analyticsKey) ?? {
      generationCompleted: false,
      timelineInsertCompleted: false,
    };
    milestonesRef.current.set(analyticsKey, progress);

    if (!progress.generationCompleted) {
      const readyOutput = nodes.find((node) => (
        node.data.kind === 'output' &&
        node.data.output?.status === 'ready' &&
        guidedSourceShotIds.has(node.data.output.sourceShotId)
      ));
      if (readyOutput) {
        progress.generationCompleted = true;
        progress.outputNodeId = readyOutput.id;
        dispatchGuideAnalytics('studio_first_generation_completed', 'output');
      }
    }

    if (
      progress.generationCompleted &&
      !progress.timelineInsertCompleted &&
      progress.outputNodeId &&
      timelineItems.some((item) => item.outputNodeId === progress.outputNodeId)
    ) {
      progress.timelineInsertCompleted = true;
      dispatchGuideAnalytics('studio_first_timeline_insert_completed', 'timeline');
    }
  }, [analyticsKey, dispatchGuideAnalytics, guidedSourceShotIds, nodes, sourceTemplateId, timelineItems]);

  const deleteAnnotation = useCallback((annotationId: string) => {
    const stepId = stepIdForAnnotation(annotationId);
    commitCanvasGuideState((current) => deleteWorkspaceGuideAnnotation(current, annotationId));
    if (stepId) dispatchGuideAnalytics('studio_guide_annotation_deleted', stepId);
  }, [commitCanvasGuideState, dispatchGuideAnalytics, stepIdForAnnotation]);

  const deleteAllAnnotations = useCallback(() => {
    commitCanvasGuideState(deleteAllWorkspaceGuideAnnotations);
    dispatchGuideAnalytics('studio_guide_all_deleted', 'all');
  }, [commitCanvasGuideState, dispatchGuideAnalytics]);

  const focusAnnotation = useCallback((annotationId: string) => {
    const stepId = stepIdForAnnotation(annotationId);
    setGuideFocusRequest((current) => {
      const requestId = Math.max(latestFocusRequestIdRef.current, current?.requestId ?? 0) + 1;
      latestFocusRequestIdRef.current = requestId;
      return { annotationId, requestId };
    });
    if (stepId) dispatchGuideAnalytics('studio_guide_step_focused', stepId);
  }, [dispatchGuideAnalytics, setGuideFocusRequest, stepIdForAnnotation]);

  const consumeFocusRequest = useCallback((requestId: number) => {
    setGuideFocusRequest((current) => current?.requestId === requestId ? null : current);
  }, [setGuideFocusRequest]);

  const moveAnnotation = useCallback((annotationId: string, position: XYPosition) => {
    commitCanvasGuideState(
      (current) => moveWorkspaceGuideAnnotation(current, annotationId, position),
      { gesture: true },
    );
  }, [commitCanvasGuideState]);

  const resetAnnotations = useCallback(() => {
    if (!guideState.sourceTemplateId) return;
    const template = createStarterWorkspaceTemplate(guideState.sourceTemplateId);
    const canonicalState = createWorkspaceCanvasGuideState(template);
    commitCanvasGuideState((current) => resetWorkspaceCanvasGuideState(current, canonicalState, nodes));
    dispatchGuideAnalytics('studio_guide_reset', 'all');
  }, [commitCanvasGuideState, dispatchGuideAnalytics, guideState.sourceTemplateId, nodes]);

  const setHidden = useCallback((hidden: boolean) => {
    setGuideState((current) => current.hidden === hidden ? current : { ...current, hidden });
    if (hidden && !guideState.hidden) dispatchGuideAnalytics('studio_guide_hidden', 'all');
  }, [dispatchGuideAnalytics, guideState.hidden, setGuideState]);

  return {
    deleteAnnotation,
    deleteAllAnnotations,
    consumeFocusRequest,
    focusAnnotation,
    moveAnnotation,
    resetAnnotations,
    setHidden,
  };
}
