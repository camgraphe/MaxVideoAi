import assert from 'node:assert/strict';
import test from 'node:test';
import { startStudioIntegrationRuntime } from './helpers/studio-integration-runtime';
import { STUDIO_FIXTURE_OWNERS } from './helpers/studio-auth-fixture';
import { initializeStudioConnectedFixture, STUDIO_CONNECTED_ASSET_IDS, STUDIO_CONNECTED_MONTAGE_INPUT } from './helpers/studio-connected-fixture-data';
import { postStudioMcpRequest, readStudioMcpResponse } from './helpers/studio-mcp-http-fixture';

test('real MCP persists caller-ordered videos, enforces owner and idempotency, and coexists with revisioned UI saves', { timeout: 180_000 }, async () => {
  const runtime = await startStudioIntegrationRuntime({
    mcp: { studioMontageCreation: true }, privateStorage: true,
    initializeDatabase: initializeStudioConnectedFixture,
  });
  try {
    const ownerA = runtime.auth.createSession(STUDIO_FIXTURE_OWNERS[0], { clientId: 'studio-connected-local-fixture' });
    const ownerB = runtime.auth.createSession(STUDIO_FIXTURE_OWNERS[1], { clientId: 'studio-connected-local-fixture' });
    let requestId = 0;
    const call = async (input: unknown, token = ownerA.access_token) => readStudioMcpResponse(await postStudioMcpRequest(runtime, {
      jsonrpc: '2.0', id: ++requestId, method: 'tools/call', params: { name: 'create_studio_montage', arguments: input },
    }, { token }));
    const route = (path: string, init: RequestInit = {}, token = ownerA.access_token) => fetch(`${runtime.origin}${path}`, {
      ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init.headers },
      signal: AbortSignal.timeout(30_000),
    });
    const discovery = await readStudioMcpResponse(await postStudioMcpRequest(runtime, {
      jsonrpc: '2.0', id: ++requestId, method: 'tools/list', params: {},
    }, { token: ownerA.access_token }));
    const tool = discovery.result.tools.find((entry: { name: string }) => entry.name === 'create_studio_montage');
    assert.ok(tool, 'The explicit loopback override must publish the real persisted command.');
    assert.equal(tool.annotations.readOnlyHint, false);
    assert.equal(tool.annotations.idempotentHint, true);
    assert.ok(!discovery.result.tools.some((entry: { name: string }) => entry.name === 'prepare_montage'));

    const created = await call(STUDIO_CONNECTED_MONTAGE_INPUT);
    assert.notEqual(created.result.isError, true, JSON.stringify(created.result));
    const montage = created.result.structuredContent;
    assert.equal(montage.persisted, true);
    assert.equal(montage.revision, 0);
    assert.equal(montage.clipCount, 2);
    assert.equal(montage.totalFrames, 120);
    assert.equal(montage.totalSeconds, 4);
    assert.equal(montage.studioUrl, `/app/studio/workspace/${montage.projectId}`);
    assert.doesNotMatch(JSON.stringify(created.result), /X-Amz-|s3\.|media-assets\//u, 'MCP must not disclose original or signed media URLs.');

    const stored = await runtime.database.pool.query(`SELECT p.user_id, p.persistence_mode, p.revision,
      p.workspace_state, s.id AS sequence_id, s.timeline_state FROM studio_projects p
      JOIN studio_sequences s ON s.project_id = p.id AND s.user_id = p.user_id WHERE p.id = $1`, [montage.projectId]);
    assert.equal(stored.rows.length, 1);
    const row = stored.rows[0];
    assert.equal(row.user_id, STUDIO_FIXTURE_OWNERS[0]);
    assert.equal(row.persistence_mode, 'connected');
    assert.equal(Number(row.revision), 0);
    assert.equal(row.sequence_id, montage.sequenceId);
    assert.deepEqual(row.workspace_state.nodes, []);
    assert.deepEqual(row.workspace_state.edges, []);
    assert.equal(row.workspace_state.focusMode, 'viewer');
    assert.equal(row.workspace_state.activeSequenceId, montage.sequenceId);
    const items = row.timeline_state.timelineItems;
    assert.equal(items.length, 2);
    assert.notEqual(items[0].id, items[1].id);
    assert.deepEqual(items.map((item: { startSec: number; sourceStartSec: number; durationSec: number }) => [item.startSec, item.sourceStartSec, item.durationSec]), [[0, 1, 2], [2, 0.5, 2]]);
    assert.deepEqual(row.workspace_state.projectAssets.map((asset: { ref: { assetId: string } }) => asset.ref.assetId), [STUDIO_CONNECTED_ASSET_IDS.b, STUDIO_CONNECTED_ASSET_IDS.a]);
    assert.doesNotMatch(JSON.stringify(row), /X-Amz-Signature/u, 'Durable state must preserve identity rather than temporary access.');
    assert.equal((await runtime.database.pool.query('SELECT count(*)::int AS count FROM studio_project_commands')).rows[0].count, 1);

    const path = `/api/studio/projects/${montage.projectId}`;
    assert.equal((await fetch(`${runtime.origin}${path}`)).status, 401);
    assert.equal((await route(path, {}, ownerB.access_token)).status, 404);
    const projectResponse = await route(path);
    assert.equal(projectResponse.status, 200);
    const project = (await projectResponse.json()).project;
    const sequencesResponse = await route(`${path}/sequences`);
    assert.equal(sequencesResponse.status, 200);
    const sequences = (await sequencesResponse.json()).sequences;
    assert.equal(sequences.length, 1);
    const snapshot = {
      name: 'Owner A edited this montage', canvasTemplateId: project.canvasTemplateId,
      settings: project.settings,
      workspaceState: { ...project.workspaceState, sequences: sequences.map((sequence: {
        id: string; name: string; settings: unknown; timelineState: Record<string, unknown>;
      }) => ({ id: sequence.id, name: sequence.name, projectSettings: sequence.settings, ...sequence.timelineState })) },
    };
    const save = await route(`${path}/workspace`, { method: 'PUT', body: JSON.stringify({ expectedRevision: 0, snapshot }) });
    assert.equal(save.status, 200, (await save.clone().text()).slice(0, 1000));
    assert.equal((await save.json()).revision, 1);
    const stale = await route(`${path}/workspace`, { method: 'PUT', body: JSON.stringify({ expectedRevision: 0, snapshot: { ...snapshot, name: 'Stale tab must not win' } }) });
    assert.equal(stale.status, 409);
    const otherOwner = await route(`${path}/workspace`, { method: 'PUT', body: JSON.stringify({ expectedRevision: 1, snapshot }) }, ownerB.access_token);
    assert.equal(otherOwner.status, 404);
    for (const method of ['PUT', 'PATCH', 'DELETE']) {
      assert.equal((await route(path, { method, ...(method === 'DELETE' ? {} : { body: JSON.stringify({ name: 'Legacy writer must not win' }) }) })).status, 409);
    }
    assert.equal((await route('/api/studio/projects', { method: 'POST', body: JSON.stringify({ id: montage.projectId, name: 'Legacy upsert must not win' }) })).status, 409);

    const replay = await call(STUDIO_CONNECTED_MONTAGE_INPUT);
    assert.notEqual(replay.result.isError, true);
    assert.equal(replay.result.structuredContent.projectId, montage.projectId);
    assert.equal(replay.result.structuredContent.revision, 1);
    const kept = await runtime.database.pool.query('SELECT name, revision FROM studio_projects WHERE id = $1', [montage.projectId]);
    assert.equal(kept.rows[0].name, snapshot.name);
    assert.equal(Number(kept.rows[0].revision), 1);
    const conflict = await call({ ...STUDIO_CONNECTED_MONTAGE_INPUT, clips: [...STUDIO_CONNECTED_MONTAGE_INPUT.clips].reverse() });
    assert.equal(conflict.result.isError, true, 'Same exact key with a new order must be rejected.');
    const foreign = await call(STUDIO_CONNECTED_MONTAGE_INPUT, ownerB.access_token);
    assert.equal(foreign.result.isError, true);
    const unknownFacts = await call({ ...STUDIO_CONNECTED_MONTAGE_INPUT, idempotencyKey: 'unmeasured-is-not-trim-proof', clips: [
      { assetId: STUDIO_CONNECTED_ASSET_IDS.unmeasured, sourceInFrame: 0, durationFrames: 30 },
      STUDIO_CONNECTED_MONTAGE_INPUT.clips[1],
    ] });
    assert.equal(unknownFacts.result.isError, true);
    assert.equal((await runtime.database.pool.query('SELECT count(*)::int AS count FROM studio_projects')).rows[0].count, 1);
    assert.equal((await runtime.database.pool.query('SELECT count(*)::int AS count FROM studio_sequences')).rows[0].count, 1);
    assert.equal((await runtime.database.pool.query('SELECT count(*)::int AS count FROM studio_project_commands')).rows[0].count, 1);
  } finally { await runtime.close(); }
});
