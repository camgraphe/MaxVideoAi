import assert from 'node:assert/strict';
import test from 'node:test';

import { createStudioConnectedSaveQueue } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_state/studio-connected-save-queue';

test('connected autosave sends one request at a time, coalesces edits and chains ACK revisions', async () => {
  const releases: Array<(value: { status: 'ready'; revision: number }) => void> = [];
  const calls: unknown[] = [];
  const queue = createStudioConnectedSaveQueue<{ value: number }>({
    scope: 'owner-a:project-a', initialRevision: 4,
    save: (request) => { calls.push(request); return new Promise((resolve) => releases.push(resolve)); },
  });
  queue.enqueue({ value: 1 });
  queue.enqueue({ value: 2 });
  queue.enqueue({ value: 3 });
  assert.deepEqual(calls, [{ scope: 'owner-a:project-a', expectedRevision: 4, snapshot: { value: 1 } }]);
  releases.shift()?.({ status: 'ready', revision: 5 });
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual(calls, [
    { scope: 'owner-a:project-a', expectedRevision: 4, snapshot: { value: 1 } },
    { scope: 'owner-a:project-a', expectedRevision: 5, snapshot: { value: 3 } },
  ]);
  releases.shift()?.({ status: 'ready', revision: 6 });
  assert.equal(await queue.whenIdle(), 'ready');
  assert.deepEqual(queue.state(), { blockedByConflict: false, inFlight: false, revision: 6 });
});

test('a conflict blocks retries, preserves the latest draft and a disposed context ignores late ACKs', async () => {
  const first = Promise.withResolvers<{ status: 'ready'; revision: number }>();
  const revisions: number[] = [];
  const stale = createStudioConnectedSaveQueue<{ value: string }>({
    scope: 'owner-a:project-a', initialRevision: 0, save: () => first.promise,
    onRevision: (revision) => revisions.push(revision),
  });
  stale.enqueue({ value: 'stale' });
  stale.dispose();
  first.resolve({ status: 'ready', revision: 1 });
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual(revisions, []);

  const conflict = createStudioConnectedSaveQueue<{ value: string }>({
    scope: 'owner-b:project-b', initialRevision: 7,
    save: async () => ({ status: 'conflict' }),
  });
  conflict.enqueue({ value: 'keep me' });
  assert.equal(await conflict.whenIdle(), 'conflict');
  conflict.enqueue({ value: 'newest draft' });
  assert.deepEqual(conflict.draft(), { value: 'newest draft' });
  assert.deepEqual(conflict.state(), { blockedByConflict: true, inFlight: false, revision: 7 });
});
