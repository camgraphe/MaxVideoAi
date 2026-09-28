import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildSeedance25DraftRequest,
  buildSeedance25FinalRequest,
} from '../frontend/src/server/video-providers/byteplus-modelark-draft';

test('Seedance 2.5 Draft is one 480p provider task with the original creative inputs', () => {
  const draft = buildSeedance25DraftRequest({
    modelId: 'account-endpoint-25',
    prompt: 'A slow camera move through a garden',
    durationSec: 5,
    mode: 'i2v',
    imageUrl: 'https://cdn.maxvideoai.com/first.png',
    endImageUrl: 'https://cdn.maxvideoai.com/last.png',
    resolution: '480p',
    generateAudio: false,
  });
  assert.equal(draft.model, 'account-endpoint-25');
  assert.equal(draft.draft, true);
  assert.equal(draft.resolution, '480p');
  assert.equal(draft.generate_audio, false);
  assert.equal('ratio' in draft, false);
  assert.deepEqual(draft.content.map((item) => item.type), ['text', 'image_url', 'image_url']);
});

test('Seedance 2.5 Draft rejects non-480p and unsupported duration', () => {
  const base = {
    modelId: 'dreamina-seedance-2-5-260628',
    prompt: 'A mountain ridge',
    durationSec: 5,
    mode: 't2v' as const,
    resolution: '480p',
  };
  assert.throws(() => buildSeedance25DraftRequest({ ...base, resolution: '720p' }));
  assert.throws(() => buildSeedance25DraftRequest({ ...base, durationSec: 31 }));
});

test('Seedance 2.5 final reuses only the owned Draft task and requests 1080p', () => {
  const final = buildSeedance25FinalRequest({
    modelId: 'dreamina-seedance-2-5-260628',
    draftProviderTaskId: 'cgt-2026-draft-id',
  });
  assert.deepEqual(final, {
    model: 'dreamina-seedance-2-5-260628',
    content: [{ type: 'draft_task', draft_task: { id: 'cgt-2026-draft-id' } }],
    resolution: '1080p',
    watermark: false,
  });
  assert.equal('duration' in final, false);
  assert.equal('ratio' in final, false);
  assert.equal('generate_audio' in final, false);
  assert.throws(() => buildSeedance25FinalRequest({
    modelId: 'dreamina-seedance-2-5-260628',
    draftProviderTaskId: '  ',
  }));
});
