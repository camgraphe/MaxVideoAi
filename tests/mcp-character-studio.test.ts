import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { createAgentCharacterStudioService } from '../frontend/src/server/agent-api/character-studio';
import { AgentApiError } from '../frontend/src/server/agent-api/errors';
import type { CanonicalGenerationRequest } from '../frontend/src/server/agent-api/generation-types';
import type { CharacterStudioIntegration, RecastPassages } from '../frontend/server/character-studio/integration';
import type { AgentGenerationStatus } from '../frontend/src/server/generations/generation-status';
import { getMcpApiRewritePath } from '../frontend/src/lib/mcp-host-routing';
import { resolveMcpConfig } from '../frontend/src/server/mcp/config';
import { buildMaxVideoAiMcpInstructions } from '../frontend/src/server/mcp/instructions';
import { buildProtectedResourceMetadata } from '../frontend/src/server/mcp/oauth-resource-metadata';
import { resolveMcpRuntimeCapabilities } from '../frontend/src/server/mcp/operational-access';
import {
  createDefaultMaxVideoAiMcpServices,
  createMaxVideoAiMcpServer,
  type MaxVideoAiMcpServerOptions,
  type MaxVideoAiMcpServices,
} from '../frontend/src/server/mcp/server';

const principal = { userId: 'character-owner', clientId: 'character-client', emailVerified: true, authMethod: 'oauth' } as const;
const quoteId = '00000000-0000-4000-8000-000000000001';
const portraitId = 'ma_00000000000000000000000000000001';
const productId = 'ma_00000000000000000000000000000002';
const videoId = 'ma_00000000000000000000000000000003';
const audioId = 'ma_00000000000000000000000000000004';
const sourceExcerpt = 'ma_00000000000000000000000000000005';
const audioExcerpt = 'ma_00000000000000000000000000000006';
const previewOrigin = 'https://maxvideoai-env-character-studio-test-camgraphes-projects.vercel.app';
const accountUrl = `${previewOrigin}/account/connections`;
const characterBuilderUrl = `${previewOrigin}/app/tools/character-builder`;
const expiresAt = '2026-11-06T16:45:00.000Z';
const settings = {
  portrait: { characterId: '42', lookId: '57' },
  product: productId,
  video: { assetId: videoId, range: { startSec: 0.125, endSec: 7.625 } },
  audio: { assetId: audioId, range: { startSec: 1.25, endSec: 5.875 } },
  direction: 'Retain the product framing.',
  dialogue: 'Here it is.',
  seconds: 8,
  resolution: '720p',
  aspectRatio: '16:9',
};
const approval = { quoteId, confirmed: true, amountCents: 434, currency: 'USD' } as const;
const studioReads = ['list_saved_characters', 'get_saved_character', 'get_recast_quote', 'get_recast_status'];
const studioTools = [...studioReads, 'save_character', 'select_saved_character', 'prepare_recast', 'confirm_recast'];
const passages: RecastPassages = {
  video: { ...settings.video.range, durationSec: 7.5, sourceId: videoId, excerptId: sourceExcerpt },
  audio: { ...settings.audio.range, durationSec: 4.625, sourceId: audioId, excerptId: audioExcerpt },
};
const summary: CanonicalGenerationRequest = {
  schemaVersion: 1, surface: 'video', mode: 'v2v', engineId: 'wan-3-prime', outputCount: 1,
  prompt: 'Retain the product framing. Here it is.',
  settings: { durationSec: 8, resolution: '720p', aspectRatio: '16:9', audio: true },
  references: [
    { kind: 'asset', assetId: portraitId, role: 'reference', slot: 0 },
    { kind: 'asset', assetId: productId, role: 'reference', slot: 1 },
    { kind: 'asset', assetId: sourceExcerpt, role: 'source' },
    { kind: 'asset', assetId: audioExcerpt, role: 'reference', slot: 2 },
  ],
};
const running: AgentGenerationStatus = {
  jobId: 'recast-job', surface: 'video', status: 'running', progress: 25, message: null,
  priceCents: 434, currency: 'USD', paymentStatus: 'paid_wallet', result: null, retryAfterSeconds: 7,
};
const completed: AgentGenerationStatus = {
  ...running, status: 'completed', progress: 100, retryAfterSeconds: null,
  result: {
    surface: 'video', videoUrl: 'https://assets.example/recast.mp4',
    previewUrl: null, thumbnailUrl: null, audioUrl: null,
  },
};
const prepared = {
  kind: 'wallet', quoteId, expiresAt, amountCents: 434, currency: 'USD', topupRequired: false,
  sourceSeconds: 7.5, audioSeconds: 4.625, passages,
  quote: {
    quoteId, expiresAt, requestHash: 'fixture-hash', summary,
    price: { amountCents: 434, currency: 'USD' },
    balance: { beforeCents: 1200, afterCents: 766 },
    fundingMode: 'wallet', confirmationRequired: true, topupRequired: false,
  },
} as const;

