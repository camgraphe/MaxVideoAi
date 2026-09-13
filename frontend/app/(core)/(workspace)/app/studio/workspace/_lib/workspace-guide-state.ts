import type { XYPosition } from '@xyflow/react';
import type {
  WorkspaceCanvasGuideState,
  WorkspaceGraphNode,
  WorkspaceGuideAnchor,
  WorkspaceGuideAnnotation,
  WorkspaceGuideCopyKey,
  WorkspaceGuidePlacement,
  WorkspaceProjectStarterTemplateId,
  WorkspaceTemplate,
} from './workspace-types';

const WORKSPACE_GUIDE_TEMPLATE_IDS = new Set<WorkspaceProjectStarterTemplateId>([
  'guided-product-ad',
  'guided-storyboard-to-video',
  'guided-cinematic-scene',
]);

const WORKSPACE_GUIDE_COPY_KEYS = new Set<WorkspaceGuideCopyKey>([
  'guided-product-ad:reference',
  'guided-product-ad:prompt',
  'guided-product-ad:generate',
  'guided-product-ad:output',
  'guided-product-ad:timeline',
  'guided-storyboard-to-video:reference',
  'guided-storyboard-to-video:prompt',
  'guided-storyboard-to-video:generate',
  'guided-storyboard-to-video:output',
  'guided-storyboard-to-video:timeline',
  'guided-cinematic-scene:reference',
  'guided-cinematic-scene:prompt',
  'guided-cinematic-scene:generate',
  'guided-cinematic-scene:output',
  'guided-cinematic-scene:timeline',
]);

const WORKSPACE_GUIDE_PLACEMENTS = new Set<WorkspaceGuidePlacement>([
  'top',
  'right',
  'bottom',
  'left',
]);

const WORKSPACE_GUIDE_NODE_TARGETS = new Set<NonNullable<Extract<WorkspaceGuideAnchor, { kind: 'node' }>['target']>>([
  'header',
  'body',
  'action',
  'input-port',
  'output-port',
]);

export const EMPTY_WORKSPACE_CANVAS_GUIDE_STATE: WorkspaceCanvasGuideState = {
  annotations: [],
  hidden: false,
};

export function createEmptyWorkspaceCanvasGuideState(): WorkspaceCanvasGuideState {
  return {
    annotations: [],
    hidden: false,
  };
}

function isWorkspaceProjectStarterTemplateId(value: unknown): value is WorkspaceProjectStarterTemplateId {
  return typeof value === 'string' && WORKSPACE_GUIDE_TEMPLATE_IDS.has(value as WorkspaceProjectStarterTemplateId);
}

function isFinitePosition(value: unknown): value is XYPosition {
  return Boolean(
    value &&
    typeof value === 'object' &&
    typeof (value as XYPosition).x === 'number' &&
    Number.isFinite((value as XYPosition).x) &&
    typeof (value as XYPosition).y === 'number' &&
    Number.isFinite((value as XYPosition).y)
  );
}

function normalizeWorkspaceGuideAnchor(value: unknown): WorkspaceGuideAnchor | null {
  if (!value || typeof value !== 'object') return null;
  const anchor = value as Partial<WorkspaceGuideAnchor>;

  if (anchor.kind === 'node') {
    if (typeof anchor.nodeId !== 'string' || !anchor.nodeId.trim()) return null;
    if (anchor.target !== undefined && !WORKSPACE_GUIDE_NODE_TARGETS.has(anchor.target)) return null;
    return {
      kind: 'node',
      nodeId: anchor.nodeId.trim(),
      ...(anchor.target ? { target: anchor.target } : {}),
    };
  }

  if (anchor.kind === 'generated-output') {
    if (typeof anchor.sourceNodeId !== 'string' || !anchor.sourceNodeId.trim()) return null;
    return { kind: 'generated-output', sourceNodeId: anchor.sourceNodeId.trim() };
  }

  if (anchor.kind === 'surface' && (anchor.surface === 'viewer-tab' || anchor.surface === 'timeline')) {
    return { kind: 'surface', surface: anchor.surface };
  }

  return null;
}

function normalizeWorkspaceGuideAnnotation(value: unknown): WorkspaceGuideAnnotation | null {
  if (!value || typeof value !== 'object') return null;
  const annotation = value as Partial<WorkspaceGuideAnnotation>;
  if (typeof annotation.id !== 'string' || !annotation.id.trim()) return null;
  if (typeof annotation.order !== 'number' || !Number.isFinite(annotation.order) || annotation.order < 0) return null;
  if (typeof annotation.copyKey !== 'string' || !WORKSPACE_GUIDE_COPY_KEYS.has(annotation.copyKey as WorkspaceGuideCopyKey)) return null;
  if (typeof annotation.preferredPlacement !== 'string' || !WORKSPACE_GUIDE_PLACEMENTS.has(annotation.preferredPlacement as WorkspaceGuidePlacement)) return null;
  if (!isWorkspaceProjectStarterTemplateId(annotation.originTemplateId)) return null;
  if (!annotation.copyKey.startsWith(`${annotation.originTemplateId}:`)) return null;
  const anchor = normalizeWorkspaceGuideAnchor(annotation.anchor);
  if (!anchor) return null;
  if (annotation.manualPosition !== undefined && !isFinitePosition(annotation.manualPosition)) return null;

  return {
    id: annotation.id.trim(),
    order: annotation.order,
    copyKey: annotation.copyKey as WorkspaceGuideCopyKey,
    anchor,
    preferredPlacement: annotation.preferredPlacement as WorkspaceGuidePlacement,
    ...(annotation.manualPosition
      ? { manualPosition: { x: annotation.manualPosition.x, y: annotation.manualPosition.y } }
      : {}),
    originTemplateId: annotation.originTemplateId,
  };
}

