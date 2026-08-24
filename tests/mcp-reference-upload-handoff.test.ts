import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { NextRequest } from 'next/server';

import type { TransactionQueryExecutor } from '../frontend/src/lib/db';
import { AgentApiError } from '../frontend/src/server/agent-api/errors';
import type { AgentPrincipal } from '../frontend/src/server/agent-api/principal';
import { createReferenceUploadLinkService } from '../frontend/src/server/agent-api/create-reference-upload-link';
import { createMaxVideoAiMcpServer, type MaxVideoAiMcpServices } from '../frontend/src/server/mcp/server';
import { ImageUploadError } from '../frontend/src/server/uploads/store-image-upload';
import { createReferenceUploadPostHandler } from '../frontend/src/server/uploads/create-reference-upload-post-handler';

const principal: AgentPrincipal = {
  userId: 'user-a',
  clientId: 'claude-client',
  emailVerified: true,
  authMethod: 'oauth',
};
const token = `mru_${'C'.repeat(43)}`;
const expiresAt = new Date('2026-08-24T10:15:00.000Z');
const session = {
  sessionId: '00000000-0000-4000-8000-000000000032',
  userId: 'user-a',
  oauthClientId: 'claude-client',
  state: 'created' as const,
  claimId: null,
  assetId: null,
  expiresAt,
  claimedAt: null,
  uploadedAt: null,
  createdAt: new Date('2026-08-24T10:00:00.000Z'),
  updatedAt: new Date('2026-08-24T10:00:00.000Z'),
};

test('link service creates one private 15-minute browser handoff for the OAuth principal', async () => {
  const createLink = createReferenceUploadLinkService({
    baseUrl: 'https://maxvideoai.com/account/connections',
    createUploadSession: async (input) => {
      assert.deepEqual(input, { userId: 'user-a', oauthClientId: 'claude-client' });
      return { token, session };
    },
  });

  assert.deepEqual(await createLink(principal), {
    uploadUrl: `https://maxvideoai.com/mcp/reference-upload/${token}`,
    expiresAt: expiresAt.toISOString(),
    accepted: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
    maxBytes: 26_214_400,
    nextAction: 'Open the URL, upload one image, then call list_media.',
  });
});

test('create_reference_upload_link is gated, strict, non-destructive, and open-world', async (t) => {
  const expected = {
    uploadUrl: `https://maxvideoai.com/mcp/reference-upload/${token}`,
    expiresAt: expiresAt.toISOString(),
    accepted: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
    maxBytes: 26_214_400,
    nextAction: 'Open the URL, upload one image, then call list_media.',
  };
  const services: MaxVideoAiMcpServices = {
    async getAccountStatus() { throw new Error('unused'); },
    async listModels() { return []; },
    async recommendModels() { return { recommendations: [], nextAction: 'clarify_requirements' }; },
    async listMedia() { return { items: [], nextCursor: null, hasMore: false }; },
    async createReferenceUploadLink(receivedPrincipal) {
      assert.equal(receivedPrincipal, principal);
      return expected;
    },
  };
  const server = createMaxVideoAiMcpServer(principal, services, { referenceUploads: true });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'reference-upload-contract', version: '1.0.0' });
  await client.connect(clientTransport);
  t.after(async () => {
    await client.close();
    await server.close();
  });

  const tool = (await client.listTools()).tools.find((candidate) => candidate.name === 'create_reference_upload_link');
  assert.ok(tool);
  assert.equal(tool.inputSchema.type, 'object');
  assert.deepEqual(tool.inputSchema.properties, {});
  assert.equal(tool.inputSchema.additionalProperties, false);
  assert.equal(tool.annotations?.readOnlyHint, false);
  assert.equal(tool.annotations?.destructiveHint, false);
  assert.equal(tool.annotations?.openWorldHint, true);
  const result = await client.callTool({ name: 'create_reference_upload_link', arguments: {} });
  assert.deepEqual(result.structuredContent, expected);
});

function uploadRequest(overrides: { contentLength?: number; origin?: string } = {}): NextRequest {
  const form = new FormData();
  form.set('file', new File([new Uint8Array([1, 2, 3])], 'reference.png', { type: 'image/png' }));
  const request = new NextRequest(`https://maxvideoai.com/api/mcp/reference-upload/${token}`, {
    method: 'POST',
    headers: {
      origin: overrides.origin ?? 'https://maxvideoai.com',
      ...(overrides.contentLength === undefined ? {} : { 'content-length': String(overrides.contentLength) }),
    },
    body: form,
  });
  return request;
}

