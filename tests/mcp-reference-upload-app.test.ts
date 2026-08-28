import assert from 'node:assert/strict';
import test from 'node:test';
import { Script } from 'node:vm';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import type { AgentPrincipal } from '../frontend/src/server/agent-api/principal';
import {
  createMaxVideoAiMcpServer,
  type MaxVideoAiMcpServices,
} from '../frontend/src/server/mcp/server';

const APP_URI = 'ui://maxvideoai/reference-upload-v1.html';
const token = `mru_${'U'.repeat(43)}`;
const principal: AgentPrincipal = {
  userId: 'reference-app-owner',
  clientId: 'claude-connector',
  emailVerified: true,
  authMethod: 'oauth',
};

function services(): MaxVideoAiMcpServices {
  return {
    async getAccountStatus() { throw new Error('unused'); },
    async listModels() { return []; },
    async getModelDetails() { throw new Error('unused'); },
    async recommendModels() { return { recommendations: [], nextAction: 'clarify_requirements' }; },
    async listMedia() { return { items: [], nextCursor: null, hasMore: false }; },
    async importReferenceFiles() {
      return {
        assets: [],
        failures: [],
        library: {
          type: 'open_url',
          purpose: 'media_library',
          label: 'Open the MaxVideoAI media library',
          url: 'https://maxvideoai.com/app/library',
        },
      };
    },
    async createReferenceUploadLink(input) {
      return {
        destination: {
          type: 'open_url',
          purpose: 'reference_upload',
          label: `Upload private ${input.kind} references to MaxVideoAI`,
          url: `https://maxvideoai.com/mcp/reference-upload/${token}`,
        },
        expiresAt: '2026-08-28T12:15:00.000Z',
        mediaKind: input.kind,
        accepted: input.kind === 'image' ? ['image/png'] : [`${input.kind}/mp4`],
        maxBytes: 25 * 1024 * 1024,
        library: {
          type: 'open_url',
          purpose: 'media_library',
          label: 'Open the MaxVideoAI media library',
          url: 'https://maxvideoai.com/app/library',
        },
        nextAction: { tool: 'list_media', arguments: { kind: input.kind } },
      };
    },
  };
}

test('reference handoff renders a portable multi-file MCP App that reports imported asset IDs to the host', async (t) => {
  const server = createMaxVideoAiMcpServer(principal, services(), {
    paidGeneration: false,
    referenceUploads: true,
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'reference-upload-app-contract', version: '1.0.0' });
  await client.connect(clientTransport);
  t.after(async () => {
    await client.close();
    await server.close();
  });

  const tools = await client.listTools();
  const handoff = tools.tools.find(({ name }) => name === 'create_reference_upload_link');
  assert.ok(handoff);
  assert.equal((handoff._meta?.ui as { resourceUri?: string } | undefined)?.resourceUri, APP_URI);
  assert.equal(handoff._meta?.['ui/resourceUri'], APP_URI);
  assert.equal(handoff._meta?.['openai/outputTemplate'], APP_URI);

  const resources = await client.listResources();
  assert.ok(resources.resources.some(({ uri }) => uri === APP_URI));
  const result = await client.readResource({ uri: APP_URI });
  const content = result.contents[0];
  assert.equal(content?.mimeType, 'text/html;profile=mcp-app');
  const html = content?.text ?? '';
  assert.match(html, /<input\b[^>]*type=["']file["'][^>]*multiple/is);
  assert.match(html, /files\.length\s*>\s*8/);
  assert.match(html, /\/start/);
  assert.match(html, /\/part/);
  assert.match(html, /\/complete/);
  assert.match(html, /Authorization['"]?\s*:\s*['"]Bearer /);
  assert.match(html, /name:\s*['"]create_reference_upload_link['"]/);
  assert.match(html, /ui\/update-model-context/);
  assert.match(html, /assetId/);
  assert.match(html, /ui\/notifications\/tool-result/);
  assert.match(html, /trustedOrigins\.has\(parsed\.origin\)/);
  assert.match(html, /failures\.push\(\{ index, fileName: file\.name \}\)/);
  assert.match(html, /if \(assets\.length > 0\)/);
  assert.match(html, /Select only those files to retry/);
  assert.ok(
    html.indexOf('file.size > currentHandoff.maxBytes') < html.indexOf('file.arrayBuffer()'),
    'the MCP App must reject oversized files before allocating their bytes',
  );
  assert.doesNotMatch(html, /eval\(|new Function\(|document\.write\(/);
  const script = html.match(/<script>([\s\S]*?)<\/script>/u)?.[1];
  assert.ok(script);
  assert.doesNotThrow(() => new Script(script), 'the embedded MCP App JavaScript must parse');

  const ui = content?._meta?.ui as {
    csp?: { connectDomains?: string[] };
  } | undefined;
  assert.ok(ui?.csp?.connectDomains?.includes('https://maxvideoai.com'));
  assert.ok(ui?.csp?.connectDomains?.includes('https://maxvideoai-mcp-staging.vercel.app'));
  assert.ok(ui?.csp?.connectDomains?.every((origin) => !origin.includes('*')));
});
