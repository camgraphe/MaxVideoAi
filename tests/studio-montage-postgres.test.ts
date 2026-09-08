import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import type { Pool } from 'pg';

import { startDisposablePostgres, missingDisposablePostgresCommand } from './helpers/disposable-postgres';
import type { QueryExecutor } from '../frontend/src/lib/db';
import {
  createStudioMontageProject,
  StudioConnectedPersistenceError,
  type StudioMontageTransactionStage,
} from '../frontend/src/server/studio/montage-command';

const ownerA = '00000000-0000-4000-8000-00000000000a';
const ownerB = '00000000-0000-4000-8000-00000000000b';
const firstAssetId = `ma_${'a'.repeat(32)}`;
const secondAssetId = `ma_${'b'.repeat(32)}`;
const ownerBFirstAssetId = `ma_${'8'.repeat(32)}`;
const ownerBSecondAssetId = `ma_${'9'.repeat(32)}`;
const linkedAssetId = `ma_${'7'.repeat(32)}`;

const input = {
  title: 'Persistent montage',
  settings: { fps: 24 as const, aspectRatio: '16:9' as const, resolution: '1080p' as const, audioMode: 'preserve' as const },
  clips: [
    { assetId: firstAssetId, sourceInFrame: 12, durationFrames: 24 },
    { assetId: secondAssetId, sourceInFrame: 0, durationFrames: 48 },
  ],
  idempotencyKey: 'retry-key-001',
};

async function verifiedDatabase() {
  assert.equal(missingDisposablePostgresCommand(), null);
  const database = await startDisposablePostgres('stmon');
  try {
    const socket = new URL(database.databaseUrl).searchParams.get('host');
    assert.ok(socket?.includes('/stmon-') && socket.endsWith('/socket'));
    const facts = (await database.pool.query(
      "SELECT current_setting('listen_addresses') AS listeners, current_setting('server_version_num')::int AS version, current_setting('unix_socket_directories') AS sockets, current_setting('data_directory') AS directory",
    )).rows[0];
    assert.equal(facts.listeners, '');
    assert.equal(facts.sockets, socket);
    assert.equal(facts.directory, socket.replace(/\/socket$/u, '/data'));
    assert.ok(facts.version >= 170000 && facts.version < 180000);
    await database.pool.query(await readFile('neon/migrations/26_studio_projects.sql', 'utf8'));
    await database.pool.query(await readFile('neon/migrations/42_studio_connected_montages.sql', 'utf8'));
    await database.pool.query(`
    CREATE TABLE app_jobs(job_id text PRIMARY KEY, user_id text NOT NULL, hidden boolean NOT NULL DEFAULT false);
    CREATE TABLE job_outputs(id text PRIMARY KEY, job_id text NOT NULL, user_id text NOT NULL, kind text NOT NULL,
      url text NOT NULL, storage_url text, mime_type text, status text, metadata jsonb);
    CREATE TABLE media_assets(id text PRIMARY KEY, public_id text UNIQUE, user_id text NOT NULL, kind text NOT NULL,
      url text NOT NULL, storage_url text, thumb_url text, preview_url text, mime_type text, status text,
      deleted_at timestamptz, source_job_id text, source_output_id text, metadata jsonb);
    INSERT INTO app_jobs VALUES ('job-visible', '${ownerA}', false), ('job-hidden', '${ownerA}', true);
    INSERT INTO job_outputs VALUES ('output-visible', 'job-visible', '${ownerA}', 'video',
      'https://cdn.maxvideoai.com/linked.mp4', null, 'video/mp4', 'ready', '{"mediaFacts":{"source":"probe","durationSec":6}}');
    INSERT INTO media_assets VALUES
      ('internal-a', '${firstAssetId}', '${ownerA}', 'video', 'https://cdn.maxvideoai.com/a.mp4', null, null, null,
       'video/mp4', 'ready', null, null, null,
       '{"originalName":"pattern-a.mp4","mediaFacts":{"source":"probe","durationSec":6,"width":1920,"height":1080,"hasAudio":true}}'),
      ('internal-b', '${secondAssetId}', '${ownerA}', 'video', 'https://cdn.maxvideoai.com/b.mp4', null, null, null,
       'video/mp4', 'ready', null, null, null,
       '{"originalName":"pattern-b.mp4","mediaFacts":{"source":"probe","durationSec":6,"width":1920,"height":1080,"hasAudio":false}}'),
      ('flat-duration', 'ma_${'c'.repeat(32)}', '${ownerA}', 'video', 'https://cdn.maxvideoai.com/c.mp4', null, null, null,
       'video/mp4', 'ready', null, null, null, '{"durationSec":6}'),
      ('foreign', 'ma_${'d'.repeat(32)}', '${ownerB}', 'video', 'https://cdn.maxvideoai.com/d.mp4', null, null, null,
       'video/mp4', 'ready', null, null, null, '{"mediaFacts":{"source":"probe","durationSec":6}}'),
      ('pending', 'ma_${'e'.repeat(32)}', '${ownerA}', 'video', 'https://cdn.maxvideoai.com/e.mp4', null, null, null,
       'video/mp4', 'pending', null, null, null, '{"mediaFacts":{"source":"probe","durationSec":6}}'),
      ('deleted', 'ma_${'f'.repeat(32)}', '${ownerA}', 'video', 'https://cdn.maxvideoai.com/f.mp4', null, null, null,
       'video/mp4', 'ready', now(), null, null, '{"mediaFacts":{"source":"probe","durationSec":6}}'),
      ('hidden', 'ma_${'0'.repeat(32)}', '${ownerA}', 'video', 'https://cdn.maxvideoai.com/hidden.mp4', null, null, null,
       'video/mp4', 'ready', null, 'job-hidden', null, '{"mediaFacts":{"source":"probe","durationSec":6}}'),
      ('linked', '${linkedAssetId}', '${ownerA}', 'video', 'https://cdn.maxvideoai.com/linked.mp4', null, null, null,
       'video/mp4', 'ready', null, 'job-visible', 'output-visible',
       '{"mediaFacts":{"source":"probe","durationSec":6,"width":1920,"height":1080,"hasAudio":true}}');
    `);
    return database;
  } catch (error) {
    await database.cleanup();
    throw error;
  }
}

