import assert from 'node:assert/strict';
import test from 'node:test';
import * as requests from '../frontend/server/seedance-workflow-request';

const draft = { draftJobId: 'draft-owned', providerTaskId: 'cgt-private', providerModelId: 'same-model',
  expiresAt: '2026-10-08T00:00:00Z' };
const parent = { prompt: 'Original prompt', durationSec: 5, aspectRatio: '16:9', audio: false,
  settings: { inputMode: 't2v', core: { resolution: '480p', iterationCount: 1 }, seedanceWorkflow: { step: 'draft' } } };

test('final pricing inherits owned Draft facts and rejects missing ownership before any quote', async () => {
  const resolve = requests.resolveSeedanceWorkflowRequest;
  const body = { engineId: 'seedance-2-5', mode: 't2v', prompt: 'Changed!', durationSec: 30, resolution: '480p',
    aspectRatio: '9:16', audio: true, inputs: [], seedanceWorkflow: { step: 'final', draftJobId: 'draft-owned' } };
  const resolved = await resolve({ body, userId: 'owner', engineId: 'seedance-2-5', enabled: true }, {
    getOwnedReadyFn: async (user, id) => user === 'owner' && id === 'draft-owned' ? draft : null,
    readParentFn: async () => parent,
  });
  assert.ok(resolved);
  assert.equal(resolved.body.prompt, 'Original prompt');
  assert.equal(resolved.body.durationSec, 5);
  assert.equal(resolved.body.aspectRatio, '16:9');
  assert.equal(resolved.body.audio, false);
  assert.equal(resolved.body.resolution, '1080p');
  assert.deepEqual(resolved.seedanceFinal, { draftJobId: 'draft-owned', providerTaskId: 'cgt-private', providerModelId: 'same-model' });
  await assert.rejects(resolve({ body, userId: 'other', engineId: 'seedance-2-5', enabled: true }, {
    getOwnedReadyFn: async () => null, readParentFn: async () => { throw new Error('must not read foreign parent'); },
  }), /unavailable/i);
  await assert.rejects(resolve({ body: { ...body, seedanceWorkflow: { step: 'final', draftJobId: 'draft-owned', providerTaskId: 'cgt-forged' } },
    userId: 'owner', engineId: 'seedance-2-5', enabled: true }), /workflow/i);
});

test('ordinary generation stays ordinary and unsupported Draft requests fail closed', async () => {
  assert.equal(await requests.resolveSeedanceWorkflowRequest({ body: {}, userId: 'owner', engineId: 'seedance-2-5', enabled: false }), null);
  for (const body of [{ draft: true }, { seedanceWorkflow: { step: 'draft' }, mode: 'i2v' },
    { seedanceWorkflow: { step: 'draft' }, mode: 't2v', iterationCount: 2 },
    { seedanceWorkflow: { step: 'draft' }, mode: 't2v', payment: { mode: 'direct' } }]) {
    await assert.rejects(requests.resolveSeedanceWorkflowRequest({ body, userId: 'owner', engineId: 'seedance-2-5', enabled: true }), /workflow|Draft/i);
  }
  await assert.rejects(requests.resolveSeedanceWorkflowRequest({ body: { seedanceWorkflow: { step: 'draft' } },
    userId: 'owner', engineId: 'seedance-2-5', enabled: false }), /unavailable/i);
});
