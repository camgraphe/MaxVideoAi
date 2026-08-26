import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

import {
  resolveMcpAcquisitionSigningSecret,
  type SignedMcpAcquisition,
} from '@/lib/mcp-acquisition';
import { query, type QueryExecutor } from '@/lib/db';
import type { AgentPrincipal } from '@/server/agent-api/principal';
import { isValidAuthorizationId } from '@/server/mcp/oauth-consent';

export const MCP_CONNECTION_BINDING_WINDOW_SECONDS = 15 * 60;

export type McpConnectionBindingResult = 'attributed' | 'direct' | 'duplicate' | 'unavailable';

type FunnelDeps = { executor: QueryExecutor };
type ApprovalBindingOptions = Partial<FunnelDeps> & {
  secret?: string;
  now?: Date;
  bindingId?: string;
};

const defaultDeps: FunnelDeps = { executor: { query } };
const BINDING_PREFIX = 'mcpb1';
const BINDING_ID_PATTERN = /^mcpb_[A-Za-z0-9_-]{24}$/;
const ACQUISITION_ID_PATTERN = /^acq_[A-Za-z0-9_-]{24}$/;
const BASE64URL_SHA256_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const DECIMAL_SECONDS_PATTERN = /^[1-9]\d{9,10}$/;
const OUTER_BINDING_KEYS = new Set(['authorizationId', 'userId', 'oauthClientId', 'acquisition']);
const APPROVAL_KEYS = new Set([
  'token', 'authorizationId', 'userId', 'oauthClientId', 'approvedAt',
]);
const ACQUISITION_KEYS = new Set([
  'version', 'acquisitionId', 'source', 'medium', 'campaign', 'client', 'issuedAt', 'expiresAt',
]);

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: Set<string>): boolean {
  const keys = Object.keys(value);
  return keys.length === expected.size && keys.every((key) => expected.has(key));
}

function isBoundedString(value: unknown, maxLength: number): value is string {
  return typeof value === 'string'
    && value.length >= 1
    && value.length <= maxLength
    && value === value.trim();
}

function isValidDate(value: unknown): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}

function isSignedLandingAcquisition(value: unknown): value is SignedMcpAcquisition {
  if (!isPlainRecord(value) || !hasExactKeys(value, ACQUISITION_KEYS)) return false;
  return value.version === 1
    && typeof value.acquisitionId === 'string'
    && ACQUISITION_ID_PATTERN.test(value.acquisitionId)
    && value.source === 'mcp_landing'
    && value.medium === 'owned'
    && value.campaign === 'mcp_connect'
    && (value.client === 'chatgpt' || value.client === 'claude' || value.client === 'codex')
    && Number.isSafeInteger(value.issuedAt)
    && Number.isSafeInteger(value.expiresAt);
}

function resolveSecret(secret?: string): string {
  const resolved = secret ?? resolveMcpAcquisitionSigningSecret();
  if (Buffer.byteLength(resolved, 'utf8') < 32) {
    throw new Error('MCP approval binding secret must contain at least 32 bytes.');
  }
  return resolved;
}

