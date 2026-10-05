import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { editStudioConversationTimeline } from '../frontend/src/server/studio/conversation-edit-command';
import { createWorkspaceSequenceRecord } from '../frontend/app/(core)/(workspace)/app/studio/_shared/_state/workspace-state';

const facts = { source: 'probe' as const, durationSec: 6, width: 320, height: 180, hasAudio: true };
const ref = { type: 'job-output' as const, jobId: 'job', outputId: 'job:video:0', kind: 'video' as const };
const command = { projectId: 'project', sequenceId: 'sequence', expectedRevision: 0, idempotencyKey: 'offline-insert', edit: { kind: 'insert' as const, ref, startFrame: 0, durationFrames: 150 } };

function fixture() {
  const settings = { fps: 30 as const, aspectRatio: '16:9' as const, resolution: '720p' as const };
  const initial = createWorkspaceSequenceRecord({ id: 'sequence', name: 'Main', projectSettings: settings, timelineItems: [] });
  const state = {
    locked: false, revision: 0, hydrations: 0, sourceAvailable: true, projectScope: true,
    source: { id: ref.outputId, job_id: ref.jobId, user_id: 'owner', job_user_id: 'owner', job_status: 'completed', kind: 'video', status: 'ready', mime_type: 'video/mp4', url: 'https://media.maxvideoai.com/original.mp4', metadata: { durationSec: 5, legacy: true } as Record<string, unknown> },
    workspace: { nodes: [], edges: [], timelineItems: [], sequences: [], activeSequenceId: 'sequence', projectAssets: [] } as Record<string, unknown>,
    timeline: initial as Record<string, unknown>, receipts: new Map<string, { request_hash: string; safe_result: unknown }>(),
    writes: [] as unknown[],
  };
  const query = async <T>(sql: string, values: readonly unknown[] = []): Promise<T[]> => {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    let rows: unknown[];
    if (normalized.includes('to_regclass')) rows = [{ ready: true }];
    else if (normalized.includes('pg_advisory_xact_lock')) rows = [];
    else if (normalized.startsWith('SELECT request_hash')) rows = state.receipts.has(String(values[2])) ? [state.receipts.get(String(values[2]))] : [];
    else if (normalized.includes('FROM studio_projects')) rows = values[0] === 'project' && values[1] === 'owner' ? [{ id: 'project', user_id: 'owner', name: 'Film', canvas_template_id: 'minimal-start', settings, workspace_state: state.workspace, revision: state.revision, persistence_mode: 'connected', created_at: '2026-01-01', updated_at: '2026-01-01' }] : [];
    else if (normalized.includes('FROM studio_sequences')) rows = [{ id: 'sequence', user_id: 'owner', project_id: 'project', name: 'Main', settings, timeline_state: state.timeline, created_at: '2026-01-01', updated_at: '2026-01-01' }];
    else if (normalized.startsWith('SELECT o.id') && normalized.includes('mcp_generation_quotes')) rows = state.sourceAvailable && state.projectScope && values[2] === state.source.user_id ? [{ id: ref.outputId }] : [];
    else if (normalized.startsWith('SELECT o.*')) rows = state.sourceAvailable ? [state.source] : [];
    else if (normalized.startsWith('WITH measured')) {
      assert.equal(state.locked, false); assert.equal(values[0], state.source.user_id); assert.equal(values[3], state.source.url);
      state.source.metadata.mediaFacts = JSON.parse(String(values[4])); rows = [{ id: ref.outputId }];
    }
    else if (normalized.startsWith('INSERT INTO studio_sequences')) { state.timeline = JSON.parse(String(values[5])); rows = [{ id: 'sequence' }]; }
    else if (normalized.startsWith('UPDATE studio_sequences')) rows = [];
    else if (normalized.startsWith('UPDATE studio_projects')) {
      assert.equal(values[6], state.revision);
      state.workspace = JSON.parse(String(values[5])); state.revision++; rows = [{ revision: state.revision }]; state.writes.push(values);
    } else if (normalized.startsWith('INSERT INTO studio_project_commands')) {
      state.receipts.set(String(values[2]), { request_hash: String(values[3]), safe_result: JSON.parse(String(values[7])) }); rows = [];
    } else throw new Error(`Unexpected offline query: ${normalized}`);
    return rows as T[];
  };
  const withTransaction = async <T>(callback: (executor: { query: typeof query }) => Promise<T>): Promise<T> => {
    assert.equal(state.locked, false); state.locked = true;
    const snapshot = structuredClone({ revision: state.revision, workspace: state.workspace, timeline: state.timeline, receipts: state.receipts, writes: state.writes });
    try { return await callback({ query }); }
    catch (error) { Object.assign(state, snapshot); throw error; }
    finally { state.locked = false; }
  };
  const hydrateVideoFacts = async (input: { userId: string; ref: unknown; expectedUrl: string }) => {
    assert.equal(state.locked, false, 'Source inspection must happen after database locks are released.');
    assert.equal(input.userId, 'owner'); assert.deepEqual(input.ref, ref); assert.equal(input.expectedUrl, state.source.url);
    state.hydrations++; state.source.metadata.mediaFacts = facts;
    return facts;
  };
  return { state, query, dependencies: { withTransaction, featureEnabled: true, hydrateVideoFacts } };
}

