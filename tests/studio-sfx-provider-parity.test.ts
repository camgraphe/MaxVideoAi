import assert from 'node:assert/strict';
import test from 'node:test';
import { validateAudioGenerateRequest } from '../frontend/src/server/audio/audio-generate-validation';
import { generateSoundDesignTrack, orderSoundDesignProviders } from '../frontend/src/server/audio/providers/sound-design';
import { buildAudioVendorCostFacts } from '../frontend/src/lib/audio-generation';
import { AUDIO_PROVIDER_ROSTER } from '../frontend/src/server/audio/providers/roster';

test('standalone SFX validates text-only input and its provider duration before charging', () => {
  for (const durationSec of [3, 8, 30]) {
    const request = validateAudioGenerateRequest({ pack: 'sfx_only', prompt: 'Waves against a wooden pier', durationSec });
    assert.equal(request.sourceVideoUrl, null);
    assert.equal(request.musicEnabled, false);
    assert.equal(request.durationSec, durationSec);
    const facts = buildAudioVendorCostFacts({ pack: request.pack, durationSec: request.durationSec! });
    assert.equal(facts.components.length, 1);
    assert.equal(facts.components[0].model, 'fal-ai/mmaudio-v2/text-to-audio');
    assert.equal(facts.vendorSubtotalCents, durationSec * 0.1);
  }
  for (const extra of [{ durationSec: 31 }, { durationSec: 2 }, { sourceVideoUrl: 'https://example.com/input.mp4' }, { sourceJobId: 'job-1' }, { musicEnabled: true }]) {
    assert.throws(() => validateAudioGenerateRequest({ pack: 'sfx_only', prompt: 'Waves', durationSec: 8, ...extra }));
  }
  assert.throws(() => buildAudioVendorCostFacts({ pack: 'sfx_only', durationSec: 31 }));
});

test('standalone SFX sends the quoted duration to exactly MMAudio V2', async () => {
  const calls: Array<{ model: string; input: Record<string, unknown> }> = [];
  const output = await generateSoundDesignTrack({ durationSec: 8, mood: 'epic', intensity: 'standard', prompt: 'Waves' }, {
    subscribe: async (model, input) => {
      calls.push({ model, input });
      return { data: { audio: { url: 'https://example.com/output.flac' } }, requestId: 'test-request' };
    },
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].model, 'fal-ai/mmaudio-v2/text-to-audio');
  assert.equal(calls[0].input.duration, 8);
  assert.equal('video_url' in calls[0].input, false);
  assert.equal(output.model, calls[0].model);
  assert.deepEqual(orderSoundDesignProviders('https://example.com/video.mp4'), AUDIO_PROVIDER_ROSTER.soundDesign);
});

test('standalone SFX provider failure cannot switch to a more expensive model', async () => {
  const attempted: string[] = [];
  await assert.rejects(generateSoundDesignTrack({ durationSec: 8, mood: 'epic', intensity: 'standard', prompt: 'Waves' }, {
    subscribe: async (model) => { attempted.push(model); throw new Error('fixture failure'); },
  }));
  assert.deepEqual(attempted, ['fal-ai/mmaudio-v2/text-to-audio']);
});
