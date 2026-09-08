import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import type { Pool } from 'pg';

import { startDisposablePostgres, missingDisposablePostgresCommand } from './helpers/disposable-postgres';
import type { QueryExecutor } from '../frontend/src/lib/db';
import { getDb } from '../frontend/src/lib/db';
import {
  readStudioWorkspace,
  saveStudioWorkspace,
  StudioConnectedPersistenceError,
} from '../frontend/src/server/studio/workspace-command';
import {
  deleteStudioProject,
  deleteStudioSequence,
  upsertStudioProject,
  upsertStudioSequence,
} from '../frontend/src/server/studio/repository';

const owner = '00000000-0000-4000-8000-00000000000a';

async function verifiedDatabase() {
  assert.equal(missingDisposablePostgresCommand(), null);
  const database = await startDisposablePostgres('strev');
  try {
    const socket = new URL(database.databaseUrl).searchParams.get('host');
    assert.ok(socket?.includes('/strev-') && socket.endsWith('/socket'));
    const facts = (await database.pool.query("SELECT current_setting('listen_addresses') AS listeners, current_setting('server_version_num')::int AS version, current_setting('unix_socket_directories') AS sockets, current_setting('data_directory') AS directory")).rows[0];
    assert.deepEqual({ listeners: facts.listeners, sockets: facts.sockets }, { listeners: '', sockets: socket });
    assert.equal(facts.directory, socket.replace(/\/socket$/u, '/data'));
    assert.ok(facts.version >= 170000 && facts.version < 180000);
    await database.pool.query(await readFile('neon/migrations/26_studio_projects.sql', 'utf8'));
    await database.pool.query(await readFile('neon/migrations/42_studio_connected_montages.sql', 'utf8'));
    await database.pool.query(`
    INSERT INTO studio_projects(id,user_id,name,canvas_template_id,settings,workspace_state,persistence_mode,revision)
    VALUES ('connected-project','${owner}','Connected','minimal-start','{"fps":24,"aspectRatio":"16:9","resolution":"1080p"}',
      '{"nodes":[],"edges":[],"timelineItems":[],"sequences":[],"activeSequenceId":"sequence-main","activeTemplateId":"minimal-start","projectSettings":{"fps":24,"aspectRatio":"16:9","resolution":"1080p"}}',
      'connected',0),
      ('legacy-project','${owner}','Legacy','minimal-start','{}','{}','legacy',0);
    INSERT INTO studio_sequences(id,user_id,project_id,name,settings,timeline_state)
    VALUES ('sequence-main','${owner}','connected-project','Main sequence','{"fps":24,"aspectRatio":"16:9","resolution":"1080p"}',
      '{"timelineItems":[],"audioTrackCount":2,"videoTrackCount":1}');
    `);
    process.env.DATABASE_URL = database.databaseUrl;
    return database;
  } catch (error) {
    delete process.env.DATABASE_URL;
    await database.cleanup();
    throw error;
  }
}

