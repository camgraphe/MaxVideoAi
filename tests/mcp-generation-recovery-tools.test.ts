import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { AgentApiError } from '../frontend/src/server/agent-api/errors';
import {
  buildAgentGenerationRecovery,
  buildGenerationResourceLinks,
  getAgentGenerationStatus,
  listAgentRecentGenerations,
  type AgentGenerationRecovery,
} from '../frontend/src/server/agent-api/generation-status';
import type { AgentPrincipal } from '../frontend/src/server/agent-api/principal';
import type { AgentGenerationStatus } from '../frontend/src/server/generations/generation-status';
import { RecentGenerationInputError } from '../frontend/src/server/generations/recent-generations';
import {
  createMaxVideoAiMcpServer,
  type MaxVideoAiMcpServices,
} from '../frontend/src/server/mcp/server';

const principal: AgentPrincipal = {
  userId: 'owner-user',
  clientId: 'codex-client',
  emailVerified: true,
  authMethod: 'oauth',
};

function status(overrides: Partial<AgentGenerationStatus> = {}): AgentGenerationStatus {
  return {
    jobId: 'legacy-job_42',
    surface: 'video',
    status: 'accepted',
    progress: 0,
    message: 'Generation accepted.',
    priceCents: 125,
    currency: 'USD',
    paymentStatus: 'paid_wallet',
    result: null,
    retryAfterSeconds: 5,
    ...overrides,
  };
}

function baseServices(overrides: Partial<MaxVideoAiMcpServices> = {}): MaxVideoAiMcpServices {
  return {
    async getAccountStatus() {
      return {
        accountId: principal.userId,
        emailVerified: true,
        clientId: principal.clientId,
        wallet: { amountCents: 1000, currency: 'USD', pendingCents: 0 },
        trial: { status: 'disabled' },
        spendingLimits: { perGenerationCents: null, dailyCents: null, webApprovalAboveCents: null },
        accountUrl: 'https://maxvideoai.com/account/connections',
      };
    },
    async listModels() { return []; },
    async getModelDetails() { throw new Error('not used'); },
    async recommendModels() { return { recommendations: [], nextAction: 'clarify_requirements' }; },
    async calculateProjectBudget() { throw new Error('not used'); },
    async listMedia() { return { items: [], nextCursor: null, hasMore: false }; },
    async createReferenceUploadLink() { throw new Error('not used'); },
    async importReferenceFiles() { throw new Error('not used'); },
    async prepareGeneration() { throw new Error('not used'); },
    async confirmGeneration() { throw new Error('not used'); },
    async getGenerationStatus() { return buildAgentGenerationRecovery(status()); },
    async listRecentGenerations() {
      return { items: [buildAgentGenerationRecovery(status())], nextCursor: null };
    },
    async createTopupLink() { throw new Error('not used'); },
    ...overrides,
  };
}

async function connected(
  overrides: Partial<MaxVideoAiMcpServices> = {},
  capabilities: { paidGeneration: boolean; referenceUploads: boolean } = {
    paidGeneration: true,
    referenceUploads: false,
  },
) {
  const server = createMaxVideoAiMcpServer(principal, baseServices(overrides), capabilities);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'p9-contract', version: '1.0.0' });
  await client.connect(clientTransport);
  return {
    client,
    async close() {
      await client.close();
      await server.close();
    },
  };
}

test('status facade scopes every read to the principal and makes missing and other-user jobs equivalent', async () => {
  const requested: Array<{ userId: string; jobId: string }> = [];
  const readStatus = async (input: { userId: string; jobId: string }) => {
    requested.push(input);
    return null;
  };
  for (const jobId of ['missing-job', 'belongs-to-another-user']) {
    await assert.rejects(
      getAgentGenerationStatus({ jobId }, principal, { readStatus }),
      (error: unknown) => {
        assert.ok(error instanceof AgentApiError);
        assert.equal(error.code, 'JOB_FAILED');
        assert.equal(error.message, 'Generation not found.');
        assert.equal(error.retryable, false);
        assert.equal(error.nextAction, null);
        return true;
      },
    );
  }
  assert.deepEqual(requested, [
    { userId: principal.userId, jobId: 'missing-job' },
    { userId: principal.userId, jobId: 'belongs-to-another-user' },
  ]);
});

