import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { startStudioIntegrationRuntime } from './helpers/studio-integration-runtime';
import { STUDIO_FIXTURE_OWNERS } from './helpers/studio-auth-fixture';
import { initializeStudioConnectedFixture, STUDIO_CONNECTED_ASSET_IDS, STUDIO_CONNECTED_MONTAGE_INPUT } from './helpers/studio-connected-fixture-data';
import { postStudioMcpRequest, postStudioMontageUiRequest, readStudioMcpResponse } from './helpers/studio-mcp-http-fixture';
import { STUDIO_PRIVATE_MEDIA_KEYS, validateStudioPrivateMediaRequest } from './helpers/studio-private-storage-fixture';

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
    const sourceFrames = STUDIO_CONNECTED_MONTAGE_INPUT.clips.map((clip, orderIndex) => ({
      commandKind: 'create_studio_montage', commandVersion: 1, orderIndex,
      ...clip, fps: STUDIO_CONNECTED_MONTAGE_INPUT.settings.fps,
    }));
    assert.deepEqual(items.map((item: { montageSource: unknown }) => item.montageSource), sourceFrames);
    assert.deepEqual(row.workspace_state.projectAssets.map((asset: { ref: { assetId: string } }) => asset.ref.assetId), [STUDIO_CONNECTED_ASSET_IDS.b, STUDIO_CONNECTED_ASSET_IDS.a]);
    assert.doesNotMatch(JSON.stringify(row), /X-Amz-Signature/u, 'Durable state must preserve identity rather than temporary access.');
    assert.equal((await runtime.database.pool.query('SELECT count(*)::int AS count FROM studio_project_commands')).rows[0].count, 1);
    assert.deepEqual((await runtime.database.pool.query('SELECT request_payload FROM studio_project_commands')).rows[0].request_payload, STUDIO_CONNECTED_MONTAGE_INPUT);

    const path = `/api/studio/projects/${montage.projectId}`;
    assert.equal((await fetch(`${runtime.origin}${path}`)).status, 401);
    assert.equal((await route(path, {}, ownerB.access_token)).status, 404);
    assert.equal((await route(`${path}/workspace`, {}, ownerB.access_token)).status, 404);
    assert.equal((await fetch(`${runtime.origin}${path}/workspace`)).status, 401);
    const projectResponse = await route(`${path}/workspace`);
    assert.equal(projectResponse.status, 200);
    const aggregate = await projectResponse.json();
    const project = aggregate.project;
    assert.equal(project.revision, 0);
    assert.equal(project.persistenceMode, 'connected');
    const accessPayload = JSON.stringify({ assetIds: [STUDIO_CONNECTED_ASSET_IDS.b, STUDIO_CONNECTED_ASSET_IDS.a] });
    assert.equal((await fetch(`${runtime.origin}${path}/media-access`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: accessPayload })).status, 401);
    assert.equal((await route(`${path}/media-access`, { method: 'POST', body: accessPayload }, ownerB.access_token)).status, 404);
    assert.equal((await route(`${path}/media-access`, { method: 'POST', body: JSON.stringify({ assetIds: [STUDIO_CONNECTED_ASSET_IDS.foreign] }) })).status, 404);
    assert.equal((await route(`${path}/media-access`, { method: 'POST', body: JSON.stringify({ assetIds: [STUDIO_CONNECTED_ASSET_IDS.unmeasured] }) })).status, 404, 'Even owned assets must belong to this project before access is issued.');
    const accessResponse = await route(`${path}/media-access`, { method: 'POST', body: accessPayload });
    assert.equal(accessResponse.status, 200, (await accessResponse.clone().text()).slice(0, 1000));
    assert.equal(accessResponse.headers.get('cache-control'), 'private, no-store');
    const access = await accessResponse.json();
    assert.equal(access.projectId, montage.projectId);
    assert.deepEqual(access.assets.map((asset: { assetId: string }) => asset.assetId), [STUDIO_CONNECTED_ASSET_IDS.b, STUDIO_CONNECTED_ASSET_IDS.a]);
    for (const [index, asset] of access.assets.entries()) {
      const verified = await validateStudioPrivateMediaRequest({ url: asset.url, method: 'GET' });
      assert.equal(verified.ok, true, 'The production signer must issue a valid GET token for the private fixture.');
      if (verified.ok) assert.equal(verified.key, index === 0 ? STUDIO_PRIVATE_MEDIA_KEYS.b : STUDIO_PRIVATE_MEDIA_KEYS.a);
      assert.equal(new URL(asset.url).searchParams.get('X-Amz-Expires'), '300');
      assert.equal((await validateStudioPrivateMediaRequest({ url: asset.url, method: 'GET', now: new Date(Date.parse(asset.expiresAt) + 1000) })).ok, false);
    }
    const sequences = aggregate.sequences;
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
    const malformed = structuredClone(snapshot);
    malformed.workspaceState.sequences[0].timelineItems = [null];
    const refusedMalformed = await route(`${path}/workspace`, { method: 'PUT', body: JSON.stringify({ expectedRevision: 1, snapshot: malformed }) });
    assert.equal(refusedMalformed.status, 400, 'A malformed timeline must not be acknowledged or normalized away after saving.');
    assert.equal(Number((await runtime.database.pool.query('SELECT revision FROM studio_projects WHERE id=$1', [montage.projectId])).rows[0].revision), 1);
    // Inject a PostgreSQL write failure only into this already verified disposable cluster.
    // Sequence writes precede the project write, so the failed transaction must roll both back.
    await runtime.database.pool.query('ALTER TABLE studio_projects ADD CONSTRAINT studio_fixture_internal_detail CHECK (revision < 2) NOT VALID');
    try {
      const failedSnapshot = structuredClone(snapshot);
      failedSnapshot.workspaceState.sequences[0].timelineItems[0].title = 'This write must roll back';
      const failed = await route(`${path}/workspace`, { method: 'PUT', body: JSON.stringify({ expectedRevision: 1, snapshot: failedSnapshot }) });
      assert.equal(failed.status, 500, 'An unexpected database failure is not invalid user input.');
      assert.deepEqual(await failed.json(), { ok: false, error: 'STUDIO_WORKSPACE_SAVE_FAILED' });
      const rolledBack = await runtime.database.pool.query('SELECT timeline_state FROM studio_sequences WHERE id=$1', [montage.sequenceId]);
      assert.equal(rolledBack.rows[0].timeline_state.timelineItems[0].title, items[0].title);
      assert.equal(Number((await runtime.database.pool.query('SELECT revision FROM studio_projects WHERE id=$1', [montage.projectId])).rows[0].revision), 1);
    } finally {
      await runtime.database.pool.query('ALTER TABLE studio_projects DROP CONSTRAINT studio_fixture_internal_detail');
    }
    for (const method of ['PUT', 'PATCH', 'DELETE']) {
      assert.equal((await route(path, { method, ...(method === 'DELETE' ? {} : { body: JSON.stringify({ name: 'Legacy writer must not win' }) }) })).status, 409);
      assert.equal((await route(`${path}/sequences/${montage.sequenceId}`, { method, ...(method === 'DELETE' ? {} : { body: JSON.stringify({ name: 'Legacy sequence must not win' }) }) })).status, 409);
    }
    assert.equal((await route(`${path}/sequences`, { method: 'POST', body: JSON.stringify({ id: 'legacy-sequence-cannot-enter', name: 'Legacy insertion' }) })).status, 409);
    assert.equal((await route('/api/studio/projects', { method: 'POST', body: JSON.stringify({ id: montage.projectId, name: 'Legacy upsert must not win' }) })).status, 409);

    const replay = await call(STUDIO_CONNECTED_MONTAGE_INPUT);
    assert.notEqual(replay.result.isError, true);
    assert.equal(replay.result.structuredContent.projectId, montage.projectId);
    assert.equal(replay.result.structuredContent.revision, 1);
    const kept = await runtime.database.pool.query('SELECT name, revision FROM studio_projects WHERE id = $1', [montage.projectId]);
    assert.equal(kept.rows[0].name, snapshot.name);
    assert.equal(Number(kept.rows[0].revision), 1);
    const savedFrames = await runtime.database.pool.query('SELECT timeline_state FROM studio_sequences WHERE id=$1', [montage.sequenceId]);
    assert.deepEqual(savedFrames.rows[0].timeline_state.timelineItems.map((item: { montageSource: unknown }) => item.montageSource), sourceFrames);
    assert.deepEqual((await runtime.database.pool.query('SELECT request_payload FROM studio_project_commands')).rows[0].request_payload, STUDIO_CONNECTED_MONTAGE_INPUT);
    const cookie = runtime.auth.cookiesFor(ownerA).map((item) => `${item.name}=${item.value}`).join('; ');
    assert.equal((await postStudioMontageUiRequest(runtime, STUDIO_CONNECTED_MONTAGE_INPUT)).status, 401);
    const uiReplay = await postStudioMontageUiRequest(runtime, STUDIO_CONNECTED_MONTAGE_INPUT, { cookie });
    assert.equal(uiReplay.status, 200, (await uiReplay.clone().text()).slice(0, 1000));
    const uiMontage = (await uiReplay.json()).montage;
    assert.equal(uiMontage.projectId, montage.projectId, 'UI and MCP must share the exact same owner-scoped command receipt.');
    assert.equal(uiMontage.revision, 1);
    const uiConflict = await postStudioMontageUiRequest(runtime, { ...STUDIO_CONNECTED_MONTAGE_INPUT, title: 'Changed via UI' }, { cookie });
    assert.equal(uiConflict.status, 409);
    const conflict = await call({ ...STUDIO_CONNECTED_MONTAGE_INPUT, clips: [...STUDIO_CONNECTED_MONTAGE_INPUT.clips].reverse() });
    assert.equal(conflict.result.isError, true, 'Same exact key with a new order must be rejected.');
    assert.equal(conflict.result.structuredContent.error.code, 'PARAMETER_INVALID');
    assert.equal(conflict.result.structuredContent.error.retryable, false);
    const foreign = await call(STUDIO_CONNECTED_MONTAGE_INPUT, ownerB.access_token);
    assert.equal(foreign.result.isError, true);
    assert.equal(foreign.result.structuredContent.error.code, 'REFERENCE_NOT_FOUND');
    assert.equal(foreign.result.structuredContent.error.retryable, false);
    const unknownFacts = await call({ ...STUDIO_CONNECTED_MONTAGE_INPUT, idempotencyKey: 'unmeasured-is-not-trim-proof', clips: [
      { assetId: STUDIO_CONNECTED_ASSET_IDS.unmeasured, sourceInFrame: 0, durationFrames: 30 },
      STUDIO_CONNECTED_MONTAGE_INPUT.clips[1],
    ] });
    assert.equal(unknownFacts.result.isError, true);
    assert.equal(unknownFacts.result.structuredContent.error.code, 'REFERENCE_INVALID');
    assert.equal(unknownFacts.result.structuredContent.error.retryable, false);

    // Removing a bin entry deliberately keeps its existing timeline occurrences.
    // Those live occurrences must remain authorized for renewable private playback.
    const withoutBinEntry = structuredClone(snapshot);
    withoutBinEntry.workspaceState.projectAssets = withoutBinEntry.workspaceState.projectAssets.filter(
      (asset: { ref: { assetId: string } }) => asset.ref.assetId !== STUDIO_CONNECTED_ASSET_IDS.b,
    );
    const removeFromBin = await route(`${path}/workspace`, {
      method: 'PUT', body: JSON.stringify({ expectedRevision: 1, snapshot: withoutBinEntry }),
    });
    assert.equal(removeFromBin.status, 200);
    assert.equal((await removeFromBin.json()).revision, 2);
    const binState = await runtime.database.pool.query('SELECT workspace_state FROM studio_projects WHERE id=$1', [montage.projectId]);
    assert.deepEqual(binState.rows[0].workspace_state.projectAssets.map((asset: { ref: { assetId: string } }) => asset.ref.assetId), [STUDIO_CONNECTED_ASSET_IDS.a]);
    const liveSequence = await runtime.database.pool.query('SELECT timeline_state FROM studio_sequences WHERE id=$1', [montage.sequenceId]);
    assert.equal(liveSequence.rows[0].timeline_state.timelineItems[0].ref.assetId, STUDIO_CONNECTED_ASSET_IDS.b);
    const singleAccess = JSON.stringify({ assetIds: [STUDIO_CONNECTED_ASSET_IDS.b] });
    const retainedAccess = await route(`${path}/media-access`, { method: 'POST', body: singleAccess });
    assert.equal(retainedAccess.status, 200, 'A live timeline occurrence keeps its private access after removal from the bin.');
    const retainedAsset = (await retainedAccess.json()).assets[0];
    const retainedSignature = await validateStudioPrivateMediaRequest({ url: retainedAsset.url, method: 'GET' });
    assert.equal(retainedSignature.ok, true);
    if (retainedSignature.ok) assert.equal(retainedSignature.key, STUDIO_PRIVATE_MEDIA_KEYS.b);
    assert.equal((await route(`${path}/media-access`, { method: 'POST', body: singleAccess }, ownerB.access_token)).status, 404);

    const withoutAnyOccurrence = structuredClone(withoutBinEntry);
    withoutAnyOccurrence.workspaceState.timelineItems = withoutAnyOccurrence.workspaceState.timelineItems.filter(
      (item: { ref: { assetId: string } }) => item.ref.assetId !== STUDIO_CONNECTED_ASSET_IDS.b,
    );
    for (const sequence of withoutAnyOccurrence.workspaceState.sequences) {
      sequence.timelineItems = sequence.timelineItems.filter(
        (item: { ref: { assetId: string } }) => item.ref.assetId !== STUDIO_CONNECTED_ASSET_IDS.b,
      );
    }
    const removeLastOccurrence = await route(`${path}/workspace`, {
      method: 'PUT', body: JSON.stringify({ expectedRevision: 2, snapshot: withoutAnyOccurrence }),
    });
    assert.equal(removeLastOccurrence.status, 200);
    assert.equal((await removeLastOccurrence.json()).revision, 3);
    assert.equal((await route(`${path}/media-access`, { method: 'POST', body: singleAccess })).status, 404, 'The initial command receipt is provenance, not permanent playback authorization after all live refs are removed.');
    assert.equal((await runtime.database.pool.query('SELECT count(*)::int AS count FROM studio_projects')).rows[0].count, 1);
    assert.equal((await runtime.database.pool.query('SELECT count(*)::int AS count FROM studio_sequences')).rows[0].count, 1);
    assert.equal((await runtime.database.pool.query('SELECT count(*)::int AS count FROM studio_project_commands')).rows[0].count, 1);
  } finally { await runtime.close(); }
});