function transactionFor(pool: Pool) {
  return async <T>(callback: (executor: QueryExecutor) => Promise<T>): Promise<T> => {
    const client = await pool.connect();
    const executor: QueryExecutor = { query: async (sql, values) => (await client.query(sql, values)).rows };
    try {
      await client.query('BEGIN');
      const result = await callback(executor);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  };
}

function snapshot(name: string, sequenceIds = ['sequence-main']) {
  const projectSettings = { fps: 24, aspectRatio: '16:9', resolution: '1080p' };
  return {
    name,
    canvasTemplateId: 'minimal-start',
    settings: projectSettings,
    workspaceState: {
      nodes: [], edges: [], timelineItems: [], activeTemplateId: 'minimal-start', activeSequenceId: sequenceIds[0],
      projectSettings, focusMode: 'viewer', projectAssets: [], projectMediaFolders: [],
      sequences: sequenceIds.map((id) => ({
        id, name: id, timelineItems: [], projectSettings, audioTrackCount: 2, hiddenVideoTracks: [],
        lockedTimelineTracks: [], mutedAudioTracks: [], videoTrackCount: 1, timelinePanelHeight: null,
        timelineInPointSec: null, timelineOutPointSec: null, createdAt: '2026-09-08T00:00:00.000Z', updatedAt: '2026-09-08T00:00:00.000Z',
      })),
    },
  };
}

test('two concurrent CAS saves have one winner and the stale draft cannot overwrite or delete newer sequences', async () => {
  const database = await verifiedDatabase();
  try {
    const deps = { withTransaction: transactionFor(database.pool) };
    const settled = await Promise.allSettled([
      saveStudioWorkspace({ userId: owner }, { projectId: 'connected-project', expectedRevision: 0, snapshot: snapshot('First') }, deps),
      saveStudioWorkspace({ userId: owner }, { projectId: 'connected-project', expectedRevision: 0, snapshot: snapshot('Second') }, deps),
    ]);
    assert.equal(settled.filter((result) => result.status === 'fulfilled').length, 1);
    const rejected = settled.find((result): result is PromiseRejectedResult => result.status === 'rejected');
    assert.ok(rejected?.reason instanceof StudioConnectedPersistenceError);
    assert.equal(rejected.reason.code, 'STUDIO_REVISION_CONFLICT');
    assert.equal((await database.pool.query("SELECT revision FROM studio_projects WHERE id='connected-project'")).rows[0].revision, '1');

    await database.pool.query(`INSERT INTO studio_sequences(id,user_id,project_id,name,settings,timeline_state)
      VALUES ('sequence-new','${owner}','connected-project','New sequence','{}','{"timelineItems":[]}');
      UPDATE studio_projects SET revision=2 WHERE id='connected-project'`);
    await assert.rejects(
      saveStudioWorkspace({ userId: owner }, { projectId: 'connected-project', expectedRevision: 1, snapshot: snapshot('Stale') }, deps),
      (error: unknown) => error instanceof StudioConnectedPersistenceError && error.code === 'STUDIO_REVISION_CONFLICT',
    );
    assert.equal((await database.pool.query("SELECT deleted_at FROM studio_sequences WHERE id='sequence-new'")).rows[0].deleted_at, null);
  } finally {
    delete process.env.DATABASE_URL;
    await database.cleanup();
  }
});

test('the atomic save replaces the connected aggregate only after validation and increments exactly one revision', async () => {
  const database = await verifiedDatabase();
  try {
    const saved = await saveStudioWorkspace({ userId: owner }, {
      projectId: 'connected-project', expectedRevision: 0,
      snapshot: snapshot('Saved', ['sequence-main', 'sequence-added']),
    }, { withTransaction: transactionFor(database.pool) });
    assert.deepEqual(saved, { projectId: 'connected-project', revision: 1 });
    assert.deepEqual((await database.pool.query("SELECT id FROM studio_sequences WHERE project_id='connected-project' AND deleted_at IS NULL ORDER BY id")).rows.map((row) => row.id), ['sequence-added', 'sequence-main']);
    const stored = (await database.pool.query("SELECT workspace_state FROM studio_projects WHERE id='connected-project'")).rows[0].workspace_state;
    assert.deepEqual(stored.timelineItems, []);
    assert.deepEqual(stored.sequences, []);

    await assert.rejects(saveStudioWorkspace({ userId: owner }, {
      projectId: 'connected-project', expectedRevision: 1,
      snapshot: { ...snapshot('Invalid'), workspaceState: { ...snapshot('Invalid').workspaceState, sequences: [] } },
    }, { withTransaction: transactionFor(database.pool) }), /at least one sequence/u);
    assert.equal((await database.pool.query("SELECT revision FROM studio_projects WHERE id='connected-project'")).rows[0].revision, '1');
  } finally {
    delete process.env.DATABASE_URL;
    await database.cleanup();
  }
});

test('the connected workspace reader locks the aggregate so project revision and sequences come from one state', async () => {
  const database = await verifiedDatabase();
  const locked = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  try {
    const deps = { withTransaction: transactionFor(database.pool) };
    const read = readStudioWorkspace({ userId: owner }, 'connected-project', {
      ...deps,
      afterProjectLock: async () => { locked.resolve(); await release.promise; },
    });
    await locked.promise;
    let saveSettled = false;
    const save = saveStudioWorkspace({ userId: owner }, {
      projectId: 'connected-project', expectedRevision: 0, snapshot: snapshot('After read'),
    }, deps).finally(() => { saveSettled = true; });
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(saveSettled, false, 'the writer must wait for the aggregate reader lock');
    release.resolve();
    const original = await read;
    assert.equal(original.project.revision, 0);
    assert.equal(original.project.name, 'Connected');
    assert.deepEqual(original.sequences.map((sequence) => sequence.id), ['sequence-main']);
    assert.deepEqual(await save, { projectId: 'connected-project', revision: 1 });
  } finally {
    delete process.env.DATABASE_URL;
    await database.cleanup();
  }
});

test('legacy writers lock the parent inside their transaction and recheck a concurrent transition to connected mode', async () => {
  const database = await verifiedDatabase();
  const operations = [
    () => upsertStudioProject({ userId: owner, id: 'legacy-project', name: 'Racing project write' }),
    () => upsertStudioSequence({ userId: owner, projectId: 'legacy-project', id: 'legacy-race-sequence', name: 'Racing sequence write' }),
    () => deleteStudioSequence({ userId: owner, projectId: 'legacy-project', sequenceId: 'legacy-sequence-a' }),
    () => deleteStudioProject({ userId: owner, projectId: 'legacy-project' }),
  ];
  try {
    await database.pool.query(`INSERT INTO studio_sequences(id,user_id,project_id,name,settings,timeline_state)
      VALUES ('legacy-sequence-a','${owner}','legacy-project','A','{}','{}'),
             ('legacy-sequence-b','${owner}','legacy-project','B','{}','{}')`);
    for (const operation of operations) {
      const blocker = await database.pool.connect();
      try {
        await blocker.query('BEGIN');
        await blocker.query("SELECT id FROM studio_projects WHERE id='legacy-project' FOR UPDATE");
        await blocker.query("UPDATE studio_projects SET persistence_mode='connected' WHERE id='legacy-project'");
        const attempted = operation();
        await new Promise<void>((resolve) => setImmediate(resolve));
        await blocker.query('COMMIT');
        await assert.rejects(attempted, /STUDIO_CONNECTED_PROJECT_REVISION_REQUIRED/u);
      } finally {
        await blocker.query('ROLLBACK').catch(() => undefined);
        blocker.release();
      }
      await database.pool.query("UPDATE studio_projects SET persistence_mode='legacy' WHERE id='legacy-project'");
    }
    assert.equal((await database.pool.query("SELECT deleted_at FROM studio_projects WHERE id='legacy-project'")).rows[0].deleted_at, null);
  } finally {
    await getDb().end();
    delete process.env.DATABASE_URL;
    await database.cleanup();
  }
});

test('all historical project and sequence writers explicitly refuse connected projects, including POST-style IDs and delete', async () => {
  const database = await verifiedDatabase();
  try {
    for (const operation of [
      () => upsertStudioProject({ userId: owner, id: 'connected-project', name: 'Legacy overwrite' }),
      () => upsertStudioSequence({ userId: owner, projectId: 'connected-project', id: 'sequence-main', name: 'Legacy overwrite' }),
      () => upsertStudioSequence({ userId: owner, projectId: 'connected-project', id: 'sequence-post-id', name: 'POST with ID' }),
      () => deleteStudioSequence({ userId: owner, projectId: 'connected-project', sequenceId: 'sequence-main' }),
      () => deleteStudioProject({ userId: owner, projectId: 'connected-project' }),
    ]) {
      await assert.rejects(operation(), /STUDIO_CONNECTED_PROJECT_REVISION_REQUIRED/u);
    }
    const legacy = await upsertStudioProject({ userId: owner, id: 'legacy-project', name: 'Legacy still works' });
    assert.equal(legacy.name, 'Legacy still works');
  } finally {
    await getDb().end();
    delete process.env.DATABASE_URL;
    await database.cleanup();
  }
});
