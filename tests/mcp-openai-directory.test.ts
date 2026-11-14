import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { AgentApiError } from '../frontend/src/server/agent-api/errors';
import type { AgentAccountStatus, AgentModelDetails } from '../frontend/src/server/agent-api/types';
import { createMaxVideoAiMcpServer, type MaxVideoAiMcpServices } from '../frontend/src/server/mcp/server';
import { handleMcpHttpRequest } from '../frontend/src/server/mcp/http-handler';

const principal = { userId: 'owner-user', clientId: 'private-oauth-client', emailVerified: true, authMethod: 'oauth' as const };
const quoteId = '11111111-1111-4111-8111-111111111111';
const account: AgentAccountStatus = {
  accountId: principal.userId, clientId: principal.clientId, emailVerified: true,
  wallet: { amountCents: 500, pendingCents: 25, currency: 'USD' },
  trial: { status: 'disabled' },
  spendingLimits: { perGenerationCents: null, dailyCents: null, webApprovalAboveCents: null },
  accountUrl: 'https://maxvideoai.com/account/connections',
  destinations: {
    connections: { type: 'open_url', purpose: 'account_connections', label: 'Connections', url: 'https://maxvideoai.com/account/connections' },
    billing: { type: 'open_url', purpose: 'billing', label: 'Add credits', url: 'https://maxvideoai.com/billing' },
    library: { type: 'open_url', purpose: 'media_library', label: 'Library', url: 'https://maxvideoai.com/app/library' },
    videoWorkspace: { type: 'open_url', purpose: 'video_workspace', label: 'Video', url: 'https://maxvideoai.com/app' },
    imageWorkspace: { type: 'open_url', purpose: 'image_workspace', label: 'Image', url: 'https://maxvideoai.com/app/image' },
    support: { type: 'open_url', purpose: 'support', label: 'Support', url: 'https://maxvideoai.com/contact' },
  },
};
const details: AgentModelDetails = {
  id: 'minimax-h3', label: 'MiniMax H3', slug: 'minimax-h3', surface: 'video',
  availability: 'available', generationEnabled: true, lifecycle: 'current', successor: null,
  recommendedByDefault: true, prelaunch: false, modes: [], guidance: null, promptingSources: [],
  links: { model: 'https://maxvideoai.com/models/minimax-h3', pricing: 'https://maxvideoai.com/pricing', examples: null },
  catalogUpdatedAt: '2026-09-29T00:00:00.000Z',
};

// Database/provider calls are replaced at the injected service boundary; the SDK,
// registered schemas, profile selection and result serialization remain real.
function services(): MaxVideoAiMcpServices {
  const unused = async (): Promise<never> => { throw new Error('Unexpected external operation'); };
  return {
    getAccountStatus: async () => account, listModels: async () => [], getModelDetails: async () => details,
    recommendModels: async () => ({ recommendations: [], nextAction: 'clarify_requirements' }),
    calculateProjectBudget: unused, prepareGeneration: unused,
    confirmGeneration: async () => { throw new AgentApiError('INSUFFICIENT_FUNDS', 'Add funds before confirming this generation.', false, { type: 'open_url', url: 'https://maxvideoai.com/billing' }); },
    getGenerationStatus: unused, listRecentGenerations: unused, createTopupLink: unused,
    listMedia: unused, createReferenceUploadLink: unused, importReferenceFiles: unused,
    listAudioCapabilities: unused, prepareAudioGeneration: unused, confirmAudioGeneration: unused,
    prepareMontage: unused, createStudioMontage: unused,
    readStudioTimeline: unused, editStudioTimeline: unused, prepareStudioExport: unused, confirmStudioExport: unused, getStudioExport: unused,
  };
}
async function connected(distributionProfile: 'direct' | 'openai-directory', extra = {}, overrides: Partial<MaxVideoAiMcpServices> = {}) {
  const server = createMaxVideoAiMcpServer(principal, { ...services(), ...overrides }, {
    paidGeneration: true, referenceUploads: false, distributionProfile, ...extra,
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'directory-contract', version: '1.0.0' });
  await client.connect(clientTransport);
  return { client, close: async () => { await client.close(); await server.close(); } };
}
function payload(result: Awaited<ReturnType<Client['callTool']>>) {
  const value = result.structuredContent as Record<string, unknown>;
  const text = (result.content as Array<{ type: string; text?: string }>).find((part) => part.type === 'text')?.text;
  assert.deepEqual(JSON.parse(text!), value, 'text fallback must match the profile result without lost fields');
  return value;
}

