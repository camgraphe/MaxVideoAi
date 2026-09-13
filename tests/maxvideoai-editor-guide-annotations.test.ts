import assert from 'node:assert/strict';
import test, { mock } from 'node:test';
import { createElement } from '../frontend/node_modules/react';
import { renderToStaticMarkup } from '../frontend/node_modules/react-dom/server';
import { mountHook } from './helpers/react-hook-harness';
import {
  WORKSPACE_TEMPLATE_SUMMARIES,
  createStarterWorkspaceTemplate,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-templates';
import { DEFAULT_WORKSPACE_PROJECT_SETTINGS } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-project-settings';
import {
  createWorkspaceCanvasGuideState,
  deleteAllWorkspaceGuideAnnotations,
  deleteWorkspaceGuideAnnotation,
  moveWorkspaceGuideAnnotation,
  normalizeWorkspaceCanvasGuideState,
  reconcileWorkspaceCanvasGuideState,
  resetWorkspaceCanvasGuideState,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-guide-state';
import {
  workspaceGuideAnalyticsPayload,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-guide-analytics';
import {
  findGuideGeneratedOutputNodeForShot,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-graph-helpers';
import {
  WORKSPACE_GUIDE_COMPACT_GAP,
  WORKSPACE_GUIDE_COMPACT_ZOOM,
  WORKSPACE_GUIDE_DESKTOP_GAP,
  WORKSPACE_GUIDE_LEADER_END_GAP,
  compactWorkspaceGuideAtZoom,
  expandWorkspaceGuideFitBounds,
  rectanglesIntersect,
  resolveWorkspaceGuidePlacement,
  selectWorkspaceGuideCandidate,
  workspaceGuideSegmentsIntersect,
  type WorkspaceGuidePlacementInput,
  type WorkspaceGuidePlacementResult,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-guide-layout';
import {
  normalizePersistedWorkspaceState,
  normalizeUserCanvasTemplate,
  normalizeUserCanvasTemplates,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_state/workspace-api-persistence';
import type {
  CanvasHistorySnapshot,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_state/workspace-state';
import {
  createWorkspaceCanvasHistoryController,
  type WorkspaceCanvasHistoryController,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceCanvasHistory';
import { useWorkspaceCanvasTemplateActions } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceCanvasTemplateActions';
import { useWorkspaceCanvasGuideViewport } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceCanvasGuideViewport';
import { useWorkspaceCanvasGuideController } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceCanvasGuideController';
import { DEFAULT_STUDIO_COPY } from '../frontend/app/(core)/(workspace)/app/studio/_lib/studio-copy';
import type {
  WorkspaceCanvasGuideState,
  WorkspaceGraphEdge,
  WorkspaceGraphNode,
  WorkspaceGuideFocusRequest,
  WorkspaceTemplateId,
  WorkspaceTimelineItem,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-types';
import type { SetStateAction } from 'react';
import type {
  WorkspaceUserCanvasTemplate,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_state/workspace-state';

const guidedIds = [
  'guided-product-ad',
  'guided-storyboard-to-video',
  'guided-cinematic-scene',
] as const;

test('guide analytics payload excludes prompt and media content', () => {
  const payload = workspaceGuideAnalyticsPayload({
    templateId: 'guided-product-ad',
    stepId: 'generate',
    elapsedMs: 12_000,
    locale: 'fr',
    viewportClass: 'compact',
  });
  assert.deepEqual(Object.keys(payload).sort(), ['elapsed_ms', 'locale', 'step_id', 'template_id', 'viewport_class']);
  assert.equal(payload.viewport_class, 'compact');
  assert.equal(JSON.stringify(payload).includes('prompt'), false);
});

type CapturedGuideAnalyticsEvent = {
  event: string;
  payload?: Record<string, string | number>;
};

function captureGuideAnalytics(run: (events: CapturedGuideAnalyticsEvent[]) => void) {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const events: CapturedGuideAnalyticsEvent[] = [];
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      innerWidth: 1440,
      localStorage: {
        getItem: () => 'granted',
      },
      dispatchEvent: (event: CustomEvent<CapturedGuideAnalyticsEvent>) => {
        events.push(event.detail);
        return true;
      },
    },
  });

  try {
    run(events);
  } finally {
    if (previousWindow) {
      Object.defineProperty(globalThis, 'window', previousWindow);
    } else {
      delete (globalThis as { window?: unknown }).window;
    }
  }
}

function guideOutputNode({
  attemptOrdinal,
  createdAt = '2026-07-15T00:00:00.000Z',
  id,
  outputIndex,
  sourceShotId,
  status,
}: {
  attemptOrdinal?: number;
  createdAt?: string;
  id: string;
  outputIndex?: number;
  sourceShotId: string;
  status: 'processing' | 'ready' | 'failed';
}): WorkspaceGraphNode {
  return {
    id,
    type: 'output',
    position: { x: 1200, y: 240 },
    data: {
      kind: 'output',
      title: 'Private generated output.mov',
      output: {
        kind: 'video',
        modelId: 'test-model',
        modelLabel: 'Test model',
        workflowType: 'text-to-video',
        status,
        attemptOrdinal,
        outputIndex,
        createdAt,
        sourceShotId,
        url: status === 'ready' ? 'https://private.example/generated.mp4' : null,
      },
    },
  };
}

function guideOutputEdge(source: string, target: string): WorkspaceGraphEdge {
  return {
    id: `edge-${source}-${target}`,
    source,
    target,
    sourceHandle: 'video',
    targetHandle: 'generated_output',
    data: { kind: 'generated_output' },
  };
}

test('result guidance resolves active processing, then the latest ready output by attempt chronology', () => {
  const shotId = 'shot-01';
  const failed = guideOutputNode({
    id: 'output-shot-01-4b5593b3f42d7643',
    sourceShotId: shotId,
    status: 'failed',
    attemptOrdinal: 1,
  });
  const olderReady = guideOutputNode({
    id: 'output-shot-01-0000000000000000',
    sourceShotId: shotId,
    status: 'ready',
    attemptOrdinal: 2,
  });
  const latestReady = guideOutputNode({
    id: 'output-shot-01-ffffffffffffffff',
    sourceShotId: shotId,
    status: 'ready',
    attemptOrdinal: 3,
  });
  const processing = guideOutputNode({
    id: 'output-shot-01-1111111111111111',
    sourceShotId: shotId,
    status: 'processing',
    attemptOrdinal: 4,
  });
  const nodes = [failed, olderReady, latestReady, processing];
  const edges = [failed, olderReady, latestReady, processing]
    .map((node) => guideOutputEdge(shotId, node.id))
    .sort((left, right) => left.target.localeCompare(right.target));

  assert.equal(
    findGuideGeneratedOutputNodeForShot(shotId, nodes, edges)?.id,
    processing.id,
    'an active processing attempt should own result guidance',
  );
  assert.equal(
    findGuideGeneratedOutputNodeForShot(shotId, nodes.filter((node) => node.id !== processing.id), edges)?.id,
    latestReady.id,
    'a recovered ready output should beat lexical edge ordering and all failed outputs',
  );
  const staleProcessing = guideOutputNode({
    id: 'output-shot-01-stale-processing',
    sourceShotId: shotId,
    status: 'processing',
    attemptOrdinal: 1,
  });
  assert.equal(
    findGuideGeneratedOutputNodeForShot(
      shotId,
      [staleProcessing, latestReady],
      [guideOutputEdge(shotId, staleProcessing.id), guideOutputEdge(shotId, latestReady.id)],
    )?.id,
    latestReady.id,
    'processing should only win while it belongs to the newest attempt',
  );
  assert.equal(
    findGuideGeneratedOutputNodeForShot(shotId, [failed], edges)?.id,
    failed.id,
    'the latest failure should remain focusable when no processing or ready output exists',
  );

  const firstReady = guideOutputNode({
    id: 'output-shot-01-ready-0',
    sourceShotId: shotId,
    status: 'ready',
    attemptOrdinal: 5,
    outputIndex: 0,
  });
  const secondReady = guideOutputNode({
    id: 'output-shot-01-ready-1',
    sourceShotId: shotId,
    status: 'ready',
    attemptOrdinal: 5,
    outputIndex: 1,
  });
  const firstFailedRetry = guideOutputNode({
    id: 'output-shot-01-failed-retry-0',
    sourceShotId: shotId,
    status: 'failed',
    attemptOrdinal: 6,
    outputIndex: 0,
  });
  const secondFailedRetry = guideOutputNode({
    id: 'output-shot-01-failed-retry-1',
    sourceShotId: shotId,
    status: 'failed',
    attemptOrdinal: 6,
    outputIndex: 1,
  });
  const retryNodes = [firstReady, secondReady, firstFailedRetry, secondFailedRetry];
  assert.equal(
    findGuideGeneratedOutputNodeForShot(
      shotId,
      retryNodes,
      retryNodes.map((node) => guideOutputEdge(shotId, node.id)),
    )?.id,
    firstFailedRetry.id,
    'result guidance should stay within the newest failed retry instead of targeting an older success',
  );
});

function guideTimelineItem(outputNodeId: string): WorkspaceTimelineItem {
  return {
    id: `timeline-${outputNodeId}`,
    outputNodeId,
    track: 'video',
    title: 'Private timeline item',
    durationSec: 5,
    startSec: 0,
  };
}

test('guide interactions dispatch sanitized consent-aware analytics', () => {
  captureGuideAnalytics((events) => {
    const template = createStarterWorkspaceTemplate('guided-product-ad');
    const guideState = createWorkspaceCanvasGuideState(template);
    let request: WorkspaceGuideFocusRequest | null = null;
    const mounted = mountHook(useWorkspaceCanvasGuideController, {
      activeCanvasId: 'canvas-a',
      commitCanvasGuideState: () => undefined,
      guideState,
      locale: 'fr',
      nodes: template.nodes,
      setGuideFocusRequest: (next: SetStateAction<WorkspaceGuideFocusRequest | null>) => {
        request = typeof next === 'function' ? next(request) : next;
      },
      setGuideState: () => undefined,
      timelineItems: [],
    });
    const focused = guideState.annotations.find((annotation) => annotation.copyKey.endsWith(':generate'))!;
    const deleted = guideState.annotations.find((annotation) => annotation.copyKey.endsWith(':prompt'))!;

    mounted.current().focusAnnotation(focused.id);
    mounted.current().deleteAnnotation(deleted.id);
    mounted.current().deleteAllAnnotations();
    mounted.current().resetAnnotations();
    mounted.current().setHidden(true);

    assert.deepEqual(events.map(({ event }) => event), [
      'studio_guided_template_started',
      'studio_guide_step_focused',
      'studio_guide_annotation_deleted',
      'studio_guide_all_deleted',
      'studio_guide_reset',
      'studio_guide_hidden',
    ]);
    assert.deepEqual(events.map(({ payload }) => payload?.step_id), ['all', 'generate', 'prompt', 'all', 'all', 'all']);
    for (const { payload } of events) {
      assert.deepEqual(Object.keys(payload ?? {}).sort(), ['elapsed_ms', 'locale', 'step_id', 'template_id', 'viewport_class']);
      assert.equal(payload?.viewport_class, 'desktop');
      assert.equal(JSON.stringify(payload).includes('Private'), false);
    }
    mounted.unmount();
  });
});

test('guide milestones require a ready guided output and its matching timeline insertion once per canvas key', () => {
  captureGuideAnalytics((events) => {
    const template = createStarterWorkspaceTemplate('guided-product-ad');
    const guideState = createWorkspaceCanvasGuideState(template);
    const baseParams = {
      activeCanvasId: 'canvas-a',
      commitCanvasGuideState: () => undefined,
      guideState,
      locale: 'en' as const,
      nodes: template.nodes,
      setGuideFocusRequest: () => undefined,
      setGuideState: () => undefined,
      timelineItems: [] as WorkspaceTimelineItem[],
    };
    const mounted = mountHook(useWorkspaceCanvasGuideController, baseParams);
    const pending = guideOutputNode({ id: 'guided-pending', sourceShotId: 'shot-01', status: 'processing' });
    const failed = guideOutputNode({ id: 'guided-failed', sourceShotId: 'shot-01', status: 'failed' });
    const unrelated = guideOutputNode({ id: 'unrelated-ready', sourceShotId: 'other-shot', status: 'ready' });
    const ready = guideOutputNode({ id: 'guided-ready', sourceShotId: 'shot-01', status: 'ready' });

    mounted.rerender({
      ...baseParams,
      nodes: [...template.nodes, pending, failed, unrelated],
      timelineItems: [guideTimelineItem('unrelated-ready')],
    });
    assert.equal(events.some(({ event }) => event === 'studio_first_generation_completed'), false);
    assert.equal(events.some(({ event }) => event === 'studio_first_timeline_insert_completed'), false);

    const readyParams = {
      ...baseParams,
      nodes: [...template.nodes, ready],
      timelineItems: [guideTimelineItem('unrelated-ready')],
    };
    mounted.rerender(readyParams);
    mounted.rerender(readyParams);
    assert.equal(events.filter(({ event }) => event === 'studio_first_generation_completed').length, 1);
    assert.equal(events.filter(({ event }) => event === 'studio_first_timeline_insert_completed').length, 0);

    const insertedParams = {
      ...readyParams,
      timelineItems: [guideTimelineItem('unrelated-ready'), guideTimelineItem('guided-ready')],
    };
    mounted.rerender(insertedParams);
    mounted.rerender(insertedParams);
    assert.equal(events.filter(({ event }) => event === 'studio_first_generation_completed').length, 1);
    assert.equal(events.filter(({ event }) => event === 'studio_first_timeline_insert_completed').length, 1);

    mounted.rerender({ ...insertedParams, activeCanvasId: 'canvas-b' });
    assert.equal(events.filter(({ event }) => event === 'studio_guided_template_started').length, 2);
    assert.equal(events.filter(({ event }) => event === 'studio_first_generation_completed').length, 2);
    assert.equal(events.filter(({ event }) => event === 'studio_first_timeline_insert_completed').length, 2);
    mounted.unmount();
  });
});

test('guide focus requests use monotonic IDs', () => {
  const template = createStarterWorkspaceTemplate('guided-storyboard-to-video');
  const guideState = createWorkspaceCanvasGuideState(template);
  let request: WorkspaceGuideFocusRequest | null = null;
  const mounted = mountHook(useWorkspaceCanvasGuideController, {
    activeCanvasId: 'starter',
    commitCanvasGuideState: () => undefined,
    guideState,
    locale: 'en',
    nodes: template.nodes,
    setGuideFocusRequest: (next: SetStateAction<WorkspaceGuideFocusRequest | null>) => {
      request = typeof next === 'function' ? next(request) : next;
    },
    setGuideState: () => undefined,
    timelineItems: [],
  });

  mounted.current().focusAnnotation(guideState.annotations[0]!.id);
  const firstRequestId = (request as unknown as { requestId?: number } | null)?.requestId;
  mounted.current().focusAnnotation(guideState.annotations[2]!.id);
  const secondRequestId = (request as unknown as { requestId?: number } | null)?.requestId;

  assert.equal(firstRequestId, 1);
  assert.equal(secondRequestId, 2);
});

test('guide viewport memory is isolated by canvas source and revision', () => {
  const initialParams = {
    activeTemplateId: 'guided-storyboard-to-video' as const,
    activeUserCanvasTemplateId: null,
    canvasRevision: 3,
    sourceTemplateId: 'guided-storyboard-to-video' as const,
  };
  const mounted = mountHook(useWorkspaceCanvasGuideViewport, initialParams);
  const viewport = { x: 120, y: -48, zoom: 0.54 };

  assert.equal(mounted.current().initialFit.isCompleted(), false);
  assert.equal(mounted.current().initialViewport, null);
  mounted.current().initialFit.markCompleted();
  mounted.current().onViewportChange(viewport);
  mounted.rerender(initialParams);
  assert.equal(mounted.current().initialFit.isCompleted(), true);
  assert.deepEqual(mounted.current().initialViewport, viewport);

  mounted.rerender({ ...initialParams, canvasRevision: 4 });
  assert.equal(mounted.current().initialFit.isCompleted(), false);
  assert.equal(mounted.current().initialViewport, null);

  mounted.rerender({
    ...initialParams,
    activeTemplateId: 'guided-product-ad',
    sourceTemplateId: 'guided-product-ad',
  });
  assert.equal(mounted.current().initialFit.isCompleted(), false);
  assert.equal(mounted.current().initialViewport, null);
});

function expectedGuideAnnotations(templateId: (typeof guidedIds)[number]) {
  return [
    {
      id: `${templateId}-guide-reference`,
      order: 1,
      copyKey: `${templateId}:reference`,
      anchor: { kind: 'node', nodeId: 'asset-product-image', target: 'body' },
      preferredPlacement: 'top',
      originTemplateId: templateId,
    },
    {
      id: `${templateId}-guide-prompt`,
      order: 2,
      copyKey: `${templateId}:prompt`,
      anchor: { kind: 'node', nodeId: 'prompt-product-ad', target: 'body' },
      preferredPlacement: 'top',
      originTemplateId: templateId,
    },
    {
      id: `${templateId}-guide-generate`,
      order: 3,
      copyKey: `${templateId}:generate`,
      anchor: { kind: 'node', nodeId: 'shot-01', target: 'action' },
      preferredPlacement: 'top',
      originTemplateId: templateId,
    },
    {
      id: `${templateId}-guide-output`,
      order: 4,
      copyKey: `${templateId}:output`,
      anchor: { kind: 'generated-output', sourceNodeId: 'shot-01' },
      preferredPlacement: 'right',
      originTemplateId: templateId,
    },
    {
      id: `${templateId}-guide-timeline`,
      order: 5,
      copyKey: `${templateId}:timeline`,
      anchor: { kind: 'surface', surface: 'timeline' },
      preferredPlacement: 'top',
      originTemplateId: templateId,
    },
  ];
}

test('guided starters expose canonical annotations without graph note nodes', () => {
  for (const templateId of guidedIds) {
    const template = createStarterWorkspaceTemplate(templateId);
    assert.equal(template.nodes.length, 3);
    assert.equal(template.nodes.some((node) => node.data.kind === 'note'), false);
    assert.deepEqual(template.guideAnnotations?.map((annotation) => annotation.order), [1, 2, 3, 4, 5]);
    assert.equal(template.guideAnnotations?.at(-1)?.anchor.kind, 'surface');
    assert.deepEqual(template.guideAnnotations, expectedGuideAnnotations(templateId));
    assert.equal(template.timelineItems.length, 0);
  }
});

test('blank and every registered non-guided template remain unguided', () => {
  assert.equal(createStarterWorkspaceTemplate('minimal-start').guideAnnotations, undefined);
  for (const { id } of WORKSPACE_TEMPLATE_SUMMARIES) {
    assert.equal(createStarterWorkspaceTemplate(id).guideAnnotations, undefined);
  }
});

test('guide normalization drops malformed and orphaned annotations', () => {
  const template = createStarterWorkspaceTemplate('guided-product-ad');
  const state = normalizeWorkspaceCanvasGuideState({
    hidden: false,
    sourceTemplateId: 'guided-product-ad',
    annotations: [
      ...(template.guideAnnotations ?? []),
      { id: 'bad', order: 99, copyKey: 'bad', anchor: { kind: 'node', nodeId: 'missing' } },
    ],
  }, template.nodes);
  assert.equal(state.annotations.length, 5);
});

test('old workspaces normalize with an empty guide', () => {
  const normalized = normalizePersistedWorkspaceState({
    nodes: [],
    edges: [],
    timelineItems: [],
    activeTemplateId: 'minimal-start',
    projectSettings: DEFAULT_WORKSPACE_PROJECT_SETTINGS,
  });
  assert.deepEqual(normalized?.guideState, { annotations: [], hidden: false });
});

test('missing guide normalizations receive independent annotation arrays', () => {
  const workspace = {
    nodes: [],
    edges: [],
    timelineItems: [],
    activeTemplateId: 'minimal-start',
    projectSettings: DEFAULT_WORKSPACE_PROJECT_SETTINGS,
  };
  const first = normalizePersistedWorkspaceState(workspace);
  const second = normalizePersistedWorkspaceState(workspace);

  assert.notStrictEqual(first?.guideState?.annotations, second?.guideState?.annotations);
});

test('saved canvas guide survives the shared local/API JSON normalization path', () => {
  const template = createStarterWorkspaceTemplate('guided-product-ad');
  const guideState = createWorkspaceCanvasGuideState(template);
  const serialized = JSON.parse(JSON.stringify({
    id: 'canvas-guided',
    name: 'Guided canvas',
    description: '3 blocks',
    nodes: template.nodes,
    edges: template.edges,
    guideState,
    createdAt: '2026-07-15T00:00:00.000Z',
  }));
  assert.deepEqual(normalizeUserCanvasTemplate(serialized)?.guideState, guideState);
  assert.deepEqual(normalizeUserCanvasTemplates([serialized])[0]?.guideState, guideState);
});

test('saved canvases round-trip independent guide state', () => {
  const template = createStarterWorkspaceTemplate('guided-product-ad');
  const guideState = createWorkspaceCanvasGuideState(template);
  const saved = normalizeUserCanvasTemplate({
    id: 'canvas-1',
    name: 'Guided ad',
    description: '3 blocks',
    nodes: template.nodes,
    edges: template.edges,
    guideState,
    createdAt: new Date(0).toISOString(),
  });

  assert.deepEqual(saved?.guideState, guideState);
  assert.notStrictEqual(saved?.guideState, guideState);
  assert.notStrictEqual(saved?.guideState.annotations, guideState.annotations);
});

type CanvasTemplateActionController = {
  handleAddCanvasTemplate: (templateId: WorkspaceTemplateId) => void;
  handleApplyCanvasTemplate: (templateId: WorkspaceTemplateId) => void;
  handleApplyUserCanvasTemplate: (templateId: string) => void;
  handleCreateCanvasFromTemplate: (templateId: WorkspaceTemplateId) => void;
  handleDuplicateUserCanvasTemplate: (templateId: string) => void;
  handleSaveActiveCanvasTemplate: () => void;
  handleSaveCanvasTemplate: (name: string) => void;
};

function renderCanvasTemplateActions(params: Record<string, unknown>): CanvasTemplateActionController {
  let actions: CanvasTemplateActionController | null = null;
  function HookProbe() {
    actions = useWorkspaceCanvasTemplateActions(
      params as unknown as Parameters<typeof useWorkspaceCanvasTemplateActions>[0]
    );
    return null;
  }
  renderToStaticMarkup(createElement(HookProbe));
  assert.ok(actions, 'template action hook should produce an action controller');
  return actions;
}

function applyStateUpdate<T>(current: T, update: T | ((value: T) => T)): T {
  return typeof update === 'function' ? (update as (value: T) => T)(current) : update;
}

function createCanvasTemplateActionHarness({
  activeUserCanvasTemplateId = null,
  edges,
  guideState,
  nodes,
  userCanvasTemplates = [],
}: {
  activeUserCanvasTemplateId?: string | null;
  edges: WorkspaceGraphEdge[];
  guideState: WorkspaceCanvasGuideState;
  nodes: WorkspaceGraphNode[];
  userCanvasTemplates?: WorkspaceUserCanvasTemplate[];
}) {
  let savedCanvases = userCanvasTemplates;
  let canvasSnapshot: CanvasHistorySnapshot = { nodes, edges, guideState };
  let compositeCommitCount = 0;
  let graphCommitCount = 0;

  return {
    params: {
      activeUserCanvasTemplateId,
      commitCanvasGraph: (updater: (current: Pick<CanvasHistorySnapshot, 'nodes' | 'edges'>) => Pick<CanvasHistorySnapshot, 'nodes' | 'edges'>) => {
        graphCommitCount += 1;
        const next = updater(canvasSnapshot);
        canvasSnapshot = { ...canvasSnapshot, ...next };
      },
      commitCanvasState: (updater: (current: CanvasHistorySnapshot) => CanvasHistorySnapshot) => {
        compositeCommitCount += 1;
        canvasSnapshot = updater(canvasSnapshot);
      },
      edges,
      guideState,
      nodes,
      setActiveEditorSurface: () => undefined,
      setActiveTemplateId: () => undefined,
      setActiveUserCanvasTemplateId: () => undefined,
      setCanvasRevision: () => undefined,
      setNotice: () => undefined,
      setSelectedNodeId: () => undefined,
      setUserCanvasTemplates: (update: WorkspaceUserCanvasTemplate[] | ((value: WorkspaceUserCanvasTemplate[]) => WorkspaceUserCanvasTemplate[])) => {
        savedCanvases = applyStateUpdate(savedCanvases, update);
      },
      studioCanvasCopy: DEFAULT_STUDIO_COPY.canvas,
      studioNotices: DEFAULT_STUDIO_COPY.notices,
      userCanvasTemplates,
    },
    canvasSnapshot: () => canvasSnapshot,
    compositeCommitCount: () => compositeCommitCount,
    graphCommitCount: () => graphCommitCount,
    savedCanvases: () => savedCanvases,
  };
}

test('guided and unguided public canvas replacements create or clear guides in one composite commit', () => {
  const guidedTemplate = createStarterWorkspaceTemplate('guided-product-ad');
  const guidedState = createWorkspaceCanvasGuideState(guidedTemplate);
  const savedCanvas: WorkspaceUserCanvasTemplate = {
    id: 'saved-guided',
    name: 'Saved guided canvas',
    description: '3 blocks',
    nodes: guidedTemplate.nodes,
    edges: guidedTemplate.edges,
    guideState: guidedState,
    createdAt: new Date(0).toISOString(),
  };

  const starterHarness = createCanvasTemplateActionHarness({
    nodes: [],
    edges: [],
    guideState: { annotations: [], hidden: false },
  });
  renderCanvasTemplateActions(starterHarness.params).handleCreateCanvasFromTemplate('guided-product-ad');
  assert.equal(starterHarness.compositeCommitCount(), 1);
  assert.equal(starterHarness.graphCommitCount(), 0);

  const publicHarness = createCanvasTemplateActionHarness({
    nodes: guidedTemplate.nodes,
    edges: guidedTemplate.edges,
    guideState: guidedState,
  });
  const publicActions = renderCanvasTemplateActions(publicHarness.params);
  publicActions.handleApplyCanvasTemplate('guided-product-ad');
  assert.deepEqual(publicHarness.canvasSnapshot().guideState, guidedState);
  assert.notStrictEqual(publicHarness.canvasSnapshot().guideState, guidedState);
  assert.notStrictEqual(publicHarness.canvasSnapshot().guideState.annotations, guidedState.annotations);

  publicActions.handleApplyCanvasTemplate('product-ad');
  assert.equal(publicHarness.compositeCommitCount(), 2);
  assert.equal(publicHarness.graphCommitCount(), 0);
  assert.deepEqual(publicHarness.canvasSnapshot().guideState, { annotations: [], hidden: false });

  const userHarness = createCanvasTemplateActionHarness({
    nodes: [],
    edges: [],
    guideState: { annotations: [], hidden: false },
    userCanvasTemplates: [savedCanvas],
  });
  renderCanvasTemplateActions(userHarness.params).handleApplyUserCanvasTemplate(savedCanvas.id);
  assert.equal(userHarness.compositeCommitCount(), 1);
  assert.equal(userHarness.graphCommitCount(), 0);
  assert.deepEqual(userHarness.canvasSnapshot().guideState, savedCanvas.guideState);
  assert.notStrictEqual(userHarness.canvasSnapshot().guideState, savedCanvas.guideState);
  assert.notStrictEqual(userHarness.canvasSnapshot().guideState.annotations, savedCanvas.guideState?.annotations);
});

test('Add commits graph only and leaves the live guide object unchanged', () => {
  const template = createStarterWorkspaceTemplate('guided-product-ad');
  const guideState = createWorkspaceCanvasGuideState(template);
  const harness = createCanvasTemplateActionHarness({
    nodes: template.nodes,
    edges: template.edges,
    guideState,
  });

  renderCanvasTemplateActions(harness.params).handleAddCanvasTemplate('guided-cinematic-scene');

  assert.equal(harness.graphCommitCount(), 1);
  assert.equal(harness.compositeCommitCount(), 0);
  assert.strictEqual(harness.canvasSnapshot().guideState, guideState);
});

test('save, update, duplicate, create, and apply keep saved and live guides independent', () => {
  const template = createStarterWorkspaceTemplate('guided-product-ad');
  const liveGuide = createWorkspaceCanvasGuideState(template);
  const saveHarness = createCanvasTemplateActionHarness({
    nodes: template.nodes,
    edges: template.edges,
    guideState: liveGuide,
  });
  renderCanvasTemplateActions(saveHarness.params).handleSaveCanvasTemplate('Saved guide');
  const saved = saveHarness.savedCanvases()[0]!;
  assert.notStrictEqual(saved.guideState, liveGuide);
  assert.notStrictEqual(saved.guideState?.annotations, liveGuide.annotations);

  const changedGuide = { ...liveGuide, annotations: liveGuide.annotations.slice(1) };
  const updateHarness = createCanvasTemplateActionHarness({
    activeUserCanvasTemplateId: saved.id,
    nodes: template.nodes,
    edges: template.edges,
    guideState: changedGuide,
    userCanvasTemplates: [saved],
  });
  renderCanvasTemplateActions(updateHarness.params).handleSaveActiveCanvasTemplate();
  const updated = updateHarness.savedCanvases()[0]!;
  assert.deepEqual(updated.guideState, changedGuide);
  assert.notStrictEqual(updated.guideState, changedGuide);
  assert.notStrictEqual(updated.guideState?.annotations, changedGuide.annotations);

  const duplicateHarness = createCanvasTemplateActionHarness({
    nodes: template.nodes,
    edges: template.edges,
    guideState: changedGuide,
    userCanvasTemplates: [updated],
  });
  renderCanvasTemplateActions(duplicateHarness.params).handleDuplicateUserCanvasTemplate(updated.id);
  const duplicate = duplicateHarness.savedCanvases()[0]!;
  assert.notStrictEqual(duplicate.guideState, updated.guideState);
  assert.notStrictEqual(duplicate.guideState?.annotations, updated.guideState?.annotations);

  const createHarness = createCanvasTemplateActionHarness({
    nodes: [],
    edges: [],
    guideState: { annotations: [], hidden: false },
  });
  renderCanvasTemplateActions(createHarness.params).handleCreateCanvasFromTemplate('guided-product-ad');
  const created = createHarness.savedCanvases()[0]!;
  assert.deepEqual(created.guideState, createHarness.canvasSnapshot().guideState);
  assert.notStrictEqual(created.guideState, createHarness.canvasSnapshot().guideState);
  assert.notStrictEqual(created.guideState?.annotations, createHarness.canvasSnapshot().guideState.annotations);

  const applyHarness = createCanvasTemplateActionHarness({
    nodes: [],
    edges: [],
    guideState: { annotations: [], hidden: false },
    userCanvasTemplates: [created],
  });
  renderCanvasTemplateActions(applyHarness.params).handleApplyUserCanvasTemplate(created.id);
  assert.deepEqual(applyHarness.canvasSnapshot().guideState, created.guideState);
  assert.notStrictEqual(applyHarness.canvasSnapshot().guideState, created.guideState);
  assert.notStrictEqual(applyHarness.canvasSnapshot().guideState.annotations, created.guideState?.annotations);
});

test('same mounted template actions save and update the newest guide-only state', () => {
  const template = createStarterWorkspaceTemplate('guided-product-ad');
  const initialGuide = createWorkspaceCanvasGuideState(template);
  const activeCanvas: WorkspaceUserCanvasTemplate = {
    id: 'saved-active',
    name: 'Active canvas',
    description: '3 blocks',
    nodes: template.nodes,
    edges: template.edges,
    guideState: initialGuide,
    createdAt: new Date(0).toISOString(),
  };
  const harness = createCanvasTemplateActionHarness({
    activeUserCanvasTemplateId: activeCanvas.id,
    nodes: template.nodes,
    edges: template.edges,
    guideState: initialGuide,
    userCanvasTemplates: [activeCanvas],
  });
  const mounted = mountHook(
    useWorkspaceCanvasTemplateActions,
    harness.params as Parameters<typeof useWorkspaceCanvasTemplateActions>[0]
  );
  const latestGuide = {
    ...initialGuide,
    annotations: initialGuide.annotations.slice(1),
    hidden: true,
  };

  mounted.rerender({
    ...harness.params,
    guideState: latestGuide,
  } as Parameters<typeof useWorkspaceCanvasTemplateActions>[0]);
  mounted.current().handleSaveCanvasTemplate('Latest guide');
  mounted.current().handleSaveActiveCanvasTemplate();

  const newlySaved = harness.savedCanvases().find((canvas) => canvas.name === 'Latest guide');
  const updatedActive = harness.savedCanvases().find((canvas) => canvas.id === activeCanvas.id);
  assert.deepEqual(newlySaved?.guideState, latestGuide);
  assert.notStrictEqual(newlySaved?.guideState, latestGuide);
  assert.notStrictEqual(newlySaved?.guideState?.annotations, latestGuide.annotations);
  assert.deepEqual(updatedActive?.guideState, latestGuide);
  assert.notStrictEqual(updatedActive?.guideState, latestGuide);
  assert.notStrictEqual(updatedActive?.guideState?.annotations, latestGuide.annotations);

  mounted.unmount();
});

test('deleting one annotation returns a new guide state without mutating the original', () => {
  const template = createStarterWorkspaceTemplate('guided-product-ad');
  const state = createWorkspaceCanvasGuideState(template);
  const annotationId = state.annotations[0]!.id;
  const next = deleteWorkspaceGuideAnnotation(state, annotationId);

  assert.equal(next.annotations.some((annotation) => annotation.id === annotationId), false);
  assert.equal(state.annotations.some((annotation) => annotation.id === annotationId), true);
  assert.notStrictEqual(next, state);
  assert.notStrictEqual(next.annotations, state.annotations);
});

test('reconciling after node deletion removes its guide in the same state', () => {
  const template = createStarterWorkspaceTemplate('guided-product-ad');
  const state = createWorkspaceCanvasGuideState(template);
  const nodes = template.nodes.filter((node) => node.id !== 'prompt-product-ad');
  const next = reconcileWorkspaceCanvasGuideState(state, nodes);

  assert.equal(next.annotations.some((item) => item.anchor.kind === 'node' && item.anchor.nodeId === 'prompt-product-ad'), false);
});

test('delete-all preserves reset identity and reset restores canonical positions immutably', () => {
  const template = createStarterWorkspaceTemplate('guided-product-ad');
  const canonical = createWorkspaceCanvasGuideState(template);
  const moved = moveWorkspaceGuideAnnotation(canonical, canonical.annotations[0]!.id, { x: 42, y: 84 });
  const deleted = deleteAllWorkspaceGuideAnnotations(moved);

  assert.equal(deleted.annotations.length, 0);
  assert.equal(deleted.sourceTemplateId, 'guided-product-ad');

  const reset = resetWorkspaceCanvasGuideState(deleted, canonical, template.nodes);
  assert.deepEqual(reset.annotations, canonical.annotations);
  assert.deepEqual(moved.annotations[0]?.manualPosition, { x: 42, y: 84 });
});

function createCanvasHistoryHarness(): {
  controller: WorkspaceCanvasHistoryController;
  current: () => CanvasHistorySnapshot;
  setHidden: (hidden: boolean) => void;
} {
  const template = createStarterWorkspaceTemplate('guided-product-ad');
  let snapshot: CanvasHistorySnapshot = {
    nodes: template.nodes,
    edges: template.edges,
    guideState: createWorkspaceCanvasGuideState(template),
  };

  const controller = createWorkspaceCanvasHistoryController({
    getCurrentSnapshot: () => snapshot,
    applySnapshot: (next) => {
      snapshot = next;
    },
  });

  return {
    controller,
    current: () => snapshot,
    setHidden: (hidden: boolean) => {
      snapshot = {
        ...snapshot,
        guideState: { ...snapshot.guideState, hidden },
      };
    },
  };
}

test('canvas history restores graph and guide changes atomically through undo and redo', () => {
  const harness = createCanvasHistoryHarness();
  const initial = harness.current();
  const annotationId = initial.guideState.annotations[0]!.id;

  harness.controller.commitCanvasState((current) => ({
    ...current,
    nodes: current.nodes.map((node) => node.id === 'prompt-product-ad'
      ? { ...node, position: { x: 640, y: 320 } }
      : node),
    guideState: deleteWorkspaceGuideAnnotation(current.guideState, annotationId),
  }));

  assert.deepEqual(
    harness.current().nodes.find((node) => node.id === 'prompt-product-ad')?.position,
    { x: 640, y: 320 },
  );
  assert.equal(harness.current().guideState.annotations.some((annotation) => annotation.id === annotationId), false);

  harness.controller.undoCanvas();
  assert.deepEqual(harness.current(), initial);

  harness.controller.redoCanvas();
  assert.deepEqual(
    harness.current().nodes.find((node) => node.id === 'prompt-product-ad')?.position,
    { x: 640, y: 320 },
  );
  assert.equal(harness.current().guideState.annotations.some((annotation) => annotation.id === annotationId), false);
});

test('canvas graph deletion reconciles anchored guides and undo restores both', () => {
  const harness = createCanvasHistoryHarness();
  const annotationId = harness.current().guideState.annotations.find(
    (annotation) => annotation.anchor.kind === 'node' && annotation.anchor.nodeId === 'prompt-product-ad',
  )!.id;

  harness.controller.commitCanvasGraph((current) => ({
    nodes: current.nodes.filter((node) => node.id !== 'prompt-product-ad'),
    edges: current.edges.filter((edge) => edge.source !== 'prompt-product-ad' && edge.target !== 'prompt-product-ad'),
  }));

  assert.equal(harness.current().nodes.some((node) => node.id === 'prompt-product-ad'), false);
  assert.equal(harness.current().guideState.annotations.some((annotation) => annotation.id === annotationId), false);

  harness.controller.undoCanvas();
  assert.equal(harness.current().nodes.some((node) => node.id === 'prompt-product-ad'), true);
  assert.equal(harness.current().guideState.annotations.some((annotation) => annotation.id === annotationId), true);
});

test('canvas guide gestures coalesce into one history step', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const harness = createCanvasHistoryHarness();
    const annotationId = harness.current().guideState.annotations[0]!.id;

    harness.controller.commitCanvasGuideState(
      (current) => moveWorkspaceGuideAnnotation(current, annotationId, { x: 10, y: 20 }),
      { gesture: true },
    );
    harness.controller.commitCanvasGuideState(
      (current) => moveWorkspaceGuideAnnotation(current, annotationId, { x: 30, y: 40 }),
      { gesture: true },
    );

    assert.equal(harness.controller.canvasHistory().past.length, 0);
    mock.timers.tick(179);
    assert.equal(harness.controller.canvasHistory().past.length, 0);
    mock.timers.tick(1);
    assert.equal(harness.controller.canvasHistory().past.length, 1);

    harness.controller.undoCanvas();
    assert.equal(harness.current().guideState.annotations.find((annotation) => annotation.id === annotationId)?.manualPosition, undefined);

    harness.controller.redoCanvas();
    assert.deepEqual(
      harness.current().guideState.annotations.find((annotation) => annotation.id === annotationId)?.manualPosition,
      { x: 30, y: 40 },
    );
  } finally {
    mock.timers.reset();
  }
});

test('canvas undo and redo restore historical guides while retaining the live hidden value', () => {
  const harness = createCanvasHistoryHarness();
  const annotationId = harness.current().guideState.annotations[0]!.id;

  harness.controller.commitCanvasGuideState((current) => deleteWorkspaceGuideAnnotation(current, annotationId));
  assert.equal(harness.controller.canvasHistory().past.length, 1);
  harness.setHidden(true);
  assert.equal(harness.controller.canvasHistory().past.length, 1);

  harness.controller.undoCanvas();
  assert.equal(harness.current().guideState.hidden, true);
  assert.equal(harness.current().guideState.annotations.some((annotation) => annotation.id === annotationId), true);

  harness.controller.redoCanvas();
  assert.equal(harness.current().guideState.hidden, true);
  assert.equal(harness.current().guideState.annotations.some((annotation) => annotation.id === annotationId), false);
});

test('gesture undo and redo retain a hidden value changed before the delayed history flush', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const harness = createCanvasHistoryHarness();
    const annotationId = harness.current().guideState.annotations[0]!.id;

    harness.controller.commitCanvasGuideState(
      (current) => moveWorkspaceGuideAnnotation(current, annotationId, { x: 12, y: 24 }),
      { gesture: true },
    );
    harness.setHidden(true);
    assert.equal(harness.controller.canvasHistory().past.length, 0);
    mock.timers.tick(180);

    harness.controller.undoCanvas();
    assert.equal(harness.current().guideState.hidden, true);
    assert.equal(harness.current().guideState.annotations.find((annotation) => annotation.id === annotationId)?.manualPosition, undefined);

    harness.controller.redoCanvas();
    assert.equal(harness.current().guideState.hidden, true);
    assert.deepEqual(
      harness.current().guideState.annotations.find((annotation) => annotation.id === annotationId)?.manualPosition,
      { x: 12, y: 24 },
    );
  } finally {
    mock.timers.reset();
  }
});

const guidePlacementFixture = {
  anchorRect: { x: 300, y: 220, width: 180, height: 120 },
  calloutSize: { width: 190, height: 72 },
  preferredPlacement: 'top',
  viewportRect: { x: 0, y: 0, width: 1000, height: 700 },
  protectedRects: [],
  functionalEdges: [],
  gap: WORKSPACE_GUIDE_DESKTOP_GAP,
  previousPlacement: null,
} satisfies WorkspaceGuidePlacementInput;

function assertGuidePlacement(
  input: WorkspaceGuidePlacementInput,
  expected: WorkspaceGuidePlacementResult,
) {
  assert.deepEqual(resolveWorkspaceGuidePlacement(input), expected);
}

test('placement keeps a 28px desktop gap and avoids protected rectangles', () => {
  const result = resolveWorkspaceGuidePlacement({
    ...guidePlacementFixture,
    protectedRects: [{ x: 260, y: 100, width: 280, height: 80 }],
  });

  assert.deepEqual(result, {
    rect: { x: 508, y: 244, width: 190, height: 72 },
    side: 'right',
    leader: { start: { x: 508, y: 280 }, end: { x: 488, y: 280 } },
    collapsed: false,
  });
  assert.ok(result.rect.x >= guidePlacementFixture.anchorRect.x + guidePlacementFixture.anchorRect.width + WORKSPACE_GUIDE_DESKTOP_GAP);
});

test('zoom below 0.65 compacts callouts without changing layout state', () => {
  assert.equal(WORKSPACE_GUIDE_COMPACT_ZOOM, 0.65);
  assert.equal(compactWorkspaceGuideAtZoom(0.649), true);
  assert.equal(compactWorkspaceGuideAtZoom(0.65), false);
});

test('manual position wins, stays viewport-safe, and preserves the 8px leader gap', () => {
  const anchorRect = { x: 500, y: 300, width: 180, height: 120 };
  const result = resolveWorkspaceGuidePlacement({
    ...guidePlacementFixture,
    anchorRect,
    manualPosition: { x: -30, y: 640 },
  });

  assert.deepEqual(result, {
    rect: { x: 0, y: 628, width: 190, height: 72 },
    side: 'top',
    leader: {
      start: { x: 190, y: 628 },
      end: { x: 493.35681450280606, y: 424.45736317231075 },
    },
    collapsed: false,
  });
  const anchorTarget = { x: anchorRect.x, y: anchorRect.y + anchorRect.height };
  assert.equal(anchorTarget.x, anchorRect.x);
  assert.ok(anchorTarget.y >= anchorRect.y && anchorTarget.y <= anchorRect.y + anchorRect.height);
  assert.ok(
    Math.abs(
      Math.hypot(result.leader.end.x - anchorTarget.x, result.leader.end.y - anchorTarget.y) -
        WORKSPACE_GUIDE_LEADER_END_GAP,
    ) < 1e-12,
  );
});

test('manual placement returns its complete clamped result before automatic selection', () => {
  assertGuidePlacement({
    ...guidePlacementFixture,
    anchorRect: { x: 500, y: 300, width: 180, height: 120 },
    manualPosition: { x: 500, y: 0 },
  }, {
    rect: { x: 500, y: 0, width: 190, height: 72 },
    side: 'top',
    leader: { start: { x: 590, y: 72 }, end: { x: 590, y: 292 } },
    collapsed: false,
  });
});

test('guide placement geometry is collision-aware, deterministic, and complete', () => {
  const cases: Array<{
    name: string;
    input: WorkspaceGuidePlacementInput;
    expected: WorkspaceGuidePlacementResult;
  }> = [
    {
      name: 'uses the 20px compact gap',
      input: { ...guidePlacementFixture, gap: WORKSPACE_GUIDE_COMPACT_GAP },
      expected: {
        rect: { x: 295, y: 128, width: 190, height: 72 },
        side: 'top',
        leader: { start: { x: 390, y: 200 }, end: { x: 390, y: 212 } },
        collapsed: false,
      },
    },
    {
      name: 'treats earlier callouts as protected rectangles',
      input: {
        ...guidePlacementFixture,
        protectedRects: [
          { x: 260, y: 100, width: 280, height: 80 },
          { x: 500, y: 230, width: 220, height: 100 },
        ],
      },
      expected: {
        rect: { x: 295, y: 368, width: 190, height: 72 },
        side: 'bottom',
        leader: { start: { x: 390, y: 368 }, end: { x: 390, y: 348 } },
        collapsed: false,
      },
    },
    {
      name: 'prefers avoiding a functional-edge crossing',
      input: {
        ...guidePlacementFixture,
        functionalEdges: [{ start: { x: 350, y: 200 }, end: { x: 430, y: 200 } }],
      },
      expected: {
        rect: { x: 508, y: 244, width: 190, height: 72 },
        side: 'right',
        leader: { start: { x: 508, y: 280 }, end: { x: 488, y: 280 } },
        collapsed: false,
      },
    },
    {
      name: 'breaks equally safe fallback ties in fixed side order',
      input: {
        ...guidePlacementFixture,
        protectedRects: [{ x: 260, y: 100, width: 280, height: 80 }],
      },
      expected: {
        rect: { x: 508, y: 244, width: 190, height: 72 },
        side: 'right',
        leader: { start: { x: 508, y: 280 }, end: { x: 488, y: 280 } },
        collapsed: false,
      },
    },
    {
      name: 'keeps the previous equally scored side stable',
      input: { ...guidePlacementFixture, previousPlacement: 'left' },
      expected: {
        rect: { x: 82, y: 244, width: 190, height: 72 },
        side: 'left',
        leader: { start: { x: 272, y: 280 }, end: { x: 292, y: 280 } },
        collapsed: false,
      },
    },
    {
      name: 'collapses to the clamped safest candidate when no full callout fits',
      input: {
        ...guidePlacementFixture,
        anchorRect: { x: 50, y: 50, width: 100, height: 50 },
        viewportRect: { x: 0, y: 0, width: 200, height: 150 },
      },
      expected: {
        rect: { x: 5, y: 0, width: 190, height: 72 },
        side: 'top',
        leader: { start: { x: 100, y: 72 }, end: { x: 100, y: 58 } },
        collapsed: true,
      },
    },
  ];

  for (const { name, input, expected } of cases) {
    assertGuidePlacement(input, expected);
  }
});

test('manual overlap uses the deterministic closest opposing-boundary pair', () => {
  assertGuidePlacement({
    ...guidePlacementFixture,
    anchorRect: { x: 40, y: 20, width: 20, height: 20 },
    calloutSize: { width: 100, height: 50 },
    viewportRect: { x: 0, y: 0, width: 200, height: 100 },
    manualPosition: { x: 0, y: 0 },
  }, {
    rect: { x: 0, y: 0, width: 100, height: 50 },
    side: 'top',
    leader: { start: { x: 50, y: 50 }, end: { x: 50, y: 28 } },
    collapsed: false,
  });
});

test('functional-edge intersection scoring counts crossing and contact but not parallel separation', () => {
  const topResult: WorkspaceGuidePlacementResult = {
    rect: { x: 295, y: 120, width: 190, height: 72 },
    side: 'top',
    leader: { start: { x: 390, y: 192 }, end: { x: 390, y: 212 } },
    collapsed: false,
  };
  const rightResult: WorkspaceGuidePlacementResult = {
    rect: { x: 508, y: 244, width: 190, height: 72 },
    side: 'right',
    leader: { start: { x: 508, y: 280 }, end: { x: 488, y: 280 } },
    collapsed: false,
  };
  const cases = [
    {
      name: 'perpendicular crossing',
      edge: { start: { x: 350, y: 200 }, end: { x: 430, y: 200 } },
      expected: rightResult,
    },
    {
      name: 'collinear overlap',
      edge: { start: { x: 390, y: 195 }, end: { x: 390, y: 205 } },
      expected: rightResult,
    },
    {
      name: 'endpoint contact',
      edge: { start: { x: 390, y: 212 }, end: { x: 430, y: 212 } },
      expected: rightResult,
    },
    {
      name: 'screen-coordinate epsilon contact',
      edge: { start: { x: 390.0000005, y: 195 }, end: { x: 390.0000005, y: 205 } },
      expected: rightResult,
    },
    {
      name: 'parallel disjoint',
      edge: { start: { x: 391, y: 195 }, end: { x: 391, y: 205 } },
      expected: topResult,
    },
  ] as const;

  for (const { name, edge, expected } of cases) {
    assert.deepEqual(
      resolveWorkspaceGuidePlacement({ ...guidePlacementFixture, functionalEdges: [edge] }),
      expected,
      name,
    );
  }

  assert.equal(
    workspaceGuideSegmentsIntersect(
      { start: { x: 390, y: 212 }, end: { x: 390, y: 212 } },
      { start: { x: 350, y: 212 }, end: { x: 430, y: 212 } },
    ),
    true,
  );
});

test('preferred placement is first for every non-top side when scores tie', () => {
  const cases: Array<{
    preferredPlacement: WorkspaceGuidePlacementInput['preferredPlacement'];
    expected: WorkspaceGuidePlacementResult;
  }> = [
    {
      preferredPlacement: 'right',
      expected: {
        rect: { x: 508, y: 244, width: 190, height: 72 },
        side: 'right',
        leader: { start: { x: 508, y: 280 }, end: { x: 488, y: 280 } },
        collapsed: false,
      },
    },
    {
      preferredPlacement: 'bottom',
      expected: {
        rect: { x: 295, y: 368, width: 190, height: 72 },
        side: 'bottom',
        leader: { start: { x: 390, y: 368 }, end: { x: 390, y: 348 } },
        collapsed: false,
      },
    },
    {
      preferredPlacement: 'left',
      expected: {
        rect: { x: 82, y: 244, width: 190, height: 72 },
        side: 'left',
        leader: { start: { x: 272, y: 280 }, end: { x: 292, y: 280 } },
        collapsed: false,
      },
    },
  ];

  for (const { preferredPlacement, expected } of cases) {
    assertGuidePlacement({ ...guidePlacementFixture, preferredPlacement }, expected);
  }
});

test('candidate selector compares crossings, distance, order, then applies 4px previous-side hysteresis', () => {
  assert.equal(selectWorkspaceGuideCandidate([
    { side: 'top', crossings: 1, distance: 1, order: 0 },
    { side: 'right', crossings: 0, distance: 100, order: 1 },
  ], null)?.side, 'right');
  assert.equal(selectWorkspaceGuideCandidate([
    { side: 'top', crossings: 0, distance: 20, order: 0 },
    { side: 'right', crossings: 0, distance: 10, order: 1 },
  ], null)?.side, 'right');
  assert.deepEqual(selectWorkspaceGuideCandidate([
    { side: 'left', crossings: 0, distance: 10, order: 3 },
    { side: 'bottom', crossings: 0, distance: 10, order: 2 },
  ], null), {
    side: 'bottom',
    crossings: 0,
    distance: 10,
    order: 2,
  });
  assert.deepEqual(selectWorkspaceGuideCandidate([
    { side: 'top', crossings: 0, distance: 100, order: 0 },
    { side: 'left', crossings: 1, distance: 0, order: 1 },
  ], 'left'), {
    side: 'top',
    crossings: 0,
    distance: 100,
    order: 0,
  });

  for (const [difference, expectedSide] of [
    [3.99, 'left'],
    [4, 'left'],
    [4.01, 'top'],
  ] as const) {
    assert.equal(selectWorkspaceGuideCandidate([
      { side: 'top', crossings: 0, distance: 10, order: 0 },
      { side: 'left', crossings: 0, distance: 10 + difference, order: 1 },
    ], 'left')?.side, expectedSide, `previous-side difference ${difference}`);
  }
});

function assertFiniteGuidePlacement(result: WorkspaceGuidePlacementResult) {
  assert.ok(result.rect.width >= 0);
  assert.ok(result.rect.height >= 0);
  for (const value of [
    result.rect.x,
    result.rect.y,
    result.rect.width,
    result.rect.height,
    result.leader.start.x,
    result.leader.start.y,
    result.leader.end.x,
    result.leader.end.y,
  ]) {
    assert.equal(Number.isFinite(value), true);
  }
}

test('exported placement boundary normalizes invalid geometry into complete finite results', () => {
  const cases: Array<{
    name: string;
    input: WorkspaceGuidePlacementInput;
    expected: WorkspaceGuidePlacementResult;
  }> = [
    {
      name: 'NaN anchor coordinate',
      input: { ...guidePlacementFixture, anchorRect: { ...guidePlacementFixture.anchorRect, x: Number.NaN } },
      expected: {
        rect: { x: 208, y: 244, width: 190, height: 72 },
        side: 'right',
        leader: { start: { x: 208, y: 280 }, end: { x: 188, y: 280 } },
        collapsed: false,
      },
    },
    {
      name: 'infinite gap',
      input: { ...guidePlacementFixture, gap: Number.POSITIVE_INFINITY },
      expected: {
        rect: { x: 295, y: 148, width: 190, height: 72 },
        side: 'top',
        leader: { start: { x: 390, y: 220 }, end: { x: 390, y: 220 } },
        collapsed: false,
      },
    },
    {
      name: 'negative callout dimension',
      input: { ...guidePlacementFixture, calloutSize: { width: -190, height: 72 } },
      expected: {
        rect: { x: 390, y: 120, width: 0, height: 72 },
        side: 'top',
        leader: { start: { x: 390, y: 192 }, end: { x: 390, y: 212 } },
        collapsed: true,
      },
    },
    {
      name: 'zero viewport',
      input: { ...guidePlacementFixture, viewportRect: { x: 0, y: 0, width: 0, height: 0 } },
      expected: {
        rect: { x: 0, y: 0, width: 0, height: 0 },
        side: 'top',
        leader: {
          start: { x: 0, y: 0 },
          end: { x: 293.54876003315434, y: 215.26909069097985 },
        },
        collapsed: true,
      },
    },
    {
      name: 'oversized manual callout',
      input: {
        ...guidePlacementFixture,
        anchorRect: { x: 40, y: 20, width: 20, height: 20 },
        calloutSize: { width: 190, height: 72 },
        viewportRect: { x: 0, y: 0, width: 100, height: 50 },
        manualPosition: { x: 10, y: 10 },
      },
      expected: {
        rect: { x: 0, y: 0, width: 100, height: 50 },
        side: 'top',
        leader: { start: { x: 50, y: 50 }, end: { x: 50, y: 28 } },
        collapsed: true,
      },
    },
  ];

  for (const { name, input, expected } of cases) {
    const result = resolveWorkspaceGuidePlacement(input);
    assert.deepEqual(result, expected, name);
    assertFiniteGuidePlacement(result);
  }
});

test('rectangle intersections and fit bounds use the documented callout padding', () => {
  assert.equal(
    rectanglesIntersect(
      { x: 0, y: 0, width: 20, height: 20 },
      { x: 20, y: 0, width: 20, height: 20 },
    ),
    false,
  );
  assert.equal(
    rectanglesIntersect(
      { x: 0, y: 0, width: 20, height: 20 },
      { x: 19, y: 0, width: 20, height: 20 },
    ),
    true,
  );
  assert.equal(
    rectanglesIntersect(
      { x: 10, y: 0, width: 0, height: 20 },
      { x: 0, y: 0, width: 20, height: 20 },
    ),
    false,
  );
  assert.deepEqual(
    expandWorkspaceGuideFitBounds(
      { x: 300, y: 220, width: 180, height: 120 },
      { width: 190, height: 72 },
    ),
    { x: 82, y: 120, width: 616, height: 320 },
  );
  assert.deepEqual(
    expandWorkspaceGuideFitBounds(
      { x: 300, y: 220, width: 180, height: 120 },
      { width: 190, height: 72 },
      WORKSPACE_GUIDE_COMPACT_GAP,
    ),
    { x: 90, y: 128, width: 600, height: 304 },
  );

  const invalidBounds = expandWorkspaceGuideFitBounds(
    { x: Number.NaN, y: Number.POSITIVE_INFINITY, width: -10, height: 10 },
    { width: Number.POSITIVE_INFINITY, height: -20 },
    -5,
  );
  assert.deepEqual(invalidBounds, { x: 0, y: 0, width: 0, height: 10 });

  const oversizedBounds = expandWorkspaceGuideFitBounds(
    { x: 0, y: 0, width: Number.MAX_VALUE, height: Number.MAX_VALUE },
    { width: Number.MAX_VALUE, height: Number.MAX_VALUE },
    Number.MAX_VALUE,
  );
  assert.deepEqual(oversizedBounds, {
    x: -Number.MAX_SAFE_INTEGER,
    y: -Number.MAX_SAFE_INTEGER,
    width: Number.MAX_SAFE_INTEGER,
    height: Number.MAX_SAFE_INTEGER,
  });

  for (const bounds of [invalidBounds, oversizedBounds]) {
    assert.ok(bounds.width >= 0);
    assert.ok(bounds.height >= 0);
    assert.equal(Object.values(bounds).every(Number.isFinite), true);
  }
});
