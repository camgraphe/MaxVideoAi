import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveOwnedLumaGenerationSource } from '../frontend/src/server/agent-api/generation-luma-lineage';
const row = { owner_id: 'alice', source_job_id: 'job', engine_id: 'luma-ray-3-2', surface: 'video', status: 'completed',
  provider: 'luma_agents_direct', provider_job_id: 'private-provider-id', attempt_id: 7, attempt_provider: 'luma_agents_direct',
  attempt_model: 'ray-3.2', attempt_status: 'completed', attempt_provider_job_id: 'private-provider-id',
  output_id: 'out', output_status: 'ready', output_owner: 'alice', original_url: 'https://private.example/original.mp4', output_url: 'https://private.example/original.mp4' };
const resolve = (patch = {}, userId = 'alice') => resolveOwnedLumaGenerationSource({ actor: { userId }, sourceJobId: 'job', executor: {
  query: async (sql: string, params: unknown[]) => { assert.match(sql, /j.user_id = \$2/); assert.deepEqual(params.slice(0, 2), ['job', userId]); return [{ ...row, ...patch }] as never; },
} });
test('owned exact successful direct lineage resolves stable private identity', async () => {
  const source = await resolve();
  assert.equal(source.providerGenerationId, 'private-provider-id');
  assert.equal(source.sourceOutputIdentity, 'out');
  assert.equal(source.fingerprint, (await resolve({ original_url: 'https://private.example/new.mp4', output_url: 'https://private.example/new.mp4' })).fingerprint);
});
test('foreign, incomplete, mismatched and unavailable sources fail equally for every actor', async () => {
  for (const patch of [{ owner_id: 'bob' }, { output_owner: 'bob' }, { status: 'failed' }, { status: 'queued' },
    { engine_id: 'luma-ray-2' }, { provider: 'fal' }, { provider_job_id: '' }, { attempt_status: 'accepted' },
    { attempt_provider_job_id: 'other' }, { attempt_model: 'ray-2' }, { output_status: 'deleted' }, { output_url: 'other' }]) {
    await assert.rejects(resolve(patch), /not available/);
  }
  await assert.rejects(resolve({}, 'admin'), /not available/);
});
