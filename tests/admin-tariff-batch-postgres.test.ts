import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { withDbTransaction } from '../frontend/src/lib/db';
import { startDisposablePostgres } from './helpers/disposable-postgres';
import { klingBatchClasses } from '../frontend/server/pricing-admin/tariff-batches/kling';
import { previewTariffBatch, confirmTariffBatch, claimTariffBatch, applyTariffBatch, readTariffBatch, reconcileTariffBatch } from '../frontend/server/pricing-admin/tariff-batches/service';
import { upsertCustomerTariffCell } from '../frontend/server/pricing/customer-tariff-store';
import type { TariffBatchProposal } from '../frontend/server/pricing-admin/tariff-batches/contract';

const actor = '11111111-1111-4111-8111-111111111111';
const source = 'a'.repeat(40);
import { withTariffBatchFixture as fixture } from './helpers/tariff-batch-postgres-fixture';
const classes = klingBatchClasses();
const proposal = (count = 2, multiplier = '1.50', intent: 'create_missing' | 'replace_selected' = 'create_missing'): TariffBatchProposal => ({
  schemaVersion: 1, modelId: 'kling-v4', intent, reason: 'Synthetic local qualification', pricing: { kind: 'list_multiplier', multiplier },
  selections: classes.slice(0, count).map(c => ({ selector: c.selector })),
});
function deferred() { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { promise, resolve }; }

const confirm = (p: { id: string; fingerprint: string }) => confirmTariffBatch(p.id, p.fingerprint, actor, () => {});
async function counts(db: Awaited<ReturnType<typeof startDisposablePostgres>>) {
  return (await db.pool.query(`SELECT (SELECT revision FROM app_customer_tariff_state) AS revision,
    (SELECT count(*) FROM app_customer_tariff_cells) AS cells,
    (SELECT count(*) FROM app_customer_tariff_cell_versions) AS versions,
    (SELECT count(*) FROM app_pricing_change_events) AS events,
    (SELECT count(*) FROM app_tariff_batch_receipts) AS receipts`)).rows[0];
}

test('batch preview, atomic commit, immutable receipt, idempotent repeats and conforming resume', async () => fixture(async ({ db }) => {
  const p = await previewTariffBatch(proposal(), actor);
  assert.equal(p.status, 'previewed'); assert.equal(p.plan.counts.create, 2);
  assert.deepEqual(await counts(db), { revision: '0', cells: '0', versions: '0', events: '0', receipts: '0' });
  const committed = await confirm(p);
  assert.equal(committed.status, 'committed'); assert.equal(committed.receipt?.changes.length, 2);
  assert.deepEqual(await counts(db), { revision: '2', cells: '2', versions: '0', events: '2', receipts: '1' });
  assert.deepEqual((await confirm(p)).receipt, committed.receipt);
  assert.deepEqual((await readTariffBatch(p.id, actor)).receipt, committed.receipt);
  await assert.rejects(db.pool.query('UPDATE app_tariff_batch_receipts SET receipt_json = \'{}\''), /immutable/i);
  await assert.rejects(db.pool.query('DELETE FROM app_tariff_batch_operations'), /immutable/i);
  const before = (await db.pool.query('SELECT * FROM app_customer_tariff_cells ORDER BY id')).rows;
  const resume = await previewTariffBatch(proposal(), actor);
  assert.equal(resume.plan.counts.unchanged, 2);
  assert.equal((await confirm(resume)).receipt?.changes.length, 0);
  assert.deepEqual((await db.pool.query('SELECT * FROM app_customer_tariff_cells ORDER BY id')).rows, before);
  assert.equal((await counts(db)).revision, '2'); assert.equal((await counts(db)).events, '2');
}));

test('source, actor, fingerprint and global revision are checked before any tariff write', async () => fixture(async ({ db }) => {
  const p = await previewTariffBatch(proposal(), actor);
  await assert.rejects(confirmTariffBatch(p.id, p.fingerprint, randomUUID()), /not found/i);
  await assert.rejects(confirmTariffBatch(p.id, 'b'.repeat(64), actor), /preview/i);
  await db.pool.query('UPDATE app_tariff_batch_control SET source_id = $1', ['b'.repeat(40)]);
  await assert.rejects(confirm(p), /disabled|source|deployment/i);
  await db.pool.query('UPDATE app_tariff_batch_control SET source_id = $1', [source]);
  await db.pool.query('UPDATE app_customer_tariff_state SET revision = revision + 1');
  const rejected = await confirm(p);
  assert.equal(rejected.status, 'not_applied'); assert.equal((await counts(db)).cells, '0');
}));

