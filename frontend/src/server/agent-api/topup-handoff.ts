import {
  createHmac,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';

import { withDbTransaction, type TransactionQueryExecutor } from '@/lib/db';
import { getWalletSummary, type WalletSummary } from '@/server/wallet-summary';

import { AgentApiError } from './errors';
import type { AgentPrincipal } from './principal';
import {
  invalidatePreparedQuote,
  lockOwnedQuote,
  type LockedOwnedQuote,
  type McpGenerationQuote,
  type OwnedQuoteInput,
} from './quote-repository';

const TOKEN_VERSION = 'v1';
const TOKEN_LIFETIME_SECONDS = 10 * 60;
const MIN_TOPUP_CENTS = 1000;
const MAX_CENTS = 2_147_483_647;
const MAX_TOKEN_CHARS = 4096;
const MAX_PAYLOAD_CHARS = 1024;
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/u;
const SECRET_PATTERN = /^[\x21-\x7e]{32,256}$/u;
const PAYLOAD_KEYS = new Set(['amountCents', 'currency', 'quoteIntentId', 'expiresAt']);
const INPUT_KEYS = new Set(['quoteId']);

export type McpTopupHandoffPayload = {
  amountCents: number;
  currency: 'USD';
  quoteIntentId: string;
  expiresAt: number;
};

export type McpTopupHandoff = McpTopupHandoffPayload & {
  url: string;
  freshQuoteRequired: true;
};

export type McpTopupNotRequired = {
  topupRequired: false;
  nextAction: {
    tool: 'confirm_generation';
    arguments: { quoteId: string; confirmed: true };
  };
};

export type McpTopupHandoffResult = McpTopupHandoff | McpTopupNotRequired;

export type McpTopupHandoffDependencies = {
  secret: string | undefined;
  billingBaseUrl: string;
  randomUUID(): string;
  withTransaction<TResult>(
    callback: (executor: TransactionQueryExecutor) => Promise<TResult>,
  ): Promise<TResult>;
  lockOwnedQuote(
    input: OwnedQuoteInput,
    dependencies: { executor: TransactionQueryExecutor },
  ): Promise<LockedOwnedQuote | null>;
  getWalletSummary(userId: string, executor: TransactionQueryExecutor): Promise<WalletSummary>;
  invalidatePreparedQuote(
    input: OwnedQuoteInput,
    dependencies: { executor: TransactionQueryExecutor; expiredAt: Date },
  ): Promise<McpGenerationQuote | null>;
};

const defaultDependencies: Omit<McpTopupHandoffDependencies, 'billingBaseUrl'> = {
  secret: process.env.MCP_TOPUP_HANDOFF_SECRET,
  randomUUID,
  withTransaction: (callback) => withDbTransaction((executor) => callback(executor)),
  lockOwnedQuote,
  getWalletSummary,
  invalidatePreparedQuote,
};

type TokenOptions = {
  secret: string | undefined;
  now?: Date;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(value: Record<string, unknown>, keys: ReadonlySet<string>): boolean {
  const actual = Reflect.ownKeys(value);
  return actual.length === keys.size
    && actual.every((key) => typeof key === 'string' && keys.has(key))
    && actual.every((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      return Boolean(descriptor?.enumerable && 'value' in descriptor);
    });
}

function requireSecret(value: string | undefined): string {
  if (typeof value !== 'string' || !SECRET_PATTERN.test(value)) {
    throw new Error('MCP_TOPUP_HANDOFF_SECRET must contain at least 32 random printable ASCII characters.');
  }
  return value;
}

function finiteNow(value: Date | undefined): Date | null {
  const now = value ?? new Date();
  return now instanceof Date && Number.isFinite(now.getTime()) ? now : null;
}

function validPayloadShape(value: unknown): value is McpTopupHandoffPayload {
  return isRecord(value)
    && hasExactKeys(value, PAYLOAD_KEYS)
    && Number.isSafeInteger(value.amountCents)
    && (value.amountCents as number) >= MIN_TOPUP_CENTS
    && (value.amountCents as number) <= MAX_CENTS
    && value.currency === 'USD'
    && typeof value.quoteIntentId === 'string'
    && UUID_V4_PATTERN.test(value.quoteIntentId)
    && Number.isSafeInteger(value.expiresAt)
    && (value.expiresAt as number) > 0;
}

function payloadJson(value: McpTopupHandoffPayload): string {
  return JSON.stringify({
    amountCents: value.amountCents,
    currency: value.currency,
    quoteIntentId: value.quoteIntentId,
    expiresAt: value.expiresAt,
  });
}

function signatureFor(signingInput: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(signingInput, 'utf8').digest();
}

export function signMcpTopupHandoff(
  payload: McpTopupHandoffPayload,
  options: Pick<TokenOptions, 'secret'>,
): string {
  const secret = requireSecret(options.secret);
  if (!validPayloadShape(payload)) throw new Error('Invalid MCP top-up handoff payload.');
  const encodedPayload = Buffer.from(payloadJson(payload), 'utf8').toString('base64url');
  const signingInput = `${TOKEN_VERSION}.${encodedPayload}`;
  const signature = signatureFor(signingInput, secret).toString('base64url');
  return `${signingInput}.${signature}`;
}

export function verifyMcpTopupHandoff(
  token: string | null | undefined,
  options: TokenOptions,
): McpTopupHandoffPayload | null {
  let secret: string;
  try {
    secret = requireSecret(options.secret);
  } catch {
    return null;
  }
  const now = finiteNow(options.now);
  if (!now || typeof token !== 'string' || token.length < 1 || token.length > MAX_TOKEN_CHARS) return null;
  if (token !== token.trim() || !/^[\x21-\x7e]+$/u.test(token)) return null;
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== TOKEN_VERSION) return null;
  const encodedPayload = parts[1] ?? '';
  const encodedSignature = parts[2] ?? '';
  if (
    !encodedPayload
    || encodedPayload.length > MAX_PAYLOAD_CHARS
    || !BASE64URL_PATTERN.test(encodedPayload)
    || encodedSignature.length !== 43
    || !BASE64URL_PATTERN.test(encodedSignature)
  ) {
    return null;
  }
  let suppliedSignature: Buffer;
  let payloadBytes: Buffer;
  let parsed: unknown;
  try {
    suppliedSignature = Buffer.from(encodedSignature, 'base64url');
    payloadBytes = Buffer.from(encodedPayload, 'base64url');
    if (
      suppliedSignature.length !== 32
      || suppliedSignature.toString('base64url') !== encodedSignature
      || payloadBytes.toString('base64url') !== encodedPayload
    ) return null;
    parsed = JSON.parse(payloadBytes.toString('utf8')) as unknown;
  } catch {
    return null;
  }
  const expectedSignature = signatureFor(`${TOKEN_VERSION}.${encodedPayload}`, secret);
  if (
    suppliedSignature.length !== expectedSignature.length
    || !timingSafeEqual(suppliedSignature, expectedSignature)
    || !validPayloadShape(parsed)
  ) {
    return null;
  }
  const nowSeconds = Math.floor(now.getTime() / 1000);
  if (parsed.expiresAt <= nowSeconds || parsed.expiresAt > nowSeconds + TOKEN_LIFETIME_SECONDS) return null;
  return parsed;
}

function parseTrustedBillingBase(value: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('The trusted MCP billing URL is invalid.');
  }
  const loopback = parsed.hostname === 'localhost'
    || parsed.hostname === '127.0.0.1'
    || parsed.hostname === '[::1]'
    || parsed.hostname === '::1';
  const production = parsed.protocol === 'https:'
    && parsed.hostname.toLowerCase() === 'maxvideoai.com'
    && !parsed.port;
  const officialStaging = parsed.protocol === 'https:'
    && parsed.hostname.toLowerCase() === 'maxvideoai-mcp-staging.vercel.app'
    && !parsed.port;
  if (
    parsed.username
    || parsed.password
    || parsed.search
    || parsed.hash
    || (parsed.pathname !== '/' && parsed.pathname !== '')
    || (!production
      && !officialStaging
      && !(loopback && (parsed.protocol === 'http:' || parsed.protocol === 'https:')))
  ) {
    throw new Error('The trusted MCP billing URL uses an unexpected origin.');
  }
  return parsed;
}

