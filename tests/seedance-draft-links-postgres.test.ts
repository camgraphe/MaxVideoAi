import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  captureSeedanceDraftValidityStart,
  markSeedanceDraftFailed,
  markSeedanceDraftReady,
  registerSeedanceDraftLink,
  reserveSeedanceDraftFinal,
} from '../frontend/server/seedance-draft-links';
import { missingDisposablePostgresCommand, startDisposablePostgres } from './helpers/disposable-postgres';

test('Draft finalization is account-bound, completed-only, unexpired and single-reservation', { timeout: 90_000 }, async (t) => {
  const missing = missingDisposablePostgresCommand();
  if (missing) return t.skip(missing);
  const db = await startDisposablePostgres('seedance-draft-links');
  t.after(() => db.cleanup());
  await db.pool.query(`
    CREATE TABLE app_jobs (
      job_id text PRIMARY KEY, user_id text NOT NULL, engine_id text NOT NULL,
      provider text NOT NULL, provider_job_id text, status text NOT NULL
    );
    INSERT INTO app_jobs VALUES
      ('draft-owned', 'owner', 'seedance-2-5', 'byteplus_modelark', 'cgt-owned', 'queued'),
      ('draft-foreign', 'other', 'seedance-2-5', 'byteplus_modelark', 'cgt-foreign', 'completed'),
      ('draft-will-fail', 'owner', 'seedance-2-5', 'byteplus_modelark', 'cgt-will-fail', 'queued'),
      ('draft-failed', 'owner', 'seedance-2-5', 'byteplus_modelark', 'cgt-failed', 'failed');
  `);
  await db.pool.query(readFileSync('neon/migrations/53_seedance_draft_links.sql', 'utf8'));
  const queryFn = async <T,>(sql: string, params?: readonly unknown[]): Promise<T[]> =>
    (await db.pool.query(sql, params as unknown[])).rows;
  const beforeExpiry = () => new Date('2026-09-29T10:00:00Z');
  const atExpiry = () => new Date('2026-10-05T10:00:00Z');
  const validityStart = captureSeedanceDraftValidityStart(() => new Date('2026-09-28T10:00:00Z'));
  assert.equal(await registerSeedanceDraftLink({
    userId: 'owner', draftJobId: 'draft-owned', providerTaskId: 'cgt-owned',
    providerModelId: 'dreamina-seedance-2-5-260628', validityStart,
  }, queryFn), true);
  assert.equal(await registerSeedanceDraftLink({
    userId: 'owner', draftJobId: 'draft-owned', providerTaskId: 'cgt-owned',
    providerModelId: 'dreamina-seedance-2-5-260628', validityStart,
  }, queryFn), true, 'same accepted task is idempotent');
  const provenance = await db.pool.query<{
    validity_started_at: Date; validity_start_source: string; expires_at: Date;
  }>('SELECT validity_started_at, validity_start_source, expires_at FROM seedance_draft_links WHERE draft_job_id = $1', ['draft-owned']);
  assert.equal(provenance.rows[0]?.validity_started_at.toISOString(), '2026-09-28T10:00:00.000Z');
  assert.equal(provenance.rows[0]?.validity_start_source, 'server_request_started');
  assert.equal(provenance.rows[0]?.expires_at.toISOString(), '2026-10-05T10:00:00.000Z');
  await assert.rejects(registerSeedanceDraftLink({
    userId: 'owner', draftJobId: 'draft-owned', providerTaskId: 'cgt-owned',
    providerModelId: 'dreamina-seedance-2-5-260628',
    validityStart: { at: '2026-09-28T10:00:00Z', source: 'server_request_started' } as never,
  }, queryFn), /server-captured/);
  assert.equal(await registerSeedanceDraftLink({
    userId: 'owner', draftJobId: 'draft-foreign', providerTaskId: 'cgt-foreign',
    providerModelId: 'dreamina-seedance-2-5-260628', validityStart,
  }, queryFn), false);
  assert.equal(await registerSeedanceDraftLink({
    userId: 'owner', draftJobId: 'draft-will-fail', providerTaskId: 'cgt-will-fail',
    providerModelId: 'dreamina-seedance-2-5-260628', validityStart,
  }, queryFn), true);
  await db.pool.query("UPDATE app_jobs SET status = 'failed' WHERE job_id = 'draft-will-fail'");
  assert.equal(await markSeedanceDraftFailed('owner', 'draft-will-fail', queryFn), true);
  assert.equal(await markSeedanceDraftFailed('owner', 'draft-will-fail', queryFn), true);
  assert.equal(await markSeedanceDraftReady('owner', 'draft-will-fail', queryFn), false);
  assert.equal(await reserveSeedanceDraftFinal({
    userId: 'owner', draftJobId: 'draft-will-fail', finalJobId: 'failed-final',
  }, queryFn, beforeExpiry), null);
  assert.equal(await reserveSeedanceDraftFinal({
    userId: 'owner', draftJobId: 'draft-owned', finalJobId: 'final-1',
  }, queryFn, beforeExpiry), null, 'pending Draft cannot finalize');
  await db.pool.query("UPDATE app_jobs SET status = 'completed' WHERE job_id = 'draft-owned'");
  assert.equal(await markSeedanceDraftReady('owner', 'draft-owned', queryFn), true);
  const attempts = await Promise.all(['final-1', 'final-2'].map((finalJobId) =>
    reserveSeedanceDraftFinal({
      userId: 'owner', draftJobId: 'draft-owned', finalJobId,
    }, queryFn, beforeExpiry)
  ));
  assert.equal(attempts.filter(Boolean).length, 1);
  const winner = attempts.find(Boolean)!;
  assert.equal(winner.providerTaskId, 'cgt-owned');
  assert.equal(winner.providerModelId, 'dreamina-seedance-2-5-260628');
  const repeated = await reserveSeedanceDraftFinal({
    userId: 'owner', draftJobId: 'draft-owned', finalJobId: winner.finalJobId,
  }, queryFn, beforeExpiry);
  assert.equal(repeated?.finalJobId, winner.finalJobId);
  assert.equal(await reserveSeedanceDraftFinal({
    userId: 'other', draftJobId: 'draft-owned', finalJobId: 'foreign-final',
  }, queryFn, beforeExpiry), null);
  assert.equal(await reserveSeedanceDraftFinal({
    userId: 'owner', draftJobId: 'draft-failed', finalJobId: 'failed-final',
  }, queryFn, beforeExpiry), null);
  assert.equal(await reserveSeedanceDraftFinal({
    userId: 'owner', draftJobId: 'draft-owned', finalJobId: 'late-final',
  }, queryFn, atExpiry), null, 'provider seven-day boundary is exclusive');
});
