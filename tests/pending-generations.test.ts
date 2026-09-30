import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPendingGenerations } from '../frontend/lib/pending-generations';
import { buildCompletedGroup, buildPendingGroup } from '../frontend/app/(core)/(workspace)/app/image/_lib/image-workspace-history';
import type { GroupSummary } from '../frontend/types/groups';

const imageRun = buildPendingGroup({ id: 'image-run', engineId: 'seedream', engineLabel: 'Seedream', prompt: 'Night scene', count: 4, createdAt: 1000 });

test('image activity counts an unresolved request once and excludes completed groups still retained in the gallery', () => {
  const finished = buildCompletedGroup({ id: 'finished', engineId: 'seedream', engineLabel: 'Seedream', prompt: 'Done', aspectRatio: '1:1', images: [{ url: '/original.webp' }], createdAt: 2000 });
  assert.deepEqual(buildPendingGenerations([imageRun, finished], 'group'), [
    { id: 'image-run', engineLabel: 'Seedream', prompt: 'Night scene', durationSec: 0 },
  ]);
  assert.equal(finished.members[0].originalUrl, '/original.webp');
  assert.deepEqual(buildPendingGenerations([finished], 'group'), []);
});

test('video activity counts unresolved jobs within a mixed batch without duplicates or failed jobs', () => {
  const group: GroupSummary = { ...imageRun, id: 'video-batch', members: [
    { ...imageRun.hero, id: 'a', jobId: 'job-a', engineLabel: 'Seedance 2.0', durationSec: 15 },
    { ...imageRun.hero, id: 'b', jobId: 'job-b', status: 'completed' },
    { ...imageRun.hero, id: 'c', jobId: 'job-c', status: 'failed' },
    { ...imageRun.hero, id: 'd', jobId: 'job-a' },
    { ...imageRun.hero, id: 'e', localKey: 'local-e', engineLabel: 'Kling', durationSec: 5 },
  ] };
  assert.deepEqual(buildPendingGenerations([group], 'job'), [
    { id: 'job-a', engineLabel: 'Seedance 2.0', prompt: 'Night scene', durationSec: 15 },
    { id: 'local-e', engineLabel: 'Kling', prompt: 'Night scene', durationSec: 5 },
  ]);
  assert.deepEqual(buildPendingGenerations([]), []);
});

test('terminal observations do not keep a stale pending member in the activity counter', () => {
  const groups = [{ ...imageRun, members: imageRun.members.map(member => ({ ...member, observation: { stage: 'completed' as const } })) }];
  assert.deepEqual(buildPendingGenerations(groups, 'group'), []);
});
