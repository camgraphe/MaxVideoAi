import { createHash, randomUUID } from 'node:crypto';

import { query, type QueryExecutor, type TransactionQueryExecutor } from '@/lib/db';

import { AgentApiError } from './errors';
import type { CanonicalReferenceMediaKind } from './generation-types';
import { getOwnedUploadSession, type ReferenceUploadSession } from './reference-upload-sessions';

const TOKEN_PATTERN = /^mru_[A-Za-z0-9_-]{43}$/u;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SHA_PATTERN = /^[a-f0-9]{64}$/u;
const ASSET_PATTERN = /^ma_[a-f0-9]{32}$/u;
export const MCP_REFERENCE_UPLOAD_LEASE_MS = 5 * 60_000;
export const MCP_REFERENCE_UPLOAD_MIN_FINALIZE_WINDOW_MS = 2 * 60_000;

export type ReferenceUploadAttemptState = 'pending' | 'processing' | 'staged' | 'failed' | 'completed' | 'aborted';
const ATTEMPT_STATES = new Set<ReferenceUploadAttemptState>(['pending', 'processing', 'staged', 'failed', 'completed', 'aborted']);

export type ReferenceUploadAttempt = {
  protocolVersion: 1 | 2;
  uploadId: string;
  session: ReferenceUploadSession;
  storageKey: string;
  fileName: string;
  declaredMime: string;
  declaredSize: number;
  fileSha256: string | null;
  chunkBytes: number | null;
  totalParts: number | null;
  state: ReferenceUploadAttemptState;
  version: number;
  leaseId: string | null;
  leaseExpiresAt: Date | null;
  contentSha256: string | null;
  stagedAssetId: string | null;
};

export type ReferenceUploadPart = { partNumber: number; storageKey: string; sizeBytes: number; contentSha256: string };
export type ReferenceUploadCleanupRole = 'final' | 'thumbnail';

type AttemptRow = {
  protocol_version: unknown;
  upload_id: unknown; storage_key: unknown; file_name: unknown; declared_mime: unknown;
  declared_size: unknown; file_sha256: unknown; chunk_bytes: unknown; total_parts: unknown;
  state: unknown; version: unknown; lease_id: unknown; lease_expires_at: unknown;
  content_sha256: unknown; staged_asset_id: unknown;
};

const ATTEMPT_COLUMNS = `protocol_version, upload_id, storage_key, file_name, declared_mime, declared_size,
  file_sha256, chunk_bytes, total_parts, state, version, lease_id, lease_expires_at,
  content_sha256, staged_asset_id`;

function requireUuid(value: unknown): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) throw new AgentApiError('REFERENCE_INVALID', 'Reference upload is invalid.');
  return value;
}
function numberFromDb(value: unknown): number { return typeof value === 'string' ? Number(value) : value as number; }
function dateFromDb(value: unknown): Date | null {
  if (value === null) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isFinite(date.getTime()) ? date : null;
}

function parseAttempt(row: AttemptRow, session: ReferenceUploadSession): ReferenceUploadAttempt {
  const declaredSize = numberFromDb(row.declared_size);
  const protocolVersion = row.protocol_version === 1 || row.protocol_version === 2 ? row.protocol_version : null;
  const chunkBytes = row.chunk_bytes === null ? null : numberFromDb(row.chunk_bytes);
  const totalParts = row.total_parts === null ? null : numberFromDb(row.total_parts);
  const version = numberFromDb(row.version);
  const state = typeof row.state === 'string' && ATTEMPT_STATES.has(row.state as ReferenceUploadAttemptState)
    ? row.state as ReferenceUploadAttemptState : null;
  const leaseExpiresAt = dateFromDb(row.lease_expires_at);
  if (!UUID_PATTERN.test(String(row.upload_id))
    || typeof row.storage_key !== 'string' || row.storage_key.length < 1 || row.storage_key.length > 1024
    || typeof row.file_name !== 'string' || row.file_name.length < 1 || row.file_name.length > 255
    || typeof row.declared_mime !== 'string' || row.declared_mime.length < 1 || row.declared_mime.length > 128
    || !Number.isSafeInteger(declaredSize) || declaredSize < 1
    || !protocolVersion
    || (protocolVersion === 2 && (typeof row.file_sha256 !== 'string' || !SHA_PATTERN.test(row.file_sha256)))
    || (protocolVersion === 1 && row.file_sha256 !== null && (typeof row.file_sha256 !== 'string' || !SHA_PATTERN.test(row.file_sha256)))
    || (protocolVersion === 2 && (!Number.isSafeInteger(chunkBytes) || chunkBytes === null || chunkBytes < 1))
    || (protocolVersion === 1 && chunkBytes !== null && (!Number.isSafeInteger(chunkBytes) || chunkBytes < 1))
    || (protocolVersion === 2 && (!Number.isSafeInteger(totalParts) || totalParts === null || totalParts < 1))
    || (protocolVersion === 1 && totalParts !== null && (!Number.isSafeInteger(totalParts) || totalParts < 1))
    || !state || !Number.isSafeInteger(version) || version < 0
    || (row.lease_id !== null && !UUID_PATTERN.test(String(row.lease_id)))
    || ((row.lease_id === null) !== (leaseExpiresAt === null))
    || (row.content_sha256 !== null && (typeof row.content_sha256 !== 'string' || !SHA_PATTERN.test(row.content_sha256)))
    || (row.staged_asset_id !== null && (typeof row.staged_asset_id !== 'string' || !ASSET_PATTERN.test(row.staged_asset_id)))
    || ((row.content_sha256 === null) !== (row.staged_asset_id === null))) throw new Error('Invalid reference upload attempt row.');
  return {
    protocolVersion, uploadId: row.upload_id as string, session, storageKey: row.storage_key, fileName: row.file_name,
    declaredMime: row.declared_mime, declaredSize, fileSha256: row.file_sha256 as string | null, chunkBytes, totalParts,
    state, version, leaseId: row.lease_id as string | null, leaseExpiresAt,
    contentSha256: row.content_sha256 as string | null, stagedAssetId: row.staged_asset_id as string | null,
  };
}

