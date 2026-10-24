import assert from 'node:assert/strict';
import test from 'node:test';
import { listFalEngines } from '../frontend/src/config/falEngines';
import { projectAgentModelModeDetails } from '../frontend/src/server/agent-api/model-details';
import { normalizeGenerationRequest } from '../frontend/src/server/agent-api/generation-normalization';
import { buildGenerateRequestOptions } from '../frontend/app/api/generate/_lib/request-options';
import { buildBytePlusSeedancePayload } from '../frontend/src/server/video-providers/byteplus-modelark-payload';
import { buildBytePlusSeedreamPayload } from '../frontend/src/server/images/byteplus-seedream-payload';
import { buildSeedance25DraftRequest } from '../frontend/src/server/video-providers/byteplus-modelark-draft';
import { canonicalSettingsSchema } from '../frontend/src/server/mcp/tools/prepare-generation';

const retired = new Set(['watermark', 'watermark_enabled', 'watermark_info', 'return_last_frame', 'returnLastFrame']);

test('all authored video/image models and shared MCP/Studio details omit retired optional output controls', () => {
  for (const entry of listFalEngines()) {
    for (const field of [...(entry.engine.inputSchema?.required ?? []), ...(entry.engine.inputSchema?.optional ?? [])]) {
      assert.ok(!retired.has(field.id), `${entry.id} must not expose ${field.id}`);
    }
    const candidate = { engine: entry.engine, surface: entry.type === 'image' ? 'image' : 'video',
      publicModes: entry.engine.modes, modeCaps: Object.fromEntries(entry.modes.map(mode => [mode.mode, mode.ui])) } as never;
    for (const { mode } of entry.modes) {
      const details = projectAgentModelModeDetails(candidate, mode as never);
      assert.ok(!details.settings.some(setting => retired.has(setting.key)), `${entry.id}/${mode} shared details`);
    }
  }
  assert.equal('watermark' in canonicalSettingsSchema.shape, false);
  assert.equal('returnLastFrame' in canonicalSettingsSchema.shape, false);
});

test('old video and image settings normalize without reactivating output controls or dropping other choices', () => {
  const requests = [
    {surface:'video', engineId:'seedance-2-5', mode:'t2v', settings:{durationSec:5, resolution:'720p', outputFormat:'mov', watermark:true, returnLastFrame:true}},
    {surface:'image', engineId:'seedream', mode:'t2i', settings:{resolution:'2K', outputFormat:'png', watermark:true}},
  ];
  for (const input of requests) {
    const request = normalizeGenerationRequest({...input, prompt:'A garden.', references:[]});
    assert.equal(request.settings.watermark, undefined);
    assert.equal(request.settings.returnLastFrame, undefined);
    assert.equal(request.settings.resolution, input.settings.resolution);
    assert.equal(request.settings.outputFormat, input.settings.outputFormat);
    assert.equal(input.settings.watermark, true, 'normalization must not mutate a stored request');
  }
});

test('ordinary API imports and reuse drop stale optional flags before settings persistence and submission', () => {
  const engine = listFalEngines().find(entry => entry.id === 'seedance-2-5')!.engine;
  const extraInputValues = {output_format:'mov', watermark:true, return_last_frame:true};
  const result = buildGenerateRequestOptions({body:{prompt:'A garden.', durationSec:5, resolution:'720p', extraInputValues},
    engine, mode:'t2v', isBytePlusV1a:false});
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.options.rawExtraInputValues, {output_format:'mov'});
  assert.deepEqual(extraInputValues, {output_format:'mov', watermark:true, return_last_frame:true});
});

for (const modelId of ['dreamina-seedance-2-0-260128', 'dreamina-seedance-2-0-fast-260128',
  'dreamina-seedance-2-0-mini-260615', 'dreamina-seedance-2-5-260628']) {
  test(`${modelId} cannot reactivate watermark or last-frame extraction from a legacy request`, () => {
    const payload = buildBytePlusSeedancePayload({modelId, prompt:'A garden.', durationSec:5,
      resolution:'720p', ratio:'16:9', generateAudio:true, watermark:true, returnLastFrame:true});
    assert.equal(payload.watermark, false);
    assert.equal('return_last_frame' in payload, false);
    assert.equal(payload.generate_audio, true);
    assert.equal(payload.duration, 5);
  });
}

test('native Seedance Draft remains enabled while retired optional output flags stay off', () => {
  const payload = buildSeedance25DraftRequest({modelId:'dreamina-seedance-2-5-260628', prompt:'A garden.',
    durationSec:5, outputFormat:'mov', watermark:true, returnLastFrame:true});
  assert.equal(payload.draft, true);
  assert.equal(payload.resolution, '480p');
  assert.equal(payload.output_format, 'mov');
  assert.equal(payload.watermark, false);
  assert.equal('return_last_frame' in payload, false);
});

for (const modelId of ['seedream-5-0-260128', 'dola-seedream-5-0-pro-260628']) {
  for (const mode of ['t2i', 'i2i'] as const) test(`${modelId}/${mode} optional watermark stays off with legacy true`, () => {
    const payload = buildBytePlusSeedreamPayload({modelId, mode, prompt:'A garden.', numImages:1, size:'2K',
      responseFormat:'url', imageUrls:mode === 'i2i' ? ['https://example.com/owned.png'] : [], outputFormat:'png', watermark:true});
    assert.equal(payload.watermark, false);
    assert.equal(payload.output_format, 'png');
    assert.equal(payload.image, mode === 'i2i' ? 'https://example.com/owned.png' : undefined);
  });
}
