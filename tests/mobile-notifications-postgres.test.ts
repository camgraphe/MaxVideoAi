import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createPaidGenerationTestSchema, startDisposablePostgres } from './helpers/disposable-postgres';
import { getDb } from '../frontend/src/lib/db';
import { ensureMediaLibrarySchema } from '../frontend/src/lib/schema/media-library-schema';
import {
  changeNotification,
  drainNotifications,
  nextDelivery,
  pushAvailability,
} from '../frontend/src/server/mobile/notifications';
test('one voluntary render notification with anonymous content, account isolation and ticket recovery', async (t) => {
  const database = await startDisposablePostgres('mobile-push');
  const old = {
    database: process.env.DATABASE_URL,
    enabled: process.env.MOBILE_PUSH_ENABLED,
    key: process.env.MOBILE_EXPO_PUSH_ACCESS_TOKEN,
  };
  process.env.DATABASE_URL = database.databaseUrl;
  t.after(async () => {
    await getDb().end();
    await database.cleanup();
    for (const [k, v] of Object.entries({
      DATABASE_URL: old.database,
      MOBILE_PUSH_ENABLED: old.enabled,
      MOBILE_EXPO_PUSH_ACCESS_TOKEN: old.key,
    })) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });
  delete process.env.MOBILE_PUSH_ENABLED;
  assert.equal(pushAvailability().enabled, false);
  await createPaidGenerationTestSchema(database.pool);
  await database.pool.query(readFileSync('neon/migrations/108_mobile_job_notifications.sql', 'utf8'));
  process.env.MOBILE_PUSH_ENABLED = '1';
  process.env.MOBILE_EXPO_PUSH_ACCESS_TOKEN = 'fixture-not-a-service-credential';
  const owner = 'user-mobile',
    job = 'job-mobile',
    token = 'ExpoPushToken[test-device]';
  await database.pool.query(
    "INSERT INTO app_jobs(user_id,job_id,surface,status,engine_id,engine_label,prompt) VALUES($1,$2,'video','running','test','test','Private prompt')",
    [owner, job],
  );
  const watch = { action: 'watch', jobId: job, locale: 'fr', token };
  const watchStatus = { action: 'status', jobId: job, token };
  const cancel = { ...watchStatus, action: 'unwatch' };
  assert.deepEqual(await changeNotification(owner, watchStatus), { state: 'off' });
  await assert.rejects(changeNotification('someone-else', watch), /not found/);
  await changeNotification(owner, watch);
  await changeNotification(owner, watch);
  assert.deepEqual(await changeNotification(owner, watchStatus), { state: 'watching' });
  assert.deepEqual(await changeNotification('someone-else', watchStatus), { state: 'off' });
  assert.deepEqual(await changeNotification('someone-else', cancel), { state: 'off' });
  assert.deepEqual(await changeNotification(owner, { ...cancel, token: 'ExpoPushToken[other-device]' }), { state: 'off' });
  assert.deepEqual(await changeNotification(owner, { ...cancel, jobId: 'another-job' }), { state: 'off' });
  await database.pool.query("UPDATE mobile_job_notifications SET lease_until=now()+interval '1 minute'");
  assert.deepEqual(await changeNotification(owner, cancel), { state: 'sending' });
  assert.deepEqual(await changeNotification(owner, { ...watch, token: 'ExpoPushToken[other-device]' }), { watching: false, retry: true });
  await database.pool.query("UPDATE mobile_job_notifications SET lease_until=now()-interval '1 minute'");
  assert.deepEqual(await changeNotification(owner, watchStatus), { state: 'watching' });
  assert.deepEqual(await changeNotification(owner, cancel), { state: 'off' });
  assert.deepEqual(await changeNotification(owner, cancel), { state: 'off' });
  await changeNotification(owner, watch);
  await changeNotification('someone-else', { action: 'remove', token });
  assert.equal((await database.pool.query('SELECT * FROM mobile_job_notifications')).rowCount, 1);
  await changeNotification(owner, { action: 'remove', token });
  assert.equal((await database.pool.query('SELECT * FROM mobile_job_notifications')).rowCount, 0);
  await changeNotification(owner, watch);
  const sends: unknown[] = [];
  const deliver: typeof nextDelivery = (row) =>
    nextDelivery(row, undefined, async (endpoint, payload) => {
      if (endpoint === 'getReceipts') return { data: { 'ticket-test': { status: 'ok' } } };
      sends.push(payload);
      return { data: [{ status: 'ok', id: 'ticket-test' }] };
    });
  await drainNotifications(deliver);
  assert.equal(sends.length, 0);
  await database.pool.query("UPDATE app_jobs SET status='failed' WHERE job_id=$1", [job]);
  await database.pool.query('UPDATE mobile_job_notifications SET next_check=now()');
  await Promise.all([drainNotifications(deliver), drainNotifications(deliver)]);
  assert.equal(sends.length, 1);
  assert.deepEqual(await changeNotification(owner, cancel), { state: 'off' });
  const item = (sends[0] as { data: unknown; body: string }[])[0];
  assert.deepEqual(item.data, { screen: 'library', jobId: job });
  assert.match(item.body, /échoué/);
  assert.doesNotMatch(item.body, /Private prompt|user-mobile/);
  assert.deepEqual(
    (await database.pool.query('SELECT state,token,ticket FROM mobile_job_notifications')).rows,
    [{ state: 'receipt', token: null, ticket: 'ticket-test' }],
  );
  await database.pool.query('UPDATE mobile_job_notifications SET next_check=now()');
  await drainNotifications(deliver);
  assert.deepEqual((await database.pool.query('SELECT state,ticket FROM mobile_job_notifications')).rows, [
    { state: 'closed', ticket: null },
  ]);
  assert.deepEqual(await changeNotification(owner, watch), { watching: false });

  await t.test('a ready alert uses the same playable output as Activity', async () => {
    await ensureMediaLibrarySchema();
    const id = 'normalized-image';
    await database.pool.query("INSERT INTO app_jobs(user_id,job_id,surface,status,engine_id,engine_label,prompt) VALUES($1,$2,'image','running','test','test','Private prompt')", [owner, id]);
    await changeNotification(owner, { ...watch, jobId: id });
    await database.pool.query("UPDATE app_jobs SET status='completed' WHERE job_id=$1", [id]);
    await drainNotifications(deliver);
    assert.equal(sends.length, 1);
    await database.pool.query(`INSERT INTO job_outputs(id,job_id,user_id,kind,status,url)
      VALUES ('test-original',$1,$2,'image','ready','https://cdn.maxvideoai.com/finished.png')`, [id, owner]);
    await database.pool.query("UPDATE mobile_job_notifications SET next_check=now() WHERE job_id=$1", [id]);
    await drainNotifications(deliver);
    assert.equal(sends.length, 2);
    const alert = (sends[1] as { data: unknown; body: string }[])[0];
    assert.deepEqual(alert.data, { screen: 'library', jobId: id });
    assert.match(alert.body, /prête/);
    assert.doesNotMatch(alert.body, /Private prompt|finished.png/);
  });

  await t.test('the menu counts and cancels only upcoming alerts on this account and phone', async () => {
    const menuOwner = 'user-with-pending-alerts';
    const summary = { action: 'summary', token };
    const cancelPending = { action: 'cancelPending', token };
    await database.pool.query(`INSERT INTO mobile_job_notifications (user_id,job_id,token,locale,lease_until,expires_at,state)
      VALUES ($1,'upcoming',$2,'en',NULL,now()+interval '1 day','waiting'),
             ($1,'leased',$2,'en',now()+interval '1 minute',now()+interval '1 day','waiting'),
             ($1,'expired',$2,'en',NULL,now()-interval '1 minute','waiting'),
             ($1,'accepted-ticket',NULL,'en',NULL,now()+interval '1 day','receipt'),
             ($1,'other-phone','ExpoPushToken[other-device]','en',NULL,now()+interval '1 day','waiting'),
             ('another-account','another-job',$2,'en',NULL,now()+interval '1 day','waiting')`, [menuOwner, token]);
    assert.deepEqual(await changeNotification(menuOwner, summary), { pending: 1, processing: 1 });
    assert.deepEqual(await changeNotification(menuOwner, cancelPending), { pending: 0, processing: 1 });
    assert.deepEqual(await changeNotification(menuOwner, cancelPending), { pending: 0, processing: 1 });
    assert.deepEqual(await changeNotification('another-account', summary), { pending: 1, processing: 0 });
    assert.deepEqual(await changeNotification(menuOwner, { ...summary, token: 'ExpoPushToken[other-device]' }), { pending: 1, processing: 0 });
    const preserved = await database.pool.query('SELECT job_id FROM mobile_job_notifications WHERE user_id=$1 ORDER BY job_id', [menuOwner]);
    assert.deepEqual(preserved.rows.map(row => row.job_id), ['accepted-ticket', 'expired', 'leased', 'other-phone']);
  });
});
