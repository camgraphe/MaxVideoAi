import assert from 'node:assert/strict';
import test from 'node:test';
import {
  mergePersistedWorkspaceWithServerSequences,
  shouldApplyStudioProjectWorkspaceState,
  stripWorkspaceSequencesForProjectApi,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_state/workspace-api-persistence';
import {
  DEFAULT_WORKSPACE_SEQUENCE_ID,
  createWorkspaceSequenceRecord,
  type PersistedWorkspaceState,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_state/workspace-state';
import { DEFAULT_WORKSPACE_PROJECT_SETTINGS } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-project-settings';
import {
  normalizeGeneratedOutputEdges,
  normalizeWorkspaceGraphNodes,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_state/workspace-normalizers';
import type {
  WorkspaceGraphEdge,
  WorkspaceGraphNode,
  WorkspaceTimelineItem,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-types';

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