test('status facade trims bounded legacy job IDs and rejects invalid input before reading', async () => {
  const reads: string[] = [];
  const value = await getAgentGenerationStatus({ jobId: '  legacy-job_42  ' }, principal, {
    readStatus: async ({ jobId }) => {
      reads.push(jobId);
      return status({ jobId });
    },
    accountUrl: 'https://maxvideoai-mcp-staging.vercel.app/account/connections',
  });
  assert.equal(value.jobId, 'legacy-job_42');
  assert.deepEqual(reads, ['legacy-job_42']);
  assert.equal(value.library.url, 'https://maxvideoai-mcp-staging.vercel.app/app/library');
  assert.equal(
    value.workspace.url,
    'https://maxvideoai-mcp-staging.vercel.app/app?job=legacy-job_42',
  );
  assert.equal(value.savedToLibrary, false);

  for (const jobId of ['', '   ', 'x'.repeat(257)]) {
    await assert.rejects(
      getAgentGenerationStatus({ jobId }, principal, { readStatus: async () => status() }),
      (error: unknown) => error instanceof AgentApiError && error.code === 'PARAMETER_INVALID',
    );
  }
});

test('status and recent recovery expose only the included trial lifecycle state', async () => {
  const trialStatus = status({
    jobId: 'trial-job-7',
    priceCents: 0,
    paymentStatus: 'included_mcp_trial',
  });
  const readTrialStatus = async () => ({
    funding: 'included_trial' as const,
    entitlementState: 'reserved' as const,
  });
  const single = await getAgentGenerationStatus({ jobId: 'trial-job-7' }, principal, {
    readStatus: async () => trialStatus,
    readTrialStatus,
  });
  assert.equal(single.funding, 'included_trial');
  assert.equal(single.entitlementState, 'reserved');
  assert.equal(single.paymentStatus, 'included_trial');
  assert.doesNotMatch(JSON.stringify(single), /included_mcp_trial/i);
  assert.doesNotMatch(JSON.stringify(single), /reason|providerCost|fingerprint|ipPrefix/i);

  const recent = await listAgentRecentGenerations({}, principal, {
    listRecent: async () => ({ items: [trialStatus], nextCursor: null }),
    readTrialStatus,
  });
  assert.equal(recent.items[0]?.funding, 'included_trial');
  assert.equal(recent.items[0]?.entitlementState, 'reserved');
  assert.equal(recent.items[0]?.paymentStatus, 'included_trial');
});

test('recovery facade rejects malformed principals and exotic exact-input shapes before reading', async () => {
  const accessor = {} as Record<string, unknown>;
  Object.defineProperty(accessor, 'jobId', { enumerable: true, get: () => 'legacy-job_42' });
  const inherited = Object.assign(Object.create({ inherited: true }), { jobId: 'legacy-job_42' });
  const symbolInput = { jobId: 'legacy-job_42' } as Record<PropertyKey, unknown>;
  symbolInput[Symbol('hidden')] = true;
  for (const input of [accessor, inherited, symbolInput]) {
    let read = false;
    await assert.rejects(
      getAgentGenerationStatus(input as never, principal, {
        readStatus: async () => { read = true; return status(); },
      }),
      (error: unknown) => error instanceof AgentApiError && error.code === 'PARAMETER_INVALID',
    );
    assert.equal(read, false);
  }
  for (const invalidPrincipal of [
    { ...principal, userId: '' },
    { ...principal, userId: ' owner-user ' },
    { ...principal, clientId: '' },
    { ...principal, authMethod: 'cookie' },
  ]) {
    let read = false;
    await assert.rejects(
      getAgentGenerationStatus({ jobId: 'legacy-job_42' }, invalidPrincipal as never, {
        readStatus: async () => { read = true; return status(); },
      }),
      (error: unknown) => error instanceof AgentApiError && error.code === 'AUTH_REQUIRED',
    );
    assert.equal(read, false);
  }
});

test('accepted and running recoveries include bounded deterministic status retry guidance', () => {
  for (const [rawStatus, retryAfterSeconds, expected] of [
    ['accepted', -100, 5],
    ['running', 999, 30],
  ] as const) {
    const recovery = buildAgentGenerationRecovery(status({ status: rawStatus, retryAfterSeconds }));
    assert.deepEqual(recovery.retry, {
      tool: 'get_generation_status',
      arguments: { jobId: 'legacy-job_42' },
      afterSeconds: expected,
    });
    assert.equal('retryAfterSeconds' in recovery, false);
    assert.equal(recovery.library.url, 'https://maxvideoai.com/app/library');
    assert.equal(recovery.workspace.url, 'https://maxvideoai.com/app?job=legacy-job_42');
    assert.equal(recovery.savedToLibrary, false);
  }

  for (const terminal of ['completed', 'failed'] as const) {
    const recovery = buildAgentGenerationRecovery(status({ status: terminal, retryAfterSeconds: 5 }));
    assert.equal(recovery.retry, null);
    assert.equal(recovery.savedToLibrary, false);
  }
});