test('directory output schema accepts successful export confirmations as well as errors', async () => {
  for (const profile of ['direct', 'openai-directory'] as const) {
    let calls = 0;
    const accepted = {ok: true as const, export: {id: 'owned-export', status: 'queued' as const, progress: 0, message: null, artifact: null}, reused: false};
    const c = await connected(profile, {studioExports: true}, {
      confirmStudioExport: async () => { calls++; return accepted; },
    });
    try {
      await c.client.listTools(); // The SDK caches output validators during discovery.
      const result = await c.client.callTool({name: 'confirm_studio_export', arguments: {projectId: 'project', quoteId, confirmed: true}});
      assert.equal(result.isError, undefined);
      assert.deepEqual(payload(result), accepted);
      assert.equal(calls, 1, 'One accepted confirmation must not appear failed to the SDK client.');
    } finally { await c.close(); }
  }
});

test('directory profile exposes generation and recovery without a purchase tool, even with other gates open', async (t) => {
  const c = await connected('openai-directory', { referenceUploads: true, audioGeneration: true, montagePreparation: true, studioMontageCreation: true, studioTimelineEditing: true, studioExports: true });
  try {
    const tools = (await c.client.listTools()).tools;
    const instructions = c.client.getInstructions() ?? '';
    assert.ok(Buffer.byteLength(instructions) <= 2000);
    assert.match(Buffer.from(instructions).subarray(0, 1000).toString(), /exact quote.*explicit user approval.*one paid attempt/);
    assert.equal(tools.length, 25);
    for (const name of ['compare_generation_prices', 'prepare_audio_generation', 'confirm_audio_generation', 'prepare_montage', 'create_studio_montage', 'get_studio_timeline', 'edit_studio_timeline', 'prepare_studio_export', 'confirm_studio_export', 'get_studio_export']) {
      assert.ok(tools.some(tool => tool.name === name), name);
    }
    assert.equal(tools.some((tool) => tool.description?.includes('create_topup_link')), false);
    for (const name of ['prepare_generation', 'prepare_audio_generation']) {
      const tool = tools.find((item) => item.name === name)!;
      assert.match(tool.description ?? '', /exact (?:generation )?cost/);
      assert.match(tool.description ?? '', /confirmation consumes existing account credits/);
      assert.match(tool.description ?? '', /wait for explicit (?:user )?approval.*before confirm_/);
      assert.match(tool.description ?? '', /entitlements are insufficient.*stop; purchases are unavailable/);
      assert.doesNotMatch(tool.description ?? '', /top-up|checkout/);
      assert.deepEqual(tool.annotations, { readOnlyHint: false, destructiveHint: false, openWorldHint: false });
      t.diagnostic(`${name}: ${tool.title}, ${Buffer.byteLength(tool.description ?? '')} description bytes.`);
    }
    for (const tool of tools) assert.ok(Buffer.byteLength(tool.description ?? '') <= 2000);
    t.diagnostic(`Directory metadata: ${Buffer.byteLength(instructions)} instruction bytes, ${tools.length} registered tools, largest descriptor ${Math.max(...tools.map((tool) => Buffer.byteLength(tool.description ?? '')))} bytes.`);
    const denied = await c.client.callTool({ name: 'create_topup_link', arguments: { quoteId } });
    assert.equal(denied.isError, true);
    assert.match(JSON.stringify(denied), /not found/i);
  } finally { await c.close(); }
});

test('directory account response keeps usable entitlements and destinations without internal IDs or billing, without mutating services', async () => {
  const c = await connected('openai-directory');
  try {
    const value = payload(await c.client.callTool({ name: 'get_account_status', arguments: {} }));
    assert.equal('clientId' in value, false);
    assert.equal('accountId' in value, false);
    assert.deepEqual(value.wallet, { amountCents: 500, pendingCents: 25, currency: 'USD' });
    assert.deepEqual(value.spendingLimits, { perGenerationCents: null, dailyCents: null, webApprovalAboveCents: null });
    const destinations = value.destinations as Record<string, unknown>;
    assert.equal('billing' in destinations, false);
    assert.equal((destinations.library as { url: string }).url, 'https://maxvideoai.com/app/library');
    assert.equal(account.clientId, 'private-oauth-client');
    assert.equal(account.destinations.billing.url, 'https://maxvideoai.com/billing');
  } finally { await c.close(); }
});