export async function createReferenceUploadAttempt(input: {
  session: ReferenceUploadSession; uploadId: string; storageKey: string; fileName: string;
  declaredMime: string; declaredSize: number; fileSha256: string; chunkBytes: number;
  totalParts: number; mediaKind: CanonicalReferenceMediaKind;
}, dependencies: { executor: TransactionQueryExecutor }): Promise<ReferenceUploadAttempt> {
  const uploadId = requireUuid(input.uploadId);
  if (!input.session.claimId || input.session.mediaKind !== input.mediaKind || !SHA_PATTERN.test(input.fileSha256)
    || !Number.isSafeInteger(input.chunkBytes) || input.chunkBytes < 1
    || !Number.isSafeInteger(input.totalParts) || input.totalParts !== Math.ceil(input.declaredSize / input.chunkBytes)) throw new Error('Invalid claimed upload attempt.');
  const rows = await dependencies.executor.query<AttemptRow>(
    `INSERT INTO mcp_reference_upload_attempts (
       session_id, upload_id, user_id, media_kind, storage_key, file_name, declared_mime,
       declared_size, file_sha256, chunk_bytes, total_parts, protocol_version, state, created_at, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,2,'pending',$12,$12) RETURNING ${ATTEMPT_COLUMNS}`,
    [input.session.sessionId, uploadId, input.session.userId, input.mediaKind, input.storageKey,
      input.fileName, input.declaredMime, input.declaredSize, input.fileSha256, input.chunkBytes, input.totalParts, input.session.claimedAt],
  );
  if (rows.length !== 1) throw new Error('Reference upload attempt was not persisted.');
  return parseAttempt(rows[0], input.session);
}

export async function getOwnedReferenceUploadAttempt(input: { token: string; userId: string; uploadId: string }, dependencies: {
  executor?: QueryExecutor; getOwnedUploadSession?: typeof getOwnedUploadSession;
} = {}): Promise<ReferenceUploadAttempt> {
  if (!TOKEN_PATTERN.test(input.token)) throw new AgentApiError('REFERENCE_NOT_FOUND', 'Reference upload session not found.');
  const uploadId = requireUuid(input.uploadId);
  const executor = dependencies.executor ?? { query };
  const session = await (dependencies.getOwnedUploadSession ?? getOwnedUploadSession)({ token: input.token, userId: input.userId }, { executor });
  if (!session) throw new AgentApiError('REFERENCE_NOT_FOUND', 'Reference upload session not found.');
  const rows = await executor.query<AttemptRow>(
    `SELECT ${ATTEMPT_COLUMNS} FROM mcp_reference_upload_attempts
      WHERE session_id = $1 AND upload_id = $2 AND user_id = $3 AND media_kind = $4 LIMIT 1`,
    [session.sessionId, uploadId, input.userId, session.mediaKind],
  );
  if (rows.length !== 1) throw new AgentApiError('REFERENCE_NOT_FOUND', 'Reference upload session not found.');
  return parseAttempt(rows[0], session);
}

function assertAttemptUsable(attempt: ReferenceUploadAttempt, now: Date): void {
  if (attempt.protocolVersion !== 2) throw new AgentApiError('UPLOAD_EXPIRED', 'Reference upload protocol changed; restart the upload.');
  if (attempt.session.expiresAt <= now) throw new AgentApiError('UPLOAD_EXPIRED', 'Reference upload link has expired.');
  if (attempt.state === 'completed' || attempt.state === 'aborted') throw new AgentApiError('UPLOAD_ALREADY_USED', 'Reference upload has already been used.');
}

