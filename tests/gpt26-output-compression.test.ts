import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeGptImage26Settings } from '../frontend/lib/image/gptImage26';
import { buildOpenAIImagePayload } from '../frontend/src/server/images/openai-image-payload';
import { OpenAIImageClient } from '../frontend/src/server/images/openai-image-client';
import { normalizeGenerationRequest, hashCanonicalGenerationRequest } from '../frontend/src/server/agent-api/generation-normalization';
import { parsePersistedImageComposerState } from '../frontend/app/(core)/(workspace)/app/image/_lib/image-workspace-persistence';
import { prepareImagePickerOption } from '../frontend/app/(core)/(workspace)/app/image/_lib/image-model-picker';
import { buildDefaultSettingsSnapshot } from '../frontend/src/server/images/image-generation-settings-snapshot';
import { GPT_IMAGE_2_6_ENGINE_REGISTRY } from '../frontend/src/config/fal-engines/gpt-image-2-6';
import { mountToolFixture } from './helpers/tool-selection-fixture';
import { prepareGenerationInputSchema, registerPrepareGenerationTool } from '../frontend/src/server/mcp/tools/prepare-generation';

test('JPEG and WebP compression survives canonical request normalization and exact provider transport', async () => {
  for (const outputFormat of ['jpeg', 'webp'] as const) for (const outputCompression of [0, 43, 100]) {
    const input = { surface: 'image', engineId: 'gpt-image-2-6-flare', mode: 't2i', prompt: 'An original graphic', settings: { outputFormat, outputCompression }, references: [], outputCount: 1 };
    let invoke!: (input: unknown) => Promise<unknown>;
    let captured: unknown;
    registerPrepareGenerationTool({ registerTool: (_name: unknown, _descriptor: unknown, handler: typeof invoke) => { invoke = handler; } } as never,
      {} as never, { prepareGeneration: async (request: unknown) => { captured = request; return {}; } } as never);
    await invoke(prepareGenerationInputSchema.parse(input));
    const request = normalizeGenerationRequest(captured);
    assert.equal(request.settings.outputCompression, outputCompression);
    assert.notEqual(hashCanonicalGenerationRequest(request), hashCanonicalGenerationRequest({ ...request, settings: { ...request.settings, outputCompression: outputCompression === 0 ? 1 : 0 } }));
    const settings = normalizeGptImage26Settings({ ...request.settings, numImages: 1 } as never);
    const payload = buildOpenAIImagePayload({ modelId: 'gpt-image-2.6-flare', mode: 't2i', prompt: request.prompt, settings, referenceUrls: [] });
    let sent: Record<string, unknown> | undefined;
    const client = new OpenAIImageClient({ apiKey: 'offline-only', fetchFn: async (_url, init) => { sent = JSON.parse(String(init?.body)); return new Response('{}'); } });
    await client.generate('t2i', payload);
    assert.equal(sent?.output_compression, outputCompression);
    assert.equal(sent?.output_format, outputFormat);
  }
});

test('compression remains optional and rejects PNG, fractional values and values outside 0–100', () => {
  for (const outputFormat of ['png', 'jpeg', 'webp'] as const) {
    const payload = buildOpenAIImagePayload({ modelId: 'gpt-image-2.6-sunburst', mode: 't2i', prompt: 'An original graphic', settings: normalizeGptImage26Settings({ outputFormat }), referenceUrls: [] });
    assert.equal(Object.hasOwn(payload, 'output_compression'), false);
  }
  for (const value of [{ outputFormat: 'png', outputCompression: 0 }, ...[-1, 101, 0.5, '50', null].map(outputCompression => ({ outputFormat: 'webp', outputCompression }))]) {
    assert.throws(() => normalizeGptImage26Settings(value as never), JSON.stringify(value));
  }
});

test('composer persistence retains compression zero and drops malformed or PNG compression', () => {
  const base = { version: 5, engineId: 'gpt-image-2-6-flare', mode: 't2i', prompt: '', numImages: 1, outputFormat: 'webp', referenceSlots: [] };
  for (const outputCompression of [0, 43, 100]) assert.equal(parsePersistedImageComposerState(JSON.stringify({ ...base, outputCompression }))?.outputCompression, outputCompression);
  for (const outputCompression of [-1, 101, 0.5, '50']) assert.equal(parsePersistedImageComposerState(JSON.stringify({ ...base, outputCompression }))?.outputCompression, null);
  assert.equal(parsePersistedImageComposerState(JSON.stringify({ ...base, outputFormat: 'png', outputCompression: 50 }))?.outputCompression, null);
});