test('directory model details preserve live capabilities and the informational pricing page', async () => {
  const c = await connected('openai-directory');
  try {
    const descriptor = (await c.client.listTools()).tools.find((tool) => tool.name === 'get_model_details')!;
    assert.match(descriptor.description!, /promptingSources contains reviewed official provider guides/);
    assert.match(descriptor.description!, /empty list means this response contains no reviewed guide/);
    assert.doesNotMatch(descriptor.description!, /substitute web search/);
    const value = payload(await c.client.callTool({ name: 'get_model_details', arguments: { id: 'minimax-h3' } }));
    assert.deepEqual(value.links, details.links);
    assert.equal(value.generationEnabled, true);
    assert.equal(details.links.pricing, 'https://maxvideoai.com/pricing');
  } finally { await c.close(); }
});

test('directory funding failure explains unavailable entitlements without a checkout or implicit retry', async () => {
  const c = await connected('openai-directory');
  try {
    const result = await c.client.callTool({ name: 'confirm_generation', arguments: { quoteId, confirmed: true } });
    assert.equal(result.isError, true);
    const error = payload(result).error as Record<string, unknown>;
    assert.equal(error.code, 'INSUFFICIENT_FUNDS');
    assert.equal(error.retryable, false);
    assert.equal(error.nextAction, null);
    assert.match(String(error.message), /entitlements/i);
    assert.doesNotMatch(JSON.stringify(error), /billing|add funds|top.?up|buy|purchase|checkout/i);
  } finally { await c.close(); }
});

test('direct profile still exposes top-up and existing account fields after a directory request', async () => {
  const c = await connected('direct');
  try {
    assert.ok((await c.client.listTools()).tools.some((tool) => tool.name === 'create_topup_link'));
    assert.match((await c.client.listTools()).tools.find((tool) => tool.name === 'get_model_details')!.description!, /do not invent a guide or substitute web search/);
    assert.deepEqual(payload(await c.client.callTool({ name: 'get_account_status', arguments: {} })), account);
    assert.deepEqual(payload(await c.client.callTool({ name: 'get_model_details', arguments: { id: 'minimax-h3' } })), details);
  } finally { await c.close(); }
});

test('HTTP endpoint resolves the server-owned directory profile and rejects unknown configuration', async () => {
  const previous = process.env.MCP_DISTRIBUTION_PROFILE;
  const request = () => new Request('https://api.maxvideoai.com/mcp', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', host: 'api.maxvideoai.com' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
  });
  const deps = {
    enabled: true, config: {
      apiHost: 'api.maxvideoai.com', resourceUrl: 'https://api.maxvideoai.com/mcp',
      protectedResourceMetadataUrl: 'https://api.maxvideoai.com/.well-known/oauth-protected-resource/mcp',
      accountUrl: 'https://maxvideoai.com/account/connections',
    },
    resolvePrincipal: async () => principal, services: services(),
    runtimeCapabilities: { paidGeneration: true, referenceUploads: false, audioGeneration: false, montagePreparation: false },
  };
  try {
    process.env.MCP_DISTRIBUTION_PROFILE = 'openai-directory';
    const response = await handleMcpHttpRequest(request(), deps);
    assert.equal(response.status, 200);
    const body = await response.text();
    assert.doesNotMatch(body, /create_topup_link/);
    assert.match(body, /confirm_generation/);
    process.env.MCP_DISTRIBUTION_PROFILE = 'invalid-profile';
    assert.equal((await handleMcpHttpRequest(request(), deps)).status, 503);
  } finally {
    if (previous === undefined) delete process.env.MCP_DISTRIBUTION_PROFILE;
    else process.env.MCP_DISTRIBUTION_PROFILE = previous;
  }
});

