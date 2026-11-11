import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { webcrypto } from 'node:crypto';
import test from 'node:test';
import { Script } from 'node:vm';

import { JSDOM } from 'jsdom';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { createReferenceUploadLinkService } from '../frontend/src/server/agent-api/create-reference-upload-link';
import { resolveMcpRequestConfig } from '../frontend/src/server/mcp/config';

import type { AgentPrincipal } from '../frontend/src/server/agent-api/principal';
import {
  createMaxVideoAiMcpServer,
  type MaxVideoAiMcpServices,
} from '../frontend/src/server/mcp/server';

const APP_URI = 'ui://maxvideoai/reference-upload-v3.html';
const V2_APP_URI = 'ui://maxvideoai/reference-upload-v2.html';
const LEGACY_APP_URI = 'ui://maxvideoai/reference-upload-v1.html';
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
  assert.ok(resources.resources.some(({ uri }) => uri === LEGACY_APP_URI));
  assert.ok(resources.resources.some(({ uri }) => uri === V2_APP_URI));
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
  assert.ok(ui?.csp?.connectDomains?.includes('https://openai-review.maxvideoai.com'));
  assert.ok(ui?.csp?.connectDomains?.every((origin) => !origin.includes('*')));

  const legacyResult = await client.readResource({ uri: LEGACY_APP_URI });
  const legacyHtml = legacyResult.contents[0]?.text ?? '';
  assert.equal(
    createHash('sha256').update(legacyHtml).digest('hex'),
    '0cd9c3fc86bd50bc662cfacb6cb8c9c52b993c3ad59469cc7878998745ce1131',
    'v1 must retain the rendered origin/main widget bytes',
  );
  assert.match(legacyHtml, /<input\b[^>]*type=["']file["'][^>]*multiple/is);
  assert.doesNotMatch(legacyHtml, /uploadInProgress/);
  assert.doesNotMatch(legacyHtml, /importedAssets/);
  const legacyScript = legacyHtml.match(/<script>([\s\S]*?)<\/script>/u)?.[1];
  assert.ok(legacyScript);
  assert.doesNotThrow(() => new Script(legacyScript), 'the frozen v1 MCP App JavaScript must parse');
  assert.notEqual(legacyHtml, html, 'the v1 cache key must retain its pre-v2 document');
});