function cloneWorkspaceGuideAnnotation(annotation: WorkspaceGuideAnnotation): WorkspaceGuideAnnotation {
  return {
    ...annotation,
    anchor: { ...annotation.anchor },
    ...(annotation.manualPosition
      ? { manualPosition: { x: annotation.manualPosition.x, y: annotation.manualPosition.y } }
      : {}),
  };
}

function cloneWorkspaceGuideAnnotationWithoutManualPosition(
  annotation: WorkspaceGuideAnnotation,
): WorkspaceGuideAnnotation {
  const cloned = cloneWorkspaceGuideAnnotation(annotation);
  delete cloned.manualPosition;
  return cloned;
}

function sortWorkspaceGuideAnnotations(annotations: WorkspaceGuideAnnotation[]): WorkspaceGuideAnnotation[] {
  return [...annotations].sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));
}

function canKeepWorkspaceGuideAnchor(anchor: WorkspaceGuideAnchor, nodeIds: Set<string>): boolean {
  if (anchor.kind === 'surface') return true;
  return nodeIds.has(anchor.kind === 'node' ? anchor.nodeId : anchor.sourceNodeId);
}

function normalizeWorkspaceGuideStateShape(value: unknown): WorkspaceCanvasGuideState {
  if (!value || typeof value !== 'object') return createEmptyWorkspaceCanvasGuideState();
  const state = value as Partial<WorkspaceCanvasGuideState>;
  return {
    annotations: Array.isArray(state.annotations)
      ? state.annotations
          .map(normalizeWorkspaceGuideAnnotation)
          .filter((annotation): annotation is WorkspaceGuideAnnotation => Boolean(annotation))
      : [],
    hidden: state.hidden === true,
    ...(isWorkspaceProjectStarterTemplateId(state.sourceTemplateId)
      ? { sourceTemplateId: state.sourceTemplateId }
      : {}),
  };
}

export function createWorkspaceCanvasGuideState(
  template: Pick<WorkspaceTemplate, 'id' | 'guideAnnotations'>,
): WorkspaceCanvasGuideState {
  return {
    annotations: sortWorkspaceGuideAnnotations(
      (template.guideAnnotations ?? []).map(cloneWorkspaceGuideAnnotation),
    ),
    hidden: false,
    ...(isWorkspaceProjectStarterTemplateId(template.id) ? { sourceTemplateId: template.id } : {}),
  };
}

export function normalizeWorkspaceCanvasGuideState(
  value: unknown,
  nodes: WorkspaceGraphNode[],
): WorkspaceCanvasGuideState {
  const state = normalizeWorkspaceGuideStateShape(value);
  const nodeIds = new Set(nodes.map((node) => node.id));
  return {
    annotations: sortWorkspaceGuideAnnotations(
      state.annotations
        .filter((annotation) => canKeepWorkspaceGuideAnchor(annotation.anchor, nodeIds))
        .map(cloneWorkspaceGuideAnnotation),
    ),
    hidden: state.hidden,
    ...(state.sourceTemplateId ? { sourceTemplateId: state.sourceTemplateId } : {}),
  };
}

export function reconcileWorkspaceCanvasGuideState(
  state: WorkspaceCanvasGuideState,
  nodes: WorkspaceGraphNode[],
): WorkspaceCanvasGuideState {
  return normalizeWorkspaceCanvasGuideState(state, nodes);
}

export function deleteWorkspaceGuideAnnotation(
  state: WorkspaceCanvasGuideState,
  annotationId: string,
): WorkspaceCanvasGuideState {
  return {
    annotations: sortWorkspaceGuideAnnotations(
      state.annotations
        .filter((annotation) => annotation.id !== annotationId)
        .map(cloneWorkspaceGuideAnnotation),
    ),
    hidden: state.hidden,
    ...(state.sourceTemplateId ? { sourceTemplateId: state.sourceTemplateId } : {}),
  };
}

export function deleteAllWorkspaceGuideAnnotations(
  state: WorkspaceCanvasGuideState,
): WorkspaceCanvasGuideState {
  return {
    annotations: [],
    hidden: state.hidden,
    ...(state.sourceTemplateId ? { sourceTemplateId: state.sourceTemplateId } : {}),
  };
}

export function moveWorkspaceGuideAnnotation(
  state: WorkspaceCanvasGuideState,
  annotationId: string,
  manualPosition: XYPosition,
): WorkspaceCanvasGuideState {
  const position = isFinitePosition(manualPosition)
    ? { x: manualPosition.x, y: manualPosition.y }
    : null;
  return {
    annotations: sortWorkspaceGuideAnnotations(
      state.annotations.map((annotation) => {
        if (annotation.id !== annotationId || !position) return cloneWorkspaceGuideAnnotation(annotation);
        return { ...cloneWorkspaceGuideAnnotation(annotation), manualPosition: position };
      }),
    ),
    hidden: state.hidden,
    ...(state.sourceTemplateId ? { sourceTemplateId: state.sourceTemplateId } : {}),
  };
}

export function resetWorkspaceCanvasGuideState(
  state: WorkspaceCanvasGuideState,
  canonicalState: WorkspaceCanvasGuideState,
  nodes: WorkspaceGraphNode[],
): WorkspaceCanvasGuideState {
  const resetState: WorkspaceCanvasGuideState = {
    annotations: canonicalState.annotations.map(cloneWorkspaceGuideAnnotationWithoutManualPosition),
    hidden: state.hidden,
    ...(canonicalState.sourceTemplateId || state.sourceTemplateId
      ? { sourceTemplateId: canonicalState.sourceTemplateId ?? state.sourceTemplateId }
      : {}),
  };
  return reconcileWorkspaceCanvasGuideState(resetState, nodes);
}
