import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as lifecycle from '../frontend/server/seedance-draft-links';
import { missingDisposablePostgresCommand, startDisposablePostgres } from './helpers/disposable-postgres';

test('a final keeps its paid Draft and permits a new attempt only after its own full refund', { timeout: 90_000 }, async (t) => {
  const missing = missingDisposablePostgresCommand();
  if (missing) return t.skip(missing);
  const api = lifecycle as typeof lifecycle & {
    markSeedanceFinalState: (owner: string, job: string, state: 'submitted' | 'completed' | 'failed', query: typeof queryFn) => Promise<boolean>;
    releaseRefundedSeedanceFinal: (owner: string, draft: string, final: string, query: typeof queryFn) => Promise<boolean>;
  };
  assert.equal(typeof api.markSeedanceFinalState, 'function');
  assert.equal(typeof api.releaseRefundedSeedanceFinal, 'function');
  const db = await startDisposablePostgres('seedance-final-state');
  t.after(() => db.cleanup());
  await db.pool.query(`
    CREATE TABLE app_jobs (job_id text PRIMARY KEY, user_id text NOT NULL, engine_id text NOT NULL,
      provider text NOT NULL, provider_job_id text, status text NOT NULL, final_price_cents integer,
      currency text, payment_status text, settings_snapshot jsonb);
    CREATE TABLE app_receipts (user_id text, job_id text, type text, amount_cents integer, currency text);
    INSERT INTO app_jobs VALUES
      ('draft', 'owner', 'seedance-2-5', 'byteplus_modelark', 'cgt-draft', 'completed', 129, 'USD', 'paid_wallet', '{}'),
      ('final', 'owner', 'seedance-2-5', 'byteplus_modelark', 'cgt-final', 'queued', 711, 'USD', 'paid_wallet',
        '{"seedanceWorkflow":{"step":"final","draftJobId":"draft"}}');
    INSERT INTO app_receipts VALUES ('owner','draft','charge',129,'USD'), ('owner','final','charge',711,'USD');
  `);
  await db.pool.query(readFileSync('neon/migrations/53_seedance_draft_links.sql', 'utf8'));
  await db.pool.query(readFileSync('neon/migrations/59_seedance_draft_final_state.sql', 'utf8'));
  const queryFn = async <T,>(sql: string, params?: readonly unknown[]): Promise<T[]> =>
    (await db.pool.query(sql, params as unknown[])).rows;
  const start = lifecycle.captureSeedanceDraftValidityStart(() => new Date());
  assert.equal(await lifecycle.registerSeedanceDraftLink({ userId: 'owner', draftJobId: 'draft',
    providerTaskId: 'cgt-draft', providerModelId: 'seedance-model', validityStart: start }, queryFn), true);
  await lifecycle.markSeedanceDraftReady('owner', 'draft', queryFn);
  await lifecycle.reserveSeedanceDraftFinal({ userId: 'owner', draftJobId: 'draft', finalJobId: 'final' }, queryFn);
  assert.equal(await api.markSeedanceFinalState('other', 'final', 'submitted', queryFn), false);
  assert.equal(await api.markSeedanceFinalState('owner', 'final', 'completed', queryFn), false);
  assert.equal(await api.markSeedanceFinalState('owner', 'final', 'submitted', queryFn), true);
  assert.equal(await api.markSeedanceFinalState('owner', 'final', 'failed', queryFn), false);
  await db.pool.query("UPDATE app_jobs SET status = 'failed' WHERE job_id = 'final'");
  assert.equal(await api.markSeedanceFinalState('owner', 'final', 'failed', queryFn), true);
  assert.equal(await api.releaseRefundedSeedanceFinal('owner', 'draft', 'final', queryFn), false);
  await db.pool.query("UPDATE app_jobs SET payment_status = 'refunded_wallet' WHERE job_id = 'final'");
  await db.pool.query("INSERT INTO app_receipts VALUES ('owner','final','refund',710,'USD')");
  assert.equal(await api.releaseRefundedSeedanceFinal('owner', 'draft', 'final', queryFn), false, 'partial refund does not unlock a new paid attempt');
  await db.pool.query("UPDATE app_receipts SET amount_cents = 711 WHERE job_id = 'final' AND type = 'refund'");
  assert.equal(await api.releaseRefundedSeedanceFinal('other', 'draft', 'final', queryFn), false);
  assert.equal(await api.releaseRefundedSeedanceFinal('owner', 'draft', 'final', queryFn), true);
  const parent = (await db.pool.query("SELECT status, payment_status FROM app_jobs WHERE job_id = 'draft'")).rows[0];
  assert.deepEqual(parent, { status: 'completed', payment_status: 'paid_wallet' });
  assert.equal((await db.pool.query("SELECT * FROM app_receipts WHERE job_id = 'draft' AND type = 'refund'")).rowCount, 0);
  assert.ok(await lifecycle.getOwnedReadySeedanceDraftLink('owner', 'draft', queryFn));
  assert.equal(await api.markSeedanceFinalState('owner', 'final', 'submitted', queryFn), false, 'late old outcomes cannot change a released link');
  assert.equal(await api.releaseRefundedSeedanceFinal('owner', 'draft', 'final', queryFn), false);
  const attempts = await Promise.all(['next-1','next-2'].map((finalJobId) =>
    lifecycle.reserveSeedanceDraftFinal({ userId: 'owner', draftJobId: 'draft', finalJobId }, queryFn)));
  assert.equal(attempts.filter(Boolean).length, 1);
});
