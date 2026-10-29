import type Stripe from 'stripe';
import { Pool } from 'pg';

import { isDatabaseConfigured, withDbTransaction } from '@/lib/db';
import { ensureBillingSchema } from '@/lib/schema';

let eventPool: Pool | null = null;
let eventDatabaseUrl: string | null = null;

// These handlers reconcile canonical receipt identities. Older failed-card handlers
// did not always record event IDs, so replaying their legacy claims is not safe.
const RECOVERABLE_LEGACY_TYPES = new Set([
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'payment_intent.succeeded',
  'invoice.paid',
]);

export function getStripeEventPool(): Pool {
  const connectionString = (process.env.DATABASE_URL ?? '').trim();
  if (!connectionString) throw new Error('DATABASE_URL is not set');
  if (!eventPool || eventDatabaseUrl !== connectionString) {
    if (eventPool) void eventPool.end().catch(() => undefined);
    // Handlers acquire their own business connections. Holding event locks in the
    // application pool can exhaust it while every handler waits for another slot.
    eventPool = new Pool({
      connectionString,
      application_name: 'maxvideoai-stripe-events',
      max: 2,
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 10_000,
      allowExitOnIdle: true,
    });
    const report = (error: Error & { code?: string }) => {
      console.error('[stripe-webhook] Event connection lost', {
        code: /^[A-Z0-9_]{1,40}$/.test(error.code ?? '') ? error.code : 'UNKNOWN',
      });
    };
    eventPool.on('connect', client => client.on('error', report));
    eventPool.on('error', report);
    eventDatabaseUrl = connectionString;
  }
  return eventPool;
}

export type StripeEventResult = 'handled' | 'duplicate';

export async function runStripeEvent(
  event: Stripe.Event,
  handle: () => Promise<void>,
  dependencies: {
    ensureSchema?: typeof ensureBillingSchema;
    pool?: Pick<Pool, 'connect'>;
  } = {},
): Promise<StripeEventResult> {
  if (!isDatabaseConfigured()) {
    await handle();
    return 'handled';
  }
  // An unavailable schema/database must never be acknowledged as success.
  await (dependencies.ensureSchema ?? ensureBillingSchema)();
  return withDbTransaction(async executor => {
    await executor.query("SET LOCAL lock_timeout = '2s'");
    await executor.query("SET LOCAL statement_timeout = '5s'");
    // Bound orphaned transactions if the handler or its external I/O never returns.
    await executor.query("SET LOCAL idle_in_transaction_session_timeout = '60s'");
    const locks = await executor.query<{ acquired: boolean }>(
      'SELECT pg_try_advisory_xact_lock(hashtextextended($1, 0)) AS acquired',
      [`stripe-webhook-event:${event.id}`],
    );
    if (!locks[0]?.acquired) throw new Error('Stripe event is still processing; retry delivery.');

    const inserted = await executor.query<{ event_id: string }>(
      `INSERT INTO stripe_webhook_events (event_id, event_type) VALUES ($1, $2)
       ON CONFLICT (event_id) DO NOTHING RETURNING event_id`,
      [event.id, event.type],
    );
    const rows = await executor.query<{ event_type: string; processed_at: Date | null }>(
      'SELECT event_type, processed_at FROM stripe_webhook_events WHERE event_id = $1 FOR UPDATE',
      [event.id],
    );
    const row = rows[0];
    if (!row || row.event_type !== event.type) throw new Error('Stripe event identity mismatch.');
    if (row.processed_at) return 'duplicate';
    if (!inserted.length && !RECOVERABLE_LEGACY_TYPES.has(event.type)) {
      throw new Error('Unfinished legacy Stripe event requires reconciliation.');
    }

    // Business transactions remain independently idempotent. A lost connection
    // cannot cancel their I/O; do not race the callback or acknowledge before COMMIT.
    await handle();
    const marked = await executor.query<{ event_id: string }>(
      `UPDATE stripe_webhook_events SET processed_at = clock_timestamp()
       WHERE event_id = $1 RETURNING event_id`,
      [event.id],
    );
    if (marked.length !== 1) throw new Error('Stripe event completion was not persisted.');
    return 'handled';
  }, { pool: dependencies.pool ?? getStripeEventPool() });
}
