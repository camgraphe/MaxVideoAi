import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  classifyStudioProjectWorkspaceSnapshot,
  mergePersistedWorkspaceWithServerSequences,
  normalizePersistedWorkspaceState,
  shouldApplyStudioProjectWorkspaceState,
  stripWorkspaceSequencesForProjectApi,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_state/workspace-api-persistence';
import {
  DEFAULT_WORKSPACE_SEQUENCE_ID,
  createWorkspaceSequenceRecord,
  type PersistedWorkspaceState,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_state/workspace-state';
import { DEFAULT_WORKSPACE_PROJECT_SETTINGS } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-project-settings';
import { createStarterWorkspaceTemplate } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-templates';
import { createWorkspaceCanvasGuideState } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-guide-state';
import {
  normalizeGeneratedOutputEdges,
  normalizeWorkspaceGraphNodes,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_state/workspace-normalizers';
import { normalizeStudioProjectStorageRecord } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_state/workspace-persistence';
import { normalizeStudioProjectRecords } from '../frontend/app/(core)/(workspace)/app/studio/projects/studio-project-records';
import type {
  WorkspaceGraphEdge,
  WorkspaceGraphNode,
  WorkspaceTimelineItem,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-types';
import {
  applyPersistedWorkspaceCanvasHydration,
  applyStoredProjectCanvasHydration,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspacePersistenceEffects';
import {
  useWorkspaceSequenceSnapshots,
  type WorkspaceSequenceSnapshotArgs,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceSequenceSnapshots';
import { mountHook } from './helpers/react-hook-harness';

const serverClip: WorkspaceTimelineItem = {
  id: 'clip-server',
  nodeId: 'node-server',
  title: 'Server clip',
  track: 'video-1',
  startSec: 0,
  durationSec: 5,
  mediaKind: 'video',
  mediaUrl: '/server.mp4',
  thumbUrl: '/server.jpg',
};

const studioRepositorySource = readFileSync(
  join(process.cwd(), 'frontend/src/server/studio/repository.ts'),
  'utf8'
);

test('Studio project persistence defaults new records to the minimal bootstrap while preserving explicit templates', () => {
  assert.match(
    studioRepositorySource,
    /const DEFAULT_STUDIO_PROJECT_CANVAS_TEMPLATE_ID = 'minimal-start';/,
    'repository should define the minimal bootstrap as its server-side project default'
  );
  assert.match(
    studioRepositorySource,
    /params\.canvasTemplateId\?\.trim\(\) \|\| DEFAULT_STUDIO_PROJECT_CANVAS_TEMPLATE_ID/,
    'repository should preserve an explicitly supplied canvas template id'
  );
});

test('local legacy Studio projects without a canvas template retain the Product Ad fallback', () => {
  const project = normalizeStudioProjectStorageRecord({
    id: 'project-legacy-absent-template',
    name: 'Legacy local project',
  });

  assert.equal(project?.canvasTemplateId, 'product-ad');
});

test('local legacy Studio projects with a null canvas template retain the Product Ad fallback', () => {
  const project = normalizeStudioProjectStorageRecord({
    id: 'project-legacy-null-template',
    name: 'Legacy local project',
    canvasTemplateId: null,
  });

  assert.equal(project?.canvasTemplateId, 'product-ad');
});

test('Studio project list normalizes legacy records before filtering them', () => {
  const projects = normalizeStudioProjectRecords([
    {
      id: 'project-list-missing-template',
      name: 'Missing template',
      settings: DEFAULT_WORKSPACE_PROJECT_SETTINGS,
    },
    {
      id: 'project-list-null-template',
      name: 'Null template',
      canvasTemplateId: null,
      settings: DEFAULT_WORKSPACE_PROJECT_SETTINGS,
    },
    {
      id: 'project-list-missing-settings',
      name: 'Missing settings',
      canvasTemplateId: 'minimal-start',
    },
    { name: 'Invalid without id' },
  ], {
    now: '2026-07-11T12:00:00.000Z',
    untitledProject: 'Untitled project',
  });

  assert.deepEqual(projects.map((project) => project.id), [
    'project-list-missing-template',
    'project-list-null-template',
    'project-list-missing-settings',
  ]);
  assert.equal(projects[0]?.canvasTemplateId, 'product-ad');
  assert.equal(projects[1]?.canvasTemplateId, 'product-ad');
  assert.equal(projects[2]?.canvasTemplateId, 'minimal-start');
  assert.deepEqual(projects[2]?.settings, DEFAULT_WORKSPACE_PROJECT_SETTINGS);
});

test('legacy Product Ad graphs preserve user edits and remain unguided during hydration', () => {
  const legacyTemplate = createStarterWorkspaceTemplate('product-ad');
  const editedNodes = normalizeWorkspaceGraphNodes(legacyTemplate.nodes).map((node, index) => ({
    ...structuredClone(node),
    position: {
      x: node.position.x + 37 + index,
      y: node.position.y - 23 - index,
    },
    data: {
      ...structuredClone(node.data),
      title: `User edited ${node.data.title}`,
      ...(node.id === 'prompt-camera'
        ? {
            generatedCopy: { ...node.data.generatedCopy, promptText: null },
            promptText: 'Keep this user-authored orbit and rack-focus prompt.',
          }
        : {}),
      ...(node.id === 'shot-01' && node.data.shot
        ? {
            shot: {
              ...node.data.shot,
              aspectRatio: '9:16' as const,
              durationSec: 10,
              modelId: 'seedance-2-0',
              resolution: '720p' as const,
              seed: 4711,
            },
          }
        : {}),
    },
  }));
  const editedEdges = normalizeGeneratedOutputEdges(editedNodes, legacyTemplate.edges).map((edge) => ({
    ...structuredClone(edge),
    data: {
      ...structuredClone(edge.data),
      label: `User edited ${edge.data?.label ?? edge.id}`,
    },
  }));
  const editedProjectSettings = {
    aspectRatio: '9:16' as const,
    resolution: '720p' as const,
    fps: 30 as const,
  };
  const sequence = createWorkspaceSequenceRecord({
    id: DEFAULT_WORKSPACE_SEQUENCE_ID,
    name: 'Sequence 1',
    timelineItems: [],
    projectSettings: editedProjectSettings,
  });
  const normalized = normalizePersistedWorkspaceState({
    nodes: editedNodes,
    edges: editedEdges,
    projectAssets: [],
    projectMediaFolders: [],
    timelineItems: [],
    activeSequenceId: DEFAULT_WORKSPACE_SEQUENCE_ID,
    sequences: [sequence],
    activeTemplateId: 'product-ad',
    projectSettings: editedProjectSettings,
    focusMode: 'canvas',
  });

  assert.equal(normalized?.activeTemplateId, 'product-ad');
  assert.deepEqual(normalized?.nodes, editedNodes);
  assert.deepEqual(normalized?.edges, editedEdges);
  assert.deepEqual(normalized?.projectSettings, editedProjectSettings);
  assert.deepEqual(normalized?.guideState, { annotations: [], hidden: false });
});

test('legacy guided projects do not infer guide annotations during hydration', () => {
  const template = createStarterWorkspaceTemplate('guided-product-ad');
  const normalized = normalizePersistedWorkspaceState({
    nodes: template.nodes,
    edges: template.edges,
    timelineItems: [],
    activeTemplateId: 'guided-product-ad',
    projectSettings: DEFAULT_WORKSPACE_PROJECT_SETTINGS,
  });

  assert.deepEqual(normalized?.guideState, { annotations: [], hidden: false });
});

test('persisted user canvases preserve saved guide state without inferring missing guides', () => {
  const template = createStarterWorkspaceTemplate('guided-product-ad');
  const guideState = {
    annotations: [{
      ...template.guideAnnotations![0],
      manualPosition: { x: 48, y: 96 },
    }],
    hidden: true,
    sourceTemplateId: 'guided-product-ad' as const,
  };
  const normalized = normalizePersistedWorkspaceState({
    nodes: template.nodes,
    edges: template.edges,
    timelineItems: [],
    activeTemplateId: template.id,
    projectSettings: DEFAULT_WORKSPACE_PROJECT_SETTINGS,
    savedCanvases: [
      {
        id: 'saved-guided',
        name: 'Saved guided',
        description: '3 blocks',
        nodes: template.nodes,
        edges: template.edges,
        guideState,
        createdAt: new Date(0).toISOString(),
      },
      {
        id: 'legacy-guided',
        name: 'Legacy guided',
        description: '3 blocks',
        nodes: template.nodes,
        edges: template.edges,
        createdAt: new Date(0).toISOString(),
      },
    ],
  });

  assert.deepEqual(normalized?.savedCanvases?.[0]?.guideState, guideState);
  assert.deepEqual(normalized?.savedCanvases?.[1]?.guideState, { annotations: [], hidden: false });
});

function createCanvasHydrationRecorder() {
  const calls: string[] = [];
  let nodes: WorkspaceGraphNode[] = [];
  let edges: WorkspaceGraphEdge[] = [];
  let guideState = { annotations: [], hidden: false } as ReturnType<typeof createWorkspaceCanvasGuideState>;
  return {
    calls,
    controls: {
      resetCanvasHistory: () => calls.push('resetCanvasHistory'),
      setEdges: (value: WorkspaceGraphEdge[]) => {
        calls.push('setEdges');
        edges = value;
      },
      setGuideState: (value: ReturnType<typeof createWorkspaceCanvasGuideState>) => {
        calls.push('setGuideState');
        guideState = value;
      },
      setNodes: (value: WorkspaceGraphNode[]) => {
        calls.push('setNodes');
        nodes = value;
      },
    },
    current: () => ({ edges, guideState, nodes }),
  };
}

test('persistence hydration applies persisted and legacy guides before resetting canvas history', () => {
  const template = createStarterWorkspaceTemplate('guided-product-ad');
  const persistedGuide = {
    ...createWorkspaceCanvasGuideState(template),
    hidden: true,
  };
  const persisted = normalizePersistedWorkspaceState({
    nodes: template.nodes,
    edges: template.edges,
    guideState: persistedGuide,
    timelineItems: [],
    activeTemplateId: template.id,
    projectSettings: DEFAULT_WORKSPACE_PROJECT_SETTINGS,
  })!;
  const persistedRecorder = createCanvasHydrationRecorder();

  applyPersistedWorkspaceCanvasHydration(persisted, persistedRecorder.controls);

  assert.deepEqual(persistedRecorder.current().guideState, persistedGuide);
  assert.deepEqual(persistedRecorder.calls, [
    'setNodes',
    'setEdges',
    'setGuideState',
    'resetCanvasHistory',
  ]);

  const legacy = normalizePersistedWorkspaceState({
    nodes: template.nodes,
    edges: template.edges,
    timelineItems: [],
    activeTemplateId: template.id,
    projectSettings: DEFAULT_WORKSPACE_PROJECT_SETTINGS,
  })!;
  const legacyRecorder = createCanvasHydrationRecorder();
  applyPersistedWorkspaceCanvasHydration(legacy, legacyRecorder.controls);
  assert.deepEqual(legacyRecorder.current().guideState, { annotations: [], hidden: false });
  assert.deepEqual(legacyRecorder.calls, [
    'setNodes',
    'setEdges',
    'setGuideState',
    'resetCanvasHistory',
  ]);
});

test('clean guided project hydration derives starter guides before resetting canvas history', () => {
  const recorder = createCanvasHydrationRecorder();

  const template = applyStoredProjectCanvasHydration(
    { canvasTemplateId: 'guided-product-ad' },
    recorder.controls
  );

  assert.deepEqual(recorder.current().nodes, template.nodes);
  assert.deepEqual(recorder.current().edges, template.edges);
  assert.deepEqual(recorder.current().guideState, createWorkspaceCanvasGuideState(template));
  assert.deepEqual(recorder.calls, [
    'setNodes',
    'setEdges',
    'setGuideState',
    'resetCanvasHistory',
  ]);
});

test('sequence snapshot serialization uses the latest live guide and keeps sequence records guide-free', () => {
  const template = createStarterWorkspaceTemplate('guided-product-ad');
  const sequence = createWorkspaceSequenceRecord({
    id: DEFAULT_WORKSPACE_SEQUENCE_ID,
    name: 'Sequence 1',
    timelineItems: [],
    projectSettings: DEFAULT_WORKSPACE_PROJECT_SETTINGS,
  });
  const initialGuide = createWorkspaceCanvasGuideState(template);
  const latestGuide = {
    ...initialGuide,
    annotations: initialGuide.annotations.slice(1),
    hidden: true,
  };
  const baseArgs = {
    activeCanvasId: null,
    activeSequenceId: DEFAULT_WORKSPACE_SEQUENCE_ID,
    activeTemplateId: template.id,
    audioTrackCount: sequence.audioTrackCount,
    edges: template.edges,
    focusMode: 'canvas',
    hiddenVideoTracks: sequence.hiddenVideoTracks,
    lockedTimelineTracks: sequence.lockedTimelineTracks,
    mutedAudioTracks: sequence.mutedAudioTracks,
    nodes: template.nodes,
    projectAssets: [],
    projectMediaFolders: [],
    projectSettings: DEFAULT_WORKSPACE_PROJECT_SETTINGS,
    savedCanvases: [],
    sequences: [sequence],
    timelineInPointSec: null,
    timelineItems: [],
    timelineOutPointSec: null,
    timelinePanelHeight: null,
    videoTrackCount: sequence.videoTrackCount,
  } satisfies Omit<WorkspaceSequenceSnapshotArgs, 'guideState'>;

  const mounted = mountHook(useWorkspaceSequenceSnapshots, {
    ...baseArgs,
    guideState: initialGuide,
  });
  mounted.rerender({
    ...baseArgs,
    guideState: latestGuide,
  });
  const latestSnapshot = mounted.current().buildPersistedWorkspaceState();

  assert.strictEqual(latestSnapshot.guideState, latestGuide);
  for (const sequenceRecord of latestSnapshot.sequences ?? []) {
    assert.equal('guideState' in sequenceRecord, false);
  }
  mounted.unmount();
});

function persistedWorkspaceState(): PersistedWorkspaceState {
  const localSequence = createWorkspaceSequenceRecord({
    id: DEFAULT_WORKSPACE_SEQUENCE_ID,
    name: 'Local sequence',
    timelineItems: [],
    projectSettings: DEFAULT_WORKSPACE_PROJECT_SETTINGS,
  });

  return {
    nodes: [],
    edges: [],
    projectMediaFolders: [{
      id: 'folder-assets',
      name: 'Assets',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }],
    projectAssets: [{
      id: 'asset-image',
      kind: 'image',
      filename: 'image.png',
      subtitle: 'image',
      folderId: 'folder-assets',
    }],
    timelineItems: [],
    activeSequenceId: DEFAULT_WORKSPACE_SEQUENCE_ID,
    sequences: [localSequence],
    activeTemplateId: 'product-ad',
    projectSettings: DEFAULT_WORKSPACE_PROJECT_SETTINGS,
    focusMode: 'viewer',
    audioTrackCount: localSequence.audioTrackCount,
    hiddenVideoTracks: localSequence.hiddenVideoTracks,
    lockedTimelineTracks: localSequence.lockedTimelineTracks,
    mutedAudioTracks: localSequence.mutedAudioTracks,
    videoTrackCount: localSequence.videoTrackCount,
    timelinePanelHeight: localSequence.timelinePanelHeight,
    timelineInPointSec: localSequence.timelineInPointSec,
    timelineOutPointSec: localSequence.timelineOutPointSec,
  };
}

test('project API workspace snapshots are stripped after sequence sync succeeds', () => {
  const stripped = stripWorkspaceSequencesForProjectApi(persistedWorkspaceState());
  assert.deepEqual(stripped.timelineItems, []);
  assert.deepEqual(stripped.sequences, []);
  assert.equal(stripped.projectMediaFolders?.[0]?.name, 'Assets');
  assert.equal(stripped.projectAssets?.[0]?.folderId, 'folder-assets');
  assert.equal(stripped.activeSequenceId, DEFAULT_WORKSPACE_SEQUENCE_ID);
  assert.equal(stripped.activeTemplateId, 'product-ad');
});

test('stripped project snapshots are ignored when sequence hydration is unavailable', () => {
  const stripped = stripWorkspaceSequencesForProjectApi(persistedWorkspaceState());
  assert.equal(shouldApplyStudioProjectWorkspaceState(stripped, null), false);
  assert.equal(shouldApplyStudioProjectWorkspaceState(stripped, []), true);
});

test('project API workspace snapshot classification distinguishes production empty state from persisted snapshots', () => {
  const current = persistedWorkspaceState();
  const stripped = stripWorkspaceSequencesForProjectApi(current);

  assert.equal(classifyStudioProjectWorkspaceSnapshot(undefined), 'missing');
  assert.equal(classifyStudioProjectWorkspaceSnapshot(null), 'missing');
  assert.equal(classifyStudioProjectWorkspaceSnapshot({}), 'empty');
  assert.equal(classifyStudioProjectWorkspaceSnapshot(current), 'persisted');
  assert.equal(classifyStudioProjectWorkspaceSnapshot(stripped), 'persisted');
  assert.equal(classifyStudioProjectWorkspaceSnapshot({ nodes: [], edges: [] }), 'invalid');
  assert.equal(shouldApplyStudioProjectWorkspaceState({}, []), false);
});

test('server sequence records override stale project timeline payloads during hydration', () => {
  const serverSequence = createWorkspaceSequenceRecord({
    id: 'sequence-server',
    name: 'Server sequence',
    timelineItems: [serverClip],
    projectSettings: { ...DEFAULT_WORKSPACE_PROJECT_SETTINGS, fps: 24 },
    timelineInPointSec: 1,
    timelineOutPointSec: 4,
  });

  const merged = mergePersistedWorkspaceWithServerSequences(persistedWorkspaceState(), [serverSequence]);
  assert.equal(merged.activeSequenceId, 'sequence-server');
  assert.equal(merged.timelineItems[0]?.id, 'clip-server');
  assert.equal(merged.projectMediaFolders?.[0]?.id, 'folder-assets');
  assert.equal(merged.projectAssets?.[0]?.folderId, 'folder-assets');
  assert.equal(merged.projectSettings.fps, 24);
  assert.equal(merged.timelineInPointSec, 1);
  assert.equal(merged.timelineOutPointSec, 4);
});

test('workspace reload migrates legacy requested source values and preserves explicitly measured provenance', () => {
  const unknownItem: WorkspaceTimelineItem = {
    id: 'unknown-duration',
    outputNodeId: 'project-asset-unknown-duration',
    title: 'Unknown duration',
    track: 'video',
    startSec: 0,
    durationSec: 6,
    sourceStartSec: 0,
    mediaKind: 'video',
    mediaUrl: '/unknown-duration.mp4',
  };
  const measuredItem: WorkspaceTimelineItem = {
    ...unknownItem,
    id: 'measured-duration',
    outputNodeId: 'project-asset-measured-duration',
    startSec: 6,
    durationSec: 9.25,
    sourceDurationSec: 9.25,
    sourceWidth: 1920,
    sourceHeight: 1080,
    sourceMetadata: { measurementStatus: 'measured' },
    mediaUrl: '/measured-duration.mp4',
  };
  const legacyRequestedItem: WorkspaceTimelineItem = {
    ...unknownItem,
    id: 'legacy-requested-duration',
    startSec: 16,
    sourceDurationSec: 12,
    sourceWidth: 3840,
    sourceHeight: 2160,
    mediaUrl: '/legacy-requested-duration.mp4',
  };
  const state = persistedWorkspaceState();
  const reloaded = normalizePersistedWorkspaceState(JSON.parse(JSON.stringify({
    ...state,
    timelineItems: [unknownItem, measuredItem, legacyRequestedItem],
  })));

  assert.ok(reloaded);
  assert.equal(reloaded.timelineItems.find((item) => item.id === unknownItem.id)?.sourceDurationSec, undefined);
  assert.equal(reloaded.timelineItems.find((item) => item.id === measuredItem.id)?.sourceDurationSec, 9.25);
  const migratedLegacy = reloaded.timelineItems.find((item) => item.id === legacyRequestedItem.id);
  assert.equal(migratedLegacy?.sourceDurationSec, undefined);
  assert.equal(migratedLegacy?.sourceWidth, undefined);
  assert.equal(migratedLegacy?.sourceHeight, undefined);
  assert.deepEqual(migratedLegacy?.requestedSettings, {
    sourceDurationSec: 12,
    sourceWidth: 3840,
    sourceHeight: 2160,
  });
  assert.deepEqual(migratedLegacy?.sourceMetadata, { measurementStatus: 'unknown' });
  const activeSequence = reloaded.sequences?.find((sequence) => sequence.id === reloaded.activeSequenceId);
  assert.equal(activeSequence?.timelineItems.find((item) => item.id === unknownItem.id)?.sourceDurationSec, undefined);
  assert.equal(activeSequence?.timelineItems.find((item) => item.id === measuredItem.id)?.sourceDurationSec, 9.25);
  assert.equal(activeSequence?.timelineItems.find((item) => item.id === legacyRequestedItem.id)?.sourceDurationSec, undefined);

  const hydratedServerSequence = createWorkspaceSequenceRecord({
    id: 'server-legacy',
    name: 'Server legacy',
    timelineItems: [legacyRequestedItem],
    projectSettings: DEFAULT_WORKSPACE_PROJECT_SETTINGS,
  });
  assert.equal(hydratedServerSequence.timelineItems[0]?.sourceDurationSec, undefined);
  assert.deepEqual(hydratedServerSequence.timelineItems[0]?.requestedSettings, {
    sourceDurationSec: 12,
    sourceWidth: 3840,
    sourceHeight: 2160,
  });
});

test('workspace graph normalization preserves media-specific output handles and generation metadata', () => {
  const nodes: WorkspaceGraphNode[] = [
    {
      id: 'shot-image',
      type: 'shot',
      position: { x: 0, y: 0 },
      data: {
        kind: 'shot',
        title: 'Legacy image shot',
        subtitle: 'Legacy',
        accent: '#6366f1',
        targetHandles: ['prompt'],
        sourceHandles: [],
        shot: {
          modelId: 'seedream',
          workflowType: 'text_to_image',
          durationSec: 1,
          aspectRatio: '16:9',
          resolution: '1080p',
          fps: 24,
          seed: null,
          audioEnabled: false,
          lipSyncEnabled: false,
          referenceStrength: 0.65,
          outputName: 'Image output',
          status: 'draft',
        },
      },
    },
    {
      id: 'output-image',
      type: 'output',
      position: { x: 320, y: 0 },
      data: {
        kind: 'output',
        title: 'Image output',
        subtitle: 'Ready',
        accent: '#6366f1',
        targetHandles: [],
        sourceHandles: ['video_reference'],
        output: {
          kind: 'image',
          modelId: 'seedream',
          modelLabel: 'Seedream',
          workflowType: 'text_to_image',
          createdAt: '2026-01-01T00:00:00.000Z',
          sourceShotId: 'shot-image',
          url: '/image.png',
          thumbUrl: '/image.png',
          status: 'ready',
        },
      },
    },
    {
      id: 'output-audio',
      type: 'output',
      position: { x: 320, y: 120 },
      data: {
        kind: 'output',
        title: 'Audio output',
        subtitle: 'Ready',
        accent: '#16a34a',
        targetHandles: [],
        sourceHandles: ['video_reference'],
        output: {
          kind: 'audio',
          modelId: 'audio-music-only',
          modelLabel: 'Music generator',
          workflowType: 'music_generation',
          createdAt: '2026-01-01T00:00:00.000Z',
          sourceShotId: 'shot-audio',
          url: '/audio.m4a',
          audioUrl: '/audio.m4a',
          status: 'ready',
        },
      },
    },
    {
      id: 'chat-legacy',
      type: 'chat',
      position: { x: 0, y: 180 },
      data: {
        kind: 'chat',
        title: 'Chat',
        subtitle: 'LLM',
        accent: '#64748b',
        targetHandles: [],
        sourceHandles: [],
      },
    },
  ];
  const edges: WorkspaceGraphEdge[] = [
    {
      id: 'edge-image-output',
      source: 'output-image',
      target: 'shot-image',
      sourceHandle: 'video_reference',
      targetHandle: 'reference',
      data: { kind: 'reference' },
    },
    {
      id: 'edge-audio-output',
      source: 'output-audio',
      target: 'shot-image',
      sourceHandle: 'video_reference',
      targetHandle: 'audio',
      data: { kind: 'audio' },
    },
  ];

  const normalizedNodes = normalizeWorkspaceGraphNodes(nodes);
  const imageOutput = normalizedNodes.find((node) => node.id === 'output-image');
  const audioOutput = normalizedNodes.find((node) => node.id === 'output-audio');
  const imageShot = normalizedNodes.find((node) => node.id === 'shot-image');
  const chat = normalizedNodes.find((node) => node.id === 'chat-legacy');
  assert.deepEqual(imageOutput?.data.sourceHandles, ['reference']);
  assert.deepEqual(audioOutput?.data.sourceHandles, ['audio']);
  assert.equal(imageShot?.data.shot?.family, 'image');
  assert.equal(imageShot?.data.shot?.outputKind, 'image');
  assert.equal(chat?.data.chat?.provider, 'openai');
  assert.deepEqual(chat?.data.sourceHandles, ['prompt']);

  const normalizedEdges = normalizeGeneratedOutputEdges(normalizedNodes, edges);
  assert.equal(normalizedEdges[0]?.sourceHandle, 'reference');
  assert.equal(normalizedEdges[1]?.sourceHandle, 'audio');
});
