import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { AgentApiError } from '../frontend/src/server/agent-api/errors';
import { listAgentModels } from '../frontend/src/server/agent-api/model-catalog';
import { getAgentModelDetails } from '../frontend/src/server/agent-api/model-details';
import { listAudioCapabilities } from '../frontend/src/server/agent-api/audio-capabilities';
import { createAgentCreatorToolsService } from '../frontend/src/server/agent-api/creator-tools';
import { normalizeScribeTranscript } from '../frontend/src/lib/subtitles/document';
import { serializeSubtitles } from '../frontend/src/lib/subtitles/serialize';
import type { GenerationPriceComparison, GenerationPriceOption } from '../frontend/src/server/agent-api/generation-price-comparison';
import { createMaxVideoAiMcpServer, type MaxVideoAiMcpServices, type MaxVideoAiMcpServerOptions } from '../frontend/src/server/mcp/server';

const principal = { userId: 'output-user', clientId: 'output-client', emailVerified: true, authMethod: 'oauth' as const };
const unused = async (): Promise<never> => { throw new Error('Unexpected fixture service call'); };
const creatorServices = { list: unused, prepare: unused, confirm: unused, status: unused,
  readDocument: unused, editDocument: unused, prepareExport: unused, prepareStudio: unused, exportText: unused };
const services: MaxVideoAiMcpServices = {
  creatorTools: creatorServices,
  getAccountStatus: unused, listModels: async input => listAgentModels(input),
  getModelDetails: async input => getAgentModelDetails(input), recommendModels: unused,
  calculateProjectBudget: unused, listMedia: unused, prepareGeneration: unused,
  confirmGeneration: unused, getGenerationStatus: unused, listRecentGenerations: unused,
  createReferenceUploadLink: unused, importReferenceFiles: unused,
  listAudioCapabilities: async () => listAudioCapabilities({}),
  prepareAudioGeneration: unused, confirmAudioGeneration: unused,
  prepareMontage: unused, createStudioMontage: unused, createTopupLink: unused, readStudioTimeline: unused, editStudioTimeline: unused,
  prepareStudioExport: unused, confirmStudioExport: unused, getStudioExport: unused,
};
const enabled = { paidGeneration: true, referenceUploads: true, audioGeneration: true, montagePreparation: true, studioMontageCreation: true, studioTimelineEditing: true, studioExports: true };

async function withClient<T>(options: MaxVideoAiMcpServerOptions, run: (client: Client) => Promise<T>, overrides: Partial<MaxVideoAiMcpServices> = {}) {
  const server = createMaxVideoAiMcpServer(principal, { ...services, ...overrides }, options);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'output-contract', version: '1' });
  await client.connect(clientTransport);
  try { return await run(client); } finally { await client.close(); await server.close(); }
}

test('directory tools declare success output schemas for every capability mask; direct metadata stays unchanged', async () => {
  for (const distributionProfile of ['direct', 'openai-directory'] as const) {
    for (let mask = 0; mask < 256; mask++) {
      await withClient({ distributionProfile, paidGeneration: !!(mask & 1), referenceUploads: !!(mask & 2), audioGeneration: !!(mask & 4), montagePreparation: !!(mask & 8), studioMontageCreation: !!(mask & 16), studioTimelineEditing: !!(mask & 32), studioExports: !!(mask & 64), creatorTools: !!(mask & 128) }, async client => {
        const { tools } = await client.listTools();
        if (mask === 255) assert.equal(tools.length, distributionProfile === 'direct' ? 35 : 34);
        const creatorNames = tools.filter(tool => /creator|subtitle/.test(tool.name));
        assert.equal(creatorNames.length, (mask & 131) === 131 ? ((mask & 32) ? 9 : 8) : 5);
        assert.ok(tools.some(tool => tool.name === 'compare_generation_prices'));
        const preexistingSchemas = new Set(['get_generation_download', 'get_studio_timeline', 'edit_studio_timeline', 'prepare_studio_export', 'confirm_studio_export', 'get_studio_export']);
        for (const tool of tools) {
          if (distributionProfile === 'direct' && !preexistingSchemas.has(tool.name)) {
            assert.equal(tool.outputSchema, undefined, tool.name);
            continue;
          }
          assert.equal(tool.outputSchema?.type, 'object', `${distributionProfile}/${mask}/${tool.name}: missing object output schema`);
          assert.ok(Object.keys(tool.outputSchema?.properties ?? {}).length > 0, tool.name);
          assert.ok(Array.isArray(tool.outputSchema?.required) && tool.outputSchema.required.length > 0, tool.name);
        }
        const account = tools.find(tool => tool.name === 'get_account_status')!;
        if (distributionProfile === 'openai-directory') assert.equal(Object.hasOwn(account.outputSchema!.properties!, 'accountId'), false);
      });
    }
  }
});

