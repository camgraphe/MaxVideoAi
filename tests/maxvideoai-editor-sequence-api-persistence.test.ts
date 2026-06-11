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
import type { WorkspaceTimelineItem } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-types';

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