test('completed image recoveries bound, deduplicate, and length-limit public URLs without embedding bytes', () => {
  const longUri = `https://cdn.maxvideoai.com/${'x'.repeat(2050)}.png`;
  const primary = Array.from({ length: 7 }, (_, index) => `https://cdn.maxvideoai.com/image-${index}.png`);
  const thumbnails = Array.from({ length: 7 }, (_, index) => `https://cdn.maxvideoai.com/thumb-${index}.webp`);
  const recovery = buildAgentGenerationRecovery(status({
    surface: 'image',
    status: 'completed',
    progress: 100,
    retryAfterSeconds: null,
    result: {
      surface: 'image',
      imageUrls: [primary[0]!, primary[0]!, longUri, ...primary.slice(1)],
      thumbnailUrls: [primary[0]!, ...thumbnails, longUri],
    },
  }));

  assert.equal(recovery.result?.surface, 'image');
  if (recovery.result?.surface !== 'image') assert.fail('expected image result');
  assert.deepEqual(recovery.result.imageUrls, primary.slice(0, 4));
  assert.deepEqual(recovery.result.thumbnailUrls, thumbnails.slice(0, 4));
  assert.equal(recovery.savedToLibrary, true);
  assert.equal(recovery.library.url, 'https://maxvideoai.com/app/library');
  assert.equal(recovery.workspace.url, 'https://maxvideoai.com/app/image?job=legacy-job_42');
  const links = buildGenerationResourceLinks(recovery);
  assert.equal(links.length, 8);
  assert.ok(links.every((link) => link.uri.length <= 2048 && link.uri.startsWith('https://')));
  assert.equal(new Set(links.map((link) => link.uri)).size, links.length);
  assert.doesNotMatch(JSON.stringify(links), /base64|data:/i);
});

test('completed media deduplicates equivalent URLs by their canonical HTTPS form', () => {
  const recovery = buildAgentGenerationRecovery(status({
    surface: 'image',
    status: 'completed',
    progress: 100,
    retryAfterSeconds: null,
    result: {
      surface: 'image',
      imageUrls: [
        'https://CDN.MAXVIDEOAI.COM:443/generated/canonical.png',
        'https://cdn.maxvideoai.com/generated/canonical.png',
      ],
      thumbnailUrls: ['https://cdn.maxvideoai.com:443/generated/canonical.png'],
    },
  }));
  assert.deepEqual(recovery.result, {
    surface: 'image',
    imageUrls: ['https://cdn.maxvideoai.com/generated/canonical.png'],
    thumbnailUrls: [],
  });
  assert.deepEqual(buildGenerationResourceLinks(recovery).map((link) => link.uri), [
    'https://cdn.maxvideoai.com/generated/canonical.png',
  ]);
});

test('completed video recovery exposes bounded stable links while non-terminal jobs expose none', () => {
  const completed = buildAgentGenerationRecovery(status({
    status: 'completed',
    progress: 100,
    retryAfterSeconds: null,
    result: {
      surface: 'video',
      videoUrl: 'https://media.maxvideoai.com/final.mp4',
      previewUrl: 'https://media.maxvideoai.com/preview.mp4',
      thumbnailUrl: 'https://cdn.maxvideoai.com/preview.webp',
      audioUrl: 'https://media.maxvideoai.com/audio.mp3',
    },
  }));
  assert.deepEqual(buildGenerationResourceLinks(completed).map((link) => link.uri), [
    'https://media.maxvideoai.com/final.mp4',
    'https://media.maxvideoai.com/preview.mp4',
    'https://cdn.maxvideoai.com/preview.webp',
    'https://media.maxvideoai.com/audio.mp3',
  ]);
  assert.deepEqual(buildGenerationResourceLinks(buildAgentGenerationRecovery(status())), []);
});