test('reference handoff requests a fresh capability when retrying a failed later file', async () => {
  const { buildReferenceUploadAppHtml } = await import('../frontend/src/server/mcp/reference-upload-app');
  const html = buildReferenceUploadAppHtml();
  const handoff = (tokenValue: string) => ({
    destination: {
      type: 'open_url',
      purpose: 'reference_upload',
      label: 'Upload private image references to MaxVideoAI',
      url: `https://maxvideoai.com/mcp/reference-upload/${tokenValue}`,
    },
    expiresAt: '2026-08-28T12:15:00.000Z',
    mediaKind: 'image',
    accepted: ['image/png'],
    maxBytes: 25 * 1024 * 1024,
  });
  const toolCalls: string[] = [];
  const issuedTokens: string[] = [];
  const starts: string[] = [];
  const parts: string[] = [];
  const completes: string[] = [];
  const modelContexts: string[] = [];
  const usedTokens = new Set<string>();
  let tokenNumber = 1;
  const parent = {
    postMessage(message: { id?: number; method?: string; params?: { name?: string; content?: Array<{ text?: string }> } }) {
      let result = {};
      if (message.method === 'tools/call') {
        toolCalls.push(message.params?.name ?? '');
        if (message.params?.name === 'create_reference_upload_link') {
          const tokenValue = `mru_${String(tokenNumber++).padStart(43, '0')}`;
          issuedTokens.push(tokenValue);
          result = { structuredContent: handoff(tokenValue) };
        }
      } else if (message.method === 'ui/update-model-context') {
        modelContexts.push(message.params?.content?.[0]?.text ?? '');
      }
      queueMicrotask(() => {
        dom.window.dispatchEvent(new dom.window.MessageEvent('message', {
          source: parent,
          data: { jsonrpc: '2.0', id: message.id, result },
        }));
      });
    },
  };
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    url: 'https://maxvideoai.com/mcp/reference-upload/mru_initial',
    beforeParse(window) {
      Object.defineProperty(window, 'parent', { configurable: true, value: parent });
      Object.defineProperty(window, 'openai', { configurable: true, value: { toolOutput: handoff(`mru_${'0'.repeat(43)}`) } });
      Object.defineProperty(window, 'crypto', { configurable: true, value: webcrypto });
      Object.defineProperty(window, 'Response', { configurable: true, value: Response });
      Object.defineProperty(window, 'Headers', { configurable: true, value: Headers });
      window.fetch = async (request) => {
        const url = typeof request === 'string' ? request : request.url;
        const tokenValue = url.match(/\/(mru_[A-Za-z0-9_-]{43})\//u)?.[1] ?? '';
        if (url.endsWith('/start')) {
          if (usedTokens.has(tokenValue)) return new Response(JSON.stringify({ ok: false, error: 'UPLOAD_ALREADY_USED' }), { status: 409 });
          usedTokens.add(tokenValue);
          starts.push(tokenValue);
          return new Response(JSON.stringify({ ok: true, uploadId: `upload-${tokenValue}`, totalParts: 1, chunkBytes: 10 }), { status: 200 });
        }
        if (url.endsWith('/part')) {
          parts.push(tokenValue);
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }
        if (url.endsWith('/complete')) {
          completes.push(tokenValue);
          if (tokenValue.endsWith('1')) return new Response(JSON.stringify({ ok: false, error: 'STORE_FAILED' }), { status: 500 });
          return new Response(JSON.stringify({ ok: true, assetId: `ma_${tokenValue.slice(-1).repeat(32)}`, mediaKind: 'image' }), { status: 200 });
        }
        throw new Error(`Unexpected fetch URL: ${url}`);
      };
    },
  });
  const input = dom.window.document.getElementById('files') as HTMLInputElement;
  const upload = dom.window.document.getElementById('upload') as HTMLButtonElement;
  const makeFile = (name: string, content: string) => {
    const bytes = new TextEncoder().encode(content);
    return {
      name,
      type: 'image/png',
      size: bytes.length,
      arrayBuffer: async () => bytes.buffer,
      slice: () => ({ arrayBuffer: async () => bytes.buffer }),
    } as unknown as File;
  };
  const fileOne = makeFile('one.png', 'one');
  const fileTwo = makeFile('two.png', 'two');
  const choose = (files: File[]) => {
    Object.defineProperty(input, 'files', { configurable: true, value: files });
    input.dispatchEvent(new dom.window.Event('change'));
  };
  const waitFor = async (predicate: () => boolean) => {
    for (let attempt = 0; attempt < 100 && !predicate(); attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    assert.equal(predicate(), true, 'MCP App did not reach the expected state');
  };

  choose([fileOne, fileTwo]);
  upload.click();
  upload.dispatchEvent(new dom.window.Event('click'));
  choose([fileTwo]);
  await waitFor(() => !upload.disabled);
  assert.deepEqual(starts, [
    `mru_${'0'.repeat(43)}`,
    `mru_${'0'.repeat(42)}1`,
  ]);
  assert.deepEqual(completes, [
    `mru_${'0'.repeat(43)}`,
    `mru_${'0'.repeat(42)}1`,
  ]);
  assert.deepEqual(modelContexts, ['Private MaxVideoAI references imported and ready:\n- one.png: ma_00000000000000000000000000000000 (image)']);
  assert.equal(dom.window.document.getElementById('results')?.textContent, 'one.png — readytwo.png — failed');
  assert.match(dom.window.document.getElementById('error')?.textContent ?? '', /1 file\(s\) failed/);
  assert.equal(dom.window.document.getElementById('selection')?.textContent, '1 reference(s) ready');

  choose([fileTwo]);
  upload.click();
  await waitFor(() => toolCalls.filter((name) => name === 'create_reference_upload_link').length >= 2);
  await waitFor(() => !upload.disabled);

  assert.equal(toolCalls.filter((name) => name === 'create_reference_upload_link').length, 2);
  assert.notEqual(issuedTokens[0], issuedTokens[1], 'retrying a failed file must request a fresh upload capability');
  assert.deepEqual(starts, [
    `mru_${'0'.repeat(43)}`,
    `mru_${'0'.repeat(42)}1`,
    `mru_${'0'.repeat(42)}2`,
  ]);
  assert.deepEqual(parts, starts);
  assert.deepEqual(completes, starts);
  assert.deepEqual(modelContexts, [
    'Private MaxVideoAI references imported and ready:\n- one.png: ma_00000000000000000000000000000000 (image)',
    'Private MaxVideoAI references imported and ready:\n- one.png: ma_00000000000000000000000000000000 (image)\n- two.png: ma_22222222222222222222222222222222 (image)',
  ]);
  assert.equal(dom.window.document.getElementById('results')?.textContent, 'two.png — ready');
  assert.equal(dom.window.document.getElementById('error')?.textContent, '');
  assert.equal(dom.window.document.getElementById('selection')?.textContent, '1 reference(s) ready');
  dom.window.close();
});