export async function claimReferenceUploadPart(input: {
  attempt: ReferenceUploadAttempt; partNumber: number; contentSha256: string; sizeBytes: number;
}, dependencies: { executor: TransactionQueryExecutor; now: Date; leaseId?: string }): Promise<{ leaseId: string; storageKey: string; alreadyStored: boolean }> {
  assertAttemptUsable(input.attempt, dependencies.now);
  if (input.attempt.chunkBytes === null || input.attempt.totalParts === null) {
    throw new AgentApiError('UPLOAD_EXPIRED', 'Reference upload protocol changed; restart the upload.');
  }
  const expectedSize = input.partNumber === input.attempt.totalParts
    ? input.attempt.declaredSize - input.attempt.chunkBytes * (input.attempt.totalParts - 1)
    : input.attempt.chunkBytes;
  if (input.attempt.state !== 'pending' || !SHA_PATTERN.test(input.contentSha256)
    || !Number.isSafeInteger(input.partNumber) || input.partNumber < 1 || input.partNumber > input.attempt.totalParts
    || input.sizeBytes !== expectedSize) throw new AgentApiError('UPLOAD_ALREADY_USED', 'Reference upload cannot accept parts.');
  const leaseId = requireUuid(dependencies.leaseId ?? randomUUID());
  const storageKey = `${input.attempt.storageKey}/parts/${input.partNumber}-${leaseId}`;
  const leaseExpiresAt = new Date(dependencies.now.getTime() + MCP_REFERENCE_UPLOAD_LEASE_MS);
  const rows = await dependencies.executor.query<{ lease_id: unknown; storage_key: unknown; state: unknown }>(
    `INSERT INTO mcp_reference_upload_parts (session_id, upload_id, user_id, media_kind, part_number,
       state, lease_id, lease_expires_at, storage_key, created_at, updated_at)
     SELECT $1,$2,$3,$4,$5,'processing',$6,$7,$8,$9,$9
       FROM mcp_reference_upload_attempts AS attempts
       JOIN mcp_reference_upload_sessions AS sessions ON sessions.session_id = attempts.session_id
      WHERE attempts.session_id = $1 AND attempts.upload_id = $2 AND attempts.user_id = $3
        AND attempts.media_kind = $4 AND attempts.version = $10 AND attempts.state = 'pending'
        AND attempts.lease_id IS NULL AND sessions.user_id = $3 AND sessions.media_kind = $4
        AND sessions.claim_id = $11 AND sessions.state = 'created' AND sessions.expires_at > $9
     ON CONFLICT (upload_id, part_number) DO UPDATE SET state = 'processing', lease_id = EXCLUDED.lease_id,
       lease_expires_at = EXCLUDED.lease_expires_at, storage_key = EXCLUDED.storage_key,
       size_bytes = NULL, content_sha256 = NULL, updated_at = EXCLUDED.updated_at
     WHERE mcp_reference_upload_parts.state = 'failed'
        OR (mcp_reference_upload_parts.state = 'processing' AND mcp_reference_upload_parts.lease_expires_at <= EXCLUDED.updated_at)
     RETURNING lease_id, storage_key, state`,
    [input.attempt.session.sessionId, input.attempt.uploadId, input.attempt.session.userId,
      input.attempt.session.mediaKind, input.partNumber, leaseId, leaseExpiresAt, storageKey, dependencies.now,
      input.attempt.version, input.attempt.session.claimId],
  );
  if (rows.length === 0) {
    const ready = await dependencies.executor.query<{ lease_id: unknown; storage_key: unknown }>(
      `SELECT parts.lease_id, parts.storage_key FROM mcp_reference_upload_parts AS parts
         JOIN mcp_reference_upload_attempts AS attempts ON attempts.session_id = parts.session_id
           AND attempts.upload_id = parts.upload_id AND attempts.user_id = parts.user_id
         JOIN mcp_reference_upload_sessions AS sessions ON sessions.session_id = attempts.session_id
        WHERE parts.session_id = $1 AND parts.upload_id = $2 AND parts.user_id = $3 AND parts.media_kind = $4
          AND parts.part_number = $5 AND parts.state = 'ready' AND parts.size_bytes = $6 AND parts.content_sha256 = $7
          AND attempts.version = $8 AND attempts.state = 'pending' AND attempts.lease_id IS NULL
          AND sessions.claim_id = $9 AND sessions.state = 'created' AND sessions.expires_at > $10`,
      [input.attempt.session.sessionId, input.attempt.uploadId, input.attempt.session.userId,
        input.attempt.session.mediaKind, input.partNumber, input.sizeBytes, input.contentSha256,
        input.attempt.version, input.attempt.session.claimId, dependencies.now],
    );
    if (ready.length === 1) return { leaseId: String(ready[0].lease_id), storageKey: String(ready[0].storage_key), alreadyStored: true };
  }
  if (rows.length !== 1) throw new AgentApiError('UPLOAD_ALREADY_USED', 'This upload part is already processing or stored.');
  const ownerPrefix = `${input.attempt.storageKey}/parts/`;
  await dependencies.executor.query(
    `INSERT INTO mcp_reference_upload_cleanup_objects (
       cleanup_id, session_id, upload_id, user_id, media_kind, object_role,
       object_key, owner_prefix, state, created_at, updated_at
     ) VALUES ($1,$2,$3,$4,$5,'part',$6,$7,'pending',$8,$8)
     ON CONFLICT (session_id, upload_id, user_id, media_kind, object_key) DO NOTHING`,
    [randomUUID(), input.attempt.session.sessionId, input.attempt.uploadId,
      input.attempt.session.userId, input.attempt.session.mediaKind, storageKey, ownerPrefix, dependencies.now],
  );
  return { leaseId, storageKey, alreadyStored: rows[0].state === 'ready' };
}

