import assert from 'node:assert/strict';
import test from 'node:test';

import { buildKling3TurboFalFallbackRequest } from '../frontend/src/lib/kling-3-turbo';

test('Kling 3 Turbo normalizes a single-prompt text request to the Standard Fal contract', () => {
  assert.deepEqual(
    buildKling3TurboFalFallbackRequest({
      engineId: 'kling-3-turbo-standard',
      mode: 't2v',
      prompt: 'A red kite drifts over a quiet coastal town at sunrise.',
      durationSec: 5,
      aspectRatio: '16:9',
    }),
    {
      model: 'fal-ai/kling-video/v3/turbo/standard/text-to-video',
      requestBody: {
        prompt: 'A red kite drifts over a quiet coastal town at sunrise.',
        duration: '5',
        aspect_ratio: '16:9',
      },
    },
  );
});

test('Kling 3 Turbo requires a start image for image-to-video', () => {
  assert.throws(
    () => buildKling3TurboFalFallbackRequest({
      engineId: 'kling-3-turbo-pro',
      mode: 'i2v',
      prompt: 'The still life gathers a gentle breeze.',
      durationSec: 5,
    }),
    /image_url/i,
  );
});

test('Kling 3 Turbo preserves six multi-shot segments with their documented total duration', () => {
  assert.deepEqual(
    buildKling3TurboFalFallbackRequest({
      engineId: 'kling-3-turbo-pro',
      mode: 't2v',
      durationSec: 15,
      aspectRatio: '9:16',
      multiPrompt: [
        { prompt: 'Shot one.', durationSec: 3 },
        { prompt: 'Shot two.', durationSec: 3 },
        { prompt: 'Shot three.', durationSec: 3 },
        { prompt: 'Shot four.', durationSec: 2 },
        { prompt: 'Shot five.', durationSec: 2 },
        { prompt: 'Shot six.', durationSec: 2 },
      ],
    }),
    {
      model: 'fal-ai/kling-video/v3/turbo/pro/text-to-video',
      requestBody: {
        multi_prompt: [
          { prompt: 'Shot one.', duration: '3' },
          { prompt: 'Shot two.', duration: '3' },
          { prompt: 'Shot three.', duration: '3' },
          { prompt: 'Shot four.', duration: '2' },
          { prompt: 'Shot five.', duration: '2' },
          { prompt: 'Shot six.', duration: '2' },
        ],
        duration: '15',
        aspect_ratio: '9:16',
      },
    },
  );
});

test('Kling 3 Turbo rejects a mixed single and multi-shot prompt request', () => {
  assert.throws(
    () => buildKling3TurboFalFallbackRequest({
      engineId: 'kling-3-turbo-standard',
      mode: 't2v',
      prompt: 'A single prompt.',
      durationSec: 3,
      multiPrompt: [{ prompt: 'A shot prompt.', durationSec: 3 }],
    }),
    /mutually exclusive/i,
  );
});

test('Kling 3 Turbo rejects a multi-shot sequence longer than fifteen seconds', () => {
  assert.throws(
    () => buildKling3TurboFalFallbackRequest({
      engineId: 'kling-3-turbo-standard',
      mode: 't2v',
      durationSec: 15,
      multiPrompt: [
        { prompt: 'Opening.', durationSec: 8 },
        { prompt: 'Closing.', durationSec: 8 },
      ],
    }),
    /15 seconds/i,
  );
});
