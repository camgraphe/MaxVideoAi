import { createHash } from 'node:crypto';

import { query, type QueryExecutor, type TransactionQueryExecutor } from '@/lib/db';

import { AgentApiError } from './errors';
import type { CanonicalReferenceMediaKind } from './generation-types';
import {
  getOwnedUploadSession,
  releaseUploadSessionClaim,
  type ReferenceUploadSession,
} from './reference-upload-sessions';

const TOKEN_PATTERN = /^mru_[A-Za-z0-9_-]{43}$/u;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export type ReferenceUploadAttempt = {
  uploadId: string;
  session: ReferenceUploadSession;
  storageKey: string;
  fileName: string;
  declaredMime: string;
  declaredSize: number;
  contentSha256: string | null;
  stagedAssetId: string | null;
};

type AttemptRow = {
  upload_id: unknown;
  storage_key: unknown;
  file_name: unknown;
  declared_mime: unknown;
  declared_size: unknown;
  content_sha256: unknown;
  staged_asset_id: unknown;
};

function requireUuid(value: unknown): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) throw new AgentApiError('REFERENCE_INVALID', 'Reference upload is invalid.');
  return value;
}

function parseAttempt(row: AttemptRow, session: ReferenceUploadSession): ReferenceUploadAttempt {
  const declaredSize = typeof row.declared_size === 'string' ? Number(row.declared_size) : row.declared_size;
  if (!UUID_PATTERN.test(String(row.upload_id))
    || typeof row.storage_key !== 'string' || row.storage_key.length < 1 || row.storage_key.length > 1024
    || typeof row.file_name !== 'string' || row.file_name.length < 1 || row.file_name.length > 255
    || typeof row.declared_mime !== 'string' || row.declared_mime.length < 1 || row.declared_mime.length > 128
    || typeof declaredSize !== 'number' || !Number.isSafeInteger(declaredSize) || declaredSize < 1
    || (row.content_sha256 !== null && (typeof row.content_sha256 !== 'string' || !/^[a-f0-9]{64}$/u.test(row.content_sha256)))
    || (row.staged_asset_id !== null && (typeof row.staged_asset_id !== 'string' || !/^ma_[a-f0-9]{32}$/u.test(row.staged_asset_id)))
    || ((row.content_sha256 === null) !== (row.staged_asset_id === null))) {
    throw new Error('Invalid reference upload attempt row.');
  }
  return {
    uploadId: row.upload_id as string,
    session,
    storageKey: row.storage_key,
    fileName: row.file_name,
    declaredMime: row.declared_mime,
    declaredSize,
    contentSha256: row.content_sha256 as string | null,
    stagedAssetId: row.staged_asset_id as string | null,
  };
}

export async function createReferenceUploadAttempt(input: {
  session: ReferenceUploadSession;
  uploadId: string;
  storageKey: string;
  fileName: string;
  declaredMime: string;
  declaredSize: number;
  mediaKind: CanonicalReferenceMediaKind;
}, dependencies: { executor: TransactionQueryExecutor }): Promise<ReferenceUploadAttempt> {
  const uploadId = requireUuid(input.uploadId);
  if (!input.session.claimId || input.session.mediaKind !== input.mediaKind) throw new Error('Invalid claimed upload session.');
  const rows = await dependencies.executor.query<AttemptRow>(
    `INSERT INTO mcp_reference_upload_attempts (
       session_id, upload_id, user_id, media_kind, storage_key, file_name, declared_mime,
       declared_size, created_at, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)
     RETURNING upload_id, storage_key, file_name, declared_mime, declared_size, content_sha256, staged_asset_id`,
    [input.session.sessionId, uploadId, input.session.userId, input.mediaKind, input.storageKey,
      input.fileName, input.declaredMime, input.declaredSize, input.session.claimedAt],
  );
  if (rows.length !== 1) throw new Error('Reference upload attempt was not persisted.');
  return parseAttempt(rows[0], input.session);
}