test('browser handoff authenticates, claims once, stores, binds, and returns private noindex output', async () => {
  const events: string[] = [];
  const executor = { async query<T>() { return [] as T[]; } } as TransactionQueryExecutor;
  const handler = createReferenceUploadPostHandler({
    isEnabled: () => true,
    isSameOriginRequest: () => true,
    async getRouteAuthContext() {
      events.push('auth');
      return { userId: 'user-a' } as never;
    },
    async withTransaction(callback) {
      events.push('transaction');
      return callback(executor);
    },
    async claimUploadSessionForUpload(input) {
      events.push('claim');
      assert.deepEqual(input, { token, userId: 'user-a' });
      return { ...session, claimId: '00000000-0000-4000-8000-000000000033', claimedAt: session.createdAt };
    },
    async storeImageUpload(input) {
      events.push('store');
      assert.equal(input.userId, 'user-a');
      assert.equal(input.fileName, 'reference.png');
      return {
        assetId: 'asset-image-1', width: 100, height: 100,
        mimeType: 'image/png', sizeBytes: 3, previewUrl: null,
      };
    },
    async completeUploadSession(input) {
      events.push('complete');
      assert.equal(input.assetId, 'asset-image-1');
      return { ...session, state: 'uploaded', assetId: 'asset-image-1' } as never;
    },
    async releaseUploadSessionClaim() {
      events.push('release');
      return null;
    },
  });

  const response = await handler(uploadRequest(), { params: Promise.resolve({ token }) });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, assetId: 'asset-image-1' });
  assert.deepEqual(events, ['auth', 'transaction', 'claim', 'store', 'transaction', 'complete']);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
});

test('browser handoff rejects cross-origin, oversized, expired, and replayed requests before storage', async () => {
  let authCalls = 0;
  let storeCalls = 0;
  const executor = { async query<T>() { return [] as T[]; } } as TransactionQueryExecutor;
  const base = {
    isEnabled: () => true,
    isSameOriginRequest: () => true,
    async getRouteAuthContext() { authCalls += 1; return { userId: 'user-a' } as never; },
    async withTransaction<T>(callback: (tx: TransactionQueryExecutor) => Promise<T>) { return callback(executor); },
    async storeImageUpload() { storeCalls += 1; throw new Error('must not store'); },
    async completeUploadSession() { throw new Error('must not complete'); },
    async releaseUploadSessionClaim() { return null; },
  };

  const crossOrigin = createReferenceUploadPostHandler({ ...base, isSameOriginRequest: () => false });
  assert.equal((await crossOrigin(uploadRequest({ origin: 'https://evil.example' }), { params: Promise.resolve({ token }) })).status, 403);
  assert.equal(authCalls, 0);

  const oversized = createReferenceUploadPostHandler({
    ...base,
    async claimUploadSessionForUpload() { throw new Error('must not claim'); },
  });
  assert.equal((await oversized(uploadRequest({ contentLength: 26_214_401 }), { params: Promise.resolve({ token }) })).status, 413);

  for (const [code, status] of [['UPLOAD_EXPIRED', 410], ['UPLOAD_ALREADY_USED', 409]] as const) {
    const handler = createReferenceUploadPostHandler({
      ...base,
      async claimUploadSessionForUpload() { throw new AgentApiError(code, 'safe'); },
    });
    assert.equal((await handler(uploadRequest(), { params: Promise.resolve({ token }) })).status, status);
  }
  assert.equal(storeCalls, 0);
});

test('known image failures safely release the exact claim for retry without leaking details', async () => {
  let releasedClaim: string | null = null;
  const executor = { async query<T>() { return [] as T[]; } } as TransactionQueryExecutor;
  const handler = createReferenceUploadPostHandler({
    isEnabled: () => true,
    isSameOriginRequest: () => true,
    async getRouteAuthContext() { return { userId: 'user-a' } as never; },
    async withTransaction<T>(callback: (tx: TransactionQueryExecutor) => Promise<T>) { return callback(executor); },
    async claimUploadSessionForUpload() {
      return { ...session, claimId: '00000000-0000-4000-8000-000000000033', claimedAt: session.createdAt };
    },
    async storeImageUpload() { throw new ImageUploadError('UNSUPPORTED_TYPE', 'secret decoder detail'); },
    async completeUploadSession() { throw new Error('must not complete'); },
    async releaseUploadSessionClaim(input) { releasedClaim = input.claimId; return session; },
  });

  const response = await handler(uploadRequest(), { params: Promise.resolve({ token }) });
  assert.equal(response.status, 415);
  assert.equal(releasedClaim, '00000000-0000-4000-8000-000000000033');
  assert.doesNotMatch(await response.text(), /secret decoder detail/i);
});

test('private upload page has login return, noindex metadata, private cache, and restrictive headers', () => {
  const page = readFileSync('frontend/app/(core)/mcp/reference-upload/[token]/page.tsx', 'utf8');
  const nextConfig = readFileSync('frontend/next.config.js', 'utf8');
  assert.match(page, /robots:\s*\{\s*index:\s*false,\s*follow:\s*false/i);
  assert.match(page, /\/login\?next=/i);
  assert.match(page, /getOwnedUploadSession/);
  assert.match(nextConfig, /\/mcp\/reference-upload\/:path\*/);
  assert.match(nextConfig, /X-Robots-Tag[\s\S]*noindex, nofollow/i);
  assert.match(nextConfig, /Cache-Control[\s\S]*private, no-store/i);
  assert.match(nextConfig, /Content-Security-Policy/i);
  assert.match(nextConfig, /frame-ancestors 'none'/i);
});