test('missing connected migration fails closed through real UI and MCP without applying runtime DDL', { timeout: 180_000 }, async () => {
  const runtime = await startStudioIntegrationRuntime({
    mcp: { studioMontageCreation: true },
    initializeDatabase: async (database) => {
      for (const name of ['26_studio_projects.sql', '29_mcp_audit_events.sql', '41_mcp_client_family.sql']) {
        await database.pool.query(await readFile(`neon/migrations/${name}`, 'utf8'));
      }
    },
  });
  try {
    const session = runtime.auth.createSession(STUDIO_FIXTURE_OWNERS[0], { clientId: 'studio-unmigrated-local-fixture' });
    const cookie = runtime.auth.cookiesFor(session).map((item) => `${item.name}=${item.value}`).join('; ');
    const ui = await postStudioMontageUiRequest(runtime, STUDIO_CONNECTED_MONTAGE_INPUT, { cookie });
    assert.equal(ui.status, 503);
    assert.deepEqual(await ui.json(), { ok: false, error: 'STUDIO_CONNECTED_SCHEMA_UNAVAILABLE' });
    const mcp = await readStudioMcpResponse(await postStudioMcpRequest(runtime, {
      jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'create_studio_montage', arguments: STUDIO_CONNECTED_MONTAGE_INPUT },
    }, { token: session.access_token }));
    assert.equal(mcp.result.isError, true);
    assert.equal(mcp.result.structuredContent.error.code, 'RATE_LIMITED');
    assert.equal(mcp.result.structuredContent.error.retryable, true);
    const aggregate = await fetch(`${runtime.origin}/api/studio/projects/does-not-exist/workspace`, {
      headers: { Authorization: `Bearer ${session.access_token}` }, signal: AbortSignal.timeout(30_000),
    });
    assert.equal(aggregate.status, 503);
    const schema = await runtime.database.pool.query(`SELECT to_regclass('public.studio_project_commands') AS receipt_table,
      EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='studio_projects' AND column_name='revision') AS revision_column,
      EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='studio_projects' AND column_name='persistence_mode') AS mode_column`);
    assert.deepEqual(schema.rows, [{ receipt_table: null, revision_column: false, mode_column: false }]);
    assert.equal((await runtime.database.pool.query('SELECT count(*)::int AS count FROM studio_projects')).rows[0].count, 0);
  } finally { await runtime.close(); }
});
