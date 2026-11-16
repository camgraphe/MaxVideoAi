import assert from 'node:assert/strict';
import test from 'node:test';
import { createPaidGenerationTestSchema, startDisposablePostgres } from './helpers/disposable-postgres';
import { claimBytePlusLasSubmission, readOwnedBytePlusLasSubmission, recordBytePlusLasSubmissionAccepted,
  preserveBytePlusLasSubmission, recordBytePlusLasSubmissionRejection } from '../frontend/server/byteplus-submission-state';
import { requiresBytePlusDurableEditOutput } from '../frontend/server/byteplus-output-persistence';

test('Flash edit owns one durable submission and preserves its accepted job and original price', { timeout: 90_000 }, async () => {
  const db = await startDisposablePostgres('flash-edit-state');
  const query = async <T,>(sql: string, values?: unknown[]): Promise<T[]> => (await db.pool.query(sql, values)).rows;
  try {
    await createPaidGenerationTestSchema(db.pool);
    for (const job of ['accepted', 'rejected']) await db.pool.query(`INSERT INTO app_jobs
      (job_id,user_id,engine_id,provider,status,progress,payment_status,final_price_cents,currency,pricing_snapshot,settings_snapshot)
      VALUES ($1,'owner','seedance-2-5-flash','byteplus_modelark','pending',0,'paid_wallet',134,'USD',
      '{"totalCents":134,"currency":"USD"}','{"inputMode":"v2v","byteplusTransport":"modelark"}')`, [job]);
    assert.equal(await claimBytePlusLasSubmission('accepted', 'another-owner', query, 'modelark'), false);
    const claims = await Promise.all(Array.from({ length: 4 }, () => claimBytePlusLasSubmission('accepted', 'owner', query, 'modelark')));
    assert.equal(claims.filter(Boolean).length, 1);
    await recordBytePlusLasSubmissionAccepted({ jobId: 'accepted', userId: 'owner', providerJobId: 'cgt-flash', queryFn: query });
    await preserveBytePlusLasSubmission({ jobId: 'accepted', userId: 'owner', providerJobId: null, queryFn: query });
    const accepted = await readOwnedBytePlusLasSubmission('accepted', 'owner', query);
    assert.equal(accepted.provider_job_id, 'cgt-flash');
    assert.equal(accepted.final_price_cents, 134);
    assert.deepEqual(accepted.pricing_snapshot, { totalCents: 134, currency: 'USD' });
    assert.equal(requiresBytePlusDurableEditOutput(accepted), true);
    assert.equal(await claimBytePlusLasSubmission('accepted', 'owner', query, 'modelark'), false);
    assert.equal(await recordBytePlusLasSubmissionRejection({ jobId: 'rejected', userId: 'owner', attempted: false,
      message: 'Known rejection', errorCode: 'InvalidParameter', transport: 'modelark', queryFn: query }), true);
    assert.equal(await claimBytePlusLasSubmission('rejected', 'owner', query, 'modelark'), false);
  } finally { await db.cleanup(); }
});