function services(calls: unknown[], executionEnabled: boolean, recovery: AgentGenerationStatus | null): MaxVideoAiMcpServices {
  const unused = async () => { throw new Error('Unexpected service call'); };
  return {
    getAccountStatus: unused, listModels: unused, getModelDetails: unused, recommendModels: unused,
    prepareGeneration: unused, confirmGeneration: unused, getGenerationStatus: unused, listRecentGenerations: unused,
    createTopupLink: unused, createReferenceUploadLink: unused, importReferenceFiles: unused, listMedia: unused,
    characterStudio: principal => createAgentCharacterStudioService(principal, { accountUrl, executionEnabled }, (actor, options): CharacterStudioIntegration => ({
      list: async input => {
        calls.push(['list', actor, input]);
        return { characters: [], nextCursor: '41' };
      },
      get: async input => {
        calls.push(['get', actor, input]);
        throw new AgentApiError('REFERENCE_NOT_FOUND', 'Saved character unavailable.');
      },
      select: async input => {
        calls.push(['select', actor, input]);
        return {
          characterId: '42', lookId: '57', name: 'Basil',
          lookName: 'Night', assetId: portraitId, kind: 'image', jobId: 'builder-job',
        };
      },
      save: async input => {
        calls.push(['save', actor, input]);
        throw new AgentApiError('REFERENCE_NOT_FOUND', 'Character Builder output unavailable.');
      },
      prepareRecast: async input => {
        calls.push(['prepareRecast', actor, input]);
        assert.equal(options.executionEnabled, true);
        return prepared;
      },
      confirmRecast: async input => {
        calls.push(['confirmRecast', actor, input]);
        assert.equal(options.executionEnabled, true);
        if ((input as { amountCents: number }).amountCents !== 434) throw new AgentApiError('QUOTE_EXPIRED', 'Review the exact Recast quote.');
        return running;
      },
      getRecastQuote: async input => {
        calls.push(['getRecastQuote', actor, input]);
        return {
          quoteId, userId: actor.userId, oauthClientId: actor.clientId, request: summary, requestHash: 'fixture-hash',
          catalogRevision: 'revision', pricingSnapshot: { privateProviderCostCents: 217 },
          priceCents: 434, currency: 'USD', fundingMode: 'wallet', trialFunding: null, state: 'accepted',
          jobId: 'recast-job', expiresAt: new Date(expiresAt), claimedAt: new Date(expiresAt),
          createdAt: new Date(expiresAt), updatedAt: new Date(expiresAt), passages,
        };
      },
      recoverRecast: async input => {
        calls.push(['recoverRecast', actor, input]);
        return recovery;
      },
    })),
  };
}

async function connected(t: TestContext, options: MaxVideoAiMcpServerOptions = {}, recovery: AgentGenerationStatus | null = completed) {
  const calls: unknown[] = [];
  const settings = {
    paidGeneration: true, referenceUploads: true, montagePreparation: false,
    audioGeneration: false, studioMontageCreation: false, studioTimelineEditing: false, studioExports: false,
    ...options,
  };
  const server = createMaxVideoAiMcpServer(principal, services(calls, settings.paidGeneration && settings.referenceUploads, recovery), settings);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'character-studio-test', version: '1' });
  await client.connect(clientTransport);
  t.after(async () => { await client.close(); await server.close(); });
  return { client, calls };
}

