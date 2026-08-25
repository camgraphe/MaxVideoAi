import { createHash, randomUUID } from 'node:crypto';

import { query, type QueryExecutor, type TransactionQueryExecutor } from '@/lib/db';

import { AgentApiError } from './errors';
import type { CanonicalReferenceMediaKind } from './generation-types';
import { getOwnedUploadSession, type ReferenceUploadSession } from './reference-upload-sessions';

const TOKEN_PATTERN = /^mru_[A-Za-z0-9_-]{43}$/u;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SHA_PATTERN = /^[a-f0-9]{64}$/u;
const ASSET_PATTERN = /^ma_[a-f0-9]{32}$/u;
export const MCP_REFERENCE_UPLOAD_LEASE_MS = 60_000;

export type ReferenceUploadAttemptState = 'pending' | 'processing' | 'staged' | 'failed' | 'completed' | 'aborted';
const ATTEMPT_STATES = new Set<ReferenceUploadAttemptState>(['pending', 'processing', 'staged', 'failed', 'completed', 'aborted']);

export type ReferenceUploadAttempt = {
  uploadId: string;
  session: ReferenceUploadSession;
  storageKey: string;
  fileName: string;
  declaredMime: string;
  declaredSize: number;
  fileSha256: string;
  chunkBytes: number;
  totalParts: number;
  state: ReferenceUploadAttemptState;
  version: number;
  leaseId: string | null;
  leaseExpiresAt: Date | null;
  contentSha256: string | null;
  stagedAssetId: string | null;
};

export type ReferenceUploadPart = { partNumber: number; storageKey: string; sizeBytes: number; contentSha256: string };

type AttemptRow = {
  upload_id: unknown; storage_key: unknown; file_name: unknown; declared_mime: unknown;
  declared_size: unknown; file_sha256: unknown; chunk_bytes: unknown; total_parts: unknown;
  state: unknown; version: unknown; lease_id: unknown; lease_expires_at: unknown;
  content_sha256: unknown; staged_asset_id: unknown;
};

const ATTEMPT_COLUMNS = `upload_id, storage_key, file_name, declared_mime, declared_size,
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
  const chunkBytes = numberFromDb(row.chunk_bytes);
  const totalParts = numberFromDb(row.total_parts);
  const version = numberFromDb(row.version);
  const state = typeof row.state === 'string' && ATTEMPT_STATES.has(row.state as ReferenceUploadAttemptState)
    ? row.state as ReferenceUploadAttemptState : null;
  const leaseExpiresAt = dateFromDb(row.lease_expires_at);
  if (!UUID_PATTERN.test(String(row.upload_id))
    || typeof row.storage_key !== 'string' || row.storage_key.length < 1 || row.storage_key.length > 1024
    || typeof row.file_name !== 'string' || row.file_name.length < 1 || row.file_name.length > 255
    || typeof row.declared_mime !== 'string' || row.declared_mime.length < 1 || row.declared_mime.length > 128
    || !Number.isSafeInteger(declaredSize) || declaredSize < 1
    || typeof row.file_sha256 !== 'string' || !SHA_PATTERN.test(row.file_sha256)
    || !Number.isSafeInteger(chunkBytes) || chunkBytes < 1
    || !Number.isSafeInteger(totalParts) || totalParts < 1
    || !state || !Number.isSafeInteger(version) || version < 0
    || (row.lease_id !== null && !UUID_PATTERN.test(String(row.lease_id)))
    || ((row.lease_id === null) !== (leaseExpiresAt === null))
    || (row.content_sha256 !== null && (typeof row.content_sha256 !== 'string' || !SHA_PATTERN.test(row.content_sha256)))
    || (row.staged_asset_id !== null && (typeof row.staged_asset_id !== 'string' || !ASSET_PATTERN.test(row.staged_asset_id)))
    || ((row.content_sha256 === null) !== (row.staged_asset_id === null))) throw new Error('Invalid reference upload attempt row.');
  return {
    uploadId: row.upload_id as string, session, storageKey: row.storage_key, fileName: row.file_name,
    declaredMime: row.declared_mime, declaredSize, fileSha256: row.file_sha256, chunkBytes, totalParts,
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
       declared_size, file_sha256, chunk_bytes, total_parts, state, created_at, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pending',$12,$12) RETURNING ${ATTEMPT_COLUMNS}`,
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
  if (attempt.session.expiresAt <= now) throw new AgentApiError('UPLOAD_EXPIRED', 'Reference upload link has expired.');
  if (attempt.state === 'completed' || attempt.state === 'aborted') throw new AgentApiError('UPLOAD_ALREADY_USED', 'Reference upload has already been used.');
}

