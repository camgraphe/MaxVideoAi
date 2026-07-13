import { ensureUserPreferredCurrency, normalizeCurrencyCode } from '@/lib/currency';
import { query, withDbTransaction, type QueryExecutor } from '@/lib/db';
import { ensureBillingSchema } from '@/lib/schema';
import { recordMockWalletTopUp } from '@/lib/wallet';
import { extractGaClientId, sendGa4Event } from '@/server/ga4';
import { buildTopupAttributionGa4Params } from '@/server/wallet-attribution';
import { lockAndResolveFirstWalletTopup } from '@/server/wallet-first-topup';
import {
  normalizeStripeId,
  normalizeStripeUrl,
  type TopupDocumentFields,
} from './stripe-webhook-documents';

export type CanonicalStripeTopupInput = {
  userId: string;
  walletAmountCents: number;
  walletCurrency: string;
  settlementAmountCents: number | null;
  settlementCurrency: string | null;
  paymentIntentId?: string | null;
  chargeId?: string | null;
  platformRevenueCents?: number | null;
  destinationAcct?: string | null;
  metadata?: Record<string, unknown>;
  originalAmountCents?: number | null;
  originalCurrency?: string | null;
  fxRate?: number | null;
  fxMarginBps?: number | null;
  fxRateTimestamp?: string | Date | null;
  stripeCustomerId?: string | null;
  stripeCheckoutSessionId?: string | null;
  stripeInvoiceId?: string | null;
  stripeHostedInvoiceUrl?: string | null;
  stripeInvoicePdf?: string | null;
  stripeReceiptUrl?: string | null;
};

function minorToMajorAmount(amountMinor: number): number {
  return amountMinor / 100;
}

async function updateTopupDocumentFields(
  receiptId: string | number,
  fields: TopupDocumentFields & {
    stripePaymentIntentId?: string | null;
    stripeChargeId?: string | null;
  },
  executor?: QueryExecutor
) {
  const values = {
    stripePaymentIntentId: normalizeStripeId(fields.stripePaymentIntentId),
    stripeChargeId: normalizeStripeId(fields.stripeChargeId),
    stripeCustomerId: normalizeStripeId(fields.stripeCustomerId),
    stripeCheckoutSessionId: normalizeStripeId(fields.stripeCheckoutSessionId),
    stripeInvoiceId: normalizeStripeId(fields.stripeInvoiceId),
    stripeHostedInvoiceUrl: normalizeStripeUrl(fields.stripeHostedInvoiceUrl),
    stripeInvoicePdf: normalizeStripeUrl(fields.stripeInvoicePdf),
    stripeReceiptUrl: normalizeStripeUrl(fields.stripeReceiptUrl),
  };
  const hasDocumentValue = Object.values(values).some(Boolean);
  if (!hasDocumentValue) return;

  const sql =
    `UPDATE app_receipts
     SET stripe_payment_intent_id = COALESCE(stripe_payment_intent_id, $2),
         stripe_charge_id = COALESCE(stripe_charge_id, $3),
         stripe_customer_id = COALESCE(stripe_customer_id, $4),
         stripe_checkout_session_id = COALESCE(stripe_checkout_session_id, $5),
         stripe_invoice_id = COALESCE(stripe_invoice_id, $6),
         stripe_hosted_invoice_url = COALESCE(stripe_hosted_invoice_url, $7),
         stripe_invoice_pdf = COALESCE(stripe_invoice_pdf, $8),
         stripe_receipt_url = COALESCE(stripe_receipt_url, $9),
         stripe_document_synced_at = NOW()
     WHERE id = $1`;
  const params = [
    receiptId,
    values.stripePaymentIntentId,
    values.stripeChargeId,
    values.stripeCustomerId,
    values.stripeCheckoutSessionId,
    values.stripeInvoiceId,
    values.stripeHostedInvoiceUrl,
    values.stripeInvoicePdf,
    values.stripeReceiptUrl,
  ];
  if (executor) {
    await executor.query(sql, params);
  } else {
    await query(sql, params);
  }
}