export async function completeReferenceUploadPart(input: {
  attempt: ReferenceUploadAttempt; partNumber: number; leaseId: string; sizeBytes: number; contentSha256: string;
}, dependencies: { executor: TransactionQueryExecutor; now: Date }): Promise<ReferenceUploadPart> {
  const rows = await dependencies.executor.query<{ part_number: unknown; storage_key: unknown; size_bytes: unknown; content_sha256: unknown }>(
    `UPDATE mcp_reference_upload_parts SET state = 'ready', size_bytes = $5, content_sha256 = $6, updated_at = $7
      WHERE session_id = $1 AND upload_id = $2 AND user_id = $3 AND part_number = $4
       AND lease_id = $8 AND state = 'processing' AND lease_expires_at > $7
     RETURNING part_number, storage_key, size_bytes, content_sha256`,
    [input.attempt.session.sessionId, input.attempt.uploadId, input.attempt.session.userId,
      input.partNumber, input.sizeBytes, input.contentSha256, dependencies.now, requireUuid(input.leaseId)],
  );
  if (rows.length !== 1) throw new AgentApiError('UPLOAD_ALREADY_USED', 'Upload part lease was lost.');
  return { partNumber: Number(rows[0].part_number), storageKey: String(rows[0].storage_key), sizeBytes: Number(rows[0].size_bytes), contentSha256: String(rows[0].content_sha256) };
}

export async function failReferenceUploadPart(input: {
  attempt: ReferenceUploadAttempt; partNumber: number; leaseId: string;
}, dependencies: { executor: TransactionQueryExecutor; failedAt: Date }): Promise<boolean> {
  const rows = await dependencies.executor.query<{ part_number: unknown }>(
    `UPDATE mcp_reference_upload_parts SET state = 'failed', lease_expires_at = $6, updated_at = $6
      WHERE session_id = $1 AND upload_id = $2 AND user_id = $3 AND part_number = $4
       AND lease_id = $5 AND state = 'processing' RETURNING part_number`,
    [input.attempt.session.sessionId, input.attempt.uploadId, input.attempt.session.userId,
      input.partNumber, requireUuid(input.leaseId), dependencies.failedAt],
  );
  return rows.length === 1;
}

export async function listReferenceUploadParts(input: { attempt: ReferenceUploadAttempt }, dependencies: { executor?: QueryExecutor } = {}): Promise<ReferenceUploadPart[]> {
  const executor = dependencies.executor ?? { query };
  const rows = await executor.query<{ part_number: unknown; storage_key: unknown; size_bytes: unknown; content_sha256: unknown }>(
    `SELECT part_number, storage_key, size_bytes, content_sha256 FROM mcp_reference_upload_parts
      WHERE session_id = $1 AND upload_id = $2 AND user_id = $3 AND media_kind = $4 AND state = 'ready' ORDER BY part_number ASC`,
    [input.attempt.session.sessionId, input.attempt.uploadId, input.attempt.session.userId, input.attempt.session.mediaKind],
  );
  return rows.map((row) => ({ partNumber: Number(row.part_number), storageKey: String(row.storage_key), sizeBytes: Number(row.size_bytes), contentSha256: String(row.content_sha256) }));
}

export async function acquireReferenceUploadCompletionLease(input: { attempt: ReferenceUploadAttempt }, dependencies: {
  executor: TransactionQueryExecutor; now: Date; leaseId?: string;
}): Promise<ReferenceUploadAttempt> {
  assertAttemptUsable(input.attempt, dependencies.now);
  const minimumSessionExpiry = new Date(
    dependencies.now.getTime() + MCP_REFERENCE_UPLOAD_MIN_FINALIZE_WINDOW_MS,
  );
  if (input.attempt.session.expiresAt < minimumSessionExpiry) {
    throw new AgentApiError('UPLOAD_EXPIRED', 'Reference upload is too close to expiry; restart the upload.');
  }
  const leaseId = requireUuid(dependencies.leaseId ?? randomUUID());
  const expiresAt = new Date(Math.min(
    dependencies.now.getTime() + MCP_REFERENCE_UPLOAD_LEASE_MS,
    input.attempt.session.expiresAt.getTime(),
  ));
  const rows = await dependencies.executor.query<AttemptRow>(
    `UPDATE mcp_reference_upload_attempts AS attempts SET state = 'processing', lease_id = $5, lease_expires_at = $6,
       version = version + 1, failure_code = NULL, updated_at = $7
      FROM mcp_reference_upload_sessions AS sessions
      WHERE attempts.session_id = $1 AND attempts.upload_id = $2 AND attempts.user_id = $3 AND attempts.media_kind = $4
       AND sessions.session_id = attempts.session_id AND sessions.user_id = attempts.user_id
       AND sessions.media_kind = attempts.media_kind AND sessions.state = 'created' AND sessions.expires_at >= $8
       AND attempts.state IN ('pending','staged','failed','processing')
       AND (attempts.state <> 'processing' OR attempts.lease_expires_at <= $7)
     RETURNING attempts.upload_id, attempts.storage_key, attempts.file_name, attempts.declared_mime,
       attempts.protocol_version, attempts.declared_size, attempts.file_sha256, attempts.chunk_bytes, attempts.total_parts,
       attempts.state, attempts.version, attempts.lease_id, attempts.lease_expires_at,
       attempts.content_sha256, attempts.staged_asset_id`,
    [input.attempt.session.sessionId, input.attempt.uploadId, input.attempt.session.userId,
      input.attempt.session.mediaKind, leaseId, expiresAt, dependencies.now, minimumSessionExpiry],
  );
  if (rows.length !== 1) throw new AgentApiError('UPLOAD_ALREADY_USED', 'Reference upload is already processing.');
  return parseAttempt(rows[0], input.attempt.session);
}