test('creator and subtitle DTOs survive SDK validation on both channels, including recovery with purchases closed', async () => {
  const asset = { type: 'asset' as const, assetId: 'ma_' + 'a'.repeat(32), kind: 'video' as const };
  const document = normalizeScribeTranscript({ text: 'Hello', language_code: 'en',
    words: [{ type: 'word', text: 'Hello', start: 0, end: 1 }],
  }, { id: 'owned-document', source: { ref: asset, fingerprint: 'a'.repeat(64), durationMs: 2000 } });
  const operationId = '123e4567-e89b-42d3-a456-426614174000';
  const quote = { price: { amountCents: 0, currency: 'USD' }, expiresAt: '2026-10-23T12:00:00Z',
    breakdown: { transcription: { amountCents: 2, currency: 'USD' }, mixPreparation: { amountCents: 0, currency: 'USD', included: true } } };
  const prepared = { toolId: 'subtitles', operationId, kind: 'render', state: 'prepared', jobId: null, quote,
    exportEstimate: { amountCents: 0, currency: 'USD', included: true }, result: null,
    subtitle: { source: asset, settings: { keyterms: [] }, document: { id: document.id, revision: document.revision } },
    futureGuidance: { included: true },
  };
  const completed = { operationId, kind: 'render', state: 'completed', jobId: 'owned-job', quote,
    result: { documentId: document.id, revision: document.revision, ref: asset,
      originalUrl: 'https://media.example.invalid/original.mp4', readUrl: 'https://media.example.invalid/read.mp4',
      readExpiresAt: '2026-10-23T12:10:00Z', artifactDelivery: 'available' },
    retry: { afterSeconds: null }, futureGuidance: { preserved: true },
  };
  const text = { documentId: document.id, revision: document.revision, format: 'vtt',
    filename: 'subtitles-r1.vtt', text: serializeSubtitles(document, 'vtt') };
  const creator = {
    ...createAgentCreatorToolsService({ enabled: false }),
    prepare: async () => prepared, prepareExport: async () => prepared, prepareStudio: async () => prepared,
    confirm: async () => completed, status: async () => completed,
    readDocument: async () => ({ document }), editDocument: async () => ({ document }), exportText: async () => text,
  };
  const calls = [
    { name: 'prepare_creator_tool', arguments: { request: { toolId: 'subtitles', source: asset } }, expected: prepared },
    { name: 'prepare_subtitle_export', arguments: { documentId: document.id, revision: 1 }, expected: prepared },
    { name: 'prepare_studio_subtitles', arguments: { projectId: 'project', sequenceId: 'sequence', expectedRevision: 1 }, expected: prepared },
    { name: 'confirm_creator_tool', arguments: { toolId: 'subtitles', operationId, confirmed: true }, expected: completed },
    { name: 'get_creator_tool_operation', arguments: { toolId: 'subtitles', operationId }, expected: completed },
    { name: 'get_subtitle_document', arguments: { documentId: document.id }, expected: { document } },
    { name: 'edit_subtitle_document', arguments: { documentId: document.id, expectedRevision: 1, requestId: operationId, change: { style: document.style } }, expected: { document } },
    { name: 'export_subtitle_text', arguments: { documentId: document.id, revision: 1, format: 'vtt' }, expected: text },
  ];
  for (const distributionProfile of ['direct', 'openai-directory'] as const) {
    await withClient({ ...enabled, creatorTools: true, distributionProfile }, async client => {
      const discovery = await client.callTool({ name: 'list_creator_tools', arguments: {} });
      assert.notEqual(discovery.isError, true, JSON.stringify(discovery.content));
      assert.deepEqual(discovery.structuredContent, await creator.list(principal));
      for (const call of calls) {
        const result = await client.callTool({ name: call.name, arguments: call.arguments });
        assert.notEqual(result.isError, true, call.name + ': ' + JSON.stringify(result.content));
        assert.deepEqual(result.structuredContent, call.expected);
        assert.deepEqual(JSON.parse((result.content as Array<{ text: string }>)[0].text), call.expected);
      }
    }, { creatorTools: creator });
    await withClient({ ...enabled, creatorTools: false, distributionProfile }, async client => {
      const names = (await client.listTools()).tools.map(tool => tool.name);
      assert.equal(names.includes('confirm_creator_tool'), false);
      const recovered = await client.callTool({ name: 'get_creator_tool_operation', arguments: { toolId: 'subtitles', operationId } });
      assert.deepEqual(recovered.structuredContent, completed);
    }, { creatorTools: creator });
    await withClient({ ...enabled, creatorTools: true, distributionProfile }, async client => {
      const malformed = await client.callTool({ name: 'get_creator_tool_operation', arguments: { toolId: 'subtitles', operationId } });
      assert.equal(malformed.isError, distributionProfile === 'openai-directory' ? true : undefined);
      if (distributionProfile === 'openai-directory') assert.match(JSON.stringify(malformed.content), /Output validation error/);
    }, { creatorTools: { ...creator, status: async () => ({ operationId, state: 'completed' }) } });
  }
});