test('a failure after an earlier row or in the receipt rolls back cells, versions, events and revision', async () => fixture(async ({ db }) => {
  await db.pool.query(`CREATE FUNCTION fail_batch_event() RETURNS trigger AS $$ BEGIN
    IF (SELECT count(*) FROM app_pricing_change_events) > 0 THEN RAISE EXCEPTION 'injected event failure'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql;
    CREATE TRIGGER fail_batch_event BEFORE INSERT ON app_pricing_change_events FOR EACH ROW EXECUTE FUNCTION fail_batch_event();`);
  const p = await previewTariffBatch(proposal(), actor);
  assert.equal((await confirm(p)).status, 'not_applied');
  assert.deepEqual(await counts(db), { revision: '0', cells: '0', versions: '0', events: '0', receipts: '0' });
  await db.pool.query('DROP TRIGGER fail_batch_event ON app_pricing_change_events');
  await db.pool.query(`CREATE FUNCTION fail_batch_receipt() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'injected receipt failure'; END; $$ LANGUAGE plpgsql;
    CREATE TRIGGER fail_batch_receipt BEFORE INSERT ON app_tariff_batch_receipts FOR EACH ROW EXECUTE FUNCTION fail_batch_receipt();`);
  assert.equal((await confirm(await previewTariffBatch(proposal(), actor))).status, 'not_applied');
  assert.deepEqual(await counts(db), { revision: '0', cells: '0', versions: '0', events: '0', receipts: '0' });
}));

test('reconciliation fences a delayed executor and a held executor stays indeterminate', async () => fixture(async f => {
  const p = await previewTariffBatch(proposal(), actor);
  const claim = await claimTariffBatch(p.id, p.fingerprint, actor);
  assert.equal(claim.claimed, true);
  const fenced = await reconcileTariffBatch(p.id, actor);
  assert.equal(fenced.status, 'not_applied'); assert.equal(fenced.epoch, claim.operation.epoch + 1);
  assert.equal((await applyTariffBatch(p.id, actor, claim.operation.epoch)).status, 'not_applied');
  assert.equal((await counts(f.db)).cells, '0');
  const next = await previewTariffBatch(proposal(), actor), entered = deferred(), release = deferred();
  f.beforeQuery = async sql => { if (sql.includes('SELECT revision FROM app_customer_tariff_state') && sql.includes('FOR UPDATE')) { entered.resolve(); await release.promise; } };
  const applying = confirm(next);
  await entered.promise;
  assert.equal((await reconcileTariffBatch(next.id, actor)).status, 'accepted');
  assert.equal((await confirm(next)).status, 'accepted');
  release.resolve(); f.beforeQuery = undefined;
  assert.equal((await applying).status, 'committed');
}));

test('rollback creates a new version, cannot remove active creations, and rejects same-price ABA', async () => fixture(async ({ db }) => {
  const created = await confirm(await previewTariffBatch(proposal(), actor));
  const rollback = (id: string): TariffBatchProposal => ({ schemaVersion: 1, modelId: 'kling-v4', intent: 'rollback',
    reason: 'Restore reviewed earlier price', sourceOperationId: id, selectors: [classes[0].selector] });
  assert.equal((await previewTariffBatch(rollback(created.id), actor)).plan.counts.conflict, 1);
  const updated = await confirm(await previewTariffBatch(proposal(2, '1.60', 'replace_selected'), actor));
  const restored = await confirm(await previewTariffBatch(rollback(updated.id), actor));
  assert.equal(restored.status, 'committed'); assert.equal(restored.receipt?.changes[0].after.price.kind, 'fixed');
  assert.equal((await counts(db)).versions, '3');
  const after = updated.receipt!.changes[1].after;
  await withDbTransaction(executor => upsertCustomerTariffCell(executor, after, actor));
  const aba = await previewTariffBatch({ ...rollback(updated.id), selectors: [classes[1].selector] }, actor);
  assert.equal(aba.plan.counts.conflict, 1); assert.match(aba.plan.rows[0].issue!, /changed since/i);
}));

test('all 226 classes commit atomically within the bounded transaction and resume without history churn', async () => fixture(async ({ db }) => {
  const start = performance.now(); const p = await previewTariffBatch(proposal(226), actor);
  assert.equal(p.plan.counts.create, 226);
  const done = await confirm(p);
  assert.equal(done.status, 'committed'); assert.equal(done.receipt?.changes.length, 226);
  assert.equal((await counts(db)).revision, '226');
  assert.ok(done.receipt!.lockDurationMs < 5000);
  console.log(JSON.stringify({ measurement: 'full-226', elapsedMs: performance.now() - start, lockDurationMs: done.receipt!.lockDurationMs }));
  assert.equal((await confirm(await previewTariffBatch(proposal(226), actor))).receipt?.changes.length, 0);
}));

test('expired previews and disabled admission fail closed without tariff writes', async () => fixture(async ({ db }) => {
  const p = await previewTariffBatch(proposal(), actor);
  const now = Date.now;
  Date.now = () => Date.parse(p.expiresAt);
  try { await assert.rejects(confirm(p), /expired/i); } finally { Date.now = now; }
  await db.pool.query('UPDATE app_tariff_batch_control SET enabled = FALSE');
  await assert.rejects(previewTariffBatch(proposal(), actor), /disabled/i);
  assert.equal((await counts(db)).cells, '0');
}));

