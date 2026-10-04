import assert from 'node:assert/strict';
import test from 'node:test';

import { getFalEngineById } from '../frontend/src/config/falEngines.ts';
import { validateGenerationMediaConstraints, type StoredMediaMetadataRow } from '../frontend/app/api/generate/_lib/generation-media-constraints.ts';
import { resolveEngineMediaFieldConstraint } from '../frontend/lib/media-field-constraints.ts';

const audioUrl = 'https://media.example/reference-audio';

function engineAndField(engineId: 'wan-3' | 'wan-3-prime') {
  const engine = getFalEngineById(engineId)?.engine;
  assert.ok(engine);
  const field = engine.inputSchema?.optional?.find((item) => item.id === 'reference_audio_urls');
  assert.ok(field);
  return { engine, field };
}

async function validateStoredAudio(engineId: 'wan-3' | 'wan-3-prime', name: string, mimeType: string) {
  const { engine } = engineAndField(engineId);
  const row: StoredMediaMetadataRow = {
    asset_id: 'audio-1', url: audioUrl, origin_url: null,
    original_name: name, mime_type: mimeType, size_bytes: 1000, duration_sec: 10,
  };
  return validateGenerationMediaConstraints({
    engineId,
    mode: 'ref2v',
    userId: 'user-1',
    inputSchema: engine.inputSchema,
    attachments: [{ name, type: mimeType, size: 1000, kind: 'audio', slotId: 'reference_audio_urls', url: audioUrl, assetId: 'audio-1' }],
    referenceMediaItems: [{ fieldId: 'reference_audio_urls', kind: 'audio', url: audioUrl }],
    deps: { queryFn: async <T>() => [row] as T[] },
  });
}

test('both Wan 3 models publish MP3/WAV as the reference audio formats', () => {
  for (const engineId of ['wan-3', 'wan-3-prime'] as const) {
    const { engine, field } = engineAndField(engineId);
    const constraint = resolveEngineMediaFieldConstraint({ engine, field });
    assert.deepEqual(constraint.acceptedFileExtensions, ['mp3', 'wav']);
    assert.deepEqual(constraint.acceptedMimeTypes, [
      'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/vnd.wave',
    ]);
  }
});

test('Wan 3 rejects stored M4A before billing with a useful format message', async () => {
  for (const engineId of ['wan-3', 'wan-3-prime'] as const) {
    const result = await validateStoredAudio(engineId, 'recording.m4a', 'audio/mp4');
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.body.error, 'MEDIA_FORMAT_UNSUPPORTED');
      assert.equal(result.body.field, 'reference_audio_urls');
      assert.match(result.body.message, /MP3 or WAV/);
    }
  }
});

test('Wan 3 still accepts WAV and MP3 reference audio', async () => {
  for (const [name, mimeType] of [['recording.wav', 'audio/wav'], ['recording.mp3', 'audio/mpeg']]) {
    const result = await validateStoredAudio('wan-3-prime', name!, mimeType!);
    assert.equal(result.ok, true);
  }
});
