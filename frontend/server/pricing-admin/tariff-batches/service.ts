import { createHash, randomUUID } from 'node:crypto';
import { query, withDbTransaction, type TransactionQueryExecutor } from '@/lib/db';
import { loadPricingPolicyOverridesWithExecutor, type PricingPolicyOverrideLoadResult } from '@/lib/pricing-rule-store';
import { loadCustomerTariffModelState, upsertCustomerTariffCell } from '@/server/pricing/customer-tariff-store';
import { insertPricingChangeEvent } from '../event-store';
import type { PricingChangeJsonValue } from '@/lib/admin/pricing-change-contract';
import { PricingAdminError } from '../errors';
import { revalidateCustomerTariffChangeSurfaces } from '../revalidation';
import { TARIFF_BATCH_PROTOCOL, TARIFF_BATCH_TTL_MS, type TariffBatchOperation, type TariffBatchPlan, type TariffBatchReceipt } from './contract';
import { parseTariffBatchProposal, batchUuid } from './input';
import { klingBatchSourceFacts, klingBatchClasses } from './kling';
import { buildTariffBatchPlan, stableBatchJson } from './planner';
import { requireTariffBatchAdmission, tariffBatchIdentity } from './environment';
import { getStoredTariffBatch, insertTariffBatch, listStoredTariffBatches, publicTariffBatch, type StoredTariffBatch } from './store';