export async function recordStripeTopup(
  input: CanonicalStripeTopupInput,
  options: { receiptsPriceOnly: boolean }
): Promise<void> {
  const {
    userId,
    walletAmountCents,
    walletCurrency,
    settlementAmountCents,
    settlementCurrency,
    paymentIntentId,
    chargeId,
    platformRevenueCents,
    destinationAcct,
    metadata,
    originalAmountCents,
    originalCurrency,
    fxRate,
    fxMarginBps,
    fxRateTimestamp,
    stripeCustomerId,
    stripeCheckoutSessionId,
    stripeInvoiceId,
    stripeHostedInvoiceUrl,
    stripeInvoicePdf,
    stripeReceiptUrl,
  } = input;
  const { receiptsPriceOnly } = options;
  const walletCurrencyUpper = walletCurrency ? walletCurrency.toUpperCase() : 'USD';
  const normalizedWalletAmount = Math.max(0, Math.round(walletAmountCents));
  const settlementCurrencyUpper = settlementCurrency ? settlementCurrency.toUpperCase() : walletCurrencyUpper;
  const normalizedSettlementAmount = settlementAmountCents != null ? Math.max(0, Math.round(settlementAmountCents)) : null;
  if (normalizedWalletAmount <= 0) return;

  if (!process.env.DATABASE_URL) {
    recordMockWalletTopUp(userId, normalizedWalletAmount, paymentIntentId, chargeId);
    console.log('[stripe-webhook] Recorded wallet top-up (mock)', {
      userId,
      amountCents: normalizedWalletAmount,
      currency: walletCurrencyUpper,
      paymentIntentId,
      chargeId,
    });
    return;
  }

  try {
    await ensureBillingSchema();
  } catch (error) {
    console.warn('[stripe-webhook] ensureBillingSchema failed, using mock ledger', error);
    recordMockWalletTopUp(userId, normalizedWalletAmount, paymentIntentId, chargeId);
    return;
  }

  try {
    const documentFields = {
      stripePaymentIntentId: paymentIntentId ?? null,
      stripeChargeId: chargeId ?? null,
      stripeCustomerId: stripeCustomerId ?? null,
      stripeCheckoutSessionId: stripeCheckoutSessionId ?? null,
      stripeInvoiceId: stripeInvoiceId ?? null,
      stripeHostedInvoiceUrl: stripeHostedInvoiceUrl ?? null,
      stripeInvoicePdf: stripeInvoicePdf ?? null,
      stripeReceiptUrl: stripeReceiptUrl ?? null,
    };

    const persistenceResult = await withDbTransaction(async (executor) => {
      const isFirstWalletTopup = await lockAndResolveFirstWalletTopup(executor, userId);

      if (paymentIntentId) {
        const existing = await executor.query<{ id: string }>(
          `SELECT id FROM app_receipts WHERE stripe_payment_intent_id = $1 LIMIT 1`,
          [paymentIntentId]
        );
        if (existing.length > 0) {
          await updateTopupDocumentFields(existing[0].id, documentFields, executor);
          return { kind: 'duplicate' as const };
        }
      }

      if (chargeId) {
        const existingCharge = await executor.query<{ id: string }>(
          `SELECT id FROM app_receipts WHERE stripe_charge_id = $1 LIMIT 1`,
          [chargeId]
        );
        if (existingCharge.length > 0) {
          await updateTopupDocumentFields(existingCharge[0].id, documentFields, executor);
          return { kind: 'duplicate' as const };
        }
      }

      if (stripeCheckoutSessionId) {
        const existingSession = await executor.query<{ id: string }>(
          `SELECT id FROM app_receipts WHERE stripe_checkout_session_id = $1 LIMIT 1`,
          [stripeCheckoutSessionId]
        );
        if (existingSession.length > 0) {
          await updateTopupDocumentFields(existingSession[0].id, documentFields, executor);
          return { kind: 'duplicate' as const };
        }
      }

      const combinedMetadata = {
        ...(metadata ?? {}),
        first_wallet_topup: String(isFirstWalletTopup),
        wallet_amount_cents: normalizedWalletAmount,
        wallet_currency: walletCurrencyUpper,
        settlement_amount_cents: normalizedSettlementAmount,
        settlement_currency: settlementCurrencyUpper,
      };

      const rows = await executor.query<{ id: number }>(
        `INSERT INTO app_receipts (
         user_id,
         type,
         amount_cents,
         currency,
         description,
         metadata,
         stripe_payment_intent_id,
         stripe_charge_id,
         platform_revenue_cents,
         destination_acct,
         original_amount_cents,
         original_currency,
         fx_rate,
         fx_margin_bps,
         fx_rate_timestamp,
         stripe_customer_id,
         stripe_checkout_session_id,
         stripe_invoice_id,
         stripe_hosted_invoice_url,
         stripe_invoice_pdf,
         stripe_receipt_url,
         stripe_document_synced_at
       )
       VALUES ($1, 'topup', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, CASE WHEN $15::text IS NOT NULL OR $16::text IS NOT NULL OR $17::text IS NOT NULL OR $18::text IS NOT NULL OR $19::text IS NOT NULL OR $20::text IS NOT NULL THEN NOW() ELSE NULL END)
       ON CONFLICT DO NOTHING
       RETURNING id`,
        [
          userId,
          normalizedWalletAmount,
          walletCurrencyUpper,
          'Wallet top-up',
          combinedMetadata,
          paymentIntentId ?? null,
          chargeId ?? null,
          receiptsPriceOnly ? null : platformRevenueCents ?? null,
          destinationAcct ?? null,
          originalAmountCents ?? normalizedSettlementAmount ?? normalizedWalletAmount,
          originalCurrency ? originalCurrency.toUpperCase() : settlementCurrencyUpper,
          fxRate ?? null,
          fxMarginBps ?? null,
          fxRateTimestamp ? new Date(fxRateTimestamp) : null,
          documentFields.stripeCustomerId,
          documentFields.stripeCheckoutSessionId,
          documentFields.stripeInvoiceId,
          documentFields.stripeHostedInvoiceUrl,
          documentFields.stripeInvoicePdf,
          documentFields.stripeReceiptUrl,
        ]
      );

      if (rows.length === 0) {
        const fallbackExisting = paymentIntentId
          ? await executor.query<{ id: string }>(
              `SELECT id FROM app_receipts WHERE stripe_payment_intent_id = $1 LIMIT 1`,
              [paymentIntentId]
            )
          : chargeId
            ? await executor.query<{ id: string }>(
                `SELECT id FROM app_receipts WHERE stripe_charge_id = $1 LIMIT 1`,
                [chargeId]
              )
            : stripeCheckoutSessionId
              ? await executor.query<{ id: string }>(
                  `SELECT id FROM app_receipts WHERE stripe_checkout_session_id = $1 LIMIT 1`,
                  [stripeCheckoutSessionId]
                )
              : [];
        if (fallbackExisting.length > 0) {
          await updateTopupDocumentFields(fallbackExisting[0].id, documentFields, executor);
        }
        return { kind: 'duplicate' as const };
      }

      return {
        kind: 'inserted' as const,
        receiptId: rows[0].id,
        combinedMetadata,
        isFirstWalletTopup,
      };
    });

    if (persistenceResult.kind === 'duplicate') {
      console.log('[stripe-webhook] Skipped duplicate wallet top-up', {
        userId,
        amountCents: normalizedWalletAmount,
        currency: walletCurrencyUpper,
        paymentIntentId,
        chargeId,
      });
      return;
    }

    const { combinedMetadata } = persistenceResult;

    const resolvedCurrency = normalizeCurrencyCode(walletCurrencyUpper.toLowerCase());
    if (resolvedCurrency) {
      await ensureUserPreferredCurrency(userId, resolvedCurrency);
    }

    const metadataRecord = combinedMetadata as Record<string, unknown>;
    const consentValue = typeof metadataRecord.analytics_consent === 'string' ? metadataRecord.analytics_consent : '';
    const analyticsConsentGranted = consentValue.toLowerCase() === 'granted';
    if (analyticsConsentGranted) {
      const attributionParams = buildTopupAttributionGa4Params(metadataRecord);
      const gaClientId = extractGaClientId(
        typeof metadataRecord.ga_client_id === 'string' ? metadataRecord.ga_client_id : null
      );
      const sourceEvent = typeof metadataRecord.source === 'string' ? metadataRecord.source : null;
      const topupTierId = typeof metadataRecord.topup_tier_id === 'string' ? metadataRecord.topup_tier_id : null;
      const topupTierLabel =
        typeof metadataRecord.topup_tier_label === 'string' ? metadataRecord.topup_tier_label : null;
      const fxSource = typeof metadataRecord.fx_source === 'string' ? metadataRecord.fx_source : null;
      const transactionId = paymentIntentId ?? chargeId ?? `topup_${persistenceResult.receiptId}`;
      const purchaseValueMinor = normalizedSettlementAmount ?? normalizedWalletAmount;
      const purchaseCurrency = settlementCurrencyUpper;
      const commonParams = {
        ...attributionParams,
        funnel_stage: 'topup_completed',
        is_first_wallet_topup: persistenceResult.isFirstWalletTopup,
        value: minorToMajorAmount(purchaseValueMinor),
        currency: purchaseCurrency,
        wallet_currency: walletCurrencyUpper,
        wallet_amount_usd: minorToMajorAmount(normalizedWalletAmount),
        wallet_amount_cents: normalizedWalletAmount,
        credits_amount: minorToMajorAmount(normalizedWalletAmount),
        topup_amount_usd: normalizedWalletAmount / 100,
        topup_amount_cents: normalizedWalletAmount,
        settlement_amount_minor: purchaseValueMinor,
        settlement_currency: settlementCurrencyUpper,
        payment_provider: 'stripe',
        payment_flow: 'checkout',
        source_event: sourceEvent ?? undefined,
        stripe_payment_intent_id: paymentIntentId ?? undefined,
        stripe_charge_id: chargeId ?? undefined,
        topup_tier_id: topupTierId ?? undefined,
        topup_tier_label: topupTierLabel ?? undefined,
        fx_source: fxSource ?? undefined,
        transaction_id: transactionId,
      };

      await Promise.allSettled([
        sendGa4Event({
          name: 'topup_completed',
          clientId: gaClientId,
          userId,
          params: commonParams,
        }),
        sendGa4Event({
          name: 'purchase',
          clientId: gaClientId,
          userId,
          params: {
            ...commonParams,
            item_category: 'wallet_topup',
          },
        }),
      ]);
    }

    console.log('[stripe-webhook] Recorded wallet top-up', {
      userId,
      amountCents: normalizedWalletAmount,
      currency: walletCurrencyUpper,
      settlementAmountCents: normalizedSettlementAmount,
      settlementCurrency: settlementCurrencyUpper,
      paymentIntentId,
      chargeId,
      platformRevenueCents,
      destinationAcct,
    });
  } catch (error) {
    console.error('[stripe-webhook] Failed to persist top-up, using mock ledger', error);
    recordMockWalletTopUp(userId, normalizedWalletAmount, paymentIntentId, chargeId);
  }
}