test('failed recovery gives Claude and Codex a stable actionable code without provider details', async (t) => {
  const recovery = buildAgentGenerationRecovery(status({
    status: 'failed',
    progress: 0,
    paymentStatus: 'refunded_wallet',
    retryAfterSeconds: null,
    failureCode: 'seedance_task_type_constraint',
    message:
      'Seedance could not identify the intended video edit or extension. Refer to the source directly as Video 1, then prepare a new quote before retrying.',
  }));
  const session = await connected({
    async getGenerationStatus() {
      return recovery;
    },
  });
  t.after(() => session.close());

  const result = await session.client.callTool({
    name: 'get_generation_status',
    arguments: { jobId: 'legacy-job_42' },
  });
  const serialized = JSON.stringify(result);
  assert.match(serialized, /seedance_task_type_constraint/);
  assert.match(serialized, /Refer to the source directly as Video 1/);
  assert.match(serialized, /refunded_wallet/);
  assert.doesNotMatch(serialized, /InvalidParameter|TaskTypeConstraint|provider_job|reference\.mp4/i);
});

test('resource link MIME types never label extensionless image output as video', () => {
  const recovery = buildAgentGenerationRecovery(status({
    surface: 'image',
    status: 'completed',
    retryAfterSeconds: null,
    result: {
      surface: 'image',
      imageUrls: ['https://cdn.maxvideoai.com/generated/opaque-image'],
      thumbnailUrls: [],
    },
  }));
  const [link] = buildGenerationResourceLinks(recovery);
  assert.ok(link);
  assert.notEqual(link.mimeType, 'video/mp4');
});

test('recent facade delegates strict cursor pagination and exact surface/status filters', async () => {
  let captured: Record<string, unknown> | null = null;
  const result = await listAgentRecentGenerations(
    { cursor: '2026-07-16T10:00:00.000Z|42', limit: 7, surface: 'image', status: 'completed' },
    principal,
    {
      listRecent: async (input) => {
        captured = input;
        return {
          items: [status({ jobId: 'image-job', surface: 'image', status: 'completed', retryAfterSeconds: null })],
          nextCursor: '2026-07-16T09:00:00.000Z|41',
        };
      },
      accountUrl: 'https://maxvideoai-mcp-staging.vercel.app/account/connections',
    },
  );
  assert.deepEqual(captured, {
    userId: principal.userId,
    cursor: '2026-07-16T10:00:00.000Z|42',
    limit: 7,
    surface: 'image',
    status: 'completed',
  });
  assert.equal(result.items[0]?.jobId, 'image-job');
  assert.equal(
    result.items[0]?.workspace.url,
    'https://maxvideoai-mcp-staging.vercel.app/app/image?job=image-job',
  );
  assert.equal(result.items[0]?.library.url, 'https://maxvideoai-mcp-staging.vercel.app/app/library');
  assert.equal(result.nextCursor, '2026-07-16T09:00:00.000Z|41');

  await assert.rejects(
    listAgentRecentGenerations({ cursor: 'invalid', limit: 10 }, principal, {
      listRecent: async () => { throw new RecentGenerationInputError('cursor', 'cursor is invalid.'); },
    }),
    (error: unknown) => error instanceof AgentApiError && error.code === 'PARAMETER_INVALID',
  );
});

test('operational gate registers the exact fifteen-tool order and default registry remains five tools', async (t) => {
  const gated = await connected({}, { paidGeneration: true, referenceUploads: true });
  const defaults = await connected({}, { paidGeneration: false, referenceUploads: false });
  t.after(async () => {
    await gated.close();
    await defaults.close();
  });
  assert.deepEqual((await gated.client.listTools()).tools.map((tool) => tool.name), [
    'get_account_status',
    'list_models',
    'get_model_details',
    'recommend_models',
    'calculate_project_budget',
    'list_media',
    'create_reference_upload_link',
    'import_reference_files',
    'prepare_generation',
    'confirm_generation',
    'get_generation_status',
    'list_recent_generations',
    'get_generation_download',
    'present_generation',
    'create_topup_link',
  ]);
  assert.deepEqual((await defaults.client.listTools()).tools.map((tool) => tool.name), [
    'get_account_status',
    'list_models',
    'get_model_details',
    'recommend_models',
    'calculate_project_budget',
  ]);
});