test('unit edits serialize with a batch and a quote waiting on it rejects the stale revision', async () => fixture(async f => {
  const { lockQuotedCustomerTariffRevision } = await import('../frontend/server/pricing/customer-tariff-revision');
  const created = await confirm(await previewTariffBatch(proposal(), actor));
  const update = await previewTariffBatch(proposal(2, '1.60', 'replace_selected'), actor);
  const before = created.receipt!.changes[0].after;
  const entered = deferred(), release = deferred();
  let held = false;
  f.beforeQuery = async sql => {
    if (!held && sql.includes('INSERT INTO app_customer_tariff_cell_versions')) { held = true; entered.resolve(); await release.promise; }
  };
  const applying = confirm(update);
  await entered.promise;
  let quoteFinished = false, unitFinished = false;
  const started = performance.now();
  const quote = withDbTransaction(executor => lockQuotedCustomerTariffRevision(executor, 'kling-v4', {
    meta: { pricingMode: 'manual_tariff', customerTariffRevision: 2 },
  })).then(() => { throw new Error('Stale quote accepted'); }, error => { quoteFinished = true; assert.match(error.message, /changed/i); });
  const unit = withDbTransaction(executor => upsertCustomerTariffCell(executor, { ...before, price: { kind: 'fixed', customerCents: 999 } }, actor))
    .then(value => { unitFinished = true; return value; });
  // Observe real waiting backends, not an arbitrary delay to assume contention.
  for (let attempt = 0; attempt < 100; attempt++) {
    const waiting = Number((await f.db.pool.query("SELECT count(*) FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND datname = current_database() ")).rows[0].count);
    if (waiting >= 2) break;
    if (attempt === 99) throw new Error('Expected two blocked transactions');
    await new Promise(done => setTimeout(done, 5));
  }
  assert.equal(quoteFinished, false); assert.equal(unitFinished, false);
  release.resolve(); f.beforeQuery = undefined;
  assert.equal((await applying).status, 'committed');
  await quote; const cell = await unit; assert.equal(cell.version, 5);
  console.log(JSON.stringify({ measurement: 'quote-and-unit-wait', elapsedMs: performance.now() - started }));
}));

test('a competing unit writer invalidates the entire batch preview; paid snapshots remain byte-for-byte unchanged', async () => fixture(async ({ db }) => {
  const created = await confirm(await previewTariffBatch(proposal(), actor));
  const snapshot = { totalCents: 118, currency: 'USD', meta: { pricingMode: 'manual_tariff', customerTariffRevision: 2 }, frozen: 'synthetic paid quote' };
  await db.pool.query("INSERT INTO app_jobs (job_id, user_id, pricing_snapshot, payment_status) VALUES ('synthetic-paid', 'synthetic-user', $1::jsonb, 'paid')", [JSON.stringify(snapshot)]);
  const paid = (await db.pool.query("SELECT * FROM app_jobs WHERE job_id = 'synthetic-paid'")).rows[0];
  const p = await previewTariffBatch(proposal(2, '1.60', 'replace_selected'), actor);
  await withDbTransaction(executor => upsertCustomerTariffCell(executor, { ...created.receipt!.changes[0].after, price: { kind: 'fixed', customerCents: 999 } }, actor));
  assert.equal((await confirm(p)).status, 'not_applied');
  assert.deepEqual((await db.pool.query("SELECT * FROM app_jobs WHERE job_id = 'synthetic-paid'")).rows[0], paid);
  assert.equal((await counts(db)).revision, '3'); assert.equal((await counts(db)).events, '2');
}));

test('bounded lock contention leaves no partial write and post-commit refresh failure retains success', async () => fixture(async ({ db }) => {
  const p = await previewTariffBatch(proposal(), actor), blocker = await db.pool.connect();
  await blocker.query('BEGIN'); await blocker.query('SELECT * FROM app_customer_tariff_state FOR UPDATE');
  const started = performance.now();
  try {
    assert.equal((await confirm(p)).status, 'not_applied');
    assert.ok(performance.now() - started < 2500);
  } finally { await blocker.query('ROLLBACK'); blocker.release(); }
  assert.equal((await counts(db)).cells, '0');
  const next = await previewTariffBatch(proposal(), actor);
  const result = await confirmTariffBatch(next.id, next.fingerprint, actor, () => { throw new Error('synthetic refresh outage'); });
  assert.equal(result.status, 'committed'); assert.equal(result.operationalWarnings?.length, 1);
  assert.deepEqual((await reconcileTariffBatch(next.id, actor)).receipt, result.receipt);
}));

test('a lost COMMIT response is recovered from the original durable receipt with no second financial execution', async () => fixture(async f => {
  const p = await previewTariffBatch(proposal(), actor); let receiptWritten = false, dropped = false;
  f.beforeQuery = async sql => { if (sql.startsWith('INSERT INTO app_tariff_batch_receipts')) receiptWritten = true; };
  f.afterQuery = async sql => { if (sql === 'COMMIT' && receiptWritten && !dropped) { dropped = true; throw new Error('synthetic lost commit response'); } };
  const result = await confirm(p);
  assert.equal(dropped, true); assert.equal(result.status, 'committed');
  assert.deepEqual((await confirm(p)).receipt, result.receipt);
  assert.deepEqual(await counts(f.db), { revision: '2', cells: '2', versions: '0', events: '2', receipts: '1' });
}));
