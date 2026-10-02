import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAssetFieldHelperLines } from '../frontend/components/asset-dropzone/asset-field-helper-lines';
import { getLocalizedAssetDropzoneCopy } from '../frontend/lib/ltx-localization';
import { resolveEngineMediaFieldConstraint, validateMediaFileAgainstConstraint } from '../frontend/lib/media-field-constraints';
import { WAN_3_PRIME_FAL_ENGINE_REGISTRY } from '../frontend/src/config/fal-engines/wan-3-prime';
import type { EngineInputField } from '../frontend/types/engines';

const engine = WAN_3_PRIME_FAL_ENGINE_REGISTRY[0].engine;
function reference(type: EngineInputField['type']) {
  const field = engine.inputSchema!.optional!.find((candidate) => candidate.type === type && candidate.id.startsWith('reference_'));
  assert.ok(field);
  return field;
}
function guidance(field: EngineInputField, locale: 'en' | 'fr' | 'es', compact = false) {
  return buildAssetFieldHelperLines({
    engine, field, caps: { maxUploadMB: 100 }, acceptFormats: ['jpg', 'png', 'webp'],
    minimumImageSidePx: null, mediaFieldConstraint: resolveEngineMediaFieldConstraint({ engine, field }),
    assetCopy: getLocalizedAssetDropzoneCopy(locale), compact,
  }).join(' · ');
}

test('image guidance uses the field limit instead of the video upload limit of its mode', () => {
  const text = guidance(reference('image'), 'fr');
  assert.match(text, /20 Mo max/);
  assert.doesNotMatch(text, /100 Mo/);
});

test('compact collection guidance distinguishes per-file sizes and combined durations in every locale', () => {
  const audio = reference('audio');
  for (const [locale, expected] of [
    ['en', 'MP3, WAV · 15 MB per file · 15s total'],
    ['fr', 'MP3, WAV · 15 Mo par fichier · 15 s au total'],
    ['es', 'MP3, WAV · 15 MB por archivo · 15 s en total'],
  ] as const) assert.equal(guidance(audio, locale, true), expected);
  assert.equal(guidance(reference('video'), 'fr', true), 'MP4, MOV · 100 Mo par fichier · 15 s au total');
  assert.equal(guidance(reference('image'), 'fr', true), 'JPG, PNG, WEBP, BMP · 20 Mo par fichier');
});

test('a source video uses its individual duration rather than the reference collection budget', () => {
  const source: EngineInputField = { id: 'video_url', type: 'video', label: 'Source video', maxCount: 1, maxDurationSec: 10, maxSizeMB: 50 };
  assert.equal(guidance(source, 'en', true), 'MP4, MOV · 50 MB per file · 10s max');
});

test('an imposed soundtrack never inherits the reference audio duration budget', () => {
  const soundtrack: EngineInputField = {
    id: 'target_audio_url', type: 'audio', label: 'Soundtrack', maxCount: 1, minDurationSec: 2, maxSizeMB: 15,
    acceptedFileExtensions: ['wav'], acceptedMimeTypes: ['audio/wav'],
  };
  assert.equal(guidance(soundtrack, 'en', true), 'WAV · 15 MB per file');
});

test('Wan audio guidance and validation share the provider formats and reject M4A', () => {
  const constraint = resolveEngineMediaFieldConstraint({ engine, field: reference('audio') });
  for (const [name, mimeType, allowed] of [
    ['reference.wav', 'audio/wav', true], ['reference.mp3', 'audio/mpeg', true],
    ['reference.m4a', 'audio/mp4', false],
  ] as const) {
    assert.equal(validateMediaFileAgainstConstraint({ name, mimeType, sizeBytes: 1024, constraint }).ok, allowed, name);
  }
});