function transactionFor(pool: Pool, afterStage?: (stage: StudioMontageTransactionStage) => void) {
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
    } finally {
      client.release();
    }
  };
}

test('one transaction persists the ordered montage and exact idempotency receipt without media URLs in its result', async () => {
  const database = await verifiedDatabase();
  try {
    const result = await createStudioMontageProject({ userId: ownerA }, input, {
      withTransaction: transactionFor(database.pool), featureEnabled: true,
      createIds: () => ({ projectId: 'project-ordered', sequenceId: 'sequence-ordered' }),
      now: () => new Date('2026-09-08T10:00:00.000Z'),
    });
    assert.deepEqual(result, {
      schemaVersion: 1, status: 'studio_project', persisted: true, title: input.title,
      projectId: 'project-ordered', sequenceId: 'sequence-ordered', revision: 0,
      studioUrl: '/app/studio/workspace/project-ordered', clipCount: 2, totalFrames: 72,
      totalSeconds: 3, orderingBasis: 'caller_supplied',
    });
    assert.doesNotMatch(JSON.stringify(result), /cdn\.maxvideoai|\.mp4|signed/iu);
    const project = (await database.pool.query("SELECT persistence_mode, revision, workspace_state FROM studio_projects WHERE id='project-ordered'" )).rows[0];
    assert.equal(project.persistence_mode, 'connected');
    assert.equal(project.revision, '0');
    assert.equal(project.workspace_state.focusMode, 'viewer');
    assert.deepEqual(project.workspace_state.projectAssets.map((asset: { ref: { assetId: string } }) => asset.ref.assetId), [firstAssetId, secondAssetId]);
    const timeline = (await database.pool.query("SELECT timeline_state FROM studio_sequences WHERE id='sequence-ordered'" )).rows[0].timeline_state.timelineItems;
    assert.deepEqual(timeline.map((clip: { ref: { assetId: string }; startSec: number; sourceStartSec: number; durationSec: number }) => ({
      assetId: clip.ref.assetId, startSec: clip.startSec, sourceStartSec: clip.sourceStartSec, durationSec: clip.durationSec,
    })), [
      { assetId: firstAssetId, startSec: 0, sourceStartSec: 0.5, durationSec: 1 },
      { assetId: secondAssetId, startSec: 1, sourceStartSec: 0, durationSec: 2 },
    ]);
    assert.equal((await database.pool.query('SELECT count(*)::int AS count FROM studio_project_commands')).rows[0].count, 1);
  } finally {
    await database.cleanup();
  }
});

