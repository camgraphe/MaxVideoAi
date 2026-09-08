import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import { createStudioConnectedSaveQueue } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_state/studio-connected-save-queue';
import { buildWorkspaceActiveSequenceSnapshot } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_state/workspace-sequence-snapshot';
import {
  readStudioConnectedWorkspaceDraft,
  resolveStudioConnectedWorkspaceHydration,
  shouldClearStudioWorkspaceForAccountChange,
} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_state/workspace-persistence';
import { studioMediaAssetIdsForWorkspace } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceMediaAccess';
import { completeStudioWorkspaceExit } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceShellActions';

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
  const savedDrafts: Array<{ value: string }> = [];
  const stale = createStudioConnectedSaveQueue<{ value: string }>({
    scope: 'owner-a:project-a', initialRevision: 0, save: () => first.promise,
    onRevision: (revision) => revisions.push(revision),
    onSaved: (draft) => savedDrafts.push(draft),
  });
  stale.enqueue({ value: 'stale' });
  stale.dispose();
  first.resolve({ status: 'ready', revision: 1 });
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual(revisions, []);
  assert.deepEqual(savedDrafts, [], 'consumer side effects are suppressed with the late ACK');

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

test('connected hydration snapshots keep the stored timestamp until a real sequence action', () => {
  const updatedAt = '2026-09-08T10:00:00.000Z';
  const sequence = {
    id: 'main', name: 'Main', timelineItems: [], projectSettings: { fps: 24, aspectRatio: '16:9', resolution: '1080p' },
    audioTrackCount: 2, hiddenVideoTracks: [], lockedTimelineTracks: [], mutedAudioTracks: [], videoTrackCount: 1,
    timelinePanelHeight: null, timelineInPointSec: null, timelineOutPointSec: null,
    createdAt: updatedAt, updatedAt,
  } as const;
  const snapshot = buildWorkspaceActiveSequenceSnapshot({
    activeSequenceId: 'main', timelineItems: [], projectSettings: sequence.projectSettings,
    audioTrackCount: 2, hiddenVideoTracks: [], lockedTimelineTracks: [], mutedAudioTracks: [], videoTrackCount: 1,
    timelinePanelHeight: null, timelineInPointSec: null, timelineOutPointSec: null,
    sequences: [sequence], preserveStoredUpdatedAt: true,
  });
  assert.equal(snapshot.updatedAt, updatedAt);
});

test('a recovered connected draft is resumed only at its exact server revision', () => {
  const server = { title: 'server' } as never;
  const draftState = { title: 'draft' } as never;
  const storage = {
    getItem: () => JSON.stringify({ revision: 4, state: draftState }),
  };
  const draft = readStudioConnectedWorkspaceDraft(storage, 'scope-key', (value) => value as never);
  assert.deepEqual(draft, { dirty: true, revision: 4, state: draftState });
  assert.deepEqual(resolveStudioConnectedWorkspaceHydration({ serverRevision: 4, serverState: server, draft }), {
    state: draftState, baseRevision: 4, conflict: false, source: 'draft',
  });
  assert.deepEqual(resolveStudioConnectedWorkspaceHydration({ serverRevision: 5, serverState: server, draft }), {
    state: draftState, baseRevision: 4, conflict: true, source: 'draft',
  });
  const identical = { dirty: true, revision: 5, state: server };
  assert.deepEqual(resolveStudioConnectedWorkspaceHydration({ serverRevision: 5, serverState: server, draft: identical }), {
    state: server, baseRevision: 5, conflict: false, source: 'server',
  });
  assert.deepEqual(resolveStudioConnectedWorkspaceHydration({
    serverRevision: 6, serverState: server, draft: { dirty: false, revision: 5, state: draftState },
  }), { state: server, baseRevision: 6, conflict: false, source: 'server' });
});

test('a reopened stale draft starts blocked without issuing a write', async () => {
  const calls: unknown[] = [];
  const queue = createStudioConnectedSaveQueue<{ value: string }>({
    scope: 'owner-a:project-a', initialRevision: 8,
    initialConflictDraft: { value: 'local draft' },
    save: async (request) => { calls.push(request); return { status: 'ready', revision: 9 }; },
  });
  assert.deepEqual(queue.state(), { blockedByConflict: true, inFlight: false, revision: 8 });
  assert.deepEqual(queue.draft(), { value: 'local draft' });
  assert.equal(await queue.whenIdle(), 'conflict');
  assert.deepEqual(calls, []);
});

