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
    const listed = await fetch(endpoint, { headers: { cookie: cookieA } });
    assert.equal(listed.status, 200);
    assert.equal((await listed.json()).projects[0].id, saved.project.id);
    const foreign = await fetch(`${endpoint}/${saved.project.id}`, { headers: { Authorization: `Bearer ${sessionB.access_token}` } });
    assert.equal(foreign.status, 404);
    const foreignList = await fetch(endpoint, { headers: { Authorization: `Bearer ${sessionB.access_token}` } });
    assert.deepEqual((await foreignList.json()).projects, []);
    const rows = await runtime.database.pool.query('SELECT id, user_id FROM studio_projects');
    assert.deepEqual(rows.rows, [{ id: saved.project.id, user_id: STUDIO_FIXTURE_OWNERS[0] }]);
    const anonymousPage = await fetch(`${runtime.origin}/app/studio/projects`, { redirect: 'manual' });
    assert.ok([302, 303, 307, 308].includes(anonymousPage.status));
    assert.match(anonymousPage.headers.get('location') ?? '', /login/);
  } finally {
    await runtime.close();
  }
});