test('same-owner retries are concurrent-safe, preserve later edits, reject changed payloads, and never resurrect deletion', async () => {
  const database = await verifiedDatabase();
  try {
    const deps = {
      withTransaction: transactionFor(database.pool), featureEnabled: true,
      createIds: () => ({ projectId: 'project-idempotent', sequenceId: 'sequence-idempotent' }),
    };
    const [first, replay] = await Promise.all([
      createStudioMontageProject({ userId: ownerA }, input, deps),
      createStudioMontageProject({ userId: ownerA }, input, deps),
    ]);
    assert.equal(first.projectId, replay.projectId);
    assert.equal((await database.pool.query('SELECT count(*)::int AS count FROM studio_projects')).rows[0].count, 1);
    await database.pool.query("UPDATE studio_projects SET name='Edited after create', revision=3 WHERE id='project-idempotent'");
    const editedReplay = await createStudioMontageProject({ userId: ownerA }, input, deps);
    assert.equal(editedReplay.revision, 3);
    assert.equal((await database.pool.query("SELECT name FROM studio_projects WHERE id='project-idempotent'")).rows[0].name, 'Edited after create');
    await assert.rejects(
      createStudioMontageProject({ userId: ownerA }, { ...input, title: 'Different payload' }, deps),
      (error: unknown) => error instanceof StudioConnectedPersistenceError && error.code === 'STUDIO_IDEMPOTENCY_CONFLICT',
    );
    await database.pool.query("UPDATE studio_projects SET deleted_at=now() WHERE id='project-idempotent'");
    await assert.rejects(
      createStudioMontageProject({ userId: ownerA }, input, deps),
      (error: unknown) => error instanceof StudioConnectedPersistenceError && error.code === 'STUDIO_MONTAGE_PROJECT_GONE',
    );
    assert.equal((await database.pool.query("SELECT deleted_at IS NOT NULL AS deleted FROM studio_projects WHERE id='project-idempotent'")).rows[0].deleted, true);
  } finally {
    await database.cleanup();
  }
});

