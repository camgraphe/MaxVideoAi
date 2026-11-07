import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeGptImage26Settings } from '../frontend/lib/image/gptImage26';
import { buildOpenAIImagePayload } from '../frontend/src/server/images/openai-image-payload';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { normalizeGenerationRequest } from '../frontend/src/server/agent-api/generation-normalization';
import { validateCanonicalGenerationCapabilities } from '../frontend/src/server/agent-api/generation-capability-validation';
import {extractOpenAIImages} from '../frontend/src/server/images/openai-image-response';

for (const variant of ['flare', 'sunburst']) test(`GPT 2.6 ${variant} preserves wide, portrait, 4K and custom dimensions through MCP and OpenAI`, () => {
  const engineId = `gpt-image-2-6-${variant}`;
  const entry = getFalEngineById(engineId)!;
  const candidate = { engine: entry.engine, surface: 'image' as const, publicModes: entry.engine.modes,
    modeCaps: entry.engine.modeCaps ?? Object.fromEntries(entry.modes.map(mode => [mode.mode, mode.ui])) };
  for (const size of ['1536x864', '864x1536', '2048x1152', '3840x2160', '2160x3840', '2880x2880', '1536x512']) {
    const settings = normalizeGptImage26Settings({ resolution: size, numImages: 10 });
    const request = normalizeGenerationRequest({ surface: 'image', engineId, mode: 't2i', prompt: 'A scene', settings: {resolution: size}, outputCount: 10 });
    validateCanonicalGenerationCapabilities(request, candidate);
    assert.equal(buildOpenAIImagePayload({ modelId: engineId.replace('2-6', '2.6'), mode: 't2i', prompt: 'A scene', settings, referenceUrls: [] }).size, size);
  }
  const settings = normalizeGptImage26Settings({ resolution: 'custom', customImageSize: { width: 1616, height: 912 } });
  const request = normalizeGenerationRequest({ surface: 'image', engineId, mode: 't2i', prompt: 'A scene', settings: {resolution: 'custom', imageWidth: 1616, imageHeight: 912} });
  validateCanonicalGenerationCapabilities(request, candidate);
  assert.equal(buildOpenAIImagePayload({ modelId: engineId.replace('2-6', '2.6'), mode: 't2i', prompt: 'A scene', settings, referenceUrls: [] }).size, '1616x912');
});

test('GPT 2.6 rejects invalid geometry before provider submission', () => {
  for (const [width, height] of [[1920,1080], [4096,2160], [3840,3840], [512,512], [3840,512], [1024.5,1024]]) {
    assert.throws(() => normalizeGptImage26Settings({ resolution: 'custom', customImageSize: {width,height} }), `${width}x${height}`);
  }
  assert.throws(() => normalizeGptImage26Settings({ resolution: '1024x1024', customImageSize: {width:1536,height:864} }));
});

test('automatic options remain provider choices and ten outputs are extracted without truncation', () => {
  const settings = normalizeGptImage26Settings({resolution:'auto',quality:'auto',numImages:10});
  const payload = buildOpenAIImagePayload({modelId:'gpt-image-2.6-flare',mode:'t2i',prompt:'A scene',settings,referenceUrls:[]});
  assert.equal(payload.size,'auto'); assert.equal(payload.quality,'auto'); assert.equal(payload.n,10);
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWKsAAAAASUVORK5CYII=';
  const data = Array.from({length:10},() => ({b64_json:png}));
  assert.equal(extractOpenAIImages({data},'png',10).complete,true);
  assert.equal(extractOpenAIImages({data:[...data,{b64_json:png}]},'png',10).complete,false);
});

test('Studio selects actual 16:9 and 9:16 pixels and preserves explicit 4K/custom sizes', async () => {
  const { imageRequestFromDraft } = await import('../frontend/src/server/studio/image-conversation-service');
  const entry = getFalEngineById('gpt-image-2-6-flare')!;
  const candidate = { engine: entry.engine, surface: 'image' as const, publicModes: entry.engine.modes,
    modeCaps: entry.engine.modeCaps ?? Object.fromEntries(entry.modes.map(mode => [mode.mode, mode.ui])) };
  const input = {requestId: '123e4567-e89b-42d3-a456-426614174000',message:'Create',references:[]};
  for (const [aspectRatio, resolution] of [['16:9','1536x864'], ['9:16','864x1536'], ['3:1','1536x512']]) {
    const result = imageRequestFromDraft({reply:'Direction',image:{modelId:entry.id,prompt:'A scene',aspectRatio}},input,[candidate]);
    assert.equal(result.settings.resolution,resolution);
  }
  const result = imageRequestFromDraft({reply:'Direction',image:{modelId:entry.id,prompt:'A scene',aspectRatio:'16:9',settings:[{name:'resolution',value:'3840x2160'}]}},input,[candidate]);
  assert.equal(result.settings.resolution,'3840x2160');
  assert.throws(() => imageRequestFromDraft({reply:'Direction',image:{modelId:entry.id,prompt:'A scene',aspectRatio:'9:16',settings:[{name:'resolution',value:'3840x2160'}]}},input,[candidate]));
});
