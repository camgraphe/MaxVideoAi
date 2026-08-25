import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { query, type QueryExecutor, type TransactionQueryExecutor } from '@/lib/db';

import { AgentApiError } from './errors';
import type { CanonicalReferenceMediaKind } from './generation-types';

export const MCP_REFERENCE_UPLOAD_LIFETIME_SECONDS = 15 * 60;
export const MCP_REFERENCE_UPLOAD_EXPIRATION_BATCH_SIZE = 100;

export type ReferenceUploadSessionState = 'created' | 'uploaded' | 'expired' | 'revoked';

export type ReferenceUploadSession = {
  sessionId: string;
  userId: string;
  oauthClientId: string | null;
  mediaKind: CanonicalReferenceMediaKind;
  state: ReferenceUploadSessionState;
  claimId: string | null;
  assetId: string | null;
  expiresAt: Date;
  claimedAt: Date | null;
  uploadedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreatedReferenceUploadSession = {
  token: string;
  session: ReferenceUploadSession;
};

type SessionRow = {
  session_id: unknown;
  token_hash: unknown;
  user_id: unknown;
  oauth_client_id: unknown;
  media_kind: unknown;
  state: unknown;
  claim_id: unknown;
  asset_id: unknown;
  expires_at: unknown;
  claimed_at: unknown;
  uploaded_at: unknown;
  created_at: unknown;
  updated_at: unknown;
};

type CreateDependencies = {
  executor: QueryExecutor;
  now: () => Date;
  randomUUID: () => string;
  randomToken: () => string;
};

type ReadDependencies = { executor: QueryExecutor };
type ClaimDependencies = {
  executor: TransactionQueryExecutor;
  randomUUID: () => string;
};
type CompleteDependencies = {
  executor: TransactionQueryExecutor;
  uploadedAt: Date;
};
type ReleaseDependencies = {
  executor: TransactionQueryExecutor;
  releasedAt: Date;
};
type ExpireDependencies = {
  executor: QueryExecutor;
  now: () => Date;
};

const defaultExecutor: QueryExecutor = { query };
const defaultCreateDependencies: CreateDependencies = {
  executor: defaultExecutor,
  now: () => new Date(),
  randomUUID,
  randomToken: () => `mru_${randomBytes(32).toString('base64url')}`,
};
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const TOKEN_PATTERN = /^mru_[A-Za-z0-9_-]{43}$/u;
const STATES = new Set<ReferenceUploadSessionState>(['created', 'uploaded', 'expired', 'revoked']);
const MEDIA_KINDS = new Set<CanonicalReferenceMediaKind>(['image', 'video', 'audio']);
const SESSION_COLUMNS = `
  session_id, token_hash, user_id, oauth_client_id, media_kind, state, claim_id, asset_id,
  expires_at, claimed_at, uploaded_at, created_at, updated_at
`;

function boundedText(value: unknown, maxLength: number): value is string {
  return typeof value === 'string'
    && value.length >= 1
    && value.length <= maxLength
    && value === value.trim()
    && !/[\u0000-\u001f\u007f]/u.test(value);
}

function nullableBoundedText(value: unknown, maxLength: number): value is string | null {
  return value === null || boundedText(value, maxLength);
}

function finiteDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? new Date(value.getTime()) : null;
  if (typeof value !== 'string') return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function tokenDigest(token: unknown): string {
  if (typeof token !== 'string' || !TOKEN_PATTERN.test(token)) {
    throw new AgentApiError('REFERENCE_NOT_FOUND', 'Reference upload session not found.');
  }
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function parseSessionRow(row: SessionRow): ReferenceUploadSession {
  const state = typeof row.state === 'string' && STATES.has(row.state as ReferenceUploadSessionState)
    ? row.state as ReferenceUploadSessionState
    : null;
  const expiresAt = finiteDate(row.expires_at);
  const claimedAt = row.claimed_at === null ? null : finiteDate(row.claimed_at);
  const uploadedAt = row.uploaded_at === null ? null : finiteDate(row.uploaded_at);
  const createdAt = finiteDate(row.created_at);
  const updatedAt = finiteDate(row.updated_at);
  const mediaKind = typeof row.media_kind === 'string'
    && MEDIA_KINDS.has(row.media_kind as CanonicalReferenceMediaKind)
    ? row.media_kind as CanonicalReferenceMediaKind
    : null;
  if (!UUID_V4_PATTERN.test(String(row.session_id))
    || typeof row.token_hash !== 'string'
    || !/^[a-f0-9]{64}$/u.test(row.token_hash)
    || !boundedText(row.user_id, 128)
    || !nullableBoundedText(row.oauth_client_id, 256)
    || !mediaKind
    || !state
    || (row.claim_id !== null && !UUID_V4_PATTERN.test(String(row.claim_id)))
    || !nullableBoundedText(row.asset_id, 512)
    || !expiresAt
    || (row.claimed_at !== null && !claimedAt)
    || (row.uploaded_at !== null && !uploadedAt)
    || !createdAt
    || !updatedAt
    || expiresAt.getTime() !== createdAt.getTime() + MCP_REFERENCE_UPLOAD_LIFETIME_SECONDS * 1000
    || updatedAt < createdAt
    || ((row.claim_id === null) !== (claimedAt === null))
    || (state === 'created' && (row.asset_id !== null || uploadedAt !== null))
    || (state === 'uploaded' && (row.claim_id === null || claimedAt === null || row.asset_id === null || uploadedAt === null))
    || ((state === 'expired' || state === 'revoked')
      && (row.claim_id !== null || claimedAt !== null || row.asset_id !== null || uploadedAt !== null))) {
    throw new Error('Invalid reference upload session row.');
  }
  return {
    sessionId: row.session_id as string,
    userId: row.user_id,
    oauthClientId: row.oauth_client_id,
    mediaKind,
    state,
    claimId: row.claim_id as string | null,
    assetId: row.asset_id,
    expiresAt,
    claimedAt,
    uploadedAt,
    createdAt,
    updatedAt,
  };
}

function parseOptionalSession(rows: SessionRow[]): ReferenceUploadSession | null {
  if (rows.length === 0) return null;
  if (rows.length !== 1) throw new Error('Invalid reference upload session result.');
  return parseSessionRow(rows[0]);
}

function requireIdentity(userId: unknown, oauthClientId?: unknown): void {
  if (!boundedText(userId, 128)
    || (oauthClientId !== undefined && !nullableBoundedText(oauthClientId, 256))) {
    throw new AgentApiError('AUTH_REQUIRED', 'Connect MaxVideoAI before uploading reference media.');
  }
}

function requireUuid(value: unknown, label: string): string {
  if (typeof value !== 'string' || !UUID_V4_PATTERN.test(value)) {
    throw new Error(`Invalid ${label}.`);
  }
  return value;
}

function requireClock(value: unknown, label: string): Date {
  const parsed = finiteDate(value);
  if (!parsed) throw new Error(`Invalid ${label} clock.`);
  return parsed;
}

export async function createUploadSession(
  input: {
    userId: string;
    oauthClientId: string | null;
    mediaKind: CanonicalReferenceMediaKind;
  },
  dependencies: Partial<CreateDependencies> = {},
): Promise<CreatedReferenceUploadSession> {
  requireIdentity(input?.userId, input?.oauthClientId);
  if (!MEDIA_KINDS.has(input?.mediaKind)) {
    throw new AgentApiError('REFERENCE_INVALID', 'Choose an image, video, or audio reference.');
  }
  const resolved = { ...defaultCreateDependencies, ...dependencies };
  const createdAt = requireClock(resolved.now(), 'reference upload');
  const expiresAt = new Date(createdAt.getTime() + MCP_REFERENCE_UPLOAD_LIFETIME_SECONDS * 1000);
  const sessionId = requireUuid(resolved.randomUUID(), 'reference upload session UUID');
  const token = resolved.randomToken();
  const tokenHash = tokenDigest(token);
  const rows = await resolved.executor.query<SessionRow>(
    `INSERT INTO mcp_reference_upload_sessions (
      session_id, token_hash, user_id, oauth_client_id, media_kind, state,
      expires_at, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, 'created', $6, $7, $7)
    RETURNING ${SESSION_COLUMNS}`,
    [sessionId, tokenHash, input.userId, input.oauthClientId, input.mediaKind, expiresAt, createdAt],
  );
  const session = parseOptionalSession(rows);
  if (!session) throw new Error('Reference upload session was not persisted.');
  return { token, session };
}

export async function getOwnedUploadSession(
  input: { token: string; userId: string },
  dependencies: ReadDependencies = { executor: defaultExecutor },
): Promise<ReferenceUploadSession | null> {
  requireIdentity(input?.userId);
  const tokenHash = tokenDigest(input?.token);
  const rows = await dependencies.executor.query<SessionRow>(
    `SELECT ${SESSION_COLUMNS}
       FROM mcp_reference_upload_sessions
      WHERE token_hash = $1
        AND user_id = $2
      LIMIT 1`,
    [tokenHash, input.userId],
  );
  return parseOptionalSession(rows);
}

export async function claimUploadSessionForUpload(
  input: { token: string; userId: string },
  dependencies: ClaimDependencies,
): Promise<ReferenceUploadSession> {
  requireIdentity(input?.userId);
  const tokenHash = tokenDigest(input?.token);
  const lockedRows = await dependencies.executor.query<SessionRow>(
    `SELECT ${SESSION_COLUMNS}
       FROM mcp_reference_upload_sessions
      WHERE token_hash = $1
        AND user_id = $2
      FOR UPDATE`,
    [tokenHash, input.userId],
  );
  const locked = parseOptionalSession(lockedRows);
  if (!locked) throw new AgentApiError('REFERENCE_NOT_FOUND', 'Reference upload session not found.');
  const clockRows = await dependencies.executor.query<{ current_time: unknown }>(
    'SELECT clock_timestamp() AS current_time',
  );
  if (clockRows.length !== 1) throw new Error('Invalid reference upload database clock result.');
  const currentTime = requireClock(clockRows[0].current_time, 'reference upload database');
  if (locked.state === 'expired' || locked.state === 'revoked' || locked.expiresAt <= currentTime) {
    throw new AgentApiError('UPLOAD_EXPIRED', 'Reference upload link has expired.');
  }
  if (locked.state !== 'created' || locked.claimId !== null) {
    throw new AgentApiError('UPLOAD_ALREADY_USED', 'Reference upload link has already been used.');
  }
  const claimId = requireUuid(dependencies.randomUUID(), 'reference upload claim UUID');
  const rows = await dependencies.executor.query<SessionRow>(
    `UPDATE mcp_reference_upload_sessions
        SET claim_id = $3, claimed_at = $4, updated_at = $4
      WHERE token_hash = $1
        AND user_id = $2
        AND state = 'created'
        AND claim_id IS NULL
        AND expires_at > $4
    RETURNING ${SESSION_COLUMNS}`,
    [tokenHash, input.userId, claimId, currentTime],
  );
  const claimed = parseOptionalSession(rows);
  if (!claimed) throw new AgentApiError('UPLOAD_ALREADY_USED', 'Reference upload link has already been used.');
  return claimed;
}

export async function completeUploadSession(
  input: {
    sessionId: string;
    userId: string;
    claimId: string;
    mediaKind: CanonicalReferenceMediaKind;
    assetId: string;
  },
  dependencies: CompleteDependencies,
): Promise<ReferenceUploadSession> {
  requireIdentity(input?.userId);
  requireUuid(input?.sessionId, 'reference upload session ID');
  requireUuid(input?.claimId, 'reference upload claim ID');
  if (!MEDIA_KINDS.has(input?.mediaKind)) throw new Error('Invalid reference upload media kind.');
  if (!boundedText(input?.assetId, 512)) throw new Error('Invalid reference upload asset ID.');
  const uploadedAt = requireClock(dependencies.uploadedAt, 'reference upload completion');
  const lockedRows = await dependencies.executor.query<SessionRow>(
    `SELECT ${SESSION_COLUMNS}
       FROM mcp_reference_upload_sessions
      WHERE session_id = $1
        AND user_id = $2
        AND claim_id = $3
        AND media_kind = $4
      FOR UPDATE`,
    [input.sessionId, input.userId, input.claimId, input.mediaKind],
  );
  const locked = parseOptionalSession(lockedRows);
  if (!locked) throw new AgentApiError('UPLOAD_ALREADY_USED', 'Reference upload link cannot be completed.');
  if (locked.state === 'uploaded') {
    if (locked.assetId === input.assetId) return locked;
    throw new AgentApiError('UPLOAD_ALREADY_USED', 'Reference upload link cannot be completed.');
  }
  if (locked.state !== 'created') throw new AgentApiError('UPLOAD_ALREADY_USED', 'Reference upload link cannot be completed.');
  const rows = await dependencies.executor.query<SessionRow>(
    `UPDATE mcp_reference_upload_sessions
        SET state = 'uploaded', asset_id = $5, uploaded_at = $6, updated_at = $6
      WHERE session_id = $1
        AND user_id = $2
        AND claim_id = $3
        AND media_kind = $4
        AND state = 'created'
        AND expires_at > $6
    RETURNING ${SESSION_COLUMNS}`,
    [input.sessionId, input.userId, input.claimId, input.mediaKind, input.assetId, uploadedAt],
  );
  const completed = parseOptionalSession(rows);
  if (!completed) throw new AgentApiError('UPLOAD_ALREADY_USED', 'Reference upload link cannot be completed.');
  return completed;
}

export async function releaseUploadSessionClaim(
  input: { sessionId: string; userId: string; claimId: string },
  dependencies: ReleaseDependencies,
): Promise<ReferenceUploadSession | null> {
  requireIdentity(input?.userId);
  requireUuid(input?.sessionId, 'reference upload session ID');
  requireUuid(input?.claimId, 'reference upload claim ID');
  const releasedAt = requireClock(dependencies.releasedAt, 'reference upload release');
  const rows = await dependencies.executor.query<SessionRow>(
    `UPDATE mcp_reference_upload_sessions
        SET claim_id = NULL, claimed_at = NULL, updated_at = $4
      WHERE session_id = $1
        AND user_id = $2
        AND claim_id = $3
        AND state = 'created'
        AND expires_at > $4
    RETURNING ${SESSION_COLUMNS}`,
    [input.sessionId, input.userId, input.claimId, releasedAt],
  );
  return parseOptionalSession(rows);
}

export async function expireUploadSessions(
  options: { limit?: number } = {},
  dependencies: Partial<ExpireDependencies> = {},
): Promise<number> {
  const limit = options.limit ?? MCP_REFERENCE_UPLOAD_EXPIRATION_BATCH_SIZE;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1_000) {
    throw new Error('Invalid reference upload expiration batch size.');
  }
  const executor = dependencies.executor ?? defaultExecutor;
  const expiredAt = requireClock((dependencies.now ?? (() => new Date()))(), 'reference upload expiration');
  const rows = await executor.query<{ count: unknown }>(
    `WITH expired_sessions AS (
      SELECT session_id
        FROM mcp_reference_upload_sessions
       WHERE state = 'created'
         AND expires_at <= $1
       ORDER BY expires_at ASC, session_id ASC
       LIMIT $2
       FOR UPDATE SKIP LOCKED
    ), updated_sessions AS (
      UPDATE mcp_reference_upload_sessions AS sessions
         SET state = 'expired', claim_id = NULL, claimed_at = NULL, updated_at = $1
        FROM expired_sessions
       WHERE sessions.session_id = expired_sessions.session_id
      RETURNING sessions.session_id
    )
    SELECT COUNT(*)::text AS count FROM updated_sessions`,
    [expiredAt, limit],
  );
  if (rows.length !== 1 || typeof rows[0].count !== 'string' || !/^\d+$/u.test(rows[0].count)) {
    throw new Error('Invalid reference upload expiration result.');
  }
  const count = Number(rows[0].count);
  if (!Number.isSafeInteger(count) || count < 0 || count > limit) {
    throw new Error('Invalid reference upload expiration result.');
  }
  return count;
}