export async function renewReferenceUploadCompletionLease(input: {
  attempt: ReferenceUploadAttempt; leaseId: string; version: number;
}, dependencies: { executor: TransactionQueryExecutor; now: Date }): Promise<ReferenceUploadAttempt> {
  assertAttemptUsable(input.attempt, dependencies.now);
  const expiresAt = new Date(Math.min(
    dependencies.now.getTime() + MCP_REFERENCE_UPLOAD_LEASE_MS,
    input.attempt.session.expiresAt.getTime(),
  ));
  const rows = await dependencies.executor.query<AttemptRow>(
    `UPDATE mcp_reference_upload_attempts AS attempts SET lease_expires_at = $7, updated_at = $8
      FROM mcp_reference_upload_sessions AS sessions
      WHERE attempts.session_id = $1 AND attempts.upload_id = $2 AND attempts.user_id = $3
       AND attempts.media_kind = $4 AND attempts.lease_id = $5 AND attempts.version = $6
       AND attempts.state IN ('processing','staged') AND attempts.lease_expires_at > $8
       AND sessions.session_id = attempts.session_id AND sessions.user_id = attempts.user_id
       AND sessions.media_kind = attempts.media_kind AND sessions.state = 'created' AND sessions.expires_at > $8
     RETURNING attempts.protocol_version, attempts.upload_id, attempts.storage_key, attempts.file_name,
       attempts.declared_mime, attempts.declared_size, attempts.file_sha256, attempts.chunk_bytes,
       attempts.total_parts, attempts.state, attempts.version, attempts.lease_id,
       attempts.lease_expires_at, attempts.content_sha256, attempts.staged_asset_id`,
    [input.attempt.session.sessionId, input.attempt.uploadId, input.attempt.session.userId,
      input.attempt.session.mediaKind, requireUuid(input.leaseId), input.version, expiresAt, dependencies.now],
  );
  if (rows.length !== 1) throw new AgentApiError('UPLOAD_ALREADY_USED', 'Reference upload lease was lost.');
  return parseAttempt(rows[0], input.attempt.session);
}

export async function stageReferenceUploadAttempt(input: {
  attempt: ReferenceUploadAttempt; leaseId: string; version: number; contentSha256: string; assetId: string;
}, dependencies: { executor: TransactionQueryExecutor; updatedAt: Date }): Promise<ReferenceUploadAttempt> {
  if (!SHA_PATTERN.test(input.contentSha256) || !ASSET_PATTERN.test(input.assetId)) throw new Error('Invalid staged upload identity.');
  const rows = await dependencies.executor.query<AttemptRow>(
    `UPDATE mcp_reference_upload_attempts SET content_sha256 = $7, staged_asset_id = $8, state = 'staged', updated_at = $9
      WHERE session_id = $1 AND upload_id = $2 AND user_id = $3 AND media_kind = $4
       AND lease_id = $5 AND version = $6 AND state = 'processing' RETURNING ${ATTEMPT_COLUMNS}`,
    [input.attempt.session.sessionId, input.attempt.uploadId, input.attempt.session.userId,
      input.attempt.session.mediaKind, requireUuid(input.leaseId), input.version, input.contentSha256, input.assetId, dependencies.updatedAt],
  );
  if (rows.length !== 1) throw new AgentApiError('UPLOAD_ALREADY_USED', 'Reference upload lease was lost.');
  return parseAttempt(rows[0], input.attempt.session);
}

export async function completeReferenceUploadAttempt(input: { attempt: ReferenceUploadAttempt; leaseId: string; version: number }, dependencies: {
  executor: TransactionQueryExecutor; completedAt: Date;
}): Promise<ReferenceUploadAttempt> {
  const rows = await dependencies.executor.query<AttemptRow>(
    `UPDATE mcp_reference_upload_attempts SET state = 'completed', lease_id = NULL,
       lease_expires_at = NULL, completed_at = $7, updated_at = $7
      WHERE session_id = $1 AND upload_id = $2 AND user_id = $3 AND media_kind = $4
       AND lease_id = $5 AND version = $6 AND state IN ('processing','staged')
       AND staged_asset_id IS NOT NULL AND content_sha256 IS NOT NULL RETURNING ${ATTEMPT_COLUMNS}`,
    [input.attempt.session.sessionId, input.attempt.uploadId, input.attempt.session.userId,
      input.attempt.session.mediaKind, requireUuid(input.leaseId), input.version, dependencies.completedAt],
  );
  if (rows.length !== 1) throw new AgentApiError('UPLOAD_ALREADY_USED', 'Reference upload lease was lost.');
  return parseAttempt(rows[0], input.attempt.session);
}

