import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { startStudioIntegrationRuntime } from './helpers/studio-integration-runtime';
import { STUDIO_FIXTURE_OWNERS } from './helpers/studio-auth-fixture';

const projectAId = 'fixture-project-a';
const sequenceAId = 'fixture-sequence-a';

function workspaceSnapshot(name: string, sequenceIds: string[]) {
  const projectSettings = { fps: 30, aspectRatio: '16:9', resolution: '720p' };
  return {
    name, canvasTemplateId: 'minimal-start', settings: projectSettings,
    workspaceState: {
      nodes: [], edges: [], timelineItems: [], activeTemplateId: 'minimal-start', activeSequenceId: sequenceIds[0],
      projectSettings, projectAssets: [], projectMediaFolders: [], focusMode: 'viewer',
      sequences: sequenceIds.map(id => ({
        id, name: id, timelineItems: [], projectSettings, audioTrackCount: 2, videoTrackCount: 1,
        hiddenVideoTracks: [], lockedTimelineTracks: [], mutedAudioTracks: [], timelinePanelHeight: null,
        timelineInPointSec: null, timelineOutPointSec: null,
        createdAt: '2026-10-05T00:00:00.000Z', updatedAt: '2026-10-05T00:00:00.000Z',
      })),
    },
  };
}

