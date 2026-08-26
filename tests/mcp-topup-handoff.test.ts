import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import type { TransactionQueryExecutor } from '../frontend/src/lib/db';
import { AgentApiError } from '../frontend/src/server/agent-api/errors';
import type { AgentPrincipal } from '../frontend/src/server/agent-api/principal';
import type { McpGenerationQuote } from '../frontend/src/server/agent-api/quote-repository';
import {
  createMcpTopupHandoff,
  createMcpTopupHandoffService,
  resolveMcpTopupBillingIntent,
  signMcpTopupHandoff,
  verifyMcpTopupHandoff,
  type McpTopupHandoffDependencies,
} from '../frontend/src/server/agent-api/topup-handoff';
import {
  createMaxVideoAiMcpServer,
  type MaxVideoAiMcpServices,
} from '../frontend/src/server/mcp/server';

const QUOTE_ID = '123e4567-e89b-42d3-a456-426614174000';
const INTENT_ID = '123e4567-e89b-42d3-a456-426614174001';
const SECRET = '0123456789abcdef0123456789abcdef';
const NOW = new Date('2026-07-16T12:00:00.000Z');
const principal: AgentPrincipal = {
  userId: 'owner-user',
  clientId: 'codex-client',
  emailVerified: true,
  authMethod: 'oauth',
};

function quote(overrides: Partial<McpGenerationQuote> = {}): McpGenerationQuote {
  return {
    quoteId: QUOTE_ID,
    userId: principal.userId,
    oauthClientId: principal.clientId,
    request: {
      schemaVersion: 1,
      surface: 'video',
      engineId: 'seedance-2-0-mini',
      mode: 't2v',
      prompt: 'private prompt must never enter the handoff',
      settings: { durationSec: 5 },
      references: [],
      outputCount: 1,
    },
    requestHash: 'a'.repeat(64),
    catalogRevision: 'catalog-v2',
    pricingSnapshot: { private: 'snapshot' },
    priceCents: 1750,
    currency: 'USD',
    fundingMode: 'wallet',
    trialFunding: null,
    state: 'prepared',
    jobId: null,
    expiresAt: new Date('2026-07-16T12:10:00.000Z'),
    claimedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function dependencies(
  overrides: Partial<McpTopupHandoffDependencies> = {},
): { deps: McpTopupHandoffDependencies; events: string[] } {
  const events: string[] = [];
  const executor = { async query() { throw new Error('inject P9 dependencies'); } } as TransactionQueryExecutor;
  const deps: McpTopupHandoffDependencies = {
    secret: SECRET,
    billingBaseUrl: 'https://maxvideoai.com',
    randomUUID: () => INTENT_ID,
    withTransaction: async (callback) => {
      events.push('transaction');
      return callback(executor);
    },
    lockOwnedQuote: async (owner, input) => {
      events.push('lock_quote');
      assert.deepEqual(owner, {
        quoteId: QUOTE_ID,
        userId: principal.userId,
        oauthClientId: principal.clientId,
      });
      assert.equal(input.executor, executor);
      return { quote: quote(), databaseNow: NOW };
    },
    getWalletSummary: async (userId, inputExecutor) => {
      events.push('wallet');
      assert.equal(userId, principal.userId);
      assert.equal(inputExecutor, executor);
      return { balanceCents: 250, currency: 'USD', pendingCents: 0, hasCompletedTopUp: true };
    },
    invalidatePreparedQuote: async (owner, input) => {
      events.push('invalidate_quote');
      assert.equal(input.executor, executor);
      assert.equal(input.expiredAt.getTime(), NOW.getTime());
      return quote({ state: 'expired', updatedAt: NOW });
    },
    ...overrides,
  };
  return { deps, events };
}

function payloadFromToken(token: string): Record<string, unknown> {
  const parts = token.split('.');
  assert.equal(parts.length, 3);
  assert.equal(parts[0], 'v1');
  return JSON.parse(Buffer.from(parts[1]!, 'base64url').toString('utf8')) as Record<string, unknown>;
}

function record(value: unknown): Record<string, unknown> {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value));
  return value as Record<string, unknown>;
}

const BASE64URL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function changeOnlyBase64urlPaddingBits(value: string): string {
  const remainder = value.length % 4;
  const unusedBits = remainder === 2 ? 4 : remainder === 3 ? 2 : 0;
  assert.ok(unusedBits > 0, 'fixture must end with unused base64url padding bits');
  const lastIndex = BASE64URL_ALPHABET.indexOf(value.at(-1) ?? '');
  assert.ok(lastIndex >= 0);
  const changedIndex = (lastIndex & ~((1 << unusedBits) - 1)) | 1;
  const changed = `${value.slice(0, -1)}${BASE64URL_ALPHABET[changedIndex]}`;
  assert.notEqual(changed, value);
  assert.deepEqual(Buffer.from(changed, 'base64url'), Buffer.from(value, 'base64url'));
  return changed;
}