function hmac(value: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(value, 'utf8').digest();
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function bindingSignatureInput(
  bindingId: string,
  expiresAtSeconds: number,
  authorizationId: string,
  userId: string,
  oauthClientId: string,
): string {
  return JSON.stringify([
    'mcp-oauth-approval-binding-v1',
    bindingId,
    expiresAtSeconds,
    authorizationId,
    userId,
    oauthClientId,
  ]);
}

function deriveBindingId(
  authorizationId: string,
  userId: string,
  oauthClientId: string,
  acquisitionId: string,
  secret: string,
): string {
  const opaqueId = hmac(JSON.stringify([
    'mcp-oauth-approval-binding-id-v1',
    authorizationId,
    userId,
    oauthClientId,
    acquisitionId,
  ]), secret).subarray(0, 18).toString('base64url');
  return `mcpb_${opaqueId}`;
}

function createBindingToken(
  bindingId: string,
  expiresAtSeconds: number,
  authorizationId: string,
  userId: string,
  oauthClientId: string,
  secret: string,
): string {
  const encodedSignature = hmac(
    bindingSignatureInput(
      bindingId,
      expiresAtSeconds,
      authorizationId,
      userId,
      oauthClientId,
    ),
    secret,
  ).toString('base64url');
  return `${BINDING_PREFIX}.${bindingId}.${expiresAtSeconds}.${encodedSignature}`;
}

export async function createMcpOAuthApprovalBinding(
  input: {
    authorizationId: string;
    userId: string;
    oauthClientId: string;
    acquisition: SignedMcpAcquisition;
  },
  options: ApprovalBindingOptions = {},
): Promise<string | null> {
  if (!isPlainRecord(input)
    || !hasExactKeys(input, OUTER_BINDING_KEYS)
    || !isValidAuthorizationId(input.authorizationId)
    || !isBoundedString(input.userId, 128)
    || !isBoundedString(input.oauthClientId, 256)
    || !isSignedLandingAcquisition(input.acquisition)) {
    return null;
  }

  const createdAt = options.now ?? new Date();
  if (!isValidDate(createdAt)) return null;

  try {
    const secret = resolveSecret(options.secret);
    const bindingId = options.bindingId ?? deriveBindingId(
      input.authorizationId,
      input.userId,
      input.oauthClientId,
      input.acquisition.acquisitionId,
      secret,
    );
    if (!BINDING_ID_PATTERN.test(bindingId)) return null;
    const expiresAt = new Date(
      createdAt.getTime() + MCP_CONNECTION_BINDING_WINDOW_SECONDS * 1000,
    );
    const executor = options.executor ?? defaultDeps.executor;
    const rows = await executor.query<{ binding_id: string; expires_at: string | Date }>(
      `WITH inserted_binding AS (
        INSERT INTO mcp_oauth_connection_bindings (
          binding_id, created_at, expires_at, user_id, oauth_client_id, acquisition_id,
          source, medium, campaign, acquisition_client
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (binding_id) DO NOTHING
        RETURNING binding_id, expires_at
      ), canonical_binding AS MATERIALIZED (
        SELECT binding_id, expires_at
          FROM inserted_binding
        UNION ALL
        SELECT binding_id, expires_at
          FROM mcp_oauth_connection_bindings
         WHERE binding_id = $1
           AND user_id = $4
           AND oauth_client_id = $5
           AND acquisition_id = $6
           AND source = $7
           AND medium = $8
           AND campaign = $9
           AND acquisition_client = $10
           AND expires_at > $2
         LIMIT 1
      ), recorded_start AS (
        INSERT INTO mcp_funnel_events (
          event_type, stage, occurred_at, user_id, oauth_client_id, acquisition_id, quote_id,
          job_id, amount_cents, currency, source, medium, campaign, acquisition_client,
          idempotency_key, receipt_hash
        )
        SELECT
          'oauth_connection_started', NULL, $2, $4, $5, $6, NULL,
          NULL, NULL, NULL, $7, $8, $9, $10, $11, NULL
          FROM canonical_binding
        ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
        RETURNING id
      )
      SELECT binding_id, expires_at
        FROM canonical_binding
       LIMIT 1`,
      [
        bindingId,
        createdAt,
        expiresAt,
        input.userId,
        input.oauthClientId,
        input.acquisition.acquisitionId,
        input.acquisition.source,
        input.acquisition.medium,
        input.acquisition.campaign,
        input.acquisition.client,
        `oauth-started:${input.acquisition.acquisitionId}`,
      ],
    );
    if (rows.length !== 1 || !BINDING_ID_PATTERN.test(rows[0].binding_id)) return null;
    const canonicalExpiry = rows[0].expires_at instanceof Date
      ? rows[0].expires_at
      : new Date(rows[0].expires_at);
    if (!isValidDate(canonicalExpiry) || canonicalExpiry <= createdAt) return null;
    const expiresAtSeconds = Math.floor(canonicalExpiry.getTime() / 1000);
    return createBindingToken(
      rows[0].binding_id,
      expiresAtSeconds,
      input.authorizationId,
      input.userId,
      input.oauthClientId,
      secret,
    );
  } catch {
    return null;
  }
}

type ParsedBindingToken = { bindingId: string; expiresAtSeconds: number };

function verifyBindingToken(
  token: unknown,
  authorizationId: string,
  userId: string,
  oauthClientId: string,
  approvedAt: Date,
  secret: string,
): ParsedBindingToken | null {
  if (typeof token !== 'string' || Buffer.byteLength(token, 'utf8') > 256) return null;
  const parts = token.split('.');
  if (parts.length !== 4) return null;
  const [prefix, bindingId, encodedExpiry, encodedSignature] = parts;
  if (prefix !== BINDING_PREFIX
    || !BINDING_ID_PATTERN.test(bindingId)
    || !DECIMAL_SECONDS_PATTERN.test(encodedExpiry)
    || !BASE64URL_SHA256_PATTERN.test(encodedSignature)) {
    return null;
  }
  const expiresAtSeconds = Number(encodedExpiry);
  if (!Number.isSafeInteger(expiresAtSeconds)
    || Math.floor(approvedAt.getTime() / 1000) > expiresAtSeconds) {
    return null;
  }
  const actual = Buffer.from(encodedSignature, 'base64url');
  if (actual.length !== 32 || actual.toString('base64url') !== encodedSignature) return null;
  const expected = hmac(
    bindingSignatureInput(
      bindingId,
      expiresAtSeconds,
      authorizationId,
      userId,
      oauthClientId,
    ),
    secret,
  );
  if (!timingSafeEqual(actual, expected)) return null;
  return { bindingId, expiresAtSeconds };
}

export async function approveMcpOAuthConnectionBinding(
  input: {
    token: unknown;
    authorizationId: string;
    userId: string;
    oauthClientId: string;
    approvedAt: Date;
  },
  options: Partial<FunnelDeps> & { secret?: string } = {},
): Promise<boolean> {
  if (!isPlainRecord(input)
    || !hasExactKeys(input, APPROVAL_KEYS)
    || !isValidAuthorizationId(input.authorizationId)
    || !isBoundedString(input.userId, 128)
    || !isBoundedString(input.oauthClientId, 256)
    || !isValidDate(input.approvedAt)) {
    return false;
  }
  try {
    const secret = resolveSecret(options.secret);
    const parsed = verifyBindingToken(
      input.token,
      input.authorizationId,
      input.userId,
      input.oauthClientId,
      input.approvedAt,
      secret,
    );
    if (!parsed) return false;
    const executor = options.executor ?? defaultDeps.executor;
    const rows = await executor.query<{ binding_id: string }>(
      `UPDATE mcp_oauth_connection_bindings
          SET approved_at = COALESCE(approved_at, $4)
        WHERE binding_id = $1
          AND user_id = $2
          AND oauth_client_id = $3
          AND consumed_at IS NULL
          AND expires_at >= $4
        RETURNING binding_id`,
      [parsed.bindingId, input.userId, input.oauthClientId, input.approvedAt],
    );
    return rows.length === 1;
  } catch {
    return false;
  }
}

export async function bindAuthenticatedMcpConnection(
  principal: AgentPrincipal,
  options: FunnelDeps & { now?: Date; bindingWindowSeconds?: number } = {
    ...defaultDeps,
  },
): Promise<McpConnectionBindingResult> {
  const now = options.now ?? new Date();
  const windowSeconds = options.bindingWindowSeconds ?? MCP_CONNECTION_BINDING_WINDOW_SECONDS;
  if (!isBoundedString(principal.userId, 128)
    || (principal.clientId !== null && !isBoundedString(principal.clientId, 256))
    || !isValidDate(now)
    || !Number.isSafeInteger(windowSeconds)
    || windowSeconds <= 0
    || windowSeconds > 24 * 60 * 60) {
    return 'unavailable';
  }
  const canonicalIdempotency = `oauth-completed:${sha256(JSON.stringify([
    'mcp-oauth-completed-v1', principal.userId, principal.clientId ?? '',
  ]))}`;
  try {
    const rows = await options.executor.query<{ acquisition_id: string | null; source: string }>(
      `WITH eligible AS MATERIALIZED (
        SELECT
          binding_id, acquisition_id, source, medium, campaign, acquisition_client
          FROM mcp_oauth_connection_bindings
         WHERE user_id = $1
           AND oauth_client_id IS NOT DISTINCT FROM $2
           AND approved_at IS NOT NULL
           AND consumed_at IS NULL
           AND approved_at <= $3
           AND approved_at >= $3 - ($4 * INTERVAL '1 second')
         ORDER BY approved_at ASC, binding_id ASC
         LIMIT 1
         FOR UPDATE
      ), candidate AS MATERIALIZED (
        SELECT acquisition_id, source, medium, campaign, acquisition_client
          FROM eligible
        UNION ALL
        SELECT NULL::text, 'direct_mcp', 'mcp', 'none', 'other'
         WHERE NOT EXISTS (SELECT 1 FROM eligible)
      ), inserted_completion AS (
        INSERT INTO mcp_funnel_events (
          event_type, stage, occurred_at, user_id, oauth_client_id, acquisition_id, quote_id,
          job_id, amount_cents, currency, source, medium, campaign, acquisition_client,
          idempotency_key, receipt_hash
        )
        SELECT
          'oauth_connection_completed', 'oauth_connected', $3, $1, $2, acquisition_id,
          NULL, NULL, NULL, NULL, source, medium, campaign, acquisition_client, $5, NULL
          FROM candidate
        ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
        RETURNING acquisition_id, source
      ), consumed_binding AS (
        UPDATE mcp_oauth_connection_bindings AS binding
           SET consumed_at = $3
          FROM eligible
         WHERE binding.binding_id = eligible.binding_id
           AND EXISTS (
             SELECT 1
               FROM inserted_completion
              WHERE inserted_completion.source = 'mcp_landing'
                AND inserted_completion.acquisition_id = eligible.acquisition_id
           )
        RETURNING binding.binding_id
      )
      SELECT acquisition_id, source
        FROM inserted_completion
        LEFT JOIN consumed_binding ON TRUE`,
      [principal.userId, principal.clientId, now, windowSeconds, canonicalIdempotency],
    );
    if (rows.length === 0) return 'duplicate';
    return rows[0].source === 'mcp_landing' ? 'attributed' : 'direct';
  } catch {
    return 'unavailable';
  }
}
