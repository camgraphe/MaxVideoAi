import type { QueryExecutor } from '@/lib/db';
import { extractGaClientId } from '@/server/ga4';
import { normalizeGa4SessionId } from '@/lib/analytics/ga-session-id';
import { buildTopupAttributionGa4Params } from '@/server/wallet-attribution';
import { enqueueGa4PaymentEvent } from '@/server/ga4-payment-outbox';

type WalletReceipt = {
  id: string; user_id: string; amount_cents: number; currency: string; created_at: Date;
  metadata: Record<string, unknown>; stripe_payment_intent_id: string | null; stripe_charge_id: string | null;
};

export async function enqueueGa4WalletReceipt(db: QueryExecutor, receiptId: string): Promise<void> {
  const [receipt] = await db.query<WalletReceipt>(`SELECT id::text,user_id,amount_cents,currency,created_at,
    metadata,stripe_payment_intent_id,stripe_charge_id FROM app_receipts WHERE id=$1 AND type='topup'`, [receiptId]);
  if (!receipt) return;
  const m = receipt.metadata ?? {};
  if (m.ga4_outbox_version !== '1' || m.stripe_livemode !== true || m.analytics_consent !== 'granted'
    || !['true','false'].includes(String(m.first_recorded_external_payment))) return;
  const settlement = Number(m.settlement_amount_cents ?? receipt.amount_cents);
  if (!Number.isFinite(settlement) || settlement <= 0) return;
  const currency = String(m.settlement_currency ?? receipt.currency).toUpperCase();
  const consentObservedAt = new Date(typeof m.ga4_consent_observed_at === 'string' ? m.ga4_consent_observed_at : 0);
  if (!Number.isFinite(consentObservedAt.getTime())) return;
  const params = {
    ...buildTopupAttributionGa4Params(m),
    funnel_stage: 'topup_completed',
    is_first_wallet_topup: m.first_wallet_topup === 'true',
    is_first_recorded_external_payment: m.first_recorded_external_payment === 'true',
    value: settlement/100, currency,
    wallet_currency: receipt.currency, wallet_amount_usd: receipt.amount_cents/100,
    wallet_amount_cents: receipt.amount_cents, credits_amount: receipt.amount_cents/100,
    topup_amount_usd: receipt.amount_cents/100, topup_amount_cents: receipt.amount_cents,
    settlement_amount_minor: settlement, settlement_currency: currency,
    payment_provider: 'stripe', payment_flow: 'checkout', source_event: m.source,
    stripe_payment_intent_id: receipt.stripe_payment_intent_id, stripe_charge_id: receipt.stripe_charge_id,
    topup_tier_id: m.topup_tier_id, topup_tier_label: m.topup_tier_label, fx_source: m.fx_source,
    transaction_id: receipt.stripe_payment_intent_id ?? receipt.stripe_charge_id ?? `topup_${receipt.id}`,
  };
  for (const name of ['topup_completed','purchase'] as const) {
    await enqueueGa4PaymentEvent(db, {
      key: `receipt:${receipt.id}:${name}`, userId: receipt.user_id, occurredAt: receipt.created_at, consentObservedAt,
      event: { name, userId: receipt.user_id,
        clientId: extractGaClientId(typeof m.ga_client_id === 'string' ? m.ga_client_id : null),
        sessionId: normalizeGa4SessionId(m.ga_session_id),
        params: name === 'purchase' ? {...params,item_category:'wallet_topup'} : params },
    });
  }
}

/** Optional measurement must not abort a real wallet receipt transaction. */
export async function enqueueGa4WalletReceiptSafely(db: QueryExecutor, receiptId: string): Promise<boolean> {
  await db.query('SAVEPOINT ga4_payment_enqueue');
  try {
    await enqueueGa4WalletReceipt(db, receiptId);
    await db.query('RELEASE SAVEPOINT ga4_payment_enqueue');
    return true;
  } catch {
    await db.query('ROLLBACK TO SAVEPOINT ga4_payment_enqueue');
    await db.query('RELEASE SAVEPOINT ga4_payment_enqueue');
    console.warn('[ga4-payments] receipt enqueue deferred to repair');
    return false;
  }
}

export async function repairGa4WalletIntents(db: QueryExecutor): Promise<number> {
  const receipts = await db.query<{id:string}>(`SELECT r.id::text FROM app_receipts r
    WHERE r.type='topup' AND r.created_at>now()-interval '71 hours'
      AND r.metadata->>'ga4_outbox_version'='1' AND r.metadata->>'stripe_livemode'='true'
      AND r.metadata->>'analytics_consent'='granted'
      AND r.metadata->>'first_recorded_external_payment' IN ('true','false')
      AND (NOT EXISTS (SELECT 1 FROM ga4_payment_outbox o WHERE o.event_key='receipt:'||r.id||':purchase')
        OR NOT EXISTS (SELECT 1 FROM ga4_payment_outbox o WHERE o.event_key='receipt:'||r.id||':topup_completed'))
    ORDER BY r.created_at,r.id LIMIT 20`);
  for (const receipt of receipts) await enqueueGa4WalletReceipt(db, receipt.id);
  return receipts.length;
}