test('top-up signer round-trips an explicit v1 token with exactly four business fields', () => {
  const value = {
    amountCents: 1500,
    currency: 'USD' as const,
    quoteIntentId: INTENT_ID,
    expiresAt: Math.floor(NOW.getTime() / 1000) + 600,
  };
  const token = signMcpTopupHandoff(value, { secret: SECRET });
  assert.deepEqual(Object.keys(payloadFromToken(token)), [
    'amountCents', 'currency', 'quoteIntentId', 'expiresAt',
  ]);
  assert.deepEqual(verifyMcpTopupHandoff(token, { secret: SECRET, now: NOW }), value);
  assert.doesNotMatch(
    Buffer.from(token.split('.')[1]!, 'base64url').toString('utf8'),
    /user|client|prompt|model|request|reference|acquisition|url|email|stripe/i,
  );
});

test('verification fails closed for tampering, expiry, overly-future values, wrong secret, and malformed input', () => {
  const expiresAt = Math.floor(NOW.getTime() / 1000) + 600;
  const valid = signMcpTopupHandoff(
    { amountCents: 1500, currency: 'USD', quoteIntentId: INTENT_ID, expiresAt },
    { secret: SECRET },
  );
  const [version, payload, signature] = valid.split('.');
  const cases: Array<[string, Parameters<typeof verifyMcpTopupHandoff>[1]]> = [
    [`${version}.${payload}.${signature?.slice(0, -1)}A`, { secret: SECRET, now: NOW }],
    [valid, { secret: 'fedcba9876543210fedcba9876543210', now: NOW }],
    [valid, { secret: SECRET, now: new Date((expiresAt + 1) * 1000) }],
    [signMcpTopupHandoff(
      { amountCents: 1500, currency: 'USD', quoteIntentId: INTENT_ID, expiresAt: expiresAt + 1 },
      { secret: SECRET },
    ), { secret: SECRET, now: NOW }],
    ['', { secret: SECRET, now: NOW }],
    [` ${valid}`, { secret: SECRET, now: NOW }],
    [`${valid}\u00a0`, { secret: SECRET, now: NOW }],
    [`v1.${'a'.repeat(5000)}.${signature}`, { secret: SECRET, now: NOW }],
    ['v1.💳.signature', { secret: SECRET, now: NOW }],
  ];
  for (const [token, options] of cases) {
    assert.equal(verifyMcpTopupHandoff(token, options), null, token.slice(0, 60));
  }
});

test('verification rejects textually distinct non-canonical base64url payloads and signatures', () => {
  const token = signMcpTopupHandoff({
    amountCents: 1500,
    currency: 'USD',
    quoteIntentId: INTENT_ID,
    expiresAt: Math.floor(NOW.getTime() / 1000) + 600,
  }, { secret: SECRET });
  const [version, payload, signature] = token.split('.') as [string, string, string];
  assert.equal(signature.length, 43);

  const nonCanonicalSignature = changeOnlyBase64urlPaddingBits(signature);
  assert.equal(
    verifyMcpTopupHandoff(`${version}.${payload}.${nonCanonicalSignature}`, { secret: SECRET, now: NOW }),
    null,
  );

  const nonCanonicalPayload = changeOnlyBase64urlPaddingBits(payload);
  const matchingSignature = createHmac('sha256', SECRET)
    .update(`${version}.${nonCanonicalPayload}`, 'utf8')
    .digest('base64url');
  assert.equal(
    verifyMcpTopupHandoff(`${version}.${nonCanonicalPayload}.${matchingSignature}`, {
      secret: SECRET,
      now: NOW,
    }),
    null,
  );
});

test('secret validation happens before quote locking and rejects weak or whitespace secrets', async () => {
  for (const secret of ['', 'short', `${SECRET} `, 'é'.repeat(32)]) {
    let locked = false;
    const { deps } = dependencies({
      secret,
      lockOwnedQuote: async () => {
        locked = true;
        return null;
      },
    });
    await assert.rejects(
      createMcpTopupHandoff({ quoteId: QUOTE_ID }, principal, deps),
      /MCP_TOPUP_HANDOFF_SECRET/,
    );
    assert.equal(locked, false);
  }
});