test('private access requests include bin, active timeline, and every live sequence reference', () => {
  const ref = (letter: string) => ({ type: 'asset' as const, kind: 'video' as const, assetId: `ma_${letter.repeat(32)}` });
  const item = (id: string, letter: string) => ({ id, ref: ref(letter) }) as never;
  assert.deepEqual(studioMediaAssetIdsForWorkspace({
    projectAssets: [item('asset-a', 'a')],
    timelineItems: [item('active-b', 'b')],
    sequences: [
      { timelineItems: [item('sequence-b', 'b'), item('sequence-c', 'c')] },
      { timelineItems: [item('sequence-d', 'd')] },
    ],
  }), [`ma_${'a'.repeat(32)}`, `ma_${'b'.repeat(32)}`, `ma_${'c'.repeat(32)}`, `ma_${'d'.repeat(32)}`]);
});

test('account changes clear project media and connected exits wait for a real ACK', async () => {
  assert.equal(shouldClearStudioWorkspaceForAccountChange('owner-a', 'owner-b', 'project-a'), true);
  assert.equal(shouldClearStudioWorkspaceForAccountChange(null, 'owner-a', 'project-a'), true);
  assert.equal(shouldClearStudioWorkspaceForAccountChange('owner-a', 'owner-a', 'project-a'), false);
  assert.equal(shouldClearStudioWorkspaceForAccountChange('owner-a', 'owner-b', undefined), false);

  const navigations: string[] = [];
  const notices: string[] = [];
  const copy = {
    studioApiUnauthorized: 'unauthorized', studioApiUnavailable: 'unavailable',
    workspaceConflict: 'conflict', workspaceSavedReturningToProjects: 'saved',
  };
  await completeStudioWorkspaceExit({ connected: true, save: async () => 'conflict', notices: copy, setNotice: (notice) => notices.push(notice), navigate: () => navigations.push('go') });
  assert.deepEqual({ navigations, notices }, { navigations: [], notices: ['conflict'] });
  await completeStudioWorkspaceExit({ connected: true, save: async () => 'ready', notices: copy, setNotice: (notice) => notices.push(notice), navigate: () => navigations.push('go') });
  assert.deepEqual({ navigations, notices }, { navigations: ['go'], notices: ['conflict', 'saved'] });
  await completeStudioWorkspaceExit({ connected: false, save: async () => 'error', notices: copy, setNotice: (notice) => notices.push(notice), navigate: () => navigations.push('go') });
  assert.deepEqual({ navigations, notices }, { navigations: ['go', 'go'], notices: ['conflict', 'saved', 'saved'] });
});

test('disposing an in-flight connected save cannot acknowledge a pending Projects exit', async () => {
  const deferred = Promise.withResolvers<{ status: 'ready'; revision: number }>();
  const queue = createStudioConnectedSaveQueue<{ value: string }>({
    scope: 'owner-a:project-a', initialRevision: 0, save: () => deferred.promise,
  });
  const notices: string[] = [];
  const navigations: string[] = [];
  const exit = completeStudioWorkspaceExit({
    connected: true,
    save: () => {
      queue.enqueue({ value: 'pending' });
      return queue.whenIdle();
    },
    notices: {
      studioApiUnauthorized: 'unauthorized', studioApiUnavailable: 'unavailable',
      workspaceConflict: 'conflict', workspaceSavedReturningToProjects: 'saved',
    },
    setNotice: (notice) => notices.push(notice),
    navigate: () => navigations.push('go'),
  });
  await new Promise<void>((resolvePending) => setImmediate(resolvePending));
  queue.dispose();
  await exit;
  assert.deepEqual(navigations, []);
  assert.deepEqual(notices, ['unavailable']);
  deferred.resolve({ status: 'ready', revision: 1 });
});

test('both Projects exits stay disabled until a project persistence mode is resolved', () => {
  const workspace = readFileSync(resolve('frontend/app/(core)/(workspace)/app/studio/workspace/WorkspacePage.client.tsx'), 'utf8');
  const layout = readFileSync(resolve('frontend/app/(core)/(workspace)/app/studio/workspace/_components/WorkspaceEditorLayout.tsx'), 'utf8');
  const topbar = readFileSync(resolve('frontend/app/(core)/(workspace)/app/studio/workspace/_components/WorkspaceEditorTopbar.tsx'), 'utf8');
  const session = readFileSync(resolve('frontend/app/(core)/(workspace)/app/studio/workspace/_components/StudioHeaderSession.tsx'), 'utf8');
  assert.match(workspace, /exitReady: persistence\.exitReady/);
  assert.match(layout, /exitToProjectsDisabled=\{shell\.exitToProjectsDisabled\}/);
  assert.match(topbar, /disabled=\{exitToProjectsDisabled\}[\s\S]*StudioHeaderSession[\s\S]*exitToProjectsDisabled=\{exitToProjectsDisabled\}/);
  assert.match(session, /disabled=\{exitToProjectsDisabled\}/);
});