export async function failReferenceUploadAttempt(input: { attempt: ReferenceUploadAttempt; leaseId: string; version: number; failureCode: string }, dependencies: {
  executor: TransactionQueryExecutor; failedAt: Date;
}): Promise<boolean> {
  const rows = await dependencies.executor.query<{ upload_id: unknown }>(
    `UPDATE mcp_reference_upload_attempts SET state = 'failed', lease_id = NULL, lease_expires_at = NULL,
       failure_code = $7, updated_at = $8 WHERE session_id = $1 AND upload_id = $2 AND user_id = $3
       AND media_kind = $4 AND lease_id = $5 AND version = $6 AND state IN ('processing','staged') RETURNING upload_id`,
    [input.attempt.session.sessionId, input.attempt.uploadId, input.attempt.session.userId,
      input.attempt.session.mediaKind, requireUuid(input.leaseId), input.version, input.failureCode, dependencies.failedAt],
  );
  return rows.length === 1;
}

export async function abortReferenceUploadAttempt(input: { attempt: ReferenceUploadAttempt }, dependencies: {
  executor: TransactionQueryExecutor; abortedAt: Date;
}): Promise<ReferenceUploadAttempt> {
  if (input.attempt.state === 'completed') throw new AgentApiError('UPLOAD_ALREADY_USED', 'Reference upload has already completed.');
  const rows = await dependencies.executor.query<AttemptRow>(
    `UPDATE mcp_reference_upload_attempts SET state = 'aborted', lease_id = NULL, lease_expires_at = NULL,
       version = version + 1, updated_at = $6
      WHERE session_id = $1 AND upload_id = $2 AND user_id = $3 AND media_kind = $4 AND version = $5
       AND state NOT IN ('completed','aborted') AND (lease_id IS NULL OR lease_expires_at <= $6)
     RETURNING ${ATTEMPT_COLUMNS}`,
    [input.attempt.session.sessionId, input.attempt.uploadId, input.attempt.session.userId,
      input.attempt.session.mediaKind, input.attempt.version, dependencies.abortedAt],
  );
  if (rows.length !== 1) throw new AgentApiError('UPLOAD_ALREADY_USED', 'Reference upload cannot be aborted.');
  return parseAttempt(rows[0], input.attempt.session);
}

export async function cleanupReferenceUploadParts(input: { attempt: ReferenceUploadAttempt }, dependencies: {
  executor?: QueryExecutor; deleteStorageObjectKey(key: string): Promise<unknown>;
}): Promise<number> {
  const executor = dependencies.executor ?? { query };
  const rows = await executor.query<{ cleanup_id: unknown; object_key: unknown; owner_prefix: unknown }>(
    `SELECT cleanup_id, object_key, owner_prefix FROM mcp_reference_upload_cleanup_objects
      WHERE session_id = $1 AND upload_id = $2 AND user_id = $3 AND media_kind = $4
       AND object_role = 'part' AND state = 'pending' ORDER BY created_at ASC, cleanup_id ASC`,
    [input.attempt.session.sessionId, input.attempt.uploadId, input.attempt.session.userId, input.attempt.session.mediaKind],
  );
  const expectedPrefix = `${input.attempt.storageKey}/parts/`;
  const scopedRows = rows.filter((row) => String(row.owner_prefix) === expectedPrefix
    && String(row.object_key).startsWith(expectedPrefix));
  const results = await Promise.allSettled(scopedRows.map((row) => dependencies.deleteStorageObjectKey(String(row.object_key))));
  const deletedIds = scopedRows.filter((_row, index) => results[index]?.status === 'fulfilled').map((row) => String(row.cleanup_id));
  if (deletedIds.length) await executor.query(
    `UPDATE mcp_reference_upload_cleanup_objects SET state = 'deleted', updated_at = clock_timestamp()
      WHERE cleanup_id = ANY($1::uuid[]) AND state = 'pending'`,
    [deletedIds],
  );
  return deletedIds.length;
}

export async function cleanupReferenceUploadObject(input: {
  attempt: ReferenceUploadAttempt; objectKey: string;
}, dependencies: { executor?: QueryExecutor; deleteStorageObjectKey(key: string): Promise<unknown> }): Promise<boolean> {
  const executor = dependencies.executor ?? { query };
  const rows = await executor.query<{ cleanup_id: unknown; object_key: unknown; owner_prefix: unknown; object_role: unknown }>(
    `SELECT cleanup_id, object_key, owner_prefix, object_role
       FROM mcp_reference_upload_cleanup_objects
      WHERE session_id = $1 AND upload_id = $2 AND user_id = $3 AND media_kind = $4
        AND object_key = $5 AND state = 'pending' LIMIT 1`,
    [input.attempt.session.sessionId, input.attempt.uploadId, input.attempt.session.userId,
      input.attempt.session.mediaKind, input.objectKey],
  );
  if (rows.length !== 1) return false;
  const row = rows[0];
  const objectKey = String(row.object_key);
  const ownerPrefix = String(row.owner_prefix);
  const scoped = objectKey.startsWith(ownerPrefix) && (
    (row.object_role === 'part' && ownerPrefix === `${input.attempt.storageKey}/parts/`)
    || (row.object_role === 'thumbnail' && ownerPrefix.startsWith('user-asset-thumbs/'))
    || (row.object_role === 'final' && ownerPrefix.startsWith('user-assets/'))
  );
  if (!scoped) return false;
  try {
    await dependencies.deleteStorageObjectKey(objectKey);
  } catch {
    return false;
  }
  const updated = await executor.query<{ cleanup_id: unknown }>(
    `UPDATE mcp_reference_upload_cleanup_objects SET state = 'deleted', updated_at = clock_timestamp()
      WHERE cleanup_id = $1 AND state = 'pending' RETURNING cleanup_id`,
    [String(row.cleanup_id)],
  );
  return updated.length === 1;
}