export async function getOwnedReferenceUploadAttempt(input: {
  token: string;
  userId: string;
  uploadId: string;
}, dependencies: { executor?: QueryExecutor; getOwnedUploadSession?: typeof getOwnedUploadSession } = {}): Promise<ReferenceUploadAttempt> {
  if (!TOKEN_PATTERN.test(input.token)) throw new AgentApiError('REFERENCE_NOT_FOUND', 'Reference upload session not found.');
  const uploadId = requireUuid(input.uploadId);
  const executor = dependencies.executor ?? { query };
  const session = await (dependencies.getOwnedUploadSession ?? getOwnedUploadSession)(
    { token: input.token, userId: input.userId }, { executor },
  );
  if (!session) throw new AgentApiError('REFERENCE_NOT_FOUND', 'Reference upload session not found.');
  const rows = await executor.query<AttemptRow>(
    `SELECT upload_id, storage_key, file_name, declared_mime, declared_size, content_sha256, staged_asset_id
       FROM mcp_reference_upload_attempts
      WHERE session_id = $1 AND upload_id = $2 AND user_id = $3 AND media_kind = $4
      LIMIT 1`,
    [session.sessionId, uploadId, input.userId, session.mediaKind],
  );
  if (rows.length !== 1) throw new AgentApiError('REFERENCE_NOT_FOUND', 'Reference upload session not found.');
  return parseAttempt(rows[0], session);
}

export async function stageReferenceUploadAttempt(input: {
  sessionId: string;
  uploadId: string;
  userId: string;
  claimId: string;
  mediaKind: CanonicalReferenceMediaKind;
  contentSha256: string;
  assetId: string;
}, dependencies: { executor: TransactionQueryExecutor; updatedAt: Date }): Promise<{ stagedAssetId: string }> {
  requireUuid(input.sessionId);
  requireUuid(input.uploadId);
  requireUuid(input.claimId);
  if (!/^[a-f0-9]{64}$/u.test(input.contentSha256) || !/^ma_[a-f0-9]{32}$/u.test(input.assetId)) throw new Error('Invalid staged upload identity.');
  const rows = await dependencies.executor.query<{ staged_asset_id: string }>(
    `UPDATE mcp_reference_upload_attempts AS attempts
        SET content_sha256 = $6, staged_asset_id = $7, updated_at = $8
       FROM mcp_reference_upload_sessions AS sessions
      WHERE attempts.session_id = $1 AND attempts.upload_id = $2 AND attempts.user_id = $3
        AND attempts.media_kind = $5 AND sessions.session_id = attempts.session_id
        AND sessions.user_id = $3 AND sessions.claim_id = $4 AND sessions.state = 'created'
        AND (attempts.staged_asset_id IS NULL OR attempts.staged_asset_id = $7)
    RETURNING attempts.staged_asset_id`,
    [input.sessionId, input.uploadId, input.userId, input.claimId, input.mediaKind,
      input.contentSha256, input.assetId, dependencies.updatedAt],
  );
  if (rows.length !== 1 || rows[0].staged_asset_id !== input.assetId) {
    throw new AgentApiError('UPLOAD_ALREADY_USED', 'Reference upload link cannot be completed.');
  }
  return { stagedAssetId: input.assetId };
}

export async function discardReferenceUploadAttempt(input: {
  sessionId: string; uploadId: string; userId: string; claimId: string;
}, dependencies: { executor: TransactionQueryExecutor; discardedAt: Date }): Promise<boolean> {
  const released = await releaseUploadSessionClaim(
    { sessionId: input.sessionId, userId: input.userId, claimId: input.claimId },
    { executor: dependencies.executor, releasedAt: dependencies.discardedAt },
  );
  if (!released) return false;
  const rows = await dependencies.executor.query<{ session_id: string }>(
    `DELETE FROM mcp_reference_upload_attempts
      WHERE session_id = $1 AND upload_id = $2 AND user_id = $3
      RETURNING session_id`,
    [input.sessionId, input.uploadId, input.userId],
  );
  if (rows.length !== 1) throw new Error('Reference upload attempt was not discarded.');
  return true;
}

export function contentSha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}
