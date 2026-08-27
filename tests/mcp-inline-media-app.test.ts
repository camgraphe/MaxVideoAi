import assert from 'node:assert/strict';
import test from 'node:test';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { JSDOM } from 'jsdom';

import { buildAgentGenerationRecovery } from '../frontend/src/server/agent-api/generation-status';
import type { AgentPrincipal } from '../frontend/src/server/agent-api/principal';
import type { AgentGenerationStatus } from '../frontend/src/server/generations/generation-status';
import { buildGenerationResultAppHtml } from '../frontend/src/server/mcp/generation-result-app';
import * as presentGenerationModule from '../frontend/src/server/mcp/tools/present-generation';
import {
  createMaxVideoAiMcpServer,
  type MaxVideoAiMcpServices,
} from '../frontend/src/server/mcp/server';

const TEMPLATE_URI = 'ui://maxvideoai/generation-result-v2.html';

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
    async createGenerationDownload() {
      return {
        url: 'https://videohub-uploads-us.s3.amazonaws.com/signed/completed-video.mp4?signature=valid',
        filename: 'maxvideoai-completed-video-job.mp4',
        expiresAt: '2026-08-27T10:00:00.000Z',
      };
    },
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
  assert.match(html, /request\(['"]ui\/initialize['"]/);
  assert.match(html, /appInfo:\s*\{[^}]*name:\s*['"]MaxVideoAI generation result['"]/s);
  assert.match(html, /appCapabilities:\s*\{[^}]*availableDisplayModes:\s*\[['"]inline['"]\]/s);
  assert.match(html, /protocolVersion:\s*['"]2026-01-26['"]/);
  assert.match(html, /ui\/notifications\/initialized/);
  assert.match(html, /ui\/notifications\/size-changed/);
  assert.match(html, /new ResizeObserver\(/);
  assert.match(html, /ui\/notifications\/tool-result/);
  assert.match(html, /ui\/open-link/);
  assert.match(html, /<button\b[^>]*id=["']download["'][^>]*>Download<\/button>/is);
  assert.match(html, /buildResultLibraryUrl\(libraryUrl,\s*result\?\.jobId,\s*result\?\.surface\)/);
  assert.match(html, /searchParams\.set\(['"]view['"],\s*['"]review['"]\)/);
  assert.match(html, /searchParams\.set\(['"]kind['"],\s*resultSurface\)/);
  assert.match(html, /searchParams\.set\(['"]job['"],\s*jobId\)/);
  assert.match(html, /const download\s*=\s*record\(result\?\.download\)/);
  assert.match(html, /downloadButton\.addEventListener\(['"]click['"]/);
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
  assert.deepEqual(result.structuredContent?.download, {
    url: 'https://videohub-uploads-us.s3.amazonaws.com/signed/completed-video.mp4?signature=valid',
    filename: 'maxvideoai-completed-video-job.mp4',
    expiresAt: '2026-08-27T10:00:00.000Z',
  });
  assert.equal(result.content.filter((block) => block.type === 'resource_link').length, 3);
  assert.doesNotMatch(JSON.stringify(result), /prompt|provider_job|storage key|wallet balance/i);
});

test('generation presenter opens the targeted recent render and downloads without an external handoff', async () => {
  const externalOpens: Array<{ href: string; redirectUrl: boolean }> = [];
  const nativeDownloads: Array<{ href: string; filename: string }> = [];
  const toolOutput = {
    ...buildAgentGenerationRecovery(completedVideoStatus(), 'https://maxvideoai-mcp-staging.vercel.app/account/connections'),
    download: {
      url: 'https://videohub-uploads-us.s3.amazonaws.com/signed/completed-video.mp4?signature=valid',
      filename: 'maxvideoai-completed-video-job.mp4',
      expiresAt: '2026-08-27T10:00:00.000Z',
    },
  };
  const dom = new JSDOM(buildGenerationResultAppHtml(), {
    runScripts: 'dangerously',
    url: 'https://web-sandbox.oaiusercontent.com/',
    beforeParse(window) {
      Object.defineProperty(window, 'openai', {
        configurable: true,
        value: {
          toolOutput,
          async openExternal(input: { href: string; redirectUrl: boolean }) {
            externalOpens.push(input);
          },
        },
      });
      Object.defineProperty(window.HTMLMediaElement.prototype, 'pause', { configurable: true, value() {} });
      Object.defineProperty(window.HTMLMediaElement.prototype, 'load', { configurable: true, value() {} });
      Object.defineProperty(window.HTMLAnchorElement.prototype, 'click', {
        configurable: true,
        value(this: HTMLAnchorElement) {
          nativeDownloads.push({ href: this.href, filename: this.download });
        },
      });
    },
  });

  const openButton = dom.window.document.getElementById('open') as HTMLButtonElement;
  const downloadButton = dom.window.document.getElementById('download') as HTMLButtonElement;
  assert.equal(openButton.disabled, false);
  assert.equal(downloadButton.disabled, false);

  openButton.click();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(externalOpens.length, 1);
  assert.equal(
    externalOpens[0]?.href,
    'https://maxvideoai-mcp-staging.vercel.app/app/library?view=review&kind=video&job=completed-video-job',
  );
  assert.equal(externalOpens[0]?.redirectUrl, false);

  downloadButton.click();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(nativeDownloads, [{
    href: 'https://videohub-uploads-us.s3.amazonaws.com/signed/completed-video.mp4?signature=valid',
    filename: 'maxvideoai-completed-video-job.mp4',
  }]);
  assert.equal(externalOpens.length, 1);
  dom.window.close();
});

test('generation presenter signs the durable output as an attachment', async () => {
  const createDescriptor = (presentGenerationModule as unknown as Record<string, unknown>)[
    'createGenerationDownloadDescriptor'
  ];
  assert.equal(typeof createDescriptor, 'function');
  if (typeof createDescriptor !== 'function') return;

  const calls: Array<{ key: string; expiresInSeconds: number; downloadFilename?: string }> = [];
  const descriptor = await (createDescriptor as (
    recovery: ReturnType<typeof buildAgentGenerationRecovery>,
    dependencies: Record<string, unknown>,
  ) => Promise<unknown>)(
    buildAgentGenerationRecovery(completedVideoStatus()),
    {
      now: () => new Date('2026-08-27T09:00:00.000Z'),
      extractStorageKeyFromUrl: () => 'mcp-render-staging/videos/owner/completed-video.mp4',
      createSignedDownloadUrl: async (
        key: string,
        options: { expiresInSeconds: number; downloadFilename?: string },
      ) => {
        calls.push({ key, ...options });
        return 'https://videohub-uploads-us.s3.amazonaws.com/signed/completed-video.mp4?signature=valid';
      },
    },
  );

  assert.deepEqual(calls, [{
    key: 'mcp-render-staging/videos/owner/completed-video.mp4',
    expiresInSeconds: 3600,
    downloadFilename: 'maxvideoai-completed-video-job.mp4',
  }]);
  assert.deepEqual(descriptor, {
    url: 'https://videohub-uploads-us.s3.amazonaws.com/signed/completed-video.mp4?signature=valid',
    filename: 'maxvideoai-completed-video-job.mp4',
    expiresAt: '2026-08-27T10:00:00.000Z',
  });
});
