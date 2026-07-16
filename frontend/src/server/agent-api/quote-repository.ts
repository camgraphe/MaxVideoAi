import { randomUUID } from 'node:crypto';

import { query, type QueryExecutor } from '@/lib/db';
import {
  hashCanonicalGenerationRequest,
  normalizeGenerationRequest,
} from '@/server/agent-api/generation-normalization';
import type { CanonicalGenerationRequest } from '@/server/agent-api/generation-types';

export const MCP_QUOTE_LIFETIME_SECONDS = 10 * 60;
export const MCP_QUOTE_EXPIRATION_BATCH_SIZE = 100;

export type McpGenerationQuoteState =
  | 'prepared'
  | 'claimed'
  | 'accepted'
  | 'failed'
  | 'expired';

export type McpGenerationQuote = {
  quoteId: string;
  userId: string;
  oauthClientId: string | null;
  request: CanonicalGenerationRequest;
  requestHash: string;
  catalogRevision: string;
  pricingSnapshot: Record<string, unknown>;
  priceCents: number;
  currency: string;
  fundingMode: 'wallet';
  state: McpGenerationQuoteState;
  jobId: string | null;
  expiresAt: Date;
  claimedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type InsertPreparedQuoteInput = {
  userId: string;
  oauthClientId: string | null;
  request: CanonicalGenerationRequest;
  requestHash: string;
  catalogRevision: string;
  pricingSnapshot: Record<string, unknown>;
  priceCents: number;
  currency: string;
};

export type OwnedQuoteInput = {
  quoteId: string;
  userId: string;
  oauthClientId: string | null;
};

export type OwnedQuoteJobInput = OwnedQuoteInput & { jobId: string };

type QuoteRepositoryDependencies = {
  executor: QueryExecutor;
  now?: () => Date;
  randomUUID?: () => string;
};

type QuoteRow = {
  quote_id: unknown;
  user_id: unknown;
  oauth_client_id: unknown;
  request_json: unknown;
  request_hash: unknown;
  catalog_revision: unknown;
  pricing_snapshot: unknown;
  price_cents: unknown;
  currency: unknown;
  funding_mode: unknown;
  state: unknown;
  job_id: unknown;
  expires_at: unknown;
  claimed_at: unknown;
  created_at: unknown;
  updated_at: unknown;
};

const defaultDependencies: QuoteRepositoryDependencies = {
  executor: { query },
  now: () => new Date(),
  randomUUID,
};
const INSERT_KEYS = new Set([
  'userId', 'oauthClientId', 'request', 'requestHash', 'catalogRevision',
  'pricingSnapshot', 'priceCents', 'currency',
]);
const OWNER_KEYS = new Set(['quoteId', 'userId', 'oauthClientId']);
const JOB_KEYS = new Set(['quoteId', 'userId', 'oauthClientId', 'jobId']);
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const HASH_PATTERN = /^[a-f0-9]{64}$/u;
const CURRENCY_PATTERN = /^[A-Z]{3}$/u;
const STATES = new Set<McpGenerationQuoteState>([
  'prepared', 'claimed', 'accepted', 'failed', 'expired',
]);
const MAX_INTEGER_CENTS = 2_147_483_647;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(record: Record<string, unknown>, keys: ReadonlySet<string>): boolean {
  const actual = Object.keys(record);
  return actual.length === keys.size && actual.every((key) => keys.has(key));
}

function isBoundedText(value: unknown, maxLength: number): value is string {
  return typeof value === 'string'
    && value.length >= 1
    && value.length <= maxLength
    && value === value.trim();
}

function isNullableBoundedText(value: unknown, maxLength: number): value is string | null {
  return value === null || isBoundedText(value, maxLength);
}

function finiteDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? new Date(value.getTime()) : null;
  if (typeof value !== 'string') return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function jsonRecord(value: unknown): Record<string, unknown> | null {
  if (isRecord(value)) return value;
  if (typeof value !== 'string') return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function requireNow(dependencies: QuoteRepositoryDependencies): Date {
  const value = (dependencies.now ?? defaultDependencies.now)?.();
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new Error('Invalid quote repository clock.');
  }
  return new Date(value.getTime());
}

function assertInsertInput(value: unknown): asserts value is InsertPreparedQuoteInput {
  if (!isRecord(value)
    || !hasExactKeys(value, INSERT_KEYS)
    || !isBoundedText(value.userId, 128)
    || !isNullableBoundedText(value.oauthClientId, 256)
    || !HASH_PATTERN.test(String(value.requestHash))
    || !isBoundedText(value.catalogRevision, 256)
    || !isRecord(value.pricingSnapshot)
    || !Number.isSafeInteger(value.priceCents)
    || (value.priceCents as number) < 0
    || (value.priceCents as number) > MAX_INTEGER_CENTS
    || typeof value.currency !== 'string'
    || !CURRENCY_PATTERN.test(value.currency)) {
    throw new Error('Invalid prepared quote input.');
  }
  let canonical: CanonicalGenerationRequest;
  try {
    canonical = normalizeGenerationRequest(value.request);
  } catch {
    throw new Error('Invalid prepared quote input.');
  }
  if (hashCanonicalGenerationRequest(canonical) !== value.requestHash) {
    throw new Error('Invalid prepared quote input.');
  }
}

function assertOwnerInput(value: unknown): asserts value is OwnedQuoteInput {
  if (!isRecord(value)
    || !hasExactKeys(value, OWNER_KEYS)
    || typeof value.quoteId !== 'string'
    || !UUID_V4_PATTERN.test(value.quoteId)
    || !isBoundedText(value.userId, 128)
    || !isNullableBoundedText(value.oauthClientId, 256)) {
    throw new Error('Invalid quote ownership input.');
  }
}

function assertJobInput(value: unknown): asserts value is OwnedQuoteJobInput {
  if (!isRecord(value)
    || !hasExactKeys(value, JOB_KEYS)
    || typeof value.quoteId !== 'string'
    || !UUID_V4_PATTERN.test(value.quoteId)
    || !isBoundedText(value.userId, 128)
    || !isNullableBoundedText(value.oauthClientId, 256)
    || !isBoundedText(value.jobId, 256)) {
    throw new Error('Invalid quote job input.');
  }
}

function parseQuoteRow(row: QuoteRow): McpGenerationQuote {
  const requestRecord = jsonRecord(row.request_json);
  const pricingSnapshot = jsonRecord(row.pricing_snapshot);
  const expiresAt = finiteDate(row.expires_at);
  const claimedAt = row.claimed_at === null ? null : finiteDate(row.claimed_at);
  const createdAt = finiteDate(row.created_at);
  const updatedAt = finiteDate(row.updated_at);
  let request: CanonicalGenerationRequest | null = null;
  try {
    if (requestRecord) request = normalizeGenerationRequest(requestRecord);
  } catch {
    request = null;
  }
  if (typeof row.quote_id !== 'string'
    || !UUID_V4_PATTERN.test(row.quote_id)
    || !isBoundedText(row.user_id, 128)
    || !isNullableBoundedText(row.oauth_client_id, 256)
    || !request
    || typeof row.request_hash !== 'string'
    || !HASH_PATTERN.test(row.request_hash)
    || hashCanonicalGenerationRequest(request) !== row.request_hash
    || !isBoundedText(row.catalog_revision, 256)
    || !pricingSnapshot
    || !Number.isSafeInteger(row.price_cents)
    || (row.price_cents as number) < 0
    || (row.price_cents as number) > MAX_INTEGER_CENTS
    || typeof row.currency !== 'string'
    || !CURRENCY_PATTERN.test(row.currency)
    || row.funding_mode !== 'wallet'
    || typeof row.state !== 'string'
    || !STATES.has(row.state as McpGenerationQuoteState)
    || !isNullableBoundedText(row.job_id, 256)
    || !expiresAt
    || !createdAt
    || !updatedAt
    || (row.claimed_at !== null && !claimedAt)
    || expiresAt.getTime() - createdAt.getTime() !== MCP_QUOTE_LIFETIME_SECONDS * 1000
    || updatedAt < createdAt
    || (claimedAt !== null
      && (claimedAt < createdAt || claimedAt >= expiresAt || claimedAt > updatedAt))) {
    throw new Error('Invalid quote row.');
  }
  const state = row.state as McpGenerationQuoteState;
  const claimedShape = row.job_id !== null && claimedAt !== null;
  if (((state === 'prepared' || state === 'expired') && (row.job_id !== null || claimedAt !== null))
    || ((state === 'claimed' || state === 'accepted') && !claimedShape)
    || (state === 'failed' && ((row.job_id === null) !== (claimedAt === null)))) {
    throw new Error('Invalid quote row.');
  }
  return {
    quoteId: row.quote_id,
    userId: row.user_id,
    oauthClientId: row.oauth_client_id,
    request,
    requestHash: row.request_hash,
    catalogRevision: row.catalog_revision,
    pricingSnapshot,
    priceCents: row.price_cents as number,
    currency: row.currency,
    fundingMode: 'wallet',
    state,
    jobId: row.job_id,
    expiresAt,
    claimedAt,
    createdAt,
    updatedAt,
  };
}

function parseOptionalQuote(rows: QuoteRow[]): McpGenerationQuote | null {
  if (rows.length === 0) return null;
  if (rows.length !== 1) throw new Error('Invalid quote repository result.');
  return parseQuoteRow(rows[0]);
}

const QUOTE_COLUMNS = `
  quote_id, user_id, oauth_client_id, request_json, request_hash, catalog_revision,
  pricing_snapshot, price_cents, currency, funding_mode, state, job_id,
  expires_at, claimed_at, created_at, updated_at
`;

export async function insertPreparedQuote(
  input: InsertPreparedQuoteInput,
  dependencies: QuoteRepositoryDependencies = defaultDependencies,
): Promise<McpGenerationQuote> {
  assertInsertInput(input);
  const canonicalRequest = normalizeGenerationRequest(input.request);
  const createdAt = requireNow(dependencies);
  const expiresAt = new Date(createdAt.getTime() + MCP_QUOTE_LIFETIME_SECONDS * 1000);
  const nextUuid = dependencies.randomUUID ?? defaultDependencies.randomUUID;
  const quoteId = nextUuid?.();
  if (!quoteId || !UUID_V4_PATTERN.test(quoteId)) throw new Error('Invalid quote UUID source.');
  const rows = await dependencies.executor.query<QuoteRow>(
    `INSERT INTO mcp_generation_quotes (
      quote_id, user_id, oauth_client_id, request_json, request_hash, catalog_revision,
      pricing_snapshot, price_cents, currency, funding_mode, state,
      expires_at, created_at, updated_at
    ) VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7::jsonb, $8, $9, $10, $11, $12, $13, $13)
    RETURNING ${QUOTE_COLUMNS}`,
    [
      quoteId, input.userId, input.oauthClientId, JSON.stringify(canonicalRequest),
      input.requestHash, input.catalogRevision, JSON.stringify(input.pricingSnapshot),
      input.priceCents, input.currency, 'wallet', 'prepared', expiresAt, createdAt,
    ],
  );
  const quote = parseOptionalQuote(rows);
  if (!quote) throw new Error('Prepared quote was not persisted.');
  return quote;
}

export async function getOwnedQuote(
  input: OwnedQuoteInput,
  dependencies: Pick<QuoteRepositoryDependencies, 'executor'> = defaultDependencies,
): Promise<McpGenerationQuote | null> {
  assertOwnerInput(input);
  const rows = await dependencies.executor.query<QuoteRow>(
    `SELECT ${QUOTE_COLUMNS}
       FROM mcp_generation_quotes
      WHERE quote_id = $1
        AND user_id = $2
        AND oauth_client_id IS NOT DISTINCT FROM $3`,
    [input.quoteId, input.userId, input.oauthClientId],
  );
  return parseOptionalQuote(rows);
}

export async function lockOwnedPreparedQuote(
  input: OwnedQuoteInput,
  dependencies: QuoteRepositoryDependencies = defaultDependencies,
): Promise<McpGenerationQuote | null> {
  assertOwnerInput(input);
  const now = requireNow(dependencies);
  const rows = await dependencies.executor.query<QuoteRow>(
    `SELECT ${QUOTE_COLUMNS}
       FROM mcp_generation_quotes
      WHERE quote_id = $1
        AND user_id = $2
        AND oauth_client_id IS NOT DISTINCT FROM $3
        AND state = 'prepared'
        AND expires_at > $4
      FOR UPDATE`,
    [input.quoteId, input.userId, input.oauthClientId, now],
  );
  return parseOptionalQuote(rows);
}

export async function markQuoteAccepted(
  input: OwnedQuoteJobInput,
  dependencies: QuoteRepositoryDependencies = defaultDependencies,
): Promise<McpGenerationQuote | null> {
  assertJobInput(input);
  const now = requireNow(dependencies);
  const rows = await dependencies.executor.query<QuoteRow>(
    `UPDATE mcp_generation_quotes
        SET state = 'accepted', updated_at = $5
      WHERE quote_id = $1
        AND user_id = $2
        AND oauth_client_id IS NOT DISTINCT FROM $3
        AND job_id = $4
        AND state = 'claimed'
    RETURNING ${QUOTE_COLUMNS}`,
    [input.quoteId, input.userId, input.oauthClientId, input.jobId, now],
  );
  return parseOptionalQuote(rows);
}

export async function markQuoteFailed(
  input: OwnedQuoteJobInput,
  dependencies: QuoteRepositoryDependencies = defaultDependencies,
): Promise<McpGenerationQuote | null> {
  assertJobInput(input);
  const now = requireNow(dependencies);
  const rows = await dependencies.executor.query<QuoteRow>(
    `UPDATE mcp_generation_quotes
        SET state = 'failed', updated_at = $5
      WHERE quote_id = $1
        AND user_id = $2
        AND oauth_client_id IS NOT DISTINCT FROM $3
        AND job_id = $4
        AND state IN ('claimed', 'accepted')
    RETURNING ${QUOTE_COLUMNS}`,
    [input.quoteId, input.userId, input.oauthClientId, input.jobId, now],
  );
  return parseOptionalQuote(rows);
}

export async function expirePreparedQuotes(
  options: { limit?: number } = {},
  dependencies: QuoteRepositoryDependencies = defaultDependencies,
): Promise<number> {
  const limit = options.limit ?? MCP_QUOTE_EXPIRATION_BATCH_SIZE;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1_000) {
    throw new Error('Invalid quote expiration batch size.');
  }
  const now = requireNow(dependencies);
  const rows = await dependencies.executor.query<{ count: unknown }>(
    `WITH expired_quotes AS (
      SELECT quote_id
        FROM mcp_generation_quotes
       WHERE state = 'prepared'
         AND expires_at <= $1
       ORDER BY expires_at ASC, quote_id ASC
       LIMIT $2
       FOR UPDATE SKIP LOCKED
    ), updated_quotes AS (
      UPDATE mcp_generation_quotes AS quotes
         SET state = 'expired', updated_at = $1
        FROM expired_quotes
       WHERE quotes.quote_id = expired_quotes.quote_id
      RETURNING quotes.quote_id
    )
    SELECT COUNT(*)::text AS count FROM updated_quotes`,
    [now, limit],
  );
  if (rows.length !== 1 || typeof rows[0].count !== 'string' || !/^\d+$/u.test(rows[0].count)) {
    throw new Error('Invalid quote expiration result.');
  }
  const count = Number(rows[0].count);
  if (!Number.isSafeInteger(count) || count < 0 || count > limit) {
    throw new Error('Invalid quote expiration result.');
  }
  return count;
}