test('the Character Studio runtime gate requires the explicit preview value', () => {
  const disabled = resolveMcpRuntimeCapabilities({ MCP_CHARACTER_STUDIO_ENABLED: 'true' }, null);
  const enabled = resolveMcpRuntimeCapabilities({ MCP_CHARACTER_STUDIO_ENABLED: '1' }, null);
  assert.equal(disabled.characterStudio, false);
  assert.equal(enabled.characterStudio, true);
});

test('the Character Studio MCP adapter requires an OAuth client binding', () => {
  assert.throws(
    () => createAgentCharacterStudioService({ ...principal, clientId: null }, { accountUrl, executionEnabled: false }),
    { code: 'AUTH_REQUIRED' },
  );
});

test('isolated Character Studio config preserves the MCP resource and the default services', () => {
  const env = {
    NODE_ENV: 'production' as const,
    MCP_API_HOST: new URL(previewOrigin).host,
    MCP_RESOURCE_URL: `${previewOrigin}/mcp`,
    MCP_CHARACTER_STUDIO_ENABLED: '1',
  };
  const config = resolveMcpConfig(env);
  const capabilities = resolveMcpRuntimeCapabilities(env, config.apiHost);
  const services = createDefaultMaxVideoAiMcpServices(config, { clientIp: null, userAgent: null }, capabilities);
  assert.equal(typeof services.characterStudio, 'function');
  assert.equal(config.accountUrl, accountUrl);
  assert.equal(getMcpApiRewritePath(config.apiHost, '/mcp', env.MCP_API_HOST), '/api/mcp');
  assert.equal(getMcpApiRewritePath('api.maxvideoai.com', '/mcp', env.MCP_API_HOST), null);
  const metadata = buildProtectedResourceMetadata({
    resourceUrl: config.resourceUrl,
    supabaseUrl: 'https://isolated-auth.example',
  });
  assert.equal(metadata.resource, `${previewOrigin}/mcp`);
  assert.deepEqual(metadata.authorization_servers, ['https://isolated-auth.example/auth/v1']);
});

test('Character Studio tools are private and paid/ref shutdown keeps reads and recovery discoverable', async t => {
  const disabled = await connected(t);
  const names = (await disabled.client.listTools()).tools.map(tool => tool.name);
  assert.deepEqual(names.filter(name => studioTools.includes(name)), []);
  assert.doesNotMatch(disabled.client.getInstructions() ?? '', /list_saved_characters/);

  for (const [paidGeneration, referenceUploads] of [[false, false], [false, true], [true, false], [true, true]]) {
    const { client, calls } = await connected(t, { characterStudio: true, paidGeneration, referenceUploads });
    const tools = (await client.listTools()).tools.filter(tool => studioTools.includes(tool.name));
    assert.deepEqual(tools.map(tool => tool.name).sort(), [
      ...studioReads, 'save_character', ...(referenceUploads ? ['select_saved_character'] : []),
      ...(paidGeneration && referenceUploads ? ['prepare_recast', 'confirm_recast'] : []),
    ].sort());
    assert.match(client.getInstructions() ?? '', /list_saved_characters/);
    if (paidGeneration && referenceUploads) {
      assert.match(client.getInstructions() ?? '', /prepare_recast for Recast/);
      assert.match(client.getInstructions() ?? '', /Recover Recast with get_recast_status/);
      const descriptor = tools.find(tool => tool.name === 'prepare_recast')?.description ?? '';
      assert.match(descriptor, /at least one of direction, dialogue, video or audio/i);
    } else {
      const instructions = client.getInstructions() ?? '';
      assert.match(instructions, /Recast purchases are unavailable/);
      assert.match(instructions, /Recover existing Recast with get_recast_status/);
      assert.doesNotMatch(instructions, /prepare_recast|confirm_recast|For a complete request use prepare_generation/);
      if (paidGeneration) assert.match(instructions, /For other generation, use prepare_generation/);
    }
    for (const tool of tools) {
      assert.equal(tool.inputSchema.additionalProperties, false, tool.name);
      assert.ok(tool.description && Buffer.byteLength(tool.description, 'utf8') <= 2000, tool.name);
    }
    assert.deepEqual(calls, []);
  }
});