test('recovery tools expose exact annotations and schemas and cap response resource links globally', async (t) => {
  let statusInput: unknown;
  let recentInput: unknown;
  const completedItems = Array.from({ length: 10 }, (_, index) => buildAgentGenerationRecovery(status({
    jobId: `image-job-${index}`,
    surface: 'image',
    status: 'completed',
    progress: 100,
    retryAfterSeconds: null,
    result: {
      surface: 'image',
      imageUrls: Array.from({ length: 4 }, (__, output) => `https://cdn.maxvideoai.com/${index}-${output}.png`),
      thumbnailUrls: [],
    },
  })));
  const session = await connected({
    async getGenerationStatus(input) {
      statusInput = input;
      return completedItems[0]!;
    },
    async listRecentGenerations(input) {
      recentInput = input;
      return { items: completedItems, nextCursor: null };
    },
  });
  t.after(() => session.close());
  const tools = (await session.client.listTools()).tools;
  assert.match(
    tools.find((tool) => tool.name === 'get_generation_status')?.description ?? '',
    /MaxVideoAI library/i,
  );
  assert.match(
    tools.find((tool) => tool.name === 'list_recent_generations')?.description ?? '',
    /same connected user.*MaxVideoAI library/i,
  );
  for (const name of ['get_generation_status', 'list_recent_generations', 'present_generation']) {
    const tool = tools.find((candidate) => candidate.name === name);
    assert.ok(tool);
    assert.deepEqual(tool.annotations, {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    });
  }
  const statusSchema = tools.find((tool) => tool.name === 'get_generation_status')?.inputSchema;
  assert.deepEqual(statusSchema?.required, ['jobId']);
  assert.deepEqual(Object.keys(statusSchema?.properties ?? {}), ['jobId']);
  const recentSchema = tools.find((tool) => tool.name === 'list_recent_generations')?.inputSchema;
  assert.deepEqual(Object.keys(recentSchema?.properties ?? {}), ['cursor', 'limit', 'surface', 'status']);

  const statusResult = await session.client.callTool({
    name: 'get_generation_status',
    arguments: { jobId: '  legacy-job_42  ' },
  });
  assert.deepEqual(statusInput, { jobId: 'legacy-job_42' });
  assert.equal(statusResult.content.filter((block) => block.type === 'resource_link').length, 4);
  assert.equal(
    (statusResult.structuredContent as { library?: { url?: string } })?.library?.url,
    'https://maxvideoai.com/app/library',
  );

  const recentResult = await session.client.callTool({
    name: 'list_recent_generations',
    arguments: { cursor: '2026-07-16T10:00:00.000Z|42', limit: 10, surface: 'image', status: 'completed' },
  });
  assert.deepEqual(recentInput, {
    cursor: '2026-07-16T10:00:00.000Z|42', limit: 10, surface: 'image', status: 'completed',
  });
  assert.equal(recentResult.content.filter((block) => block.type === 'resource_link').length, 20);
  assert.ok(recentResult.content.every((block) => block.type === 'text' || block.type === 'resource_link'));
  assert.doesNotMatch(JSON.stringify(recentResult), /private prompt|provider_job|data:|base64/i);
});

test('recovery tool validation rejects extra fields and unexpected failures keep correlation-only output', async (t) => {
  let calls = 0;
  const session = await connected({
    async getGenerationStatus() {
      calls += 1;
      throw new Error('private prompt provider-secret private-url');
    },
  });
  t.after(() => session.close());
  const invalid = await session.client.callTool({
    name: 'get_generation_status',
    arguments: { jobId: 'legacy-job_42', provider: 'forbidden' },
  });
  assert.equal(invalid.isError, true);
  assert.equal(calls, 0);
  const unexpected = await session.client.callTool({
    name: 'get_generation_status',
    arguments: { jobId: 'legacy-job_42' },
  });
  assert.equal(unexpected.isError, true);
  assert.equal(calls, 1);
  assert.match(JSON.stringify(unexpected.structuredContent), /"code":"INTERNAL_ERROR"/);
  assert.match(JSON.stringify(unexpected.structuredContent), /"correlationId":"[^"]+"/);
  assert.doesNotMatch(JSON.stringify(unexpected), /private prompt|provider-secret|private-url/);
});

test('recovery MCP owners contain no web payload, provider, or binary-loading path', () => {
  const sources = [
    'frontend/src/server/agent-api/generation-status.ts',
    'frontend/src/server/mcp/tools/get-generation-status.ts',
    'frontend/src/server/mcp/tools/list-recent-generations.ts',
  ].map((path) => readFileSync(path, 'utf8')).join('\n');
  assert.doesNotMatch(sources, /mapGenerationStatusRecordToWeb|mapRecentGenerationRecordToWeb/);
  assert.doesNotMatch(sources, /provider_job_id|settings_snapshot|stripe_payment|vendor_account|\bprompt\b/i);
  assert.doesNotMatch(sources, /fetch\(|arrayBuffer\(|Buffer\.from\([^)]*uri|type:\s*['"](?:image|resource)['"]/);
});