test('top-up input is an exact UUIDv4 object and fails before a transaction', async () => {
  for (const input of [
    {},
    { quoteId: 'not-a-uuid' },
    { quoteId: QUOTE_ID, amountCents: 1000 },
    [QUOTE_ID],
  ]) {
    let transactionStarted = false;
    const { deps } = dependencies({
      withTransaction: async () => {
        transactionStarted = true;
        throw new Error('must not run');
      },
    });
    await assert.rejects(
      createMcpTopupHandoff(input as never, principal, deps),
      (error: unknown) => error instanceof AgentApiError && error.code === 'PARAMETER_INVALID',
    );
    assert.equal(transactionStarted, false);
  }
});

test('top-up rejects malformed principals and exotic input objects before quote access', async () => {
  const exoticInputs: unknown[] = [];
  const accessor = {} as Record<string, unknown>;
  Object.defineProperty(accessor, 'quoteId', { enumerable: true, get: () => QUOTE_ID });
  exoticInputs.push(accessor, Object.assign(Object.create({ inherited: true }), { quoteId: QUOTE_ID }));
  const symbolInput = { quoteId: QUOTE_ID } as Record<PropertyKey, unknown>;
  symbolInput[Symbol('hidden')] = true;
  exoticInputs.push(symbolInput);
  for (const input of exoticInputs) {
    let locked = false;
    const { deps } = dependencies({ lockOwnedQuote: async () => { locked = true; return null; } });
    await assert.rejects(
      createMcpTopupHandoff(input as never, principal, deps),
      (error: unknown) => error instanceof AgentApiError && error.code === 'PARAMETER_INVALID',
    );
    assert.equal(locked, false);
  }

  for (const invalidPrincipal of [
    { ...principal, userId: '' },
    { ...principal, userId: ' user ' },
    { ...principal, clientId: '' },
    { ...principal, authMethod: 'cookie' },
  ]) {
    let locked = false;
    const { deps } = dependencies({ lockOwnedQuote: async () => { locked = true; return null; } });
    await assert.rejects(
      createMcpTopupHandoff({ quoteId: QUOTE_ID }, invalidPrincipal as never, deps),
      (error: unknown) => error instanceof AgentApiError && error.code === 'AUTH_REQUIRED',
    );
    assert.equal(locked, false);
  }
});

test('handoff locks quote and wallet in one transaction, recommends exact shortfall, then invalidates atomically', async () => {
  const { deps, events } = dependencies();
  const result = await createMcpTopupHandoff({ quoteId: QUOTE_ID }, principal, deps);
  assert.deepEqual(events, ['transaction', 'lock_quote', 'wallet', 'invalidate_quote']);
  assert.deepEqual(Object.keys(result), [
    'topupRequired', 'amountCents', 'currency', 'quoteIntentId', 'expiresAt', 'expiresAtIso',
    'destination', 'freshQuoteRequired', 'nextActionAfterFunding',
  ]);
  assert.equal(result.topupRequired, true);
  assert.equal(result.amountCents, 1500);
  assert.equal(result.currency, 'USD');
  assert.equal(result.quoteIntentId, INTENT_ID);
  assert.equal(result.expiresAt, Math.floor(NOW.getTime() / 1000) + 600);
  assert.equal(result.expiresAtIso, '2026-07-16T12:10:00.000Z');
  assert.equal(result.freshQuoteRequired, true);
  assert.deepEqual(result.nextActionAfterFunding, {
    tool: 'get_account_status',
    then: 'prepare_generation',
  });
  assert.deepEqual(
    {
      type: result.destination.type,
      purpose: result.destination.purpose,
      label: result.destination.label,
    },
    {
      type: 'open_url',
      purpose: 'billing',
      label: 'Add credits securely on MaxVideoAI',
    },
  );
  const url = new URL(result.destination.url);
  assert.equal(url.origin, 'https://maxvideoai.com');
  assert.equal(url.pathname, '/billing');
  assert.deepEqual(Array.from(url.searchParams.keys()), ['mcp_topup']);
  assert.deepEqual(
    verifyMcpTopupHandoff(url.searchParams.get('mcp_topup')!, { secret: SECRET, now: NOW }),
    {
      amountCents: 1500,
      currency: 'USD',
      quoteIntentId: INTENT_ID,
      expiresAt: Math.floor(NOW.getTime() / 1000) + 600,
    },
  );
  assert.doesNotMatch(result.destination.url, /owner-user|codex-client|private|seedance|stripe/i);
});

test('top-up recommendation applies the existing ten-dollar minimum', async () => {
  const { deps } = dependencies({
    getWalletSummary: async () => ({
      balanceCents: 1700, currency: 'USD', pendingCents: 0, hasCompletedTopUp: true,
    }),
  });
  const result = await createMcpTopupHandoff({ quoteId: QUOTE_ID }, principal, deps);
  assert.equal(result.amountCents, 1000);
});