function cleanupObjectOwnerPrefix(input: {
  attempt: ReferenceUploadAttempt; objectKey: string; objectRole: ReferenceUploadCleanupRole; safeToDelete: boolean;
}): string {
  const objectKey = input.objectKey.trim();
  const separator = objectKey.lastIndexOf('/');
  const expectedRoot = input.objectRole === 'final' ? 'user-assets/by-content/' : 'user-asset-thumbs/';
  if (objectKey !== input.objectKey || objectKey.length < 1 || objectKey.length > 1024
    || separator < expectedRoot.length || !objectKey.startsWith(expectedRoot)
    || (input.objectRole === 'thumbnail' && !input.safeToDelete)) {
    throw new Error('Invalid reference upload cleanup object scope.');
  }
  return objectKey.slice(0, separator + 1);
}

export async function registerReferenceUploadCleanupObject(input: {
  attempt: ReferenceUploadAttempt; objectKey: string; objectRole: ReferenceUploadCleanupRole; safeToDelete: boolean;
}, dependencies: { executor: TransactionQueryExecutor; now: Date }): Promise<void> {
  const ownerPrefix = cleanupObjectOwnerPrefix(input);
  const initialState = 'pending';
  const inserted = await dependencies.executor.query<{ cleanup_id: unknown }>(
    `INSERT INTO mcp_reference_upload_cleanup_objects (
       cleanup_id, session_id, upload_id, user_id, media_kind, object_role,
       object_key, owner_prefix, state, created_at, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)
     ON CONFLICT (session_id, upload_id, user_id, media_kind, object_key) DO NOTHING RETURNING cleanup_id`,
    [randomUUID(), input.attempt.session.sessionId, input.attempt.uploadId,
      input.attempt.session.userId, input.attempt.session.mediaKind, input.objectRole,
      input.objectKey, ownerPrefix, initialState, dependencies.now],
  );
  if (inserted.length === 1) return;
  const existing = await dependencies.executor.query<{ cleanup_id: unknown }>(
    `SELECT cleanup_id FROM mcp_reference_upload_cleanup_objects
      WHERE session_id = $1 AND upload_id = $2 AND user_id = $3 AND media_kind = $4
       AND object_role = $5 AND object_key = $6 AND owner_prefix = $7 AND state = $8 LIMIT 1`,
    [input.attempt.session.sessionId, input.attempt.uploadId, input.attempt.session.userId,
      input.attempt.session.mediaKind, input.objectRole, input.objectKey, ownerPrefix, initialState],
  );
  if (existing.length !== 1) throw new Error('Reference upload cleanup object belongs to another attempt.');
}

export async function retainReferenceUploadCleanupObject(input: {
  attempt: ReferenceUploadAttempt; objectKey: string;
}, dependencies: { executor: TransactionQueryExecutor; now: Date }): Promise<void> {
  const rows = await dependencies.executor.query<{ cleanup_id: unknown }>(
    `UPDATE mcp_reference_upload_cleanup_objects SET state = 'retained', updated_at = $6
      WHERE session_id = $1 AND upload_id = $2 AND user_id = $3 AND media_kind = $4
       AND object_key = $5 AND state = 'pending' RETURNING cleanup_id`,
    [input.attempt.session.sessionId, input.attempt.uploadId, input.attempt.session.userId,
      input.attempt.session.mediaKind, input.objectKey, dependencies.now],
  );
  if (rows.length === 1) return;
  const retained = await dependencies.executor.query<{ cleanup_id: unknown }>(
    `SELECT cleanup_id FROM mcp_reference_upload_cleanup_objects
      WHERE session_id = $1 AND upload_id = $2 AND user_id = $3 AND media_kind = $4
       AND object_key = $5 AND state = 'retained' LIMIT 1`,
    [input.attempt.session.sessionId, input.attempt.uploadId, input.attempt.session.userId,
      input.attempt.session.mediaKind, input.objectKey],
  );
  if (retained.length !== 1) throw new Error('Reference upload cleanup object was not retained.');
}