test('idempotency is owner-scoped and invalid, unmeasured, foreign, pending, deleted or hidden media leave no partial state', async () => {
  const database = await verifiedDatabase();
  try {
    let ordinal = 0;
    const deps = {
      withTransaction: transactionFor(database.pool), featureEnabled: true,
      createIds: () => ({ projectId: `project-${++ordinal}`, sequenceId: `sequence-${ordinal}` }),
    };
    await createStudioMontageProject({ userId: ownerA }, input, deps);
    await database.pool.query(`INSERT INTO media_assets
      SELECT 'owner-b-a', '${ownerBFirstAssetId}', '${ownerB}', kind, url, storage_url, thumb_url, preview_url, mime_type, status, deleted_at, null, null, metadata
      FROM media_assets WHERE id='internal-a'`);
    await database.pool.query(`INSERT INTO media_assets
      SELECT 'owner-b-b', '${ownerBSecondAssetId}', '${ownerB}', kind, url, storage_url, thumb_url, preview_url, mime_type, status, deleted_at, null, null, metadata
      FROM media_assets WHERE id='internal-b'`);
    const ownerBResult = await createStudioMontageProject({ userId: ownerB }, {
      ...input,
      clips: [
        { ...input.clips[0], assetId: ownerBFirstAssetId },
        { ...input.clips[1], assetId: ownerBSecondAssetId },
      ],
    }, deps);
    assert.notEqual(ownerBResult.projectId, 'project-1');

    for (const [key, assetId] of [
      ['flat', `ma_${'c'.repeat(32)}`], ['foreign', `ma_${'d'.repeat(32)}`], ['pending', `ma_${'e'.repeat(32)}`],
      ['deleted', `ma_${'f'.repeat(32)}`], ['hidden', `ma_${'0'.repeat(32)}`],
    ]) {
      const before = (await database.pool.query('SELECT count(*)::int AS count FROM studio_projects')).rows[0].count;
      await assert.rejects(createStudioMontageProject({ userId: ownerA }, {
        ...input, idempotencyKey: `invalid-${key}`, clips: [{ ...input.clips[0], assetId }, input.clips[1]],
      }, deps));
      assert.equal((await database.pool.query('SELECT count(*)::int AS count FROM studio_projects')).rows[0].count, before);
    }
  } finally {
    await database.cleanup();
  }
});

test('linked job and output state is revalidated under locks before any montage row is written', async () => {
  const database = await verifiedDatabase();
  const blocker = await database.pool.connect();
  try {
    await blocker.query('BEGIN');
    await blocker.query("UPDATE app_jobs SET hidden=true WHERE job_id='job-visible'");
    const create = createStudioMontageProject({ userId: ownerA }, {
      ...input,
      idempotencyKey: 'linked-race',
      clips: [{ ...input.clips[0], assetId: linkedAssetId }, input.clips[1]],
    }, {
      withTransaction: transactionFor(database.pool), featureEnabled: true,
      createIds: () => ({ projectId: 'project-linked-race', sequenceId: 'sequence-linked-race' }),
    });
    let waiting = false;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const activity = await database.pool.query(`SELECT EXISTS (
        SELECT 1 FROM pg_stat_activity
        WHERE wait_event_type = 'Lock' AND query LIKE '%FOR SHARE OF o, j%'
      ) AS waiting`);
      if (activity.rows[0].waiting) { waiting = true; break; }
      await delay(10);
    }
    assert.equal(waiting, true, 'the source revalidation must wait on the concurrent app_jobs update');
    await blocker.query('COMMIT');
    await assert.rejects(create, /MEDIA_NOT_AVAILABLE/u);
    assert.equal((await database.pool.query("SELECT count(*)::int AS count FROM studio_projects WHERE id='project-linked-race'")).rows[0].count, 0);
  } finally {
    await blocker.query('ROLLBACK').catch(() => undefined);
    blocker.release();
    await database.cleanup();
  }
});

test('an injected failure after every write stage rolls back project, sequence and receipt together', async () => {
  for (const stage of ['project', 'sequence', 'receipt'] as const) {
    const database = await verifiedDatabase();
    try {
      await assert.rejects(createStudioMontageProject({ userId: ownerA }, {
        ...input, idempotencyKey: `rollback-${stage}`,
      }, {
        withTransaction: transactionFor(database.pool), featureEnabled: true,
        createIds: () => ({ projectId: `project-${stage}`, sequenceId: `sequence-${stage}` }),
        afterStage(current) { if (current === stage) throw new Error(`fail-after-${stage}`); },
      }), new RegExp(`fail-after-${stage}`));
      for (const table of ['studio_projects', 'studio_sequences', 'studio_project_commands']) {
        assert.equal((await database.pool.query(`SELECT count(*)::int AS count FROM ${table}`)).rows[0].count, 0);
      }
    } finally {
      await database.cleanup();
    }
  }
});