test('sufficient wallet balance preserves the quote and returns safe confirmation guidance', async () => {
  let invalidated = false;
  const { deps } = dependencies({
    getWalletSummary: async () => ({
      balanceCents: 1750, currency: 'USD', pendingCents: 0, hasCompletedTopUp: true,
    }),
    invalidatePreparedQuote: async () => {
      invalidated = true;
      return null;
    },
  });
  const result = await createMcpTopupHandoff({ quoteId: QUOTE_ID }, principal, deps);
  assert.deepEqual(result, {
    topupRequired: false,
    nextAction: {
      tool: 'confirm_generation',
      arguments: { quoteId: QUOTE_ID, confirmed: true },
    },
  });
  assert.equal(invalidated, false);
});

test('missing, wrong-owner, stale, expired, and already-invalidated quotes share a stale safe failure', async () => {
  const cases = [
    null,
    { quote: quote({ state: 'claimed', jobId: QUOTE_ID, claimedAt: NOW }), databaseNow: NOW },
    { quote: quote({ state: 'expired' }), databaseNow: NOW },
    {
      quote: quote({ expiresAt: new Date('2026-07-16T12:00:00.000Z') }),
      databaseNow: NOW,
    },
  ];
  for (const locked of cases) {
    const { deps } = dependencies({ lockOwnedQuote: async () => locked });
    await assert.rejects(
      createMcpTopupHandoff({ quoteId: QUOTE_ID }, principal, deps),
      (error: unknown) => {
        assert.ok(error instanceof AgentApiError);
        assert.equal(error.code, 'QUOTE_EXPIRED');
        assert.equal(error.message, 'This quote is no longer available. Prepare a fresh generation quote.');
        return true;
      },
    );
  }
});

test('quote ownership binds both user and OAuth client without revealing which identity mismatched', async () => {
  for (const otherPrincipal of [
    { ...principal, userId: 'other-user' },
    { ...principal, clientId: 'other-client' },
  ]) {
    let observedOwner: unknown;
    const { deps } = dependencies({
      lockOwnedQuote: async (owner) => {
        observedOwner = owner;
        return null;
      },
    });
    await assert.rejects(
      createMcpTopupHandoff({ quoteId: QUOTE_ID }, otherPrincipal, deps),
      (error: unknown) => error instanceof AgentApiError
        && error.code === 'QUOTE_EXPIRED'
        && error.message === 'This quote is no longer available. Prepare a fresh generation quote.',
    );
    assert.deepEqual(observedOwner, {
      quoteId: QUOTE_ID,
      userId: otherPrincipal.userId,
      oauthClientId: otherPrincipal.clientId,
    });
  }
});

test('failed invalidation rolls the handoff transaction back instead of returning a payable URL', async () => {
  const { deps } = dependencies({ invalidatePreparedQuote: async () => null });
  await assert.rejects(
    createMcpTopupHandoff({ quoteId: QUOTE_ID }, principal, deps),
    (error: unknown) => error instanceof AgentApiError && error.code === 'QUOTE_EXPIRED',
  );
});

test('trusted billing URL rejects credentials, fragments, non-http protocols, and unexpected origins', async () => {
  for (const billingBaseUrl of [
    'https://user:pass@maxvideoai.com',
    'https://maxvideoai.com/#fragment',
    'ftp://maxvideoai.com',
    'https://evil.example',
    'http://maxvideoai.com',
    'https://maxvideoai.com.',
  ]) {
    const { deps } = dependencies({ billingBaseUrl });
    await assert.rejects(createMcpTopupHandoff({ quoteId: QUOTE_ID }, principal, deps), /billing/i);
  }
});

test('billing resolver validates signed intent server-side and ignores invalid attacker-controlled values', () => {
  const expiresAt = Math.floor(NOW.getTime() / 1000) + 600;
  const token = signMcpTopupHandoff(
    { amountCents: 1500, currency: 'USD', quoteIntentId: INTENT_ID, expiresAt },
    { secret: SECRET },
  );
  assert.deepEqual(resolveMcpTopupBillingIntent(token, { secret: SECRET, now: NOW }), {
    billingIntent: { amountCents: 1500, currency: 'USD', isExplicit: true },
    loginRedirectTarget: `/billing?mcp_topup=${encodeURIComponent(token)}`,
  });
  assert.equal(
    resolveMcpTopupBillingIntent(`${token.slice(0, -1)}A`, { secret: SECRET, now: NOW }),
    null,
  );
});