test('all capability combinations fit the instruction budget and route Recast only through its dedicated tools', () => {
  for (let mask = 0; mask < 512; mask += 1) {
    const capabilities = {
      paidGeneration: Boolean(mask & 1),
      referenceUploads: Boolean(mask & 2),
      montagePreparation: Boolean(mask & 4),
      audioGeneration: Boolean(mask & 8),
      studioMontageCreation: Boolean(mask & 16),
      studioTimelineEditing: Boolean(mask & 32),
      studioExports: Boolean(mask & 64),
      creatorTools: Boolean(mask & 128),
      characterStudio: Boolean(mask & 256),
    };
    const instructions = buildMaxVideoAiMcpInstructions(capabilities);
    const bytes = Buffer.byteLength(instructions, 'utf8');
    assert.ok(bytes <= 2000, `capabilities ${mask} used ${bytes} bytes`);
    assert.equal(instructions.includes('get_recast_status'), capabilities.characterStudio);
    assert.equal(
      instructions.includes('prepare_recast'),
      capabilities.characterStudio && capabilities.paidGeneration && capabilities.referenceUploads,
    );
  }
});

test('Character Studio transport preserves exact look IDs, ordered source roles and fractional passages', async t => {
  const { client, calls } = await connected(t, { characterStudio: true });
  const listed = await client.callTool({ name: 'list_saved_characters', arguments: { cursor: '43', name: 'Basil' } });
  assert.deepEqual(listed.structuredContent, { characters: [], nextCursor: '41', characterBuilderUrl });

  const selected = await client.callTool({ name: 'select_saved_character', arguments: { characterId: '42', lookId: '57' } });
  assert.equal((selected.structuredContent as Record<string, unknown>).assetId, portraitId);

  const result = await client.callTool({ name: 'prepare_recast', arguments: settings });
  assert.deepEqual(result.structuredContent, prepared);
  assert.deepEqual(result.content, [{ type: 'text', text: JSON.stringify(result.structuredContent) }]);

  for (const input of [
    { ...settings, billingProduct: 'character-recast' },
    { ...settings, portrait: { ...settings.portrait, assetId: portraitId } },
    { ...settings, video: { ...settings.video, range: { ...settings.video.range, endSec: 18 } } },
    { ...settings, audio: { ...settings.audio, range: { ...settings.audio.range, rate: 1 } } },
  ]) {
    const invalid = await client.callTool({ name: 'prepare_recast', arguments: input });
    assert.equal(invalid.isError, true);
  }
  assert.deepEqual(calls, [
    ['list', principal, { cursor: '43', name: 'Basil' }],
    ['select', principal, { characterId: '42', lookId: '57' }],
    ['prepareRecast', principal, settings],
  ]);
});

