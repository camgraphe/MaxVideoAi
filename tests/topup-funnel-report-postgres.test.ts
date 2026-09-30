import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { missingDisposablePostgresCommand, startDisposablePostgres } from './helpers/disposable-postgres';

test('first-top-up funnel excludes admin, repeat buyers and passive sessions, and a success return is not payment', async t => {
  const missing = missingDisposablePostgresCommand();
  if (missing) { t.skip(`${missing} is unavailable`); return; }
  const sql = readFileSync('docs/analytics/workspace-topup-funnel.sql', 'utf8').replaceAll(':admin_ids', "ARRAY['admin']::text[]");
  const pg = await startDisposablePostgres('workspace-topup-funnel');
  try {
    await pg.pool.query(`
      CREATE TABLE checkout_interaction_events (id bigserial, user_id text, event_name text,
        stripe_checkout_session_id text, created_at timestamptz, metadata jsonb);
      CREATE TABLE app_receipts (id bigserial, user_id text, type text, stripe_payment_intent_id text,
        stripe_checkout_session_id text, created_at timestamptz);
    `);
    for (const user of ['paid', 'admin', 'repeat', 'return-only', 'different-session', 'fallback', 'pending']) {
      const day = user === 'pending' ? '2026-09-29' : '2026-09-01';
      const events = [
        ['topup_review_opened', '00:00:00', null],
        [user === 'fallback' ? 'topup_quote_fallback_displayed' : 'topup_quote_displayed', '00:01:00', null],
        ['hosted_checkout_requested', '00:02:00', null],
        ['hosted_checkout_redirecting', '00:03:00', `cs_${user}`],
        ['hosted_checkout_success_return', '00:04:00', user === 'different-session' ? 'cs_other' : `cs_${user}`],
      ];
      for (const [name, time, session] of events) {
        await pg.pool.query('INSERT INTO checkout_interaction_events (user_id,event_name,created_at,stripe_checkout_session_id,metadata) VALUES ($1,$2,$3,$4,$5)',
          [user, name, `${day}T${time}Z`, session, { source: 'workspace', measurement_version: 1 }]);
      }
    }
    await pg.pool.query(`
      INSERT INTO checkout_interaction_events (user_id,event_name,created_at,metadata)
      VALUES ('passive','express_checkout_session_ready','2026-09-01','{"source":"billing"}');
      INSERT INTO checkout_interaction_events (user_id,event_name,stripe_checkout_session_id,created_at,metadata)
      VALUES ('different-session','hosted_checkout_redirecting','cs_other','2026-09-01 00:03:30Z','{"source":"billing"}');
      INSERT INTO app_receipts (user_id,type,stripe_payment_intent_id,stripe_checkout_session_id,created_at)
      VALUES ('paid','topup','pi_paid','cs_paid','2026-09-01 00:05Z'),
        ('admin','topup','pi_admin','cs_admin','2026-09-01 00:05Z'),
        ('repeat','topup','pi_before','cs_before','2026-08-31'),
        ('repeat','topup','pi_repeat','cs_repeat','2026-09-01 00:05Z'),
        ('different-session','topup','pi_other','cs_other','2026-09-01 00:05Z'),
        ('fallback','topup','pi_fallback','cs_fallback','2026-09-01 00:05Z');
    `);
    const { rows: [row] } = await pg.pool.query(sql);
    assert.equal(Number(row.review_users), 5);
    assert.equal(Number(row.mature_review_users), 4);
    assert.equal(Number(row.quote_displayed_users), 4);
    assert.equal(Number(row.ordered_checkout_users), 4);
    assert.equal(Number(row.ordered_first_topup_users), 2);
    assert.equal(Number(row.session_matched_first_topup_users), 1);
    assert.equal(Number(row.success_return_users), 3, 'a later billing success return is not a workspace return');
    assert.equal(Number(row.mature_ordered_checkout_users), 3);
    assert.equal(Number(row.mature_ordered_first_topup_users), 2);
    assert.equal(Number(row.pending_review_users), 1);
    assert.equal(Number(row.mature_checkout_to_first_topup_pct), 66.7);
    await pg.pool.query('TRUNCATE checkout_interaction_events, app_receipts');
    const { rows: [empty] } = await pg.pool.query(sql);
    assert.equal(Number(empty.review_users), 0);
    assert.equal(empty.mature_checkout_to_first_topup_pct, null, 'no observations cannot become a zero conversion rate');
  } finally { await pg.cleanup(); }
});
