import assert from 'node:assert/strict';
import test from 'node:test';

import { MINIMAX_H3_FAL_ENGINE_REGISTRY } from '../frontend/src/config/fal-engines/minimax-h3';

const entry = MINIMAX_H3_FAL_ENGINE_REGISTRY.find(({ id }) => id === 'minimax-h3');

function requireField(id: string, mode?: 't2v' | 'i2v' | 'ref2v') {
  assert.ok(entry, 'MiniMax H3 raw engine entry should exist');
  const fields = [
    ...(entry.engine.inputSchema?.required ?? []),
    ...(entry.engine.inputSchema?.optional ?? []),
  ];
  const field = fields.find((candidate) => candidate.id === id && (!mode || candidate.modes?.includes(mode)));
  assert.ok(field, `MiniMax H3 field ${id} should exist`);
  return field;
}

test('MiniMax H3 raw contract exposes one three-mode native-audio engine', () => {
  assert.ok(entry, 'MiniMax H3 raw engine entry should exist');
  assert.equal(entry.engine.provider, 'MiniMax');
  assert.deepEqual(entry.engine.modes, ['t2v', 'i2v', 'ref2v']);
  assert.deepEqual(entry.engine.resolutions, ['480P', '768P', '2K', '4K']);
  assert.deepEqual(entry.engine.aspectRatios, ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16', 'auto']);
  assert.deepEqual(entry.engine.fps, [24]);
  assert.equal(entry.engine.maxDurationSec, 15);
  assert.equal(entry.engine.audio, true);
  assert.equal(entry.modes.find(({ mode }) => mode === 't2v')?.falModelId, 'minimax/h3/text-to-video');
  assert.equal(entry.modes.find(({ mode }) => mode === 'i2v')?.falModelId, 'minimax/h3/image-to-video');
  assert.equal(entry.modes.find(({ mode }) => mode === 'ref2v')?.falModelId, 'minimax/h3/reference-to-video');
  assert.equal(entry.modes.every(({ ui }) => ui.audioToggle === false), true);
  assert.equal(entry.modes.find(({ mode }) => mode === 't2v')?.ui.aspectRatio?.includes('auto'), false);
  assert.equal(entry.modes.find(({ mode }) => mode === 'i2v')?.ui.aspectRatio, undefined);
  assert.ok(entry.modes.find(({ mode }) => mode === 'ref2v')?.ui.aspectRatio?.includes('auto'));
  assert.equal(entry.engine.inputLimits.promptMaxChars, 50_000);
  assert.equal(entry.engine.inputLimits.promptMaxCharsSource, 'official');
  assert.equal(entry.engine.inputSchema?.referenceBudget?.maxTotal, 12);
  assert.deepEqual(entry.engine.inputSchema?.referenceBudget?.fieldIds, [
    'reference_image_urls',
    'reference_video_urls',
    'reference_audio_urls',
  ]);
});

test('MiniMax H3 raw contract encodes every duration, rate, and reference bound', () => {
  assert.ok(entry, 'MiniMax H3 raw engine entry should exist');
  assert.deepEqual(requireField('duration').values, [
    '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15',
  ]);
  assert.deepEqual(requireField('resolution').values, ['480P', '768P', '2K', '4K']);
  assert.deepEqual(requireField('aspect_ratio', 't2v').values, [
    '21:9', '16:9', '4:3', '1:1', '3:4', '9:16',
  ]);
  assert.deepEqual(requireField('aspect_ratio', 'ref2v').values, [
    '21:9', '16:9', '4:3', '1:1', '3:4', '9:16', 'auto',
  ]);

  const images = requireField('reference_image_urls');
  assert.equal(images.maxCount, 9);
  assert.equal(images.maxSizeMB, 30);

  const videos = requireField('reference_video_urls');
  assert.equal(videos.maxCount, 3);
  assert.equal(videos.maxSizeMB, 50);
  assert.equal(videos.minDurationSec, 2);
  assert.equal(videos.maxDurationSec, 15);

  const audios = requireField('reference_audio_urls');
  assert.equal(audios.maxCount, 3);
  assert.equal(audios.maxSizeMB, 15);
  assert.equal(audios.minDurationSec, 2);
  assert.equal(audios.maxDurationSec, 15);

  assert.equal(entry.engine.inputSchema?.constraints?.maxCombinedVideoDurationSec, 15);
  assert.equal(entry.engine.inputSchema?.constraints?.maxCombinedAudioDurationSec, 15);
  assert.deepEqual(entry.engine.pricingDetails?.perSecondCents?.byResolution, {
    '480P': 5,
    '768P': 6,
    '2K': 13,
    '4K': 16,
  });
  assert.equal(entry.engine.pricing?.base, 0.13);
});

test('MiniMax H3 exposes no user-facing audio switch', () => {
  assert.ok(entry, 'MiniMax H3 raw engine entry should exist');
  const fieldIds = [
    ...(entry.engine.inputSchema?.required ?? []),
    ...(entry.engine.inputSchema?.optional ?? []),
  ].map(({ id }) => id);
  assert.equal(fieldIds.includes('generate_audio'), false);
  assert.equal(fieldIds.includes('audio'), false);
});

test('MiniMax H3 supports independent keyframes, soundtracks, seed, and prompt expansion', () => {
  assert.deepEqual(requireField('prompt_expansion_mode').values, ['disabled', 'fast', 'balanced', 'quality']);
  assert.equal(requireField('seed').step, 1);
  assert.equal(requireField('image_url').requiredInModes, undefined);
  assert.equal(requireField('image_url').minCount, 0);
  assert.equal(requireField('end_image_url').minCount, 0);
  const soundtrack = requireField('target_audio_url');
  assert.deepEqual(soundtrack.modes, ['t2v', 'i2v']);
  assert.equal(soundtrack.minDurationSec, 2);
  assert.equal(soundtrack.maxSizeMB, 15);
  assert.equal(soundtrack.maxDurationSec, undefined);
  assert.equal(entry?.engine.inputLimits.audioMaxDurationSec, undefined);
  assert.equal(entry?.engine.inputSchema?.constraints?.referenceAudioRequiresVisual, false);
  assert.deepEqual(entry?.engine.inputSchema?.constraints?.combinedDurationModes, ['ref2v']);
  assert.deepEqual(entry?.engine.inputSchema?.constraints?.ownedAssetModes, ['t2v', 'i2v', 'ref2v']);
});
