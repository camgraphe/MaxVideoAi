import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveGenerationAttachmentReferences } from '../frontend/app/api/generate/_lib/attachment-references';
import { buildGenerateValidationPayload } from '../frontend/app/api/generate/_lib/validation-payload';
import type { NormalizedAttachment } from '../frontend/app/api/generate/_lib/generation-attachment-types';
import { MINIMAX_H3_ENGINE } from '../frontend/src/config/fal-engines/minimax-h3';
import { MINIMAX_H3_MAX_ENGINE } from '../frontend/src/config/fal-engines/minimax-h3-max';
import { WAN_3_INPUT_SCHEMA } from '../frontend/src/config/fal-engines/wan-3-shared';
import type { EngineInputSchema, Mode } from '../frontend/types/engines';

function attachment(kind: 'image' | 'video' | 'audio', slotId: string): NormalizedAttachment {
  return { name: slotId, type: `${kind}/${kind === 'image' ? 'png' : kind === 'video' ? 'mp4' : 'wav'}`, size: 1_000,
    kind, slotId, url: `https://media.maxvideoai.com/${slotId}`, assetId: `asset-${slotId}` };
}

function validate(engineId: string, mode: Mode, schema: EngineInputSchema, attachments: NormalizedAttachment[]) {
  const references = deriveGenerationAttachmentReferences({ engineId, mode, inputSchema: schema, attachments });
  return buildGenerateValidationPayload({
    engineId, mode, prompt: 'An original scene with consistent subjects.', multiPrompt: null,
    supportsResolution: true, effectiveResolution: engineId.startsWith('minimax-h3') ? '768P' : '720p',
    supportsAspectRatio: mode !== 'i2v', aspectRatio: mode === 'i2v' ? null : '16:9',
    audioEnabled: undefined, isBytePlusV1a: false, supportsDuration: true, numFrames: null,
    validationDuration: 5, elements: null, endImageUrl: null, isLumaRay2: false,
    inputSchema: schema, ...references,
  });
}

for (const engine of [MINIMAX_H3_ENGINE, MINIMAX_H3_MAX_ENGINE]) {
  test(`${engine.id} production validation preserves an end-only frame`, () => {
    const result = validate(engine.id, 'i2v', engine.inputSchema!, [attachment('image', 'end_image_url')]);
    assert.equal(result.ok, true, JSON.stringify(result));
    if (!result.ok) return;
    assert.equal(result.payload.end_image_url, 'https://media.maxvideoai.com/end_image_url');
    assert.equal(result.payload.image_url, undefined);
  });

  test(`${engine.id} production validation projects an imposed soundtrack to its schema field`, () => {
    const result = validate(engine.id, 't2v', engine.inputSchema!, [attachment('audio', 'target_audio_url')]);
    assert.equal(result.ok, true, JSON.stringify(result));
    if (!result.ok) return;
    assert.equal(result.payload.target_audio_url, 'https://media.maxvideoai.com/target_audio_url');
    assert.equal('audio_url' in result.payload, false);
  });
}

for (const mode of ['v2v', 'extend'] as const) {
  test(`Wan ${mode} production validation retains mixed image/audio references`, () => {
    const result = validate('wan-3', mode, WAN_3_INPUT_SCHEMA, [
      attachment('video', 'video_url'), attachment('image', 'reference_image_urls'),
      attachment('audio', 'reference_audio_urls'),
    ]);
    assert.equal(result.ok, true, JSON.stringify(result));
    if (!result.ok) return;
    assert.equal(result.payload.video_url, 'https://media.maxvideoai.com/video_url');
    assert.deepEqual(result.payload.reference_image_urls, ['https://media.maxvideoai.com/reference_image_urls']);
    assert.deepEqual(result.payload.reference_audio_urls, ['https://media.maxvideoai.com/reference_audio_urls']);
    assert.equal('audio_url' in result.payload, false);
  });
}
