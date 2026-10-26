import { query, type QueryExecutor } from '@/lib/db';
import { PricingAdminError } from '../errors';
import { batchUuid } from './input';
import type { TariffBatchOperation, TariffBatchProposal, TariffBatchReceipt, TariffBatchSummary } from './contract';

export type StoredTariffBatch = TariffBatchOperation & { proposal: TariffBatchProposal; sourceId: string; targetId: string };
type Raw = {
  id: string; actor_id: string; status: TariffBatchOperation['status']; epoch: number; fingerprint: string;
  created_at: Date; expires_at: Date; plan_json: TariffBatchOperation['plan']; proposal_json: TariffBatchProposal;
  source_id: string; target_id: string; receipt_json: TariffBatchReceipt | null; failure: string | null;
};
const columns = `o.*, r.receipt_json`;
const from = `app_tariff_batch_operations o LEFT JOIN app_tariff_batch_receipts r ON r.operation_id = o.id`;
function map(row: Raw): StoredTariffBatch {
  return { id: row.id, actorId: row.actor_id, status: row.status, epoch: row.epoch, fingerprint: row.fingerprint,
    createdAt: row.created_at.toISOString(), expiresAt: row.expires_at.toISOString(), plan: row.plan_json,
    receipt: row.receipt_json, failure: row.failure, proposal: row.proposal_json, sourceId: row.source_id, targetId: row.target_id };
}
export function publicTariffBatch(operation: StoredTariffBatch): TariffBatchOperation {
  const { proposal: _proposal, sourceId: _source, targetId: _target, ...publicOperation } = operation;
  return publicOperation;
}
export async function getStoredTariffBatch(id: string, actorId: string, executor: QueryExecutor = { query }, lock = false): Promise<StoredTariffBatch> {
  const [row] = await executor.query<Raw>(`SELECT ${columns} FROM ${from}
    WHERE o.id = $1 AND o.actor_id = $2 ${lock ? 'FOR UPDATE OF o NOWAIT' : ''}`, [batchUuid(id), batchUuid(actorId)]);
  if (!row) throw new PricingAdminError('missing_target', 'Tariff batch not found.');
  return map(row);
}
export async function listStoredTariffBatches(actorId: string): Promise<TariffBatchSummary[]> {
  const rows = await query<{ id: string; status: TariffBatchOperation['status']; created_at: Date; plan: TariffBatchSummary['plan'] }>(
    `SELECT id, status, created_at, jsonb_build_object('reason', plan_json->'reason', 'counts', plan_json->'counts') AS plan
     FROM app_tariff_batch_operations WHERE actor_id = $1 ORDER BY created_at DESC, id DESC LIMIT 50`, [batchUuid(actorId)]);
  return rows.map(row => ({ id: row.id, status: row.status, createdAt: row.created_at.toISOString(), plan: row.plan }));
}
export async function insertTariffBatch(executor: QueryExecutor, operation: StoredTariffBatch): Promise<void> {
  await executor.query(`INSERT INTO app_tariff_batch_operations
    (id, actor_id, status, epoch, fingerprint, source_id, target_id, proposal_json, plan_json, created_at, expires_at)
    VALUES ($1, $2, 'previewed', 0, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9)`,
  [operation.id, operation.actorId, operation.fingerprint, operation.sourceId, operation.targetId,
    JSON.stringify(operation.proposal), JSON.stringify(operation.plan), operation.createdAt, operation.expiresAt]);
}