test('compression is saved for history and changes no model-picker price input', () => {
  const engine = GPT_IMAGE_2_6_ENGINE_REGISTRY[0].engine;
  const current = { mode: 't2i' as const, numImages: 1, resolution: '1024x1024', aspectRatio: null, quality: 'high', outputFormat: 'webp', enableWebSearch: false, customImageWidth: '', customImageHeight: '', referenceImageCount: 0, selectedReferenceCount: 0, readyReferenceSizes: [] };
  const first = prepareImagePickerOption(engine, { ...current, outputCompression: 0 }, 'en');
  const last = prepareImagePickerOption(engine, { ...current, outputCompression: 100 }, 'en');
  assert.equal(first.settings.outputCompression, 0);
  assert.equal(last.settings.outputCompression, 100);
  assert.deepEqual(first.request, last.request, 'encoding has no supplier or customer price dimension');
  const snapshot = buildDefaultSettingsSnapshot({ engineEntry: { id: engine.id, marketingName: engine.label }, outputFormat: 'webp', outputCompression: 0 } as never) as { core: { outputCompression?: number } };
  assert.equal(snapshot.core.outputCompression, 0);
  assert.equal(prepareImagePickerOption(engine, { ...current, outputFormat: 'png', outputCompression: 50 }, 'en').settings.outputCompression, null);
});

test('App reload restores compression zero, lifecycle writes preserve edits, and PNG clears the hidden setting', async () => {
  const fixture = await mountToolFixture(`
    import {useImageComposerValues} from './app/(core)/(workspace)/app/image/_hooks/useImageComposerValues';
    import {useImageSettingsFields} from './app/(core)/(workspace)/app/image/_hooks/useImageSettingsFields';
    import {useImageComposerPersistence} from './app/(core)/(workspace)/app/image/_hooks/useImageComposerPersistence';
    import {DEFAULT_COPY} from './app/(core)/(workspace)/app/image/_lib/image-workspace-copy';
    import {listFalEngines} from './src/config/falEngines';
    const entry=listFalEngines().find(x=>x.id==='gpt-image-2-6-flare'),engines=[{id:entry.id,engineCaps:entry.engine,modes:['t2i','i2i'],aliases:[entry.id]}],references=[];
    function App(){const values=useImageComposerValues(entry.id);
      const fields=useImageSettingsFields({...values,selectedEngineCaps:entry.engine,resolvedCopy:DEFAULT_COPY});
      const persistence=useImageComposerPersistence({...values,accountId:'owner',engines,persistableReferenceSlots:references,setReferenceSlots:noop});
      window.compressionValues=values;window.compressionFields=fields;
      return <output data-ready={persistence.storageHydrated}>{JSON.stringify({format:values.outputFormat,compression:values.outputCompression})}</output>;
    }
  `, {}, w => w.localStorage.setItem('maxvideoai.image.composer.v1:owner', JSON.stringify({ version: 5, engineId: 'gpt-image-2-6-flare', mode: 't2i', prompt: 'Synthetic graphic', numImages: 1, outputFormat: 'webp', outputCompression: 0, referenceSlots: [] })));
  try {
    assert.equal(fixture.w.compressionValues.outputCompression, 0);
    assert.equal(fixture.w.compressionFields.showOutputCompressionControl, true);
    assert.equal(fixture.w.compressionFields.qualitySelectOptions.find((option: { value: string }) => option.value === 'auto').label, 'Auto');
    assert.equal(fixture.w.compressionFields.resolutionSelectOptions.find((option: { value: string }) => option.value === '1536x864').label, '16:9 · 1536 x 864');
    await fixture.act(() => fixture.w.compressionValues.setOutputCompression(43));
    fixture.w.dispatchEvent(new fixture.w.Event('pagehide'));
    assert.equal(JSON.parse(fixture.w.localStorage.getItem('maxvideoai.image.composer.v1:owner')).outputCompression, 43);
    await fixture.act(() => fixture.w.compressionValues.setOutputFormat('png'));
    assert.equal(fixture.w.compressionFields.showOutputCompressionControl, false);
    assert.equal(fixture.w.compressionValues.outputCompression, null);
    await fixture.act(() => fixture.w.compressionValues.setOutputFormat('jpeg'));
    assert.equal(fixture.w.compressionFields.showOutputCompressionControl, true);
    assert.equal(fixture.w.compressionValues.outputCompression, null);
  } finally { await fixture.close(); }
});
