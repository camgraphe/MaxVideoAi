import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_WORKSPACE_PROJECT_SETTINGS } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-project-settings';
import type { WorkspaceTimelineItem } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-types';
import {
  createWorkspaceSequenceRecord,
  type WorkspaceSequenceRecord,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_state/workspace-state';
import {
  createWorkspaceSequenceDuplicate,
  resolveWorkspaceSequenceDelete,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_state/workspace-sequence-operations';

function timelineItem(id: string, startSec = 0): WorkspaceTimelineItem {
  return {
    id,
    outputNodeId: `node-${id}`,
    track: 'video-1',
    title: id,
    durationSec: 5,
    startSec,
    mediaKind: 'video',
  };
}

function sequence(id: string, name: string, timelineItems: WorkspaceTimelineItem[] = []): WorkspaceSequenceRecord {
  return createWorkspaceSequenceRecord({
    id,
    name,
    timelineItems,
    projectSettings: DEFAULT_WORKSPACE_PROJECT_SETTINGS,
  });
}

test('createWorkspaceSequenceDuplicate clones timeline state under a new sequence identity', () => {
  const sourceSequence = sequence('sequence-a', 'Main sequence', [timelineItem('clip-a'), timelineItem('clip-b', 5)]);

  const duplicate = createWorkspaceSequenceDuplicate(sourceSequence, 'sequence-copy');

  assert.equal(duplicate.id, 'sequence-copy');
  assert.equal(duplicate.name, 'Main sequence copy');
  assert.deepEqual(duplicate.timelineItems, sourceSequence.timelineItems);
  assert.deepEqual(duplicate.projectSettings, sourceSequence.projectSettings);
  assert.equal(sourceSequence.id, 'sequence-a');
  assert.equal(sourceSequence.name, 'Main sequence');
});

test('resolveWorkspaceSequenceDelete selects the previous sequence when deleting the active sequence', () => {
  const first = sequence('sequence-1', 'Sequence 1');
  const second = sequence('sequence-2', 'Sequence 2', [timelineItem('clip-2')]);
  const third = sequence('sequence-3', 'Sequence 3');

  const result = resolveWorkspaceSequenceDelete({
    activeSequenceId: second.id,
    sequenceId: second.id,
    sequences: [first, second, third],
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.deletedActiveSequence, true);
  assert.equal(result.deletedSequence.id, second.id);
  assert.equal(result.nextActiveSequence.id, first.id);
  assert.deepEqual(result.nextSequences.map((candidate) => candidate.id), [first.id, third.id]);
});

test('resolveWorkspaceSequenceDelete keeps the active sequence when deleting another sequence', () => {
  const first = sequence('sequence-1', 'Sequence 1');
  const second = sequence('sequence-2', 'Sequence 2');
  const third = sequence('sequence-3', 'Sequence 3');

  const result = resolveWorkspaceSequenceDelete({
    activeSequenceId: third.id,
    sequenceId: first.id,
    sequences: [first, second, third],
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.deletedActiveSequence, false);
  assert.equal(result.nextActiveSequence.id, third.id);
  assert.deepEqual(result.nextSequences.map((candidate) => candidate.id), [second.id, third.id]);
});

test('resolveWorkspaceSequenceDelete rejects missing and last sequence deletion', () => {
  const onlySequence = sequence('sequence-1', 'Sequence 1');

  assert.deepEqual(resolveWorkspaceSequenceDelete({
    activeSequenceId: onlySequence.id,
    sequenceId: 'missing',
    sequences: [onlySequence],
  }), {
    ok: false,
    reason: 'not_found',
  });

  assert.deepEqual(resolveWorkspaceSequenceDelete({
    activeSequenceId: onlySequence.id,
    sequenceId: onlySequence.id,
    sequences: [onlySequence],
  }), {
    ok: false,
    reason: 'last_sequence',
  });
});