test('a ready generated video obtains measured facts outside locks before the shared insert saves canonical editor media', async () => {
  const { state, dependencies } = fixture();
  const result = await editStudioConversationTimeline({ userId: 'owner' }, command, dependencies);
  assert.equal(state.hydrations, 1); assert.equal(result.revision, 1); assert.equal(result.clipCount, 1);
  const item = (state.timeline.timelineItems as any[])[0];
  assert.equal(item.durationSec, 5); assert.equal(item.sourceDurationSec, 6); assert.deepEqual(item.mediaFacts, facts);
  assert.deepEqual((state.workspace.projectAssets as any[])[0].mediaFacts, facts);
  assert.doesNotMatch(JSON.stringify(state.writes), /X-Amz-/);
  state.sourceAvailable = false;
  assert.deepEqual(await editStudioConversationTimeline({ userId: 'owner' }, command, dependencies), result);
  assert.equal(state.hydrations, 1, 'Receipt replay cannot inspect or require the source again.');
});

test('source preparation cannot bypass ownership, project quote scope, revision or measured duration', async () => {
  for (const scenario of ['foreign', 'scope', 'revision', 'overlong'] as const) {
    const { state, dependencies } = fixture();
    if (scenario === 'foreign') state.source.user_id = 'foreign';
    if (scenario === 'scope') state.projectScope = false;
    if (scenario === 'revision') state.revision = 1;
    await assert.rejects(editStudioConversationTimeline({ userId: 'owner' }, scenario === 'overlong' ? { ...command, edit: { ...command.edit, durationFrames: 210 } } : command, dependencies), scenario === 'overlong' ? /Invalid Studio timeline clip duration/ : scenario === 'revision' ? /STUDIO_REVISION_CONFLICT/ : /MEDIA_NOT_AVAILABLE/);
    assert.equal(state.hydrations, scenario === 'overlong' ? 1 : 0); assert.equal(state.writes.length, 0);
  }
});

test('the shared insert rechecks the revision after source preparation and preserves a concurrent manual edit', async () => {
  const { state, dependencies } = fixture();
  const hydrate = dependencies.hydrateVideoFacts;
  dependencies.hydrateVideoFacts = async input => { const measured = await hydrate(input); state.revision = 1; state.workspace.manual = 'kept'; return measured; };
  await assert.rejects(editStudioConversationTimeline({ userId: 'owner' }, command, dependencies), /STUDIO_REVISION_CONFLICT/);
  assert.equal(state.workspace.manual, 'kept'); assert.equal(state.revision, 1); assert.equal(state.writes.length, 0);
});

test('quote scope and ownership revocation during preparation prevent insertion', async () => {
  for (const scenario of ['scope', 'owner']) {
    const { state, dependencies } = fixture();
    const hydrate = dependencies.hydrateVideoFacts;
    dependencies.hydrateVideoFacts = async input => {
      const measured = await hydrate(input);
      if (scenario === 'scope') state.projectScope = false; else state.source.user_id = 'foreign';
      return measured;
    };
    await assert.rejects(editStudioConversationTimeline({ userId: 'owner' }, command, dependencies), /MEDIA_NOT_AVAILABLE/);
    assert.equal(state.writes.length, 0); assert.equal(state.revision, 0);
  }
});

test('a concurrently acknowledged identical command replays its receipt after preparation with one insertion', async () => {
  const { state, dependencies } = fixture();
  const hydrate = dependencies.hydrateVideoFacts;
  let acknowledged: unknown;
  dependencies.hydrateVideoFacts = async input => {
    const measured = await hydrate(input);
    acknowledged = await editStudioConversationTimeline({ userId: 'owner' }, command, dependencies);
    state.sourceAvailable = false;
    return measured;
  };
  assert.deepEqual(await editStudioConversationTimeline({ userId: 'owner' }, command, dependencies), acknowledged);
  assert.equal(state.writes.length, 1); assert.equal(state.revision, 1); assert.equal(state.hydrations, 1);
});

test('the actual shared insert repair measures local original bytes rather than the requested generation duration', async () => {
  const { hydrateOwnedVideoMediaFacts } = await import('../frontend/server/media-library/owned-video-facts');
  const { inspectSourceVideo } = await import('../frontend/src/server/audio/source-video-probe');
  const { createReferenceFileDownloader } = await import('../frontend/src/server/agent-api/reference-file-download');
  const bytes = await readFile('tests/fixtures/studio-media/pattern-a.mp4');
  const { state, query, dependencies } = fixture();
  const download = createReferenceFileDownloader({
    lookupHost: async () => [{ address: '8.8.8.8', family: 4 }],
    openPinnedHttps: async () => {
      assert.equal(state.locked, false);
      return { statusCode: 200, headers: { 'content-type': 'video/mp4' }, body: (async function* () { yield bytes; })() };
    },
  }, { accepted: ['video/mp4'], maxBytes: bytes.length });
  dependencies.hydrateVideoFacts = input => hydrateOwnedVideoMediaFacts(input as any, { query, inspectVideo: url => inspectSourceVideo(url, { download }) });
  await editStudioConversationTimeline({ userId: 'owner' }, command, dependencies);
  const item = (state.timeline.timelineItems as any[])[0];
  assert.deepEqual(item.mediaFacts, facts); assert.equal(item.durationSec, 5); assert.equal(item.sourceDurationSec, 6);
  assert.equal(state.source.metadata.durationSec, 5); assert.equal(state.revision, 1);
});