test('price comparison preserves complete estimates on both channels and validates directory success', async () => {
  const baseline: GenerationPriceOption = {
    modelId: 'baseline-model', modelLabel: 'Baseline model', surface: 'video', mode: 'i2v',
    settings: { durationSec: 8, resolution: '1080p', audio: false, aspectRatio: '16:9' },
    outputCount: 1, outputDurationSec: 8, referenceCount: 1,
    price: { amountCents: 400, currency: 'USD', formattedAmount: '$4.00' },
    estimatedAt: '2026-10-08T20:00:00Z', quoteRequired: true, audio: 'optional',
    references: [{ kind: 'asset', assetId: 'owned-image', role: 'first_frame', slot: 0 }],
    defaultedSettings: ['aspectRatio'], bestFor: ['Product animation'],
    editorialGuidance: { policyVersion: '2026-10-08.1', basis: 'product_editorial_preference',
      level: 'reference', rationale: 'Reviewed starting point.', reviewedAt: '2026-10-08', reviewStatus: 'current' },
  };
  const option: GenerationPriceOption = { ...baseline, modelId: 'alternative-model', modelLabel: 'Alternative model',
    price: { amountCents: 300, currency: 'USD', formattedAmount: '$3.00' },
    editorialGuidance: { ...baseline.editorialGuidance, level: 'alternative', reviewedAt: null, reviewStatus: 'unreviewed' },
    savings: { baselineModelId: 'baseline-model', amountCents: 100, percent: 25, configurationDiffers: false },
  };
  const comparison = {
    options: [option], baseline, comparisonCurrency: 'USD',
    excludedCurrencies: [{ modelId: 'other-currency', currency: 'EUR' }],
    unavailable: [{ modelId: 'unavailable-model', code: 'ENGINE_UNAVAILABLE' as const, baseline: true as const }],
    estimatedAt: '2026-10-08T20:00:00Z', quoteRequired: true as const,
    futureGuidance: { source: 'additive-field' },
  } satisfies GenerationPriceComparison & { futureGuidance: { source: string } };
  const request = { name: 'compare_generation_prices', arguments: {
    surface: 'video', mode: 'i2v', prompt: 'Animate my product', settings: { durationSec: 8 },
    references: [{ kind: 'asset', assetId: 'owned-image', role: 'first_frame', slot: 0 }],
  } };
  for (const distributionProfile of ['direct', 'openai-directory'] as const) {
    await withClient({ distributionProfile }, async client => {
      const result = await client.callTool(request);
      assert.notEqual(result.isError, true);
      assert.deepEqual(result.structuredContent, comparison);
      assert.deepEqual(JSON.parse((result.content as { type: string; text?: string }[]).find(item => item.type === 'text')!.text!), comparison);
    }, { compareGenerationPrices: async () => comparison });
    const { price: _price, ...incompleteOption } = option;
    await withClient({ distributionProfile }, async client => {
      const result = await client.callTool(request);
      assert.equal(result.isError, distributionProfile === 'openai-directory' ? true : undefined);
      if (distributionProfile === 'openai-directory') assert.match(JSON.stringify(result.content), /Output validation error/);
    }, { compareGenerationPrices: async () => ({ ...comparison, options: [incompleteOption] } as never) });
  }
});

test('real catalog, mode details and audio capability projections satisfy the advertised schemas', async () => {
  for (const distributionProfile of ['direct', 'openai-directory'] as const) {
    await withClient({ ...enabled, distributionProfile }, async client => {
      const catalog = await client.callTool({ name: 'list_models', arguments: {} });
      assert.notEqual(catalog.isError, true);
      const models = catalog.structuredContent!.models as Array<{ id: string }>;
      assert.ok(models.length > 0);
      for (const model of models) {
        const detail = await client.callTool({ name: 'get_model_details', arguments: { id: model.id } });
        assert.notEqual(detail.isError, true, model.id);
        assert.equal(detail.structuredContent!.id, model.id);
      }
      {
        const audio = await client.callTool({ name: 'list_audio_capabilities', arguments: {} });
        assert.notEqual(audio.isError, true, JSON.stringify(audio.content));
        assert.ok((audio.structuredContent!.modes as unknown[]).length > 0);
      }
    });
  }
});

