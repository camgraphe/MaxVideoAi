import type Stripe from 'stripe';

import { query } from '@/lib/db';
import { ensureBillingSchema } from '@/lib/schema';

export async function beginStripeEvent(event: Stripe.Event): Promise<boolean> {
  if (!process.env.DATABASE_URL) return true;
  try {
    await ensureBillingSchema();
  } catch (error) {
    console.warn('[stripe-webhook] ensureBillingSchema failed for event idempotency', error);
    return true;
  }
  try {
    const rows = await query<{ event_id: string }>(
      `INSERT INTO stripe_webhook_events (event_id, event_type)
       VALUES ($1, $2)
       ON CONFLICT (event_id) DO NOTHING
       RETURNING event_id`,
      [event.id, event.type]
    );
    return rows.length > 0;
  } catch (error) {
    console.warn('[stripe-webhook] Failed to record event id', { eventId: event.id, error });
    return true;
  }
}

export async function markStripeEventProcessed(eventId: string): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  try {
    await query(`UPDATE stripe_webhook_events SET processed_at = NOW() WHERE event_id = $1`, [eventId]);
  } catch (error) {
    console.warn('[stripe-webhook] Failed to mark event processed', { eventId, error });
  }
}

export async function rollbackStripeEvent(eventId: string): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  try {
    await query(`DELETE FROM stripe_webhook_events WHERE event_id = $1`, [eventId]);
  } catch (error) {
    console.warn('[stripe-webhook] Failed to rollback event record', { eventId, error });
  }
}