const TRANSACTION_BUDGET_MS = 5000;
async function deadlines(executor: TransactionQueryExecutor) {
  await executor.query("SET LOCAL transaction_timeout = '5000ms'");
  await executor.query("SET LOCAL lock_timeout = '1000ms'");
  await executor.query("SET LOCAL statement_timeout = '5000ms'");
  await executor.query("SET LOCAL idle_in_transaction_session_timeout = '5000ms'");
}
function isLockBusy(error: unknown) { return (error as { code?: string })?.code === '55P03'; }
function fingerprint(operation: Omit<StoredTariffBatch, 'fingerprint'> | StoredTariffBatch, plan: TariffBatchPlan, policy: PricingPolicyOverrideLoadResult) {
  return createHash('sha256').update(stableBatchJson({ protocol: TARIFF_BATCH_PROTOCOL,
    id: operation.id, actorId: operation.actorId, sourceId: operation.sourceId, targetId: operation.targetId,
    createdAt: operation.createdAt, expiresAt: operation.expiresAt, proposal: operation.proposal,
    plan, policy, facts: klingBatchSourceFacts() })).digest('hex');
}
async function currentPlan(executor: TransactionQueryExecutor, proposal: StoredTariffBatch['proposal'], actorId: string) {
  const policy = await loadPricingPolicyOverridesWithExecutor(executor, { lock: true });
  const state = await loadCustomerTariffModelState(executor, proposal.modelId);
  const rollbackReceipt = proposal.intent === 'rollback' ? (await getStoredTariffBatch(proposal.sourceOperationId, actorId, executor)).receipt : null;
  return { policy, plan: await buildTariffBatchPlan({ proposal, state, policy, rollbackReceipt }) };
}
export async function previewTariffBatch(value: unknown, actorId: string): Promise<TariffBatchOperation> {
  const proposal = parseTariffBatchProposal(value); batchUuid(actorId);
  return withDbTransaction(async executor => {
    await deadlines(executor);
    const identity = await requireTariffBatchAdmission(executor);
    await executor.query('SELECT revision FROM app_customer_tariff_state WHERE singleton = TRUE FOR SHARE');
    const { plan, policy } = await currentPlan(executor, proposal, actorId);
    const createdAt = new Date().toISOString();
    const operation: StoredTariffBatch = { id: randomUUID(), actorId, status: 'previewed', epoch: 0, fingerprint: '',
      createdAt, expiresAt: new Date(Date.parse(createdAt) + TARIFF_BATCH_TTL_MS).toISOString(),
      plan, proposal, ...identity, receipt: null, failure: null, refreshStatus: 'not_required', refreshError: null };
    operation.fingerprint = fingerprint(operation, plan, policy);
    await insertTariffBatch(executor, operation);
    return publicTariffBatch(operation);
  });
}
export async function readTariffBatch(id: string, actorId: string): Promise<TariffBatchOperation> {
  return publicTariffBatch(await getStoredTariffBatch(id, actorId));
}
export const listTariffBatches = listStoredTariffBatches;
export async function tariffBatchOptions() {
  if (!tariffBatchIdentity()) return { enabled: false as const, classes: [] };
  return withDbTransaction(async executor => {
    await deadlines(executor); await requireTariffBatchAdmission(executor);
    return { enabled: true as const, classes: klingBatchClasses().map(row => ({ key: row.key, selector: row.selector })) };
  });
}
/** Only the handler which transitions previewed -> accepted may execute this epoch. */
export async function claimTariffBatch(id: string, expectedFingerprint: string, actorId: string): Promise<{ claimed: boolean; operation: TariffBatchOperation }> {
  if (!/^[a-f0-9]{64}$/.test(expectedFingerprint)) throw new PricingAdminError('preview_stale', 'Review a fresh tariff batch preview.');
  try {
    return await withDbTransaction(async executor => {
      await deadlines(executor);
      const operation = await getStoredTariffBatch(id, actorId, executor, true);
      if (operation.fingerprint !== expectedFingerprint) throw new PricingAdminError('preview_stale', 'Tariff batch preview does not match.');
      if (operation.status !== 'previewed') return { claimed: false, operation: publicTariffBatch(operation) };
      const identity = await requireTariffBatchAdmission(executor);
      if (identity.sourceId !== operation.sourceId || identity.targetId !== operation.targetId || Date.now() >= Date.parse(operation.expiresAt)) {
        throw new PricingAdminError('preview_stale', 'Tariff batch preview expired or its deployment changed.');
      }
      if (operation.plan.counts.conflict) throw new PricingAdminError('invalid_payload', 'Resolve all batch conflicts before confirming.');
      await executor.query("UPDATE app_tariff_batch_operations SET status = 'accepted', epoch = epoch + 1 WHERE id = $1", [id]);
      return { claimed: true, operation: { ...publicTariffBatch(operation), status: 'accepted' as const, epoch: operation.epoch + 1 } };
    });
  } catch (error) {
    if (isLockBusy(error)) return { claimed: false, operation: await readTariffBatch(id, actorId) };
    throw error;
  }
}
/** One database transaction owns every tariff version, cell event and durable receipt. */
export async function applyTariffBatch(id: string, actorId: string, epoch: number): Promise<TariffBatchOperation> {
  return withDbTransaction(async executor => {
    await deadlines(executor);
    const operation = await getStoredTariffBatch(id, actorId, executor, true);
    if (operation.status !== 'accepted' || operation.epoch !== epoch) return publicTariffBatch(operation);
    const identity = await requireTariffBatchAdmission(executor);
    if (identity.sourceId !== operation.sourceId || identity.targetId !== operation.targetId || Date.now() >= Date.parse(operation.expiresAt)) {
      throw new PricingAdminError('preview_stale', 'Tariff batch preview expired or its deployment changed.');
    }
    await executor.query('SELECT revision FROM app_customer_tariff_state WHERE singleton = TRUE FOR UPDATE');
    const lockedAt = performance.now();
    const { plan, policy } = await currentPlan(executor, operation.proposal, actorId);
    if (plan.counts.conflict || fingerprint(operation, plan, policy) !== operation.fingerprint) {
      throw new PricingAdminError('preview_stale', 'Tariff batch preview changed; review current prices again.');
    }
    const changes: TariffBatchReceipt['changes'] = [];
    for (const row of plan.rows) {
      if (performance.now() - lockedAt > TRANSACTION_BUDGET_MS) throw new Error('Tariff batch transaction budget exceeded.');
      if (row.action === 'unchanged') continue;
      if (!row.proposedCell) throw new Error('Missing verified batch price.');
      const after = await upsertCustomerTariffCell(executor, row.proposedCell, actorId);
      const event = await insertPricingChangeEvent(executor, { domain: 'customer_tariff',
        operation: operation.proposal.intent === 'rollback' ? 'rollback' : row.action === 'create' ? 'create' : 'update',
        targetId: after.id, actorId, previousState: row.previousCell as unknown as PricingChangeJsonValue,
        nextState: after as unknown as PricingChangeJsonValue, affectedScenarioIds: [row.scenarioId],
        previewSummary: { batchOperationId: id, batchFingerprint: operation.fingerprint, reason: plan.reason,
          currentCents: row.currentCents, proposedCents: row.proposedCents, tariffRevision: after.version,
          ...(row.rollbackEventId ? { rollbackEventId: row.rollbackEventId } : {}) } });
      changes.push({ key: row.key, before: row.previousCell, after, eventId: event.id });
    }
    const receipt: TariffBatchReceipt = { operationId: id, actorId, fingerprint: operation.fingerprint, ...identity,
      committedAt: new Date().toISOString(), revisionBefore: plan.revision, revisionAfter: plan.revision + changes.length,
      plan, changes, lockDurationMs: Math.ceil(performance.now() - lockedAt) };
    if (receipt.lockDurationMs > TRANSACTION_BUDGET_MS) throw new Error('Tariff batch transaction budget exceeded.');
    await executor.query('INSERT INTO app_tariff_batch_receipts (operation_id, receipt_json) VALUES ($1, $2::jsonb)', [id, JSON.stringify(receipt)]);
    if (changes.length) await executor.query('INSERT INTO app_tariff_batch_refresh (operation_id) VALUES ($1)', [id]);
    await executor.query("UPDATE app_tariff_batch_operations SET status = 'committed' WHERE id = $1", [id]);
    return { ...publicTariffBatch(operation), status: 'committed', receipt, refreshStatus: changes.length ? 'pending' : 'not_required', refreshError: null };
  });
}
/** A row lock proves no live apply owns the operation; the increment fences any late handler. */
export async function reconcileTariffBatch(id: string, actorId: string): Promise<TariffBatchOperation> {
  try {
    return await withDbTransaction(async executor => {
      await deadlines(executor);
      const operation = await getStoredTariffBatch(id, actorId, executor, true);
      if (operation.status !== 'accepted') return publicTariffBatch(operation);
      const failure = 'No committed receipt exists. This operation is fenced; create and review a fresh preview.';
      await executor.query("UPDATE app_tariff_batch_operations SET status = 'not_applied', epoch = epoch + 1, failure = $2 WHERE id = $1", [id, failure]);
      return { ...publicTariffBatch(operation), status: 'not_applied', epoch: operation.epoch + 1, failure };
    });
  } catch (error) { if (isLockBusy(error)) return readTariffBatch(id, actorId); throw error; }
}
export async function confirmTariffBatch(id: string, expectedFingerprint: string, actorId: string,
  revalidate: (modelId: string) => void = revalidateCustomerTariffChangeSurfaces): Promise<TariffBatchOperation> {
  const claim = await claimTariffBatch(id, expectedFingerprint, actorId);
  if (!claim.claimed) return claim.operation;
  let operation: TariffBatchOperation;
  try { operation = await applyTariffBatch(id, actorId, claim.operation.epoch); }
  catch { operation = await reconcileTariffBatch(id, actorId); }
  if (operation.status === 'committed' && operation.receipt?.changes.length) {
    try { return await refreshTariffBatchPages(id, actorId, revalidate); }
    catch { return { ...operation, operationalWarnings: ['Prices committed. Page refresh is pending; retry page refresh only.'] }; }
  }
  return operation;
}
/** Idempotent operational retry: never calls the tariff mutation/confirmation path. */
export async function refreshTariffBatchPages(id: string, actorId: string,
  revalidate: (modelId: string) => void = revalidateCustomerTariffChangeSurfaces): Promise<TariffBatchOperation> {
  const operation = await readTariffBatch(id, actorId);
  if (operation.status !== 'committed') throw new PricingAdminError('invalid_payload', 'Only committed batches can refresh public pages.');
  if (operation.refreshStatus !== 'pending') return operation;
  try {
    revalidate(operation.plan.modelId);
    await query("UPDATE app_tariff_batch_refresh SET status = 'complete', attempts = attempts + 1, last_error = NULL, refreshed_at = clock_timestamp() WHERE operation_id = $1", [id]);
    return { ...operation, refreshStatus: 'complete', refreshError: null };
  } catch {
    const message = 'Prices committed. Public page refresh failed; retry page refresh only.';
    await query("UPDATE app_tariff_batch_refresh SET attempts = attempts + 1, last_error = $2 WHERE operation_id = $1 AND status = 'pending'", [id, message]).catch(() => undefined);
    return { ...operation, refreshError: message, operationalWarnings: [message] };
  }
}