function requirePrincipal(principal: AgentPrincipal): void {
  const safeIdentifier = (value: unknown, maxLength: number) => typeof value === 'string'
    && value.length >= 1
    && value.length <= maxLength
    && value === value.trim();
  if (
    !principal
    || principal.authMethod !== 'oauth'
    || !safeIdentifier(principal.userId, 128)
    || (principal.clientId !== null && !safeIdentifier(principal.clientId, 256))
  ) {
    throw new AgentApiError('AUTH_REQUIRED', 'Connect MaxVideoAI before creating a top-up handoff.');
  }
}

function normalizeInput(value: unknown): { quoteId: string } {
  if (!isRecord(value)
    || !hasExactKeys(value, INPUT_KEYS)
    || typeof value.quoteId !== 'string'
    || !UUID_V4_PATTERN.test(value.quoteId)) {
    throw new AgentApiError('PARAMETER_INVALID', 'quoteId must be a UUID v4.');
  }
  return { quoteId: value.quoteId };
}

function staleQuote(): never {
  throw new AgentApiError(
    'QUOTE_EXPIRED',
    'This quote is no longer available. Prepare a fresh generation quote.',
  );
}

type TransactionResult =
  | { kind: 'stale' }
  | { kind: 'not_required'; quoteId: string }
  | { kind: 'handoff'; value: McpTopupHandoff };