function mcpServices(overrides: Partial<MaxVideoAiMcpServices> = {}): MaxVideoAiMcpServices {
  return {
    async getAccountStatus() { throw new Error('not used'); },
    async listModels() { return []; },
    async recommendModels() { return { recommendations: [], nextAction: 'clarify_requirements' }; },
    async prepareGeneration() { throw new Error('not used'); },
    async confirmGeneration() { throw new Error('not used'); },
    async getGenerationStatus() { throw new Error('not used'); },
    async listRecentGenerations() { return { items: [], nextCursor: null }; },
    createTopupLink: createMcpTopupHandoffService({
      ...dependencies().deps,
    }),
    ...overrides,
  };
}

test('create_topup_link has exact UUID input, annotations, and explicit non-payment/fresh-quote description', async (t) => {
  let captured: unknown;
  const server = createMaxVideoAiMcpServer(principal, mcpServices({
    async createTopupLink(input) {
      captured = input;
      return {
        topupRequired: true,
        amountCents: 1500,
        currency: 'USD',
        quoteIntentId: INTENT_ID,
        expiresAt: Math.floor(NOW.getTime() / 1000) + 600,
        expiresAtIso: '2026-07-16T12:10:00.000Z',
        destination: {
          type: 'open_url',
          purpose: 'billing',
          label: 'Add credits securely on MaxVideoAI',
          url: 'https://maxvideoai.com/billing?mcp_topup=opaque',
        },
        freshQuoteRequired: true,
        nextActionAfterFunding: {
          tool: 'get_account_status',
          then: 'prepare_generation',
        },
      };
    },
  }), { paidGeneration: true });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'p9-topup', version: '1.0.0' });
  await client.connect(clientTransport);
  t.after(async () => {
    await client.close();
    await server.close();
  });

  const tool = (await client.listTools()).tools.find((candidate) => candidate.name === 'create_topup_link');
  assert.ok(tool);
  assert.deepEqual(tool.annotations, {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  });
  assert.deepEqual(tool.inputSchema.required, ['quoteId']);
  assert.deepEqual(Object.keys(tool.inputSchema.properties ?? {}), ['quoteId']);
  assert.match(tool.description ?? '', /short-lived MaxVideoAI web handoff/i);
  assert.match(tool.description ?? '', /does not take payment/i);
  assert.match(tool.description ?? '', /invalidates the old short-lived quote/i);
  assert.match(tool.description ?? '', /fresh prepare_generation/i);

  const response = await client.callTool({
    name: 'create_topup_link',
    arguments: { quoteId: QUOTE_ID },
  });
  assert.deepEqual(captured, { quoteId: QUOTE_ID });
  assert.deepEqual(record(response.structuredContent).nextActionAfterFunding, {
    tool: 'get_account_status',
    then: 'prepare_generation',
  });
  assert.equal(record(record(response.structuredContent).destination).purpose, 'billing');
  assert.equal('url' in record(response.structuredContent), false);
});

test('billing page resolves MCP intent on the server and preserves the exact signed login target', () => {
  const page = readFileSync('frontend/app/(core)/billing/page.tsx', 'utf8');
  const client = readFileSync('frontend/app/(core)/billing/_components/BillingClient.tsx', 'utf8');
  assert.match(page, /resolveMcpTopupBillingIntent/);
  assert.match(page, /MCP_TOPUP_HANDOFF_SECRET/);
  assert.match(page, /hasMcpToken\s*\?\s*DEFAULT_BILLING_INTENT\s*:\s*null/);
  assert.match(page, /initialBillingIntent/);
  assert.match(page, /signedLoginRedirectTarget/);
  assert.match(client, /initialBillingIntent/);
  assert.match(client, /signedLoginRedirectTarget/);
  assert.match(client, /selectedTopupCents\s*===\s*initialBillingIntent\?\.amountCents/);
  assert.doesNotMatch(page, /parseBillingIntent/);
});

test('MCP top-up owner has no Stripe/session/client-secret/wallet mutation behavior', () => {
  const paths = [
    'frontend/src/server/agent-api/topup-handoff.ts',
    'frontend/src/server/mcp/tools/create-topup-link.ts',
  ];
  const source = paths.map((path) => readFileSync(path, 'utf8')).join('\n');
  assert.doesNotMatch(source, /from ['"]stripe|@stripe|Checkout|PaymentIntent|client[_A-Z]?secret|sessionId/i);
  assert.doesNotMatch(source, /INSERT\s+INTO\s+app_receipts|UPDATE\s+app_receipts|reserveWallet|record.*Receipt/i);
});