async function withDirectoryChannel(callback: () => Promise<void>) {
  const values = { NODE_ENV: 'production', MCP_OPENAI_DIRECTORY_ENABLED: 'true', MCP_DISTRIBUTION_PROFILE: 'direct' };
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  Object.assign(process.env, values);
  try { await callback(); } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
}

const channelDeps = () => ({
  enabled: true,
  config: {
    apiHost: 'api.maxvideoai.com', resourceUrl: 'https://api.maxvideoai.com/mcp',
    protectedResourceMetadataUrl: 'https://api.maxvideoai.com/.well-known/oauth-protected-resource/mcp',
    accountUrl: 'https://maxvideoai.com/account/connections',
  },
  resolvePrincipal: async () => principal, services: services(),
  runtimeCapabilities: { paidGeneration: true, referenceUploads: true, audioGeneration: true, montagePreparation: true },
});

function channelRequest(host: string, method = 'tools/list', params: object = {}, path = '/mcp', extraHeaders = {}) {
  return new Request(`https://${host}${path}`, {
    method: 'POST', headers: { host, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...extraHeaders },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
}

async function httpPayload(response: Response) {
  if (response.headers.get('content-type')?.includes('application/json')) return response.json();
  const line = (await response.text()).split('\n').find((line) => line.startsWith('data: '));
  assert.ok(line, 'the real transport must return a protocol response');
  return JSON.parse(line.slice(6));
}

test('one deployment serves distinct inventories by exact host, including direct access to the internal route', async () => {
  await withDirectoryChannel(async () => {
    for (const path of ['/mcp', '/api/mcp']) {
      const openai = await handleMcpHttpRequest(channelRequest('openai-mcp.maxvideoai.com', 'tools/list', {}, path, {
        'x-mcp-distribution-profile': 'direct', 'user-agent': 'Claude',
      }), channelDeps());
      assert.equal(openai.status, 200);
      const directoryTools = (await httpPayload(openai)).result.tools.map((tool: { name: string }) => tool.name);
      assert.ok(directoryTools.includes('confirm_generation'));
      assert.equal(directoryTools.includes('create_topup_link'), false);
      for (const name of ['prepare_audio_generation', 'confirm_audio_generation', 'prepare_montage']) assert.ok(directoryTools.includes(name), name);
      const direct = await handleMcpHttpRequest(channelRequest('api.maxvideoai.com', 'tools/list', {}, path, {
        'x-forwarded-host': 'openai-mcp.maxvideoai.com', 'x-mcp-distribution-profile': 'openai-directory', 'user-agent': 'ChatGPT',
      }), channelDeps());
      assert.equal(direct.status, 200);
      assert.ok((await httpPayload(direct)).result.tools.some((tool: { name: string }) => tool.name === 'create_topup_link'));
    }
  });
});

test('the dedicated HTTP channel projects account data and rejects a purchase call without executing the service', async () => {
  await withDirectoryChannel(async () => {
    const response = await handleMcpHttpRequest(channelRequest('openai-mcp.maxvideoai.com', 'tools/call', {
      name: 'get_account_status', arguments: {},
    }), channelDeps());
    assert.equal(response.status, 200);
    const result = (await httpPayload(response)).result;
    const value = payload(result);
    assert.equal('accountId' in value, false);
    assert.equal('clientId' in value, false);
    assert.equal('billing' in (value.destinations as object), false);
    const denied = await handleMcpHttpRequest(channelRequest('openai-mcp.maxvideoai.com', 'tools/call', {
      name: 'create_topup_link', arguments: { quoteId, distributionProfile: 'direct' },
    }), channelDeps());
    const rejected = (await httpPayload(denied)).result;
    assert.equal(rejected.isError, true);
    assert.match(JSON.stringify(rejected), /not found/i);
  });
});

test('the candidate OAuth challenge names its own resource, while disabled and unknown hosts never authenticate', async () => {
  await withDirectoryChannel(async () => {
    const unauthorizedDeps = { ...channelDeps(), resolvePrincipal: async () => { throw new AgentApiError('AUTH_REQUIRED', 'Reconnect.', false); } };
    const response = await handleMcpHttpRequest(channelRequest('openai-mcp.maxvideoai.com'), unauthorizedDeps);
    assert.equal(response.status, 401);
    assert.match(response.headers.get('www-authenticate')!, /resource_metadata="https:\/\/openai-mcp.maxvideoai.com\/\.well-known\/oauth-protected-resource\/mcp"/);
    assert.equal(response.headers.get('cache-control'), 'private, no-store, no-transform');
    delete process.env.MCP_OPENAI_DIRECTORY_ENABLED;
    const deps = { ...channelDeps(), resolvePrincipal: async (): Promise<never> => { assert.fail('a closed resource must not authenticate'); } };
    for (const host of ['openai-mcp.maxvideoai.com', 'unknown.example', 'openai-mcp.maxvideoai.com:443']) {
      assert.equal((await handleMcpHttpRequest(channelRequest(host), deps)).status, 404);
    }
    const direct = await handleMcpHttpRequest(channelRequest('api.maxvideoai.com'), channelDeps());
    assert.equal(direct.status, 200);
    assert.ok((await httpPayload(direct)).result.tools.some((tool: { name: string }) => tool.name === 'create_topup_link'));
  });
});

test('dual-channel mode fixes both profiles even when the legacy profile variable is removed or changed', async () => {
  await withDirectoryChannel(async () => {
    for (const value of [undefined, 'openai-directory', 'invalid-profile']) {
      if (value === undefined) delete process.env.MCP_DISTRIBUTION_PROFILE;
      else process.env.MCP_DISTRIBUTION_PROFILE = value;
      for (const host of ['api.maxvideoai.com', 'openai-mcp.maxvideoai.com']) {
        const response = await handleMcpHttpRequest(channelRequest(host), channelDeps());
        assert.equal(response.status, 200);
        const names = (await httpPayload(response)).result.tools.map((tool: { name: string }) => tool.name);
        assert.equal(names.includes('create_topup_link'), host === 'api.maxvideoai.com');
      }
    }
  });
});

test('the dedicated HTTP channel rejects a staging primary configuration before authentication', async () => {
  await withDirectoryChannel(async () => {
    const response = await handleMcpHttpRequest(channelRequest('openai-mcp.maxvideoai.com'), {
      ...channelDeps(),
      config: {
        apiHost: 'maxvideoai-mcp-staging.vercel.app', resourceUrl: 'https://maxvideoai-mcp-staging.vercel.app/mcp',
        protectedResourceMetadataUrl: 'https://maxvideoai-mcp-staging.vercel.app/.well-known/oauth-protected-resource/mcp',
        accountUrl: 'https://maxvideoai-mcp-staging.vercel.app/account/connections',
      },
      resolvePrincipal: async (): Promise<never> => { assert.fail('an invalid resource must not authenticate'); },
    });
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('cache-control'), 'private, no-store, no-transform');
    assert.doesNotMatch(await response.text(), /postgres|supabase|staging-user|client-1/i);
  });
});

test('Vercel previews reject the dedicated HTTP channel before authentication and preserve the primary legacy profile', async () => {
  const previous = process.env.VERCEL_ENV;
  try {
    process.env.VERCEL_ENV = 'preview';
    await withDirectoryChannel(async () => {
      const response = await handleMcpHttpRequest(channelRequest('openai-mcp.maxvideoai.com'), {
        ...channelDeps(), resolvePrincipal: async (): Promise<never> => { assert.fail('a preview must not authenticate the production-only resource'); },
      });
      assert.equal(response.status, 503);
      assert.equal(response.headers.get('cache-control'), 'private, no-store, no-transform');
      process.env.MCP_DISTRIBUTION_PROFILE = 'openai-directory';
      const primary = await handleMcpHttpRequest(channelRequest('api.maxvideoai.com'), channelDeps());
      assert.equal(primary.status, 200);
      assert.equal((await httpPayload(primary)).result.tools.some((tool: { name: string }) => tool.name === 'create_topup_link'), false);
    });
  } finally {
    if (previous === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = previous;
  }
});

test('invalid staging activation preserves the primary legacy profile instead of restoring purchase tools', async () => {
  await withDirectoryChannel(async () => {
    process.env.MCP_DISTRIBUTION_PROFILE = 'openai-directory';
    const host = 'maxvideoai-mcp-staging.vercel.app';
    const response = await handleMcpHttpRequest(channelRequest(host), {
      ...channelDeps(), config: {
        apiHost: host, resourceUrl: `https://${host}/mcp`,
        protectedResourceMetadataUrl: `https://${host}/.well-known/oauth-protected-resource/mcp`,
        accountUrl: `https://${host}/account/connections`,
      },
    });
    assert.equal(response.status, 200);
    assert.equal((await httpPayload(response)).result.tools.some((tool: { name: string }) => tool.name === 'create_topup_link'), false);
  });
});


test('directory Audio and Studio exports stop on insufficient entitlements without a commerce handoff', async () => {
  const failure = async (): Promise<never> => { throw new AgentApiError('INSUFFICIENT_FUNDS', 'Add funds at billing.', true, { type: 'open_url', url: 'https://maxvideoai.com/billing' }); };
  const cases = [
    ['prepare_audio_generation', { surface: 'audio', engineId: 'audio-voice', mode: 'voice_only', prompt: 'A line of narration.' }],
    ['confirm_audio_generation', { quoteId, confirmed: true }],
    ['prepare_studio_export', { projectId: 'project', sequenceId: 'sequence', expectedRevision: 0, idempotencyKey: 'export', qualityPreset: 'draft', includeAudio: true }],
    ['confirm_studio_export', { projectId: 'project', quoteId, confirmed: true }],
  ] as const;
  for (const profile of ['direct', 'openai-directory'] as const) {
    const c = await connected(profile, { audioGeneration: true, studioExports: true }, { prepareAudioGeneration: failure, confirmAudioGeneration: failure, prepareStudioExport: failure, confirmStudioExport: failure });
    try {
      if (profile === 'openai-directory') await c.client.listTools();
      for (const [name, args] of cases) {
        const result = await c.client.callTool({ name, arguments: args });
        assert.equal(result.isError, true);
        const error = payload(result).error as Record<string, unknown>;
        assert.equal(error.code, 'INSUFFICIENT_FUNDS', JSON.stringify(result));
        if (profile === 'openai-directory') {
          assert.equal(error.retryable, false);
          assert.equal(error.nextAction, null);
          assert.doesNotMatch(JSON.stringify(error), /billing|add funds|checkout/i);
        } else {
          assert.deepEqual(error.nextAction, { type: 'open_url', url: 'https://maxvideoai.com/billing' });
        }
      }
    } finally { await c.close(); }
  }
});

test('all ten candidate widgets declare the dedicated origin and preserve direct HTML and CSP', async () => {
  const direct = await connected('direct', { referenceUploads: true });
  const directory = await connected('openai-directory', { referenceUploads: true });
  try {
    const directResources = (await direct.client.listResources()).resources;
    const resources = (await directory.client.listResources()).resources;
    assert.deepEqual(resources.map((resource) => resource.uri).sort(), [
      'ui://maxvideoai/generation-result-v1.html',
      'ui://maxvideoai/generation-result-v2.html',
      'ui://maxvideoai/generation-result-v3.html',
      'ui://maxvideoai/generation-result-v4.html',
      'ui://maxvideoai/generation-result-v5.html',
      'ui://maxvideoai/generation-result-v6.html',
      'ui://maxvideoai/generation-result-v7.html',
      'ui://maxvideoai/reference-upload-v1.html',
      'ui://maxvideoai/reference-upload-v2.html',
      'ui://maxvideoai/reference-upload-v3.html',
    ]);
    assert.deepEqual(resources.map(resource => resource.uri), directResources.map(resource => resource.uri));
    for (const resource of resources) {
      assert.equal((resource._meta?.ui as { domain?: string })?.domain, 'https://openai-mcp.maxvideoai.com');
      const a = (await direct.client.readResource({ uri: resource.uri })).contents[0];
      const b = (await directory.client.readResource({ uri: resource.uri })).contents[0];
      assert.equal(b.text, a.text, resource.uri);
      assert.equal((a._meta?.ui as { domain?: string })?.domain, undefined);
      assert.equal((b._meta?.ui as { domain?: string })?.domain, 'https://openai-mcp.maxvideoai.com');
      assert.equal(b._meta?.['openai/widgetDomain'], 'https://openai-mcp.maxvideoai.com');
      assert.deepEqual(b._meta?.['openai/widgetCSP'], a._meta?.['openai/widgetCSP']);
    }
  } finally { await directory.close(); await direct.close(); }
});


test('dedicated HTTP feature switches expose the complete candidate without changing the direct channel', async () => {
  await withDirectoryChannel(async () => {
    const names = async (host: string) => (await httpPayload(await handleMcpHttpRequest(channelRequest(host), channelDeps()))).result.tools.map((tool: { name: string }) => tool.name).sort();
    const directBefore = await names('api.maxvideoai.com');
    const keys = ['MCP_OPENAI_DIRECTORY_MONTAGE_PREPARATION_ENABLED', 'MCP_OPENAI_DIRECTORY_STUDIO_MONTAGE_CREATION_ENABLED', 'MCP_OPENAI_DIRECTORY_STUDIO_TIMELINE_EDITING_ENABLED', 'MCP_OPENAI_DIRECTORY_STUDIO_EXPORTS_ENABLED'];
    const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
    try {
      for (const key of keys) process.env[key] = 'true';
      const candidate = await names('openai-mcp.maxvideoai.com');
      assert.equal(candidate.length, 25);
      assert.ok(candidate.includes('compare_generation_prices'));
      assert.ok(candidate.includes('get_studio_timeline'));
      assert.ok(candidate.includes('confirm_studio_export'));
      assert.deepEqual(await names('api.maxvideoai.com'), directBefore);
      process.env.MCP_OPENAI_DIRECTORY_STUDIO_TIMELINE_EDITING_ENABLED = 'false';
      const partial = await names('openai-mcp.maxvideoai.com');
      assert.equal(partial.includes('get_studio_timeline'), false);
      assert.ok(partial.includes('create_studio_montage'));
      assert.ok(partial.includes('prepare_studio_export'));
      process.env.MCP_OPENAI_DIRECTORY_STUDIO_EXPORTS_ENABLED = 'invalid';
      let authenticated = false;
      const rejected = await handleMcpHttpRequest(channelRequest('openai-mcp.maxvideoai.com'), { ...channelDeps(), resolvePrincipal: async () => { authenticated = true; return principal; } });
      assert.equal(rejected.status, 503);
      assert.equal(authenticated, false);
    } finally {
      for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    }
  });
});

test('every creator descriptor applies the selected distribution policy to real mapped entitlement failures',async()=>{
  const failure=async():Promise<never>=>{throw new Error('INSUFFICIENT_FUNDS');};
  const creatorTools={list:failure,prepare:failure,confirm:failure,status:failure,readDocument:failure,editDocument:failure,prepareExport:failure,prepareStudio:failure,exportText:failure};
  const cases=[
    ['list_creator_tools',{}],
    ['prepare_creator_tool',{request:{toolId:'subtitles',source:{type:'asset',assetId:'owned',kind:'video'}}}],
    ['confirm_creator_tool',{toolId:'subtitles',operationId:quoteId,confirmed:true}],
    ['get_creator_tool_operation',{toolId:'subtitles',operationId:quoteId}],
    ['get_subtitle_document',{documentId:'owned',revision:1}],
    ['edit_subtitle_document',{documentId:'owned',expectedRevision:1,requestId:quoteId,change:{segments:[]}}],
    ['prepare_subtitle_export',{documentId:'owned',revision:1}],
    ['prepare_studio_subtitles',{projectId:'project',sequenceId:'sequence',expectedRevision:1}],
    ['export_subtitle_text',{documentId:'owned',revision:1,format:'vtt'}],
  ] as const;
  for(const profile of ['direct','openai-directory'] as const){
    const c=await connected(profile,{referenceUploads:true,creatorTools:true,studioTimelineEditing:true},{creatorTools});
    try{for(const [name,args] of cases){
      const result=await c.client.callTool({name,arguments:args});assert.equal(result.isError,true,name);
      const error=payload(result).error as Record<string,unknown>;
      assert.equal(error.code,'INSUFFICIENT_FUNDS',name);
      assert.deepEqual(JSON.parse((result.content as Array<{text:string}>)[0].text),result.structuredContent);
      if(profile==='openai-directory'){assert.equal(error.retryable,false);assert.equal(error.nextAction,null);assert.doesNotMatch(JSON.stringify(error),/add funds|buy|purchase|checkout|billing/i,name);}
      else assert.match(String(error.message),/Add funds/,name);
    }}finally{await c.close();}
  }
});
