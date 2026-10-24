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
    aspectRatio: '9:16', audio: true, voiceControl: true, voiceIds: ['forged-voice'], multiPrompt: [{ prompt: 'forged', duration: 30 }],
    fps: 120, audio_url: 'https://evil.example/audio.mp3', cfgScale: 50, inputs: [], seedanceWorkflow: { step: 'final', draftJobId: 'draft-owned' } };
  const resolved = await resolve({ body, userId: 'owner', engineId: 'seedance-2-5', enabled: true }, {
    getOwnedReadyFn: async (user, id) => user === 'owner' && id === 'draft-owned' ? draft : null,
    readParentFn: async () => parent,
  });
  assert.ok(resolved);
  assert.equal(resolved.body.prompt, 'Original prompt');
  assert.equal(resolved.body.durationSec, 5);
  assert.equal(resolved.body.aspectRatio, '16:9');
  assert.equal(resolved.body.audio, false);
  assert.equal(resolved.body.voiceControl, false);
  assert.deepEqual(resolved.body.voiceIds, []);
  assert.equal(resolved.body.multiPrompt, undefined);
  assert.equal(resolved.body.audio_url, undefined);
  assert.equal(resolved.body.fps, 24);
  assert.equal(resolved.body.cfgScale, undefined);
  assert.equal(resolved.body.resolution, '1080p');
  assert.deepEqual(resolved.seedanceFinal, { draftJobId: 'draft-owned', providerTaskId: 'cgt-private', providerModelId: 'same-model',
    parentSnapshotFingerprint: (await import('../frontend/server/seedance-workflow-facts')).seedanceDraftBillingFingerprint(parent) });
  await assert.rejects(resolve({ body, userId: 'other', engineId: 'seedance-2-5', enabled: true }, {
    getOwnedReadyFn: async () => null, readParentFn: async () => { throw new Error('must not read foreign parent'); },
  }), /unavailable/i);
  await assert.rejects(resolve({ body: { ...body, seedanceWorkflow: { step: 'final', draftJobId: 'draft-owned', providerTaskId: 'cgt-forged' } },
    userId: 'owner', engineId: 'seedance-2-5', enabled: true }), /workflow/i);
});

test('ordinary generation stays ordinary and unsupported Draft requests fail closed', async () => {
  assert.equal(await requests.resolveSeedanceWorkflowRequest({ body: {}, userId: 'owner', engineId: 'seedance-2-5', enabled: false }), null);
  for (const body of [{ draft: true }, { seedanceWorkflow: { step: 'draft' }, mode: 'fl2v' },
    { seedanceWorkflow: { step: 'draft' }, mode: 't2v', iterationCount: 2 },
    { seedanceWorkflow: { step: 'draft' }, mode: 't2v', payment: { mode: 'direct' } }]) {
    await assert.rejects(requests.resolveSeedanceWorkflowRequest({ body, userId: 'owner', engineId: 'seedance-2-5', enabled: true }), /workflow|Draft/i);
  }
  await assert.rejects(requests.resolveSeedanceWorkflowRequest({ body: { seedanceWorkflow: { step: 'draft' } },
    userId: 'owner', engineId: 'seedance-2-5', enabled: false }), /unavailable/i);
});

test('Draft preserves each supported mode and its original owned media and creative choices', async () => {
  for (const mode of ['t2v', 'i2v', 'ref2v', 'v2v', 'extend']) {
    const inputs = mode === 't2v' ? [] : [{ assetId: 'owned', slotId: mode === 'i2v' ? 'image_url' : 'video_urls',
      kind: mode === 'i2v' ? 'image' : 'video', url: 'https://cdn.example/owned' }];
    const extraInputValues = { output_format: 'mov', return_last_frame: true, watermark: true };
    const result = await requests.resolveSeedanceWorkflowRequest({ body: { mode, inputs, extraInputValues,
      durationOption: 'auto', aspectRatio: 'auto', seedanceWorkflow: { step: 'draft' } },
      userId: 'owner', engineId: 'seedance-2-5', enabled: true });
    assert.equal(result?.body.mode, mode);
    assert.deepEqual(result?.body.inputs, inputs);
    assert.deepEqual(result?.body.extraInputValues, { output_format: 'mov' });
    assert.equal(result?.body.durationOption, 'auto');
    assert.equal(result?.body.resolution, '480p');
  }
});

test('Final inherits immutable multimodal Draft facts and defeats caller media and option tampering', async () => {
  const input = { name: 'source.mov', type: 'video/quicktime', size: 1000, kind: 'video' as const,
    slotId: 'video_url', assetId: 'deleted-owned-video', url: 'https://cdn.example/source.mov',
    width: 1920, height: 1080, durationSec: 5.2 };
  const original = { ...parent, durationSec: 5.2,
    settings: { inputMode: 'v2v', core: { durationSec: 6, durationOption: 6, resolution: '480p', iterationCount: 1 },
      advanced: { extraInputValues: { output_format: 'mov', return_last_frame: true, watermark: true } },
      refs: { inputs: [input], videoUrls: [input.url] }, seedanceWorkflow: { step: 'draft',
        mediaFacts: { schemaVersion: 1, mode: 'v2v', durationSec: 6, aspectRatio: '16:9', hasVideoInput: true,
          inputVideoDurationSec: 5.2, attachments: [input], trustedMediaReferences: [{ kind: 'video', url: input.url, durationSec: 5.2, width: 1920, height: 1080 }] } } } };
  const result = await requests.resolveSeedanceWorkflowRequest({ body: { mode: 't2v', prompt: 'forged',
    durationSec: 30, inputs: [{ assetId: 'foreign', kind: 'video', slotId: 'video_url', url: 'https://evil.example' }],
    extraInputValues: { output_format: 'mp4', return_last_frame: false, inputVideoDurationSec: 0 },
    seedanceWorkflow: { step: 'final', draftJobId: draft.draftJobId } },
    userId: 'owner', engineId: 'seedance-2-5', enabled: true }, {
      getOwnedReadyFn: async () => draft, readParentFn: async () => original,
    });
  assert.equal(result?.body.mode, 'v2v');
  assert.equal(result?.body.durationSec, 6, 'measured Draft output must not replace immutable billing duration');
  assert.equal(result?.body.resolution, '1080p');
  assert.deepEqual(result?.body.inputs, [input]);
  assert.deepEqual(result?.body.extraInputValues, { output_format: 'mov' });
  assert.equal(result?.finalFacts?.inputVideoDurationSec, 5.2);
  assert.equal(result?.finalFacts?.hasVideoInput, true);
  await assert.rejects(requests.resolveSeedanceWorkflowRequest({ body: { mode: 't2v', seedanceWorkflow: { step: 'final', draftJobId: draft.draftJobId } },
    userId: 'owner', engineId: 'seedance-2-5', enabled: true }, { getOwnedReadyFn: async () => draft,
      readParentFn: async () => ({ ...original, settings: { ...original.settings, inputMode: 't2v' } }) }), /Draft|workflow/i,
    'a mismatched owned mode and media snapshot must never select a cheaper Final price');
});
