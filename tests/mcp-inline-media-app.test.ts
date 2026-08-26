import assert from 'node:assert/strict';
import test from 'node:test';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { buildAgentGenerationRecovery } from '../frontend/src/server/agent-api/generation-status';
import type { AgentPrincipal } from '../frontend/src/server/agent-api/principal';
import type { AgentGenerationStatus } from '../frontend/src/server/generations/generation-status';
import {
  createMaxVideoAiMcpServer,
  type MaxVideoAiMcpServices,
} from '../frontend/src/server/mcp/server';

const TEMPLATE_URI = 'ui://maxvideoai/generation-result-v1.html';

const principal: AgentPrincipal = {
  userId: 'inline-viewer-owner',
  clientId: 'inline-viewer-client',
  emailVerified: true,
  authMethod: 'oauth',
};

function completedVideoStatus(): AgentGenerationStatus {
  return {
    jobId: 'completed-video-job',
    surface: 'video',
    status: 'completed',
    progress: 100,
    message: null,
    priceCents: 95,
    currency: 'USD',
    paymentStatus: 'paid_wallet',
    result: {
      surface: 'video',
      videoUrl: 'https://media.maxvideoai.com/generated/completed-video.mp4',
      previewUrl: 'https://media.maxvideoai.com/generated/completed-video-preview.mp4',
      thumbnailUrl: 'https://cdn.maxvideoai.com/generated/completed-video.webp',
      audioUrl: null,
    },
    retryAfterSeconds: null,
  };
}

function services(onStatusRead?: (jobId: string) => void): MaxVideoAiMcpServices {
  return {
    async getAccountStatus() { return {} as never; },
    async listModels() { return []; },
    async getModelDetails() { return {} as never; },
    async recommendModels() { return { recommendations: [], nextAction: 'clarify_requirements' }; },
    async calculateProjectBudget() { return {} as never; },
    async prepareGeneration() { return {} as never; },
    async confirmGeneration() { return {} as never; },
    async getGenerationStatus(input) {
      onStatusRead?.(input.jobId);
      return buildAgentGenerationRecovery(completedVideoStatus());
    },
    async listRecentGenerations() { return { items: [], nextCursor: null }; },
    async createTopupLink() { return {} as never; },
  };
}

async function connected(onStatusRead?: (jobId: string) => void) {
  const server = createMaxVideoAiMcpServer(principal, services(onStatusRead), {
    paidGeneration: true,
    referenceUploads: false,
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'inline-media-contract', version: '1.0.0' });
  await client.connect(clientTransport);
  return {
    client,
    async close() {
      await client.close();
      await server.close();
    },
  };
}

test('paid MCP profile exposes one decoupled inline generation presenter', async (t) => {
  const session = await connected();
  t.after(() => session.close());

  const tools = await session.client.listTools();
  const presenter = tools.tools.find((tool) => tool.name === 'present_generation');
  assert.ok(presenter);
  assert.deepEqual(presenter.annotations, {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: false,
  });
  assert.equal(presenter.inputSchema.additionalProperties, false);
  assert.deepEqual(presenter.inputSchema.required, ['jobId']);
  assert.deepEqual(Object.keys(presenter.inputSchema.properties ?? {}), ['jobId']);
  assert.match(presenter.description ?? '', /completed.*inline.*video|inline.*completed.*video/is);
  assert.equal((presenter._meta?.ui as { resourceUri?: string } | undefined)?.resourceUri, TEMPLATE_URI);
  assert.equal(presenter._meta?.['ui/resourceUri'], TEMPLATE_URI);
  assert.equal(presenter._meta?.['openai/outputTemplate'], TEMPLATE_URI);
});

test('generation presenter resource is a portable light and dark MCP App with native video', async (t) => {
  const session = await connected();
  t.after(() => session.close());

  const resources = await session.client.listResources();
  const listedResource = resources.resources.find((resource) => resource.uri === TEMPLATE_URI);
  assert.ok(listedResource);
  const listedUi = (listedResource._meta?.ui ?? {}) as {
    prefersBorder?: boolean;
    csp?: { resourceDomains?: string[] };
  };
  assert.equal(listedUi.prefersBorder, true);
  assert.ok(listedUi.csp?.resourceDomains?.includes('https://media.maxvideoai.com'));
  const result = await session.client.readResource({ uri: TEMPLATE_URI });
  assert.equal(result.contents.length, 1);
  const content = result.contents[0];
  assert.equal(content?.mimeType, 'text/html;profile=mcp-app');
  assert.equal(typeof content?.text, 'string');
  const html = content?.text ?? '';
  assert.match(html, /<video\b[^>]*controls[^>]*playsinline/is);
  assert.match(html, /ui\/notifications\/tool-result/);
  assert.match(html, /ui\/open-link/);
  assert.match(html, /prefers-color-scheme:\s*dark/);
  assert.match(html, /MaxVideoAI/);
  assert.doesNotMatch(html, /dangerouslySetInnerHTML|eval\(|new Function\(|document\.write\(/);

  const meta = (content?._meta ?? {}) as Record<string, unknown>;
  const ui = meta.ui as { prefersBorder?: boolean; csp?: { resourceDomains?: string[] } } | undefined;
  assert.equal(ui?.prefersBorder, true);
  assert.ok(ui?.csp?.resourceDomains?.includes('https://media.maxvideoai.com'));
  assert.ok(ui?.csp?.resourceDomains?.includes('https://cdn.maxvideoai.com'));
  assert.ok(ui?.csp?.resourceDomains?.every((origin) => !origin.includes('*')));
});

test('generation presenter reuses the owned recovery service and preserves non-UI links', async (t) => {
  const statusReads: string[] = [];
  const session = await connected((jobId) => statusReads.push(jobId));
  t.after(() => session.close());

  const result = await session.client.callTool({
    name: 'present_generation',
    arguments: { jobId: '  completed-video-job  ' },
  });
  assert.equal(result.isError, undefined);
  assert.deepEqual(statusReads, ['completed-video-job']);
  assert.equal(result.structuredContent?.status, 'completed');
  assert.equal(result.structuredContent?.savedToLibrary, true);
  assert.equal(result.content.filter((block) => block.type === 'resource_link').length, 3);
  assert.doesNotMatch(JSON.stringify(result), /prompt|provider_job|storage key|wallet balance/i);
});