test('SDK rejects malformed success data instead of publishing an incomplete generation status', async () => {
  await withClient({ ...enabled, distributionProfile: 'openai-directory' }, async client => {
    const result = await client.callTool({ name: 'get_generation_status', arguments: { jobId: 'broken-job' } });
    assert.equal(result.isError, true);
    assert.match(JSON.stringify(result.content), /Output validation error/);
  }, { getGenerationStatus: async () => ({ jobId: 'broken-job', status: 'running' } as never) });
});

test('success validation preserves additive fields, complete media and the lossless text fallback', async () => {
  const recovery = {
    jobId: 'image-job', surface: 'image' as const, status: 'completed' as const,
    progress: 100, message: null, priceCents: 120, currency: 'USD', paymentStatus: 'paid',
    result: { surface: 'image' as const, imageUrls: ['https://example.invalid/a.png', 'https://example.invalid/b.png'], thumbnailUrls: [] },
    library: { type: 'open_url' as const, purpose: 'media_library' as const, label: 'Library', url: 'https://maxvideoai.com/app/library' },
    workspace: { type: 'open_url' as const, purpose: 'image_workspace' as const, label: 'Image', url: 'https://maxvideoai.com/app/image' },
    savedToLibrary: true, retry: null, futureEvidence: { originalAvailable: true },
  };
  await withClient({ ...enabled, distributionProfile: 'openai-directory' }, async client => {
    const result = await client.callTool({ name: 'get_generation_status', arguments: { jobId: 'image-job' } });
    assert.notEqual(result.isError, true);
    assert.deepEqual(result.structuredContent, recovery);
    const text = result.content[0];
    assert.equal(text.type, 'text');
    if (text.type === 'text') assert.deepEqual(JSON.parse(text.text), recovery);
  }, { getGenerationStatus: async () => recovery });
});

test('business failures remain actionable isError responses outside the success schema', async () => {
  await withClient({ ...enabled, distributionProfile: 'openai-directory' }, async client => {
    const result = await client.callTool({ name: 'get_generation_status', arguments: { jobId: 'owned-only' } });
    assert.equal(result.isError, true);
    assert.deepEqual(result.structuredContent, { ok: false, error: { code: 'RATE_LIMITED', message: 'Wait for recovery.', retryable: true, nextAction: { retryAfterSeconds: 30 } } });
  }, { getGenerationStatus: async () => { throw new AgentApiError('RATE_LIMITED', 'Wait for recovery.', true, { retryAfterSeconds: 30 }); } });
});

test('unexpected tool failures preserve support correlation IDs without exposing exception details', async () => {
  await withClient({ ...enabled, distributionProfile: 'openai-directory' }, async client => {
    const result = await client.callTool({ name: 'get_generation_status', arguments: { jobId: 'broken-private' } });
    assert.equal(result.isError, true);
    assert.equal((result.structuredContent!.error as Record<string, unknown>).correlationId, result._meta?.correlationId);
    assert.match(String(result._meta?.correlationId), /^[a-f0-9-]{36}$/);
    assert.doesNotMatch(JSON.stringify({ content: result.content, structuredContent: result.structuredContent }), /private-provider-secret/);
  }, { getGenerationStatus: async () => { throw new Error('private-provider-secret'); } });
});

test('current Character Studio and all other directory capabilities coexist with complete discovery', async t => {
  const characterStudio = () => ({ list: unused, get: unused, save: unused, select: unused,
    prepareRecast: unused, confirmRecast: unused, getRecastQuote: unused, recoverRecast: unused });
  await withClient({ ...enabled, creatorTools: true, characterStudio: true, distributionProfile: 'openai-directory' }, async client => {
    const { tools } = await client.listTools();
    assert.equal(tools.length, 42);
    assert.equal(tools.some(tool => tool.name === 'create_topup_link'), false);
    for (const name of ['confirm_recast', 'prepare_studio_export', 'prepare_studio_subtitles', 'compare_generation_prices']) assert.ok(tools.some(tool => tool.name === name));
    for (const tool of tools) {
      assert.equal(tool.outputSchema?.type, 'object', tool.name);
      assert.ok(Buffer.byteLength(tool.description ?? '') <= 2000, tool.name);
    }
    const instructionBytes = Buffer.byteLength(client.getInstructions() ?? '');
    const maxDescriptionBytes = Math.max(...tools.map(tool => Buffer.byteLength(tool.description ?? '')));
    assert.ok(instructionBytes <= 2000);
    t.diagnostic(JSON.stringify({ tools: tools.length, instructionBytes, maxDescriptionBytes }));
  }, { characterStudio });
});