test('the directory advertises a new widget with exact review-origin CSP and keeps v2 bytes readable', async (t) => {
  const server = createMaxVideoAiMcpServer(principal, services(), {
    paidGeneration: false,
    referenceUploads: true,
    distributionProfile: 'openai-directory',
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'review-widget', version: '1' });
  await client.connect(clientTransport);
  t.after(async () => { await client.close(); await server.close(); });

  const tools = await client.listTools();
  assert.equal(tools.tools.find((tool) => tool.name === 'create_reference_upload_link')?._meta?.['openai/outputTemplate'], APP_URI);
  const resources = await client.listResources();
  const declaredCsp = resources.resources.find((resource) => resource.uri === APP_URI)?._meta?.ui as { csp: { connectDomains: string[] } };
  const current = (await client.readResource({ uri: APP_URI })).contents[0];
  const ui = current._meta?.ui as { csp: { connectDomains: string[] } };
  assert.ok(ui.csp.connectDomains.includes('https://openai-review.maxvideoai.com'));
  assert.deepEqual(declaredCsp.csp, ui.csp);
  assert.deepEqual((current._meta?.['openai/widgetCSP'] as { connect_domains: string[] }).connect_domains, ui.csp.connectDomains);
  assert.ok(ui.csp.connectDomains.every((origin) => !origin.includes('*')));

  const old = (await client.readResource({ uri: V2_APP_URI })).contents[0];
  assert.equal(createHash('sha256').update(old.text ?? '').digest('hex'), '64bae6da32d126fa68ddcb2637e4d42fedbe18cf448604e880f05261656db050');
  assert.deepEqual((old._meta?.ui as { csp: { connectDomains: string[] } }).csp.connectDomains, [
    'https://maxvideoai.com', 'https://api.maxvideoai.com', 'https://maxvideoai-mcp-staging.vercel.app',
  ]);
});

