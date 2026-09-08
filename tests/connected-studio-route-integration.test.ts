import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { startStudioIntegrationRuntime } from './helpers/studio-integration-runtime';
import { STUDIO_FIXTURE_OWNERS } from './helpers/studio-auth-fixture';

// Explicit opt-in suite: starts its own isolated Next snapshot and local database.
test('real Studio routes authenticate cookie and bearer owners against a fresh PostgreSQL 17 cluster', { timeout: 180_000 }, async () => {
  const runtime = await startStudioIntegrationRuntime({
    initializeDatabase: async (database) => {
      await database.pool.query(await readFile('neon/migrations/26_studio_projects.sql', 'utf8'));
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
    const endpoint = `${runtime.origin}/api/studio/projects`;
    assert.equal((await fetch(endpoint)).status, 401);
    const created = await fetch(endpoint, {
      method: 'POST', headers: { Authorization: `Bearer ${sessionA.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ project: {
        name: 'Disposable route evidence', userId: STUDIO_FIXTURE_OWNERS[1],
        workspaceState: { nodes: [], edges: [], timelineItems: [] },
      } }),
    });
    assert.equal(created.status, 200, await created.clone().text());
    assert.equal(created.headers.get('cache-control'), 'private, no-store');
    const saved = await created.json();
    assert.equal(saved.project.userId, STUDIO_FIXTURE_OWNERS[0]);
    const cookieA = runtime.auth.cookiesFor(sessionA).map((item) => `${item.name}=${item.value}`).join('; ');
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
    for (const method of ['POST', 'PUT', 'PATCH']) {
      const collision = await writeAs(method === 'POST' ? endpoint : `${endpoint}/${saved.project.id}`, method, {
        id: saved.project.id, name: 'Owner B must not replace A',
      }, sessionB.access_token);
      assert.equal(collision.status, 409, `Legacy project ${method} must retain its business conflict instead of a generic500.`);
      assert.deepEqual(await collision.json(), { ok: false, error: 'STUDIO_PROJECT_CONFLICT' });
    }
    const sequenceA = await writeAs(`${endpoint}/${saved.project.id}/sequences`, 'POST', {
      id: 'legacy-sequence-owned-by-a', name: 'Owner A sequence', timelineState: { timelineItems: [] },
    }, sessionA.access_token);
    assert.equal(sequenceA.status, 200, await sequenceA.clone().text());
    const projectB = await writeAs(endpoint, 'POST', { name: 'Owner B project' }, sessionB.access_token);
    assert.equal(projectB.status, 200);
    const projectBId = (await projectB.json()).project.id;
    for (const method of ['POST', 'PUT', 'PATCH']) {
      const sequenceEndpoint = `${endpoint}/${projectBId}/sequences${method === 'POST' ? '' : '/legacy-sequence-owned-by-a'}`;
      const collision = await writeAs(sequenceEndpoint, method, {
        id: 'legacy-sequence-owned-by-a', name: 'Owner B must not replace A sequence',
      }, sessionB.access_token);
      assert.equal(collision.status, 409, `Legacy sequence ${method} must retain its business conflict instead of a generic500.`);
      assert.deepEqual(await collision.json(), { ok: false, error: 'STUDIO_SEQUENCE_CONFLICT' });
    }
    const legacyOwner = await runtime.database.pool.query('SELECT user_id, project_id, name FROM studio_sequences WHERE id=$1', ['legacy-sequence-owned-by-a']);
    assert.deepEqual(legacyOwner.rows, [{ user_id: STUDIO_FIXTURE_OWNERS[0], project_id: saved.project.id, name: 'Owner A sequence' }]);
    assert.equal((await runtime.database.pool.query('SELECT name FROM studio_projects WHERE id=$1', [saved.project.id])).rows[0].name, 'Disposable route evidence');
    const anonymousPage = await fetch(`${runtime.origin}/app/studio/projects`, { redirect: 'manual' });
    assert.ok([302, 303, 307, 308].includes(anonymousPage.status));
    assert.match(anonymousPage.headers.get('location') ?? '', /login/);
  } finally {
    await runtime.close();
  }
});