test('saved character detail and save forward exact inputs and preserve private errors', async t => {
  const { client, calls } = await connected(t, { characterStudio: true, paidGeneration: false, referenceUploads: false });
  const detail = { characterId: '42', lookCursor: '58', lookName: 'Night' };
  const imageUrl = 'https://assets.example/builder/original.png';
  const save = { name: 'Night', jobId: 'builder-job', imageUrl };
  const invalid = await client.callTool({ name: 'save_character', arguments: { ...save, parentId: '42' } });
  assert.equal(invalid.isError, true);
  assert.deepEqual(calls, []);

  for (const [name, args] of [['get_saved_character', detail], ['save_character', save]] as const) {
    const response = await client.callTool({ name, arguments: args });
    assert.equal(response.isError, true);
    assert.equal((response.structuredContent?.error as { code: string }).code, 'REFERENCE_NOT_FOUND');
    assert.doesNotMatch(JSON.stringify(response.structuredContent), /https:\/\//);
    assert.deepEqual(response.content, [{ type: 'text', text: JSON.stringify(response.structuredContent) }]);
  }
  assert.deepEqual(calls, [['get', principal, detail], ['save', principal, save]]);
});

test('Recast requires literal exact-amount consent and recovers by quote with paid execution disabled', async t => {
  const enabled = await connected(t, { characterStudio: true });
  for (const input of [
    { quoteId, confirmed: true },
    { ...approval, confirmed: false },
    { ...approval, currency: 'EUR' },
    { ...approval, retry: true },
  ]) {
    const invalid = await enabled.client.callTool({ name: 'confirm_recast', arguments: input });
    assert.equal(invalid.isError, true);
  }
  assert.deepEqual(enabled.calls, []);

  const mismatch = { ...approval, amountCents: 433 };
  const rejected = await enabled.client.callTool({ name: 'confirm_recast', arguments: mismatch });
  assert.equal(rejected.isError, true);
  assert.deepEqual(rejected.structuredContent, {
    ok: false, error: { code: 'QUOTE_EXPIRED', message: 'Review the exact Recast quote.', retryable: false, nextAction: null },
  });
  assert.deepEqual(rejected.content, [{ type: 'text', text: JSON.stringify(rejected.structuredContent) }]);

  const accepted = await enabled.client.callTool({ name: 'confirm_recast', arguments: approval });
  assert.equal(accepted.isError, undefined);
  assert.equal((accepted.structuredContent as Record<string, unknown>).jobId, 'recast-job');
  assert.deepEqual(accepted.structuredContent?.retry, { tool: 'get_recast_status', arguments: { quoteId }, afterSeconds: 7 });
  assert.deepEqual(enabled.calls, [['confirmRecast', principal, mismatch], ['confirmRecast', principal, approval]]);

  const recovery = await connected(t, { characterStudio: true, paidGeneration: false, referenceUploads: false });
  const quote = await recovery.client.callTool({ name: 'get_recast_quote', arguments: { quoteId } });
  assert.deepEqual(quote.structuredContent, {
    quoteId, amountCents: 434, currency: 'USD', expiresAt, state: 'accepted', jobId: 'recast-job',
    summary, requestHash: 'fixture-hash', passages,
  });
  const status = await recovery.client.callTool({ name: 'get_recast_status', arguments: { quoteId } });
  assert.equal((status.structuredContent as Record<string, unknown>).jobId, 'recast-job');
  assert.deepEqual(status.structuredContent?.result, completed.result);
  assert.equal(status.structuredContent?.retry, null);
  assert.equal((status.structuredContent?.library as { url: string }).url, `${previewOrigin}/app/library`);
  assert.equal((status.structuredContent?.workspace as { url: string }).url, `${previewOrigin}/app?job=recast-job`);
  assert.deepEqual(status.content, [
    { type: 'text', text: JSON.stringify(status.structuredContent) },
    { type: 'resource_link', uri: 'https://assets.example/recast.mp4', name: 'MaxVideoAI output', description: 'output for generation recast-job', mimeType: 'video/mp4' },
  ]);
  assert.deepEqual(recovery.calls, [
    ['getRecastQuote', principal, { quoteId }], ['recoverRecast', principal, { quoteId }],
  ]);
});

test('an existing unclaimed Recast quote does not start a job during recovery', async t => {
  const { client, calls } = await connected(t, { characterStudio: true, paidGeneration: false }, null);
  const status = await client.callTool({ name: 'get_recast_status', arguments: { quoteId } });
  assert.deepEqual(status.structuredContent, { quoteId, jobId: null, status: 'no_job', retry: null });
  assert.deepEqual(calls, [['recoverRecast', principal, { quoteId }]]);
});

test('the SDK rejects non-v4 Recast quote IDs and confirmation amounts above PostgreSQL integer range', async t => {
  const { client, calls } = await connected(t, { characterStudio: true });
  const results = await Promise.all([
    client.callTool({ name: 'get_recast_quote', arguments: { quoteId: '00000000-0000-1000-8000-000000000001' } }),
    client.callTool({ name: 'get_recast_status', arguments: { quoteId: '00000000-0000-0000-0000-000000000000' } }),
    client.callTool({ name: 'confirm_recast', arguments: { ...approval, quoteId: '00000000-0000-1000-8000-000000000001' } }),
    client.callTool({ name: 'confirm_recast', arguments: { ...approval, amountCents: 2_147_483_648 } }),
  ]);
  assert.deepEqual(results.map(result => result.isError), [true, true, true, true]);
  assert.deepEqual(calls, []);
});
