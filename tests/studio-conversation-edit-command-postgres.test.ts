import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {startDisposablePostgres} from './helpers/disposable-postgres';
import {initializeStudioConnectedFixture, STUDIO_CONNECTED_ASSET_IDS, STUDIO_CONNECTED_MONTAGE_INPUT} from './helpers/studio-connected-fixture-data';
import {STUDIO_FIXTURE_OWNERS} from './helpers/studio-auth-fixture';
import {createStudioMontageProject} from '../frontend/src/server/studio/montage-command';
import {readStudioWorkspace} from '../frontend/src/server/studio/workspace-command';
import type {QueryExecutor} from '../frontend/src/lib/db';

test('conversation edits use canonical revisions and receipts, preserving manual changes and unrelated editor state', async t => {
  const module = await import('../frontend/src/server/studio/conversation-edit-command').catch(() => null);
  assert.ok(module?.editStudioConversationTimeline);
  const pg = await startDisposablePostgres('stchat-edit');
  t.after(() => pg.cleanup());
  await initializeStudioConnectedFixture(pg);
  // Mutation/revision proof uses external originals; private signing has its own byte-backed integration suite.
  await pg.pool.query("UPDATE media_assets SET url='https://cdn.maxvideoai.com/' || public_id || '.mp4'");
  const withTransaction = async <T>(callback: (executor: QueryExecutor) => Promise<T>) => {
    const client = await pg.pool.connect();
    try {await client.query('BEGIN'); const result = await callback({query: async (sql, values) => (await client.query(sql, values)).rows}); await client.query('COMMIT'); return result;}
    catch (error) {await client.query('ROLLBACK'); throw error;} finally {client.release();}
  };
  const deps = {withTransaction, featureEnabled: true};
  const actor = {userId: STUDIO_FIXTURE_OWNERS[0]};
  const project = await createStudioMontageProject(actor, STUDIO_CONNECTED_MONTAGE_INPUT, deps);
  await pg.pool.query("UPDATE studio_projects SET workspace_state=workspace_state || '{\"projectMediaFolders\":[{\"id\":\"keep-me\"}],\"customFutureState\":{\"kept\":true}}'::jsonb WHERE id=$1", [project.projectId]);
  const input = {projectId: project.projectId, sequenceId: project.sequenceId, expectedRevision: 0, idempotencyKey: randomUUID(), edit: {kind: 'trim' as const, clipId: 'montage-clip-01', edge: 'start' as const, durationFrames: 30}};
  const result = await module.editStudioConversationTimeline(actor, input, deps);
  assert.equal(result.revision, 1);
  assert.deepEqual(await module.editStudioConversationTimeline(actor, input, deps), result);
  const read = await readStudioWorkspace(actor, project.projectId, deps);
  const state = read.sequences[0].timelineState as any;
  assert.deepEqual(state.timelineItems.map((item: any) => [item.startSec, item.durationSec, item.sourceStartSec]), [[0,1,2],[1,2,.5]]);
  assert.deepEqual((read.project.workspaceState as any).customFutureState, {kept: true});
  assert.equal((state.timelineItems[0].montageSource).sourceInFrame, 30);
  await assert.rejects(module.editStudioConversationTimeline(actor, {...input, idempotencyKey: randomUUID(), edit: {kind: 'move', clipId: 'montage-clip-02', startFrame: 150}}, deps), {code: 'STUDIO_REVISION_CONFLICT'});
  await assert.rejects(module.editStudioConversationTimeline(actor, {...input, expectedRevision: 1}, deps), {code: 'STUDIO_IDEMPOTENCY_CONFLICT'});
  await assert.rejects(module.editStudioConversationTimeline({userId: STUDIO_FIXTURE_OWNERS[1]}, input, deps), /STUDIO_PROJECT_NOT_FOUND/);
  const insert = {...input, expectedRevision: 1, idempotencyKey: randomUUID(), edit: {kind: 'insert' as const, ref: {type: 'asset' as const, assetId: STUDIO_CONNECTED_ASSET_IDS.a, kind: 'video' as const}, startFrame: 90, durationFrames: 60}};
  const inserted = await module.editStudioConversationTimeline(actor, insert, deps);
  assert.equal(inserted.clipCount, 3);
  await assert.rejects(module.editStudioConversationTimeline(actor, {...insert, expectedRevision: 2, idempotencyKey: randomUUID(), edit: {...insert.edit, ref: {...insert.edit.ref, assetId: STUDIO_CONNECTED_ASSET_IDS.foreign}}}, deps), /MEDIA_NOT_AVAILABLE/);
  await assert.rejects(module.editStudioConversationTimeline(actor, {...insert, expectedRevision: 2, idempotencyKey: randomUUID(), edit: {...insert.edit, ref: {...insert.edit.ref, assetId: STUDIO_CONNECTED_ASSET_IDS.unmeasured}}}, deps), /MEDIA_METADATA_REQUIRED/);
  await assert.rejects(module.editStudioConversationTimeline(actor, {...insert, expectedRevision: 2, idempotencyKey: randomUUID()}, {...deps, afterMutation: () => {throw new Error('Lost receipt');}}), /Lost receipt/);
  assert.equal((await readStudioWorkspace(actor, project.projectId, deps)).project.revision, 2);
  const conflicting = await Promise.allSettled([3,4].map(startFrame => module.editStudioConversationTimeline(actor, {...input, expectedRevision: 2, idempotencyKey: randomUUID(), edit: {kind: 'move', clipId: 'montage-clip-01', startFrame: startFrame * 30}}, deps)));
  assert.equal(conflicting.filter(value => value.status === 'fulfilled').length, 1);
  assert.equal((await pg.pool.query("SELECT count(*)::int AS n FROM studio_project_commands WHERE command_kind='conversation_timeline_edit'")).rows[0].n, 3);
  assert.ok(module.createStudioConversationProject);
  const starter = {name: 'New film',idempotencyKey: randomUUID()};
  const blank = await module.createStudioConversationProject(actor,starter,deps);
  assert.deepEqual(await module.createStudioConversationProject(actor,starter,deps),blank);
  const empty = await readStudioWorkspace(actor,blank.projectId,deps);
  assert.equal(empty.sequences.length,1);
  assert.deepEqual((empty.sequences[0].timelineState as any).timelineItems,[]);
  assert.equal(empty.project.revision,0);
  assert.equal((await readStudioWorkspace(actor,project.projectId,deps)).project.revision,3);
});