export async function createMcpTopupHandoff(
  input: { quoteId: string },
  principal: AgentPrincipal,
  dependencies: McpTopupHandoffDependencies,
): Promise<McpTopupHandoffResult> {
  const normalized = normalizeInput(input);
  requirePrincipal(principal);
  requireSecret(dependencies.secret);
  const billingBase = parseTrustedBillingBase(dependencies.billingBaseUrl);
  const owner: OwnedQuoteInput = {
    quoteId: normalized.quoteId,
    userId: principal.userId,
    oauthClientId: principal.clientId,
  };
  const result = await dependencies.withTransaction<TransactionResult>(async (executor) => {
    const locked = await dependencies.lockOwnedQuote(owner, { executor });
    if (!locked || locked.quote.state !== 'prepared') return { kind: 'stale' };
    const { quote, databaseNow } = locked;
    if (quote.expiresAt <= databaseNow) {
      await dependencies.invalidatePreparedQuote(owner, { executor, expiredAt: databaseNow });
      return { kind: 'stale' };
    }
    if (quote.currency !== 'USD' || !Number.isSafeInteger(quote.priceCents) || quote.priceCents < 0) {
      throw new AgentApiError('INTERNAL_ERROR', 'The quote cannot be funded.');
    }
    const wallet = await dependencies.getWalletSummary(principal.userId, executor);
    if (
      wallet.currency !== 'USD'
      || !Number.isSafeInteger(wallet.balanceCents)
      || wallet.balanceCents < 0
    ) {
      throw new AgentApiError('INTERNAL_ERROR', 'The wallet balance is unavailable.');
    }
    if (wallet.balanceCents >= quote.priceCents) {
      return { kind: 'not_required', quoteId: quote.quoteId };
    }
    const amountCents = Math.max(MIN_TOPUP_CENTS, quote.priceCents - wallet.balanceCents);
    const quoteIntentId = dependencies.randomUUID();
    if (!UUID_V4_PATTERN.test(quoteIntentId)) throw new Error('Invalid MCP top-up intent UUID source.');
    const expiresAt = Math.floor(databaseNow.getTime() / 1000) + TOKEN_LIFETIME_SECONDS;
    const payload: McpTopupHandoffPayload = {
      amountCents,
      currency: 'USD',
      quoteIntentId,
      expiresAt,
    };
    const token = signMcpTopupHandoff(payload, { secret: dependencies.secret });
    const billingUrl = new URL('/billing', billingBase);
    billingUrl.searchParams.set('mcp_topup', token);
    const invalidated = await dependencies.invalidatePreparedQuote(owner, {
      executor,
      expiredAt: databaseNow,
    });
    if (!invalidated || invalidated.state !== 'expired') return { kind: 'stale' };
    return {
      kind: 'handoff',
      value: {
        url: billingUrl.toString(),
        ...payload,
        freshQuoteRequired: true,
      },
    };
  });
  if (result.kind === 'stale') staleQuote();
  if (result.kind === 'not_required') {
    return {
      topupRequired: false,
      nextAction: {
        tool: 'confirm_generation',
        arguments: { quoteId: result.quoteId, confirmed: true },
      },
    };
  }
  return result.value;
}

export function createMcpTopupHandoffService(
  dependencies: Partial<McpTopupHandoffDependencies> & Pick<McpTopupHandoffDependencies, 'billingBaseUrl'>,
) {
  const resolved: McpTopupHandoffDependencies = { ...defaultDependencies, ...dependencies };
  return (input: { quoteId: string }, principal: AgentPrincipal) =>
    createMcpTopupHandoff(input, principal, resolved);
}

export function resolveMcpTopupBillingIntent(
  token: string | null | undefined,
  options: TokenOptions,
): {
  billingIntent: { amountCents: number; currency: 'USD'; isExplicit: true };
  loginRedirectTarget: string;
} | null {
  const payload = verifyMcpTopupHandoff(token, options);
  if (!payload || !token) return null;
  return {
    billingIntent: {
      amountCents: payload.amountCents,
      currency: 'USD',
      isExplicit: true,
    },
    loginRedirectTarget: `/billing?mcp_topup=${encodeURIComponent(token)}`,
  };
}
