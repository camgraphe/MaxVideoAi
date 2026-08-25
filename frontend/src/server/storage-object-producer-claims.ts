import { randomUUID } from 'node:crypto';

import { query, type QueryExecutor } from '@/lib/db';

export const STORAGE_OBJECT_PRODUCER_LEASE_MS = 5 * 60_000;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const CONTENT_KEY_PREFIX = 'user-assets/by-content/';

export type StorageObjectProducerClaim = {
  objectKey: string;
  claimId: string;
  leaseExpiresAt: Date;
};

function requireObjectKey(objectKey: string): string {
  if (objectKey !== objectKey.trim() || objectKey.length < CONTENT_KEY_PREFIX.length + 1
    || objectKey.length > 1024 || !objectKey.startsWith(CONTENT_KEY_PREFIX)) {
    throw new Error('Invalid content-addressed storage key.');
  }
  return objectKey;
}

function requireClaimId(claimId: string): string {
  if (!UUID_PATTERN.test(claimId)) throw new Error('Invalid storage producer claim.');
  return claimId;
}

function parseClaim(row: { object_key: unknown; producer_claim_id: unknown; producer_lease_expires_at: unknown }): StorageObjectProducerClaim {
  const objectKey = requireObjectKey(String(row.object_key));
  const claimId = requireClaimId(String(row.producer_claim_id));
  const leaseExpiresAt = row.producer_lease_expires_at instanceof Date
    ? row.producer_lease_expires_at
    : new Date(String(row.producer_lease_expires_at));
  if (!Number.isFinite(leaseExpiresAt.getTime())) throw new Error('Invalid storage producer lease.');
  return { objectKey, claimId, leaseExpiresAt };
}

export async function claimStorageObjectProducer(input: { objectKey: string }, dependencies: {
  executor?: QueryExecutor;
  now?: Date;
  claimId?: string;
  leaseMs?: number;
} = {}): Promise<StorageObjectProducerClaim> {
  const objectKey = requireObjectKey(input.objectKey);
  const now = dependencies.now ?? new Date();
  const claimId = requireClaimId(dependencies.claimId ?? randomUUID());
  const leaseMs = dependencies.leaseMs ?? STORAGE_OBJECT_PRODUCER_LEASE_MS;
  if (!Number.isSafeInteger(leaseMs) || leaseMs < 1) throw new Error('Invalid storage producer lease.');
  const leaseExpiresAt = new Date(now.getTime() + leaseMs);
  const executor = dependencies.executor ?? { query };
  const rows = await executor.query<{
    object_key: unknown; producer_claim_id: unknown; producer_lease_expires_at: unknown;
  }>(
    `INSERT INTO mcp_reference_upload_object_fences (
       object_key, state, producer_claim_id, producer_lease_expires_at, created_at, updated_at
     ) VALUES ($1,'producing',$2,$3,$4,$4)
     ON CONFLICT (object_key) DO UPDATE
       SET state = CASE WHEN mcp_reference_upload_object_fences.state = 'referenced'
             THEN 'referenced' ELSE 'producing' END,
           producer_claim_id = EXCLUDED.producer_claim_id,
           producer_lease_expires_at = EXCLUDED.producer_lease_expires_at,
           delete_claim_id = NULL, delete_lease_expires_at = NULL, updated_at = EXCLUDED.updated_at
       WHERE mcp_reference_upload_object_fences.state IN ('available','deleted','orphaned')
          OR (mcp_reference_upload_object_fences.state IN ('producing','referenced')
            AND (mcp_reference_upload_object_fences.producer_claim_id IS NULL
              OR mcp_reference_upload_object_fences.producer_lease_expires_at <= EXCLUDED.updated_at))
     RETURNING object_key, producer_claim_id, producer_lease_expires_at`,
    [objectKey, claimId, leaseExpiresAt, now],
  );
  if (rows.length !== 1) throw new Error('Storage object is being deleted or produced; retry upload.');
  return parseClaim(rows[0]);
}

export async function renewStorageObjectProducer(input: { claim: StorageObjectProducerClaim }, dependencies: {
  executor?: QueryExecutor;
  now?: Date;
  leaseMs?: number;
} = {}): Promise<StorageObjectProducerClaim> {
  const now = dependencies.now ?? new Date();
  const leaseMs = dependencies.leaseMs ?? STORAGE_OBJECT_PRODUCER_LEASE_MS;
  if (!Number.isSafeInteger(leaseMs) || leaseMs < 1) throw new Error('Invalid storage producer lease.');
  const leaseExpiresAt = new Date(now.getTime() + leaseMs);
  const executor = dependencies.executor ?? { query };
  const rows = await executor.query<{
    object_key: unknown; producer_claim_id: unknown; producer_lease_expires_at: unknown;
  }>(
    `UPDATE mcp_reference_upload_object_fences
        SET producer_lease_expires_at = $3, updated_at = $4
      WHERE object_key = $1 AND state IN ('producing','referenced') AND producer_claim_id = $2
        AND producer_lease_expires_at > $4
      RETURNING object_key, producer_claim_id, producer_lease_expires_at`,
    [requireObjectKey(input.claim.objectKey), requireClaimId(input.claim.claimId), leaseExpiresAt, now],
  );
  if (rows.length !== 1) throw new Error('Storage object producer claim was lost.');
  return parseClaim(rows[0]);
}

export async function settleStorageObjectProducer(input: {
  claim: StorageObjectProducerClaim;
  outcome: 'persisted' | 'abandoned';
}, dependencies: { executor?: QueryExecutor; now?: Date } = {}): Promise<void> {
  const executor = dependencies.executor ?? { query };
  const now = dependencies.now ?? new Date();
  const rows = await executor.query<{ object_key: unknown }>(
    `UPDATE mcp_reference_upload_object_fences
        SET state = CASE
              WHEN EXISTS (SELECT 1 FROM user_assets AS assets
                WHERE position($1 in assets.url) > 0
                  OR position($1 in COALESCE(assets.metadata->>'thumbUrl', '')) > 0)
                OR EXISTS (SELECT 1 FROM media_assets AS media
                  WHERE media.deleted_at IS NULL AND (position($1 in media.url) > 0
                    OR position($1 in COALESCE(media.thumb_url, '')) > 0))
              THEN 'referenced' ELSE 'orphaned' END,
            producer_claim_id = NULL, producer_lease_expires_at = NULL, updated_at = $3
      WHERE object_key = $1 AND state IN ('producing','referenced') AND producer_claim_id = $2
      RETURNING object_key`,
    [requireObjectKey(input.claim.objectKey), requireClaimId(input.claim.claimId), now],
  );
  if (rows.length !== 1) throw new Error('Storage object producer claim was lost.');
}