export async function cleanupExpiredReferenceUploadAttempts(options: { limit?: number } = {}, dependencies: {
  executor?: QueryExecutor;
  now?: () => Date;
  deleteStorageObjectKey(key: string): Promise<unknown>;
}): Promise<{ selected: number; deleted: number }> {
  const limit = options.limit ?? 100;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1_000) throw new Error('Invalid upload cleanup batch size.');
  const executor = dependencies.executor ?? { query };
  const now = (dependencies.now ?? (() => new Date()))();
  const rows = await executor.query<{
    cleanup_id: unknown; object_key: unknown; owner_prefix: unknown;
    object_role: unknown; attempt_storage_key: unknown;
  }>(
    `WITH candidates AS (
       SELECT attempts.session_id, attempts.upload_id, attempts.user_id, attempts.media_kind
         FROM mcp_reference_upload_attempts AS attempts
         JOIN mcp_reference_upload_sessions AS sessions ON sessions.session_id = attempts.session_id
        WHERE ((attempts.state = 'aborted' AND EXISTS (
             SELECT 1 FROM mcp_reference_upload_cleanup_objects AS cleanup
              WHERE cleanup.session_id = attempts.session_id AND cleanup.upload_id = attempts.upload_id
                AND cleanup.user_id = attempts.user_id AND cleanup.media_kind = attempts.media_kind
                AND cleanup.state = 'pending'
           ))
           OR (sessions.expires_at <= $1
             AND attempts.state IN ('pending','processing','staged','failed')
             AND (attempts.lease_id IS NULL OR attempts.lease_expires_at <= $1)))
          AND (attempts.lease_id IS NULL OR attempts.lease_expires_at <= $1)
        ORDER BY attempts.updated_at ASC, attempts.upload_id ASC
        LIMIT $2 FOR UPDATE OF attempts SKIP LOCKED
     ), aborted AS (
       UPDATE mcp_reference_upload_attempts AS attempts
          SET state = 'aborted', lease_id = NULL, lease_expires_at = NULL, updated_at = $1
         FROM candidates
        WHERE attempts.session_id = candidates.session_id AND attempts.upload_id = candidates.upload_id
       RETURNING attempts.session_id, attempts.upload_id, attempts.user_id, attempts.media_kind,
         attempts.storage_key
     ), protected AS (
       UPDATE mcp_reference_upload_cleanup_objects AS cleanup
          SET state = 'retained', updated_at = $1
         FROM aborted
        WHERE cleanup.session_id = aborted.session_id AND cleanup.upload_id = aborted.upload_id
          AND cleanup.user_id = aborted.user_id AND cleanup.media_kind = aborted.media_kind
          AND cleanup.state = 'pending' AND cleanup.object_role IN ('final','thumbnail','legacy_staging')
          AND (
            EXISTS (SELECT 1 FROM user_assets AS assets WHERE assets.user_id = cleanup.user_id
              AND (position(cleanup.object_key in assets.url) > 0
                OR position(cleanup.object_key in COALESCE(assets.metadata->>'thumbUrl', '')) > 0))
            OR EXISTS (SELECT 1 FROM media_assets AS media WHERE media.user_id = cleanup.user_id
              AND media.deleted_at IS NULL
              AND (position(cleanup.object_key in media.url) > 0
                OR position(cleanup.object_key in COALESCE(media.thumb_url, '')) > 0))
          )
       RETURNING cleanup.cleanup_id
     )
     SELECT cleanup.cleanup_id, cleanup.object_key, cleanup.owner_prefix, cleanup.object_role,
       aborted.storage_key AS attempt_storage_key
       FROM mcp_reference_upload_cleanup_objects AS cleanup
       JOIN aborted ON aborted.session_id = cleanup.session_id AND aborted.upload_id = cleanup.upload_id
         AND aborted.user_id = cleanup.user_id AND aborted.media_kind = cleanup.media_kind
      WHERE cleanup.state = 'pending'
        AND NOT EXISTS (SELECT 1 FROM protected WHERE protected.cleanup_id = cleanup.cleanup_id)
      ORDER BY cleanup.created_at ASC, cleanup.cleanup_id ASC`,
    [now, limit],
  );
  const scopedRows = rows.filter((row) => {
    const objectKey = String(row.object_key);
    const ownerPrefix = String(row.owner_prefix);
    if (!objectKey.startsWith(ownerPrefix)) return false;
    if (row.object_role === 'part') return ownerPrefix === `${String(row.attempt_storage_key)}/parts/`;
    if (row.object_role === 'thumbnail') return ownerPrefix.startsWith('user-asset-thumbs/');
    if (row.object_role === 'legacy_staging') return ownerPrefix.startsWith('mcp-reference-')
      && objectKey === String(row.attempt_storage_key);
    return row.object_role === 'final' && ownerPrefix.startsWith('user-assets/');
  });
  const results = await Promise.allSettled(scopedRows.map((row) => dependencies.deleteStorageObjectKey(String(row.object_key))));
  const deletedIds = scopedRows.filter((_row, index) => results[index]?.status === 'fulfilled')
    .map((row) => String(row.cleanup_id));
  if (deletedIds.length) await executor.query(
    `UPDATE mcp_reference_upload_cleanup_objects SET state = 'deleted', updated_at = clock_timestamp()
      WHERE cleanup_id = ANY($1::uuid[]) AND state = 'pending'`,
    [deletedIds],
  );
  return { selected: scopedRows.length, deleted: deletedIds.length };
}

export function contentSha256(bytes: Buffer): string { return createHash('sha256').update(bytes).digest('hex'); }