test('the actual import widget uploads to the dedicated handoff and rejects foreign destinations', async (t) => {
  const { buildReferenceUploadAppHtml } = await import('../frontend/src/server/mcp/reference-upload-app');
  const config = resolveMcpRequestConfig('openai-mcp.maxvideoai.com', {
    NODE_ENV: 'production',
    MCP_OPENAI_DIRECTORY_ENABLED: 'true',
    MCP_OPENAI_DIRECTORY_DEPLOYMENT_PROFILE: 'dedicated-qualification',
    MCP_API_HOST: 'openai-review.maxvideoai.com',
    MCP_RESOURCE_URL: 'https://openai-review.maxvideoai.com/mcp',
  });
  assert.ok(config);
  const now = new Date('2026-10-07T12:00:00.000Z');
  const createLink = createReferenceUploadLinkService({
    baseUrl: config.accountUrl,
    async createUploadSession(input) {
      return {
        token,
        session: {
          sessionId: 'review-session', ...input, state: 'created', claimId: null, assetId: null,
          expiresAt: new Date('2026-10-07T12:15:00.000Z'), claimedAt: null, uploadedAt: null,
          createdAt: now, updatedAt: now,
        },
      };
    },
  });
  const dedicatedHandoff = await createLink({ kind: 'image' }, principal);
  const reviewOrigin = new URL(dedicatedHandoff.destination.url).origin;
  assert.equal(reviewOrigin, 'https://openai-review.maxvideoai.com');

  for (const origin of [
    reviewOrigin, 'https://maxvideoai.com',
    'https://openai-review.maxvideoai.com.attacker.test',
    'https://openai-review.maxvideoai.com:444', 'http://openai-review.maxvideoai.com',
  ]) {
    await t.test(origin, async () => {
      const allowed = origin === reviewOrigin || origin === 'https://maxvideoai.com';
      const requests: Array<{ url: string; authorization: string | null }> = [];
      const contexts: string[] = [];
      const handoff = {
        ...dedicatedHandoff,
        destination: { ...dedicatedHandoff.destination, url: `${origin}/mcp/reference-upload/${token}` },
      };
      let dom: JSDOM;
      const parent = {
        postMessage(message: { id?: number; method?: string; params?: { content?: Array<{ text: string }> } }) {
          if (message.method === 'ui/update-model-context') contexts.push(message.params?.content?.[0]?.text ?? '');
          if (message.id !== undefined) {
            queueMicrotask(() => dom.window.dispatchEvent(new dom.window.MessageEvent('message', {
              source: parent, data: { jsonrpc: '2.0', id: message.id, result: {} },
            })));
          }
        },
      };
      dom = new JSDOM(buildReferenceUploadAppHtml(), {
        runScripts: 'dangerously', url: 'https://widget.example',
        beforeParse(window) {
          Object.defineProperty(window, 'parent', { configurable: true, value: parent });
          Object.defineProperty(window, 'openai', { configurable: true, value: { toolOutput: handoff } });
          Object.defineProperty(window, 'crypto', { configurable: true, value: webcrypto });
          window.fetch = async (input, init) => {
            const url = String(input);
            requests.push({ url, authorization: new Headers(init?.headers).get('authorization') });
            if (url.endsWith('/start')) return Response.json({ ok: true, uploadId: 'review-upload', totalParts: 1, chunkBytes: 4 });
            if (url.endsWith('/part')) return Response.json({ ok: true });
            if (url.endsWith('/complete')) return Response.json({ ok: true, assetId: `ma_${'a'.repeat(32)}`, mediaKind: 'image' });
            throw new Error('Unexpected upload path');
          };
        },
      });
      try {
        const bytes = new TextEncoder().encode('test');
        const file = {
          name: 'reference.png', type: 'image/png', size: 4,
          arrayBuffer: async () => bytes.buffer, slice: () => ({ arrayBuffer: async () => bytes.buffer }),
        };
        const input = dom.window.document.getElementById('files') as HTMLInputElement;
        Object.defineProperty(input, 'files', { configurable: true, value: [file] });
        input.dispatchEvent(new dom.window.Event('change'));
        (dom.window.document.getElementById('upload') as HTMLButtonElement).click();
        for (let attempt = 0; attempt < 100 && (allowed ? contexts.length === 0 : !dom.window.document.getElementById('error')?.textContent); attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
        if (allowed) {
          assert.deepEqual(requests.map((request) => request.url), ['start', 'part', 'complete'].map((stage) => `${origin}/api/mcp/reference-upload/${token}/${stage}`));
          assert.ok(requests.every((request) => request.authorization === `Bearer ${token}`));
          assert.deepEqual(contexts, [`Private MaxVideoAI references imported and ready:\n- reference.png: ma_${'a'.repeat(32)} (image)`]);
        } else {
          assert.deepEqual(requests, []);
          assert.deepEqual(contexts, []);
          assert.match(dom.window.document.getElementById('error')?.textContent ?? '', /file\(s\) failed/);
        }
      } finally { dom.window.close(); }
    });
  }
});
