import assert from 'node:assert/strict';
import test from 'node:test';

import { buildMinimaxH3MaxFalRequest } from '../frontend/src/lib/minimax-h3-max';

test('MiniMax H3 Max text requests use the documented endpoint and balanced defaults', () => {
  assert.deepEqual(buildMinimaxH3MaxFalRequest({
    mode: 't2v',
    prompt: 'An original explorer crosses a mirrored salt flat at dawn.',
    durationSec: 5,
    aspectRatio: '21:9',
  }), {
    model: 'minimax/h3-max/text-to-video',
    requestBody: {
      prompt: 'An original explorer crosses a mirrored salt flat at dawn.',
      duration: 5,
      resolution: '768P',
      aspect_ratio: '21:9',
      prompt_expansion_mode: 'balanced',
    },
  });
});

test('MiniMax H3 Max image requests preserve end_image_url and quality expansion', () => {
  assert.deepEqual(buildMinimaxH3MaxFalRequest({
    mode: 'i2v',
    prompt: 'The paper bird lifts from the table and circles the lamp.',
    durationSec: 10,
    resolution: '480P',
    imageUrl: 'https://media.maxvideoai.com/start.png',
    endImageUrl: 'https://media.maxvideoai.com/end.png',
    promptExpansionMode: 'quality',
  }), {
    model: 'minimax/h3-max/image-to-video',
    requestBody: {
      prompt: 'The paper bird lifts from the table and circles the lamp.',
      duration: 10,
      resolution: '480P',
      image_url: 'https://media.maxvideoai.com/start.png',
      end_image_url: 'https://media.maxvideoai.com/end.png',
      prompt_expansion_mode: 'quality',
    },
  });
});

test('MiniMax H3 Max reference requests group mixed typed media without changing their URLs', () => {
  assert.deepEqual(buildMinimaxH3MaxFalRequest({
    mode: 'ref2v',
    prompt: 'Keep the original character design and follow the reference performance.',
    durationSec: 15,
    resolution: '768P',
    references: [
      { type: 'image', url: 'https://media.maxvideoai.com/character.png' },
      { type: 'video', url: 'https://media.maxvideoai.com/performance.mp4' },
      { type: 'audio', url: 'https://media.maxvideoai.com/dialogue.wav' },
    ],
  }), {
    model: 'minimax/h3-max/reference-to-video',
    requestBody: {
      prompt: 'Keep the original character design and follow the reference performance.',
      duration: 15,
      resolution: '768P',
      prompt_expansion_mode: 'balanced',
      reference_image_urls: ['https://media.maxvideoai.com/character.png'],
      reference_video_urls: ['https://media.maxvideoai.com/performance.mp4'],
      reference_audio_urls: ['https://media.maxvideoai.com/dialogue.wav'],
    },
  });
});