export async function claimReferenceUploadPart(input: {
  attempt: ReferenceUploadAttempt; partNumber: number; contentSha256: string; sizeBytes: number;
}, dependencies: { executor: TransactionQueryExecutor; now: Date; leaseId?: string }): Promise<{ leaseId: string; storageKey: string; alreadyStored: boolean }> {
  assertAttemptUsable(input.attempt, dependencies.now);
  if (input.attempt.state !== 'pending' || !SHA_PATTERN.test(input.contentSha256)) throw new AgentApiError('UPLOAD_ALREADY_USED', 'Reference upload cannot accept parts.');
  const leaseId = requireUuid(dependencies.leaseId ?? randomUUID());
  const storageKey = `${input.attempt.storageKey}/parts/${input.partNumber}-${leaseId}`;
  const leaseExpiresAt = new Date(dependencies.now.getTime() + MCP_REFERENCE_UPLOAD_LEASE_MS);
  const rows = await dependencies.executor.query<{ lease_id: unknown; storage_key: unknown; state: unknown }>(
    `INSERT INTO mcp_reference_upload_parts (session_id, upload_id, user_id, media_kind, part_number,
       state, lease_id, lease_expires_at, storage_key, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,'processing',$6,$7,$8,$9,$9)
     ON CONFLICT (upload_id, part_number) DO UPDATE SET state = 'processing', lease_id = EXCLUDED.lease_id,
       lease_expires_at = EXCLUDED.lease_expires_at, storage_key = EXCLUDED.storage_key,
       size_bytes = NULL, content_sha256 = NULL, updated_at = EXCLUDED.updated_at
     WHERE mcp_reference_upload_parts.state = 'failed'
        OR (mcp_reference_upload_parts.state = 'processing' AND mcp_reference_upload_parts.lease_expires_at <= EXCLUDED.updated_at)
     RETURNING lease_id, storage_key, state`,
    [input.attempt.session.sessionId, input.attempt.uploadId, input.attempt.session.userId,
      input.attempt.session.mediaKind, input.partNumber, leaseId, leaseExpiresAt, storageKey, dependencies.now],
  );
  if (rows.length === 0) {
    const ready = await dependencies.executor.query<{ lease_id: unknown; storage_key: unknown }>(
      `SELECT lease_id, storage_key FROM mcp_reference_upload_parts
        WHERE session_id = $1 AND upload_id = $2 AND user_id = $3 AND media_kind = $4
          AND part_number = $5 AND state = 'ready' AND size_bytes = $6 AND content_sha256 = $7`,
      [input.attempt.session.sessionId, input.attempt.uploadId, input.attempt.session.userId,
        input.attempt.session.mediaKind, input.partNumber, input.sizeBytes, input.contentSha256],
    );
    if (ready.length === 1) return { leaseId: String(ready[0].lease_id), storageKey: String(ready[0].storage_key), alreadyStored: true };
  }
  if (rows.length !== 1) throw new AgentApiError('UPLOAD_ALREADY_USED', 'This upload part is already processing or stored.');
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
  const leaseId = requireUuid(dependencies.leaseId ?? randomUUID());
  const expiresAt = new Date(dependencies.now.getTime() + MCP_REFERENCE_UPLOAD_LEASE_MS);
  const rows = await dependencies.executor.query<AttemptRow>(
    `UPDATE mcp_reference_upload_attempts AS attempts SET state = 'processing', lease_id = $5, lease_expires_at = $6,
       version = version + 1, failure_code = NULL, updated_at = $7
      FROM mcp_reference_upload_sessions AS sessions
      WHERE attempts.session_id = $1 AND attempts.upload_id = $2 AND attempts.user_id = $3 AND attempts.media_kind = $4
       AND sessions.session_id = attempts.session_id AND sessions.user_id = attempts.user_id
       AND sessions.media_kind = attempts.media_kind AND sessions.state = 'created' AND sessions.expires_at > $7
       AND attempts.state IN ('pending','staged','failed','processing')
       AND (attempts.state <> 'processing' OR attempts.lease_expires_at <= $7)
     RETURNING attempts.upload_id, attempts.storage_key, attempts.file_name, attempts.declared_mime,
       attempts.declared_size, attempts.file_sha256, attempts.chunk_bytes, attempts.total_parts,
       attempts.state, attempts.version, attempts.lease_id, attempts.lease_expires_at,
       attempts.content_sha256, attempts.staged_asset_id`,
    [input.attempt.session.sessionId, input.attempt.uploadId, input.attempt.session.userId,
      input.attempt.session.mediaKind, leaseId, expiresAt, dependencies.now],
  );
  if (rows.length !== 1) throw new AgentApiError('UPLOAD_ALREADY_USED', 'Reference upload is already processing.');
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
       AND lease_id = $5 AND version = $6 AND state = 'staged' RETURNING ${ATTEMPT_COLUMNS}`,
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
    `UPDATE mcp_reference_upload_attempts SET state = 'aborted', lease_id = NULL, lease_expires_at = NULL, updated_at = $5
      WHERE session_id = $1 AND upload_id = $2 AND user_id = $3 AND media_kind = $4 AND state <> 'completed'
     RETURNING ${ATTEMPT_COLUMNS}`,
    [input.attempt.session.sessionId, input.attempt.uploadId, input.attempt.session.userId, input.attempt.session.mediaKind, dependencies.abortedAt],
  );
  if (rows.length !== 1) throw new AgentApiError('UPLOAD_ALREADY_USED', 'Reference upload cannot be aborted.');
  return parseAttempt(rows[0], input.attempt.session);
}

export async function cleanupReferenceUploadParts(input: { attempt: ReferenceUploadAttempt }, dependencies: {
  executor?: QueryExecutor; deleteStorageObjectKey(key: string): Promise<unknown>;
}): Promise<number> {
  const executor = dependencies.executor ?? { query };
  const rows = await executor.query<{ storage_key: unknown }>(
    `SELECT storage_key FROM mcp_reference_upload_parts WHERE session_id = $1 AND upload_id = $2 AND user_id = $3`,
    [input.attempt.session.sessionId, input.attempt.uploadId, input.attempt.session.userId],
  );
  const results = await Promise.allSettled(rows.map((row) => dependencies.deleteStorageObjectKey(String(row.storage_key))));
  const deletedKeys = rows.filter((_row, index) => results[index]?.status === 'fulfilled').map((row) => String(row.storage_key));
  if (deletedKeys.length) await executor.query(
    `DELETE FROM mcp_reference_upload_parts WHERE session_id = $1 AND upload_id = $2 AND user_id = $3 AND storage_key = ANY($4::text[])`,
    [input.attempt.session.sessionId, input.attempt.uploadId, input.attempt.session.userId, deletedKeys],
  );
  return deletedKeys.length;
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
  const rows = await executor.query<{ storage_key: unknown }>(
    `WITH candidates AS (
       SELECT attempts.session_id, attempts.upload_id
         FROM mcp_reference_upload_attempts AS attempts
         JOIN mcp_reference_upload_sessions AS sessions ON sessions.session_id = attempts.session_id
        WHERE attempts.state = 'aborted'
           OR (sessions.expires_at <= $1
             AND attempts.state IN ('pending','processing','staged','failed')
             AND (attempts.state <> 'processing' OR attempts.lease_expires_at <= $1))
        ORDER BY attempts.updated_at ASC, attempts.upload_id ASC
        LIMIT $2 FOR UPDATE SKIP LOCKED
     ), aborted AS (
       UPDATE mcp_reference_upload_attempts AS attempts
          SET state = 'aborted', lease_id = NULL, lease_expires_at = NULL, updated_at = $1
         FROM candidates
        WHERE attempts.session_id = candidates.session_id AND attempts.upload_id = candidates.upload_id
       RETURNING attempts.session_id, attempts.upload_id
     )
     SELECT parts.storage_key FROM mcp_reference_upload_parts AS parts
       JOIN aborted ON aborted.session_id = parts.session_id AND aborted.upload_id = parts.upload_id`,
    [now, limit],
  );
  const results = await Promise.allSettled(rows.map((row) => dependencies.deleteStorageObjectKey(String(row.storage_key))));
  const deletedKeys = rows.filter((_row, index) => results[index]?.status === 'fulfilled').map((row) => String(row.storage_key));
  if (deletedKeys.length) await executor.query(
    `DELETE FROM mcp_reference_upload_parts WHERE storage_key = ANY($4::text[])`,
    [now, limit, rows.length, deletedKeys],
  );
  return { selected: rows.length, deleted: deletedKeys.length };
}

export function contentSha256(bytes: Buffer): string { return createHash('sha256').update(bytes).digest('hex'); }