// Explicit opt-in suite: starts its own isolated Next snapshot and local database.
test('real Studio routes authenticate cookie and bearer owners against a fresh PostgreSQL 17 cluster', { timeout: 180_000 }, async () => {
  const runtime = await startStudioIntegrationRuntime({
    revision: process.env.STUDIO_INTEGRATION_REVISION,
    initializeDatabase: async (database) => {
      await database.pool.query(await readFile('neon/migrations/26_studio_projects.sql', 'utf8'));
      await database.pool.query(await readFile('neon/migrations/42_studio_connected_montages.sql', 'utf8'));
      // Canonical connected records are SQL fixtures; retired Canvas writes never seed the test.
      const initial = workspaceSnapshot('Disposable route evidence', [sequenceAId]);
      await database.pool.query(`INSERT INTO studio_projects(id,user_id,name,canvas_template_id,settings,workspace_state,persistence_mode)
        VALUES ($1,$2,$3,'minimal-start',$4::jsonb,$5::jsonb,'connected')`,
      [projectAId, STUDIO_FIXTURE_OWNERS[0], initial.name, JSON.stringify(initial.settings), JSON.stringify({ ...initial.workspaceState, sequences: [] })]);
      await database.pool.query(`INSERT INTO studio_sequences(id,user_id,project_id,name,settings,timeline_state)
        VALUES ($1,$2,$3,'Owner A sequence',$4::jsonb,'{"timelineItems":[],"audioTrackCount":2,"videoTrackCount":1}')`,
      [sequenceAId, STUDIO_FIXTURE_OWNERS[0], projectAId, JSON.stringify(initial.settings)]);
      // Minimal media-reader schema, seeded only after the runtime verifies its fresh local cluster.
      await database.pool.query(`
        CREATE TABLE app_jobs(job_id text PRIMARY KEY, user_id text, hidden boolean);
        CREATE TABLE job_outputs(id text PRIMARY KEY, job_id text, user_id text, kind text, url text,
          storage_url text, mime_type text, status text, metadata jsonb);
        CREATE TABLE media_assets(id text PRIMARY KEY, public_id text, user_id text, kind text, url text,
          mime_type text, status text, deleted_at timestamptz, source_job_id text, source_output_id text, metadata jsonb);
      `);
      await database.pool.query("INSERT INTO app_jobs VALUES ('fixture-job', $1, false)", [STUDIO_FIXTURE_OWNERS[0]]);
      await database.pool.query(`INSERT INTO job_outputs VALUES
        ('fixture-output', 'fixture-job', $1, 'video', 'https://cdn.maxvideoai.com/legacy.mp4',
         'https://cdn.maxvideoai.com/original.mp4?signature=exact%2F&value=+', 'video/mp4', 'ready',
         '{"mediaFacts":{"source":"probe","durationSec":6,"hasAudio":false}}');`, [STUDIO_FIXTURE_OWNERS[0]]);
      await database.pool.query(`INSERT INTO media_assets VALUES
        ('fixture-internal', $1, $2, 'video', 'https://cdn.maxvideoai.com/original.mp4?signature=exact%2F&value=+',
         'video/mp4', 'ready', null, 'fixture-job', 'fixture-output',
         '{"mediaFacts":{"source":"probe","durationSec":6,"hasAudio":false}}');`,
      [`ma_${'a'.repeat(32)}`, STUDIO_FIXTURE_OWNERS[0]]);
    },
  });
  try {
    const sessionA = runtime.auth.createSession(STUDIO_FIXTURE_OWNERS[0]);
    const sessionB = runtime.auth.createSession(STUDIO_FIXTURE_OWNERS[1]);
    await runtime.database.pool.query('DELETE FROM user_roles');
    const endpoint = `${runtime.origin}/api/studio/projects`;
    assert.equal((await fetch(endpoint)).status, 401);
    const read = await fetch(`${endpoint}/${projectAId}`, { headers: { Authorization: `Bearer ${sessionA.access_token}` } });
    assert.equal(read.status, 200, await read.clone().text());
    assert.equal(read.headers.get('cache-control'), 'private, no-store');
    const saved = await read.json();
    assert.equal(saved.project.userId, STUDIO_FIXTURE_OWNERS[0]);
    assert.equal(saved.project.persistenceMode, 'connected');
    const cookieA = runtime.auth.cookiesFor(sessionA).map((item) => `${item.name}=${item.value}`).join('; ');
    const entry = await fetch(`${runtime.origin}/app/studio`, { headers: { cookie: cookieA }, redirect: 'manual' });
    assert.equal(entry.status, 200, 'Disabled conversation flags must show the new Studio unavailable state, never redirect to classic Canvas.');
    assert.equal(entry.headers.get('location'), null);
    assert.match(await entry.text(), /Studio is temporarily unavailable/);
    const mediaEndpoint = `${runtime.origin}/api/studio/media/resolve`;
    const assetRef = { type: 'asset', assetId: `ma_${'a'.repeat(32)}`, kind: 'video' };
    const outputRef = { type: 'job-output', jobId: 'fixture-job', outputId: 'fixture-output', kind: 'video' };
    const resolveMedia = (refs: unknown[], authorization?: string, cookie?: string) => fetch(mediaEndpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(authorization ? { Authorization: authorization } : {}), ...(cookie ? { cookie } : {}) },
      body: JSON.stringify({ refs, userId: STUDIO_FIXTURE_OWNERS[0] }),
    });
    assert.equal((await resolveMedia([assetRef])).status, 401);
    for (const [bearer, cookie] of [[`Bearer ${sessionA.access_token}`, undefined], [undefined, cookieA]]) {
      const media = await resolveMedia([assetRef, outputRef], bearer, cookie);
      assert.equal(media.status, 200, await media.clone().text());
      assert.equal(media.headers.get('cache-control'), 'private, no-store');
      const resolved = (await media.json()).assets;
      assert.deepEqual(resolved.map((item: { ref: unknown }) => item.ref), [assetRef, outputRef]);
      for (const item of resolved) {
        assert.equal(item.url, 'https://cdn.maxvideoai.com/original.mp4?signature=exact%2F&value=+');
        assert.deepEqual(item.mediaFacts, { source: 'probe', durationSec: 6, hasAudio: false });
        assert.deepEqual(item.originalAccess, { type: 'external' });
      }
    }
    assert.equal((await resolveMedia([assetRef], `Bearer ${sessionB.access_token}`)).status, 404);
    assert.equal((await resolveMedia([{ ...outputRef, jobId: 'wrong-job' }], `Bearer ${sessionA.access_token}`)).status, 404);
    assert.equal((await resolveMedia([{ ...assetRef, assetId: 'fixture-internal' }], `Bearer ${sessionA.access_token}`)).status, 404);
    assert.equal((await resolveMedia([], `Bearer ${sessionA.access_token}`)).status, 400);
    await runtime.database.pool.query("UPDATE app_jobs SET hidden = true WHERE job_id = 'fixture-job'");
    for (const ref of [assetRef, outputRef]) assert.equal((await resolveMedia([ref], `Bearer ${sessionA.access_token}`)).status, 404);
    await runtime.database.pool.query("UPDATE app_jobs SET hidden = false WHERE job_id = 'fixture-job'");
    const chatEndpoint = `${runtime.origin}/api/studio/chat`;
    assert.equal((await fetch(chatEndpoint, { method: 'POST' })).status, 401);
    for (const headers of [{ cookie: cookieA }, { Authorization: `Bearer ${sessionA.access_token}` }]) {
      const chat = await fetch(chatEndpoint, {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'openai', mode: 'mock', quote: { totalCents: 0 }, messages: [{ role: 'user', content: 'Fixture only' }] }),
      });
      assert.equal(chat.status, 503);
      assert.equal(chat.headers.get('cache-control'), 'private, no-store');
      assert.equal((await chat.json()).error, 'STUDIO_CHAT_LIVE_UNAVAILABLE');
    }
    const listed = await fetch(endpoint, { headers: { cookie: cookieA } });
    assert.equal(listed.status, 200);
    assert.equal((await listed.json()).projects[0].id, saved.project.id);
    const foreign = await fetch(`${endpoint}/${saved.project.id}`, { headers: { Authorization: `Bearer ${sessionB.access_token}` } });
    assert.equal(foreign.status, 404);
    const foreignList = await fetch(endpoint, { headers: { Authorization: `Bearer ${sessionB.access_token}` } });
    assert.deepEqual((await foreignList.json()).projects, []);
    const rows = await runtime.database.pool.query('SELECT id, user_id FROM studio_projects');
    assert.deepEqual(rows.rows, [{ id: saved.project.id, user_id: STUDIO_FIXTURE_OWNERS[0] }]);

    const writeAs = (url: string, method: string, payload: unknown, token: string) => fetch(url, {
      method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload), signal: AbortSignal.timeout(30_000),
    });
    const projectBId = 'fixture-project-b';
    const sequenceBId = 'fixture-sequence-b';
    const initialB = workspaceSnapshot('Owner B project', [sequenceBId]);
    await runtime.database.pool.query(`INSERT INTO studio_projects(id,user_id,name,canvas_template_id,settings,workspace_state,persistence_mode)
      VALUES ($1,$2,$3,'minimal-start',$4::jsonb,$5::jsonb,'connected')`,
    [projectBId, STUDIO_FIXTURE_OWNERS[1], initialB.name, JSON.stringify(initialB.settings), JSON.stringify({ ...initialB.workspaceState, sequences: [] })]);
    await runtime.database.pool.query(`INSERT INTO studio_sequences(id,user_id,project_id,name,settings,timeline_state)
      VALUES ($1,$2,$3,'Owner B sequence',$4::jsonb,'{"timelineItems":[],"audioTrackCount":2,"videoTrackCount":1}')`,
    [sequenceBId, STUDIO_FIXTURE_OWNERS[1], projectBId, JSON.stringify(initialB.settings)]);

    const workspaceEndpoint = `${endpoint}/${projectAId}/workspace`;
    assert.equal((await fetch(workspaceEndpoint)).status, 401);
    assert.equal((await fetch(workspaceEndpoint, { headers: { Authorization: `Bearer ${sessionB.access_token}` } })).status, 404);
    assert.equal((await writeAs(workspaceEndpoint, 'PUT', {
      expectedRevision: 0, userId: STUDIO_FIXTURE_OWNERS[0], snapshot: workspaceSnapshot('Foreign overwrite', [sequenceAId]),
    }, sessionB.access_token)).status, 404);
    for (const headers of [{ cookie: cookieA }, { Authorization: `Bearer ${sessionA.access_token}` }]) {
      const workspace = await fetch(workspaceEndpoint, { headers });
      assert.equal(workspace.status, 200, await workspace.clone().text());
      const aggregate = await workspace.json();
      assert.equal(aggregate.project.userId, STUDIO_FIXTURE_OWNERS[0]);
      assert.equal(aggregate.project.revision, 0);
      assert.deepEqual(aggregate.sequences.map((sequence: { id: string }) => sequence.id), [sequenceAId]);
    }
    const foreignSequence = await fetch(`${endpoint}/${projectAId}/sequences/${sequenceAId}`, {
      headers: { Authorization: `Bearer ${sessionB.access_token}` },
    });
    assert.equal(foreignSequence.status, 404);
    const foreignSequences = await fetch(`${endpoint}/${projectAId}/sequences`, {
      headers: { Authorization: `Bearer ${sessionB.access_token}` },
    });
    assert.deepEqual((await foreignSequences.json()).sequences, []);
    const collision = await writeAs(`${endpoint}/${projectBId}/workspace`, 'PUT', {
      expectedRevision: 0, snapshot: workspaceSnapshot('Owner B must not replace A sequence', [sequenceBId, sequenceAId]),
    }, sessionB.access_token);
    assert.equal(collision.status, 409, await collision.clone().text());
    assert.deepEqual(await collision.json(), { ok: false, error: 'STUDIO_SEQUENCE_CONFLICT' });
    assert.deepEqual((await runtime.database.pool.query('SELECT user_id,project_id,name FROM studio_sequences WHERE id=$1', [sequenceAId])).rows,
      [{ user_id: STUDIO_FIXTURE_OWNERS[0], project_id: projectAId, name: 'Owner A sequence' }]);
    assert.equal((await runtime.database.pool.query('SELECT name,revision FROM studio_projects WHERE id=$1', [projectBId])).rows[0].revision, '0');
    assert.equal((await runtime.database.pool.query('SELECT name FROM studio_sequences WHERE id=$1', [sequenceBId])).rows[0].name, 'Owner B sequence', 'A conflict rolls back earlier sequence updates in the aggregate.');

    const races = await Promise.all(['First canonical save', 'Second canonical save'].map(name => writeAs(workspaceEndpoint, 'PUT', {
      expectedRevision: 0, snapshot: workspaceSnapshot(name, [sequenceAId]),
    }, sessionA.access_token)));
    assert.deepEqual(races.map(response => response.status).sort(), [200, 409]);
    const winner = races.find(response => response.status === 200)!;
    const loser = races.find(response => response.status === 409)!;
    assert.deepEqual(await winner.json(), { ok: true, projectId: projectAId, revision: 1 });
    assert.deepEqual(await loser.json(), { ok: false, error: 'STUDIO_REVISION_CONFLICT' });
    const newer = await writeAs(workspaceEndpoint, 'PUT', {
      expectedRevision: 1, snapshot: workspaceSnapshot('Newer canonical state', [sequenceAId, 'fixture-sequence-newer']),
    }, sessionA.access_token);
    assert.equal(newer.status, 200, await newer.clone().text());
    const stale = await writeAs(workspaceEndpoint, 'PUT', {
      expectedRevision: 1, snapshot: workspaceSnapshot('Stale draft', [sequenceAId]),
    }, sessionA.access_token);
    assert.equal(stale.status, 409, await stale.clone().text());
    const current = (await (await fetch(workspaceEndpoint, { headers: { cookie: cookieA } })).json());
    assert.equal(current.project.revision, 2);
    assert.equal(current.project.name, 'Newer canonical state');
    assert.deepEqual(current.sequences.map((sequence: { id: string }) => sequence.id).sort(), [sequenceAId, 'fixture-sequence-newer'].sort());

    await runtime.database.pool.query(`INSERT INTO studio_projects(id,user_id,name,persistence_mode,deleted_at)
      VALUES ('retired-legacy-project',$1,'Retired Canvas','legacy',NOW())`, [STUDIO_FIXTURE_OWNERS[0]]);
    await runtime.database.pool.query(`INSERT INTO studio_sequences(id,user_id,project_id,name,deleted_at)
      VALUES ('retired-legacy-sequence',$1,'retired-legacy-project','Retired sequence',NOW())`, [STUDIO_FIXTURE_OWNERS[0]]);
    const beforeRetiredWrites = {
      projects: (await runtime.database.pool.query('SELECT * FROM studio_projects ORDER BY id')).rows,
      sequences: (await runtime.database.pool.query('SELECT * FROM studio_sequences ORDER BY id')).rows,
    };
    const retiredWrites = [
      { url: endpoint, method: 'POST', id: 'stale-create-project' },
      { url: endpoint, method: 'POST', id: 'retired-legacy-project' },
      { url: endpoint, method: 'POST', id: projectAId },
      ...['PUT', 'PATCH'].flatMap(method => [projectAId, 'retired-legacy-project'].map(id => ({ url: `${endpoint}/${id}`, method, id }))),
      { url: `${endpoint}/${projectBId}/sequences`, method: 'POST', id: sequenceAId },
      { url: `${endpoint}/retired-legacy-project/sequences`, method: 'POST', id: 'retired-legacy-sequence' },
      ...['PUT', 'PATCH'].map(method => ({ url: `${endpoint}/retired-legacy-project/sequences/retired-legacy-sequence`, method, id: 'retired-legacy-sequence' })),
    ];
    for (const { url, method, id } of retiredWrites) {
      assert.equal((await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 401);
      for (const headers of [{ cookie: cookieA }, { Authorization: `Bearer ${sessionA.access_token}` }, { Authorization: `Bearer ${sessionB.access_token}` }]) {
        const rejected = await fetch(url, {
          method, headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, name: 'Stale Canvas write', userId: STUDIO_FIXTURE_OWNERS[0] }),
          signal: AbortSignal.timeout(30_000),
        });
        assert.equal(rejected.status, 410, `${method} ${url}: ${await rejected.clone().text()}`);
        assert.equal(rejected.headers.get('cache-control'), 'private, no-store');
        assert.deepEqual(await rejected.json(), { ok: false, error: 'STUDIO_CANVAS_RETIRED', studioUrl: '/app/studio' });
      }
    }
    assert.deepEqual({
      projects: (await runtime.database.pool.query('SELECT * FROM studio_projects ORDER BY id')).rows,
      sequences: (await runtime.database.pool.query('SELECT * FROM studio_sequences ORDER BY id')).rows,
    }, beforeRetiredWrites, 'Retired routes cannot create, overwrite or revive any project or sequence.');
    const anonymousPage = await fetch(`${runtime.origin}/app/studio/projects`, { redirect: 'manual' });
    assert.ok([302, 303, 307, 308].includes(anonymousPage.status));
    assert.match(anonymousPage.headers.get('location') ?? '', /login/);
  } finally {
    await runtime.close();
  }
});
