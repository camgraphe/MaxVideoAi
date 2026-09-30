import type { PricingSnapshot, Mode } from '@/types/engines';
import { query, withDbTransaction, isTransactionQueryExecutor, type TransactionQueryExecutor } from '@/lib/db';
import { lockInitialJobReservation } from '@/server/generations/initial-job-reservation';
import { lockQuotedCustomerTariffRevision } from './customer-tariff-revision';

export type DirectPaymentScenario = {
  engineId: string; mode: Mode; durationSec: number; resolution: string;
  aspectRatio: string | null; loop: boolean; audioEnabled: boolean | null; voiceControl: boolean;
};
export type DirectPaymentQuote = {
  id: string; userId: string; jobId: string; scenario: DirectPaymentScenario; pricing: PricingSnapshot;
  settlement: { currency: string; amountCents: number; fxRate: number; fxSource: string };
};
export type DirectPaymentIntent = {
  id: string; status: string; amount?: number | null; amount_received?: number | null;
  currency?: string | null; latest_charge?: string | { id?: string | null; refunded?: boolean; amount_refunded?: number } | null;
  metadata?: Record<string, string | undefined>;
};
export class DirectPaymentQuoteError extends Error {
  constructor(readonly code: string, readonly status: number) { super(code); this.name = 'DirectPaymentQuoteError'; }
}

export async function loadDirectPaymentQuote(id: string): Promise<DirectPaymentQuote | null> {
  const [row] = await query<{ quote_json: DirectPaymentQuote }>(
    'SELECT quote_json FROM app_direct_payment_quotes WHERE id = $1', [id]);
  return row?.quote_json ?? null;
}

/** Stripe is read once; captured amounts use the immutable server quote, never today's tariff or FX. */
export async function resolveCapturedDirectPaymentQuote(input: {
  intent: DirectPaymentIntent; userId: string; jobId: string; scenario: DirectPaymentScenario;
  loadQuote?: typeof loadDirectPaymentQuote;
}): Promise<DirectPaymentQuote> {
  const { intent } = input;
  if (intent.metadata?.kind !== 'run' || intent.metadata.user_id !== input.userId || intent.metadata.job_id !== input.jobId) {
    throw new DirectPaymentQuoteError('PAYMENT_BINDING_MISMATCH', 409);
  }
  if (!intent.metadata.direct_quote_id) throw new DirectPaymentQuoteError('DIRECT_PAYMENT_QUOTE_UNAVAILABLE', 409);
  let quote: DirectPaymentQuote | null;
  try { quote = await (input.loadQuote ?? loadDirectPaymentQuote)(intent.metadata.direct_quote_id); }
  catch { throw new DirectPaymentQuoteError('DIRECT_PAYMENT_QUOTE_UNAVAILABLE', 503); }
  if (!quote) throw new DirectPaymentQuoteError('DIRECT_PAYMENT_QUOTE_UNAVAILABLE', 409);
  if (quote.id !== intent.metadata.direct_quote_id || quote.userId !== input.userId || quote.jobId !== input.jobId ||
      Object.entries(input.scenario).some(([key, value]) => quote.scenario[key as keyof DirectPaymentScenario] !== value)) {
    throw new DirectPaymentQuoteError('PAYMENT_BINDING_MISMATCH', 409);
  }
  validateDirectQuote(quote);
  if (intent.status !== 'succeeded' || intent.amount_received !== quote.settlement.amountCents || intent.amount !== quote.settlement.amountCents) {
    throw new DirectPaymentQuoteError('PAYMENT_NOT_CAPTURED', 402);
  }
  if (intent.latest_charge && typeof intent.latest_charge === 'object' && (intent.latest_charge.refunded || (intent.latest_charge.amount_refunded ?? 0) > 0)) {
    throw new DirectPaymentQuoteError('PAYMENT_ALREADY_REFUNDED', 409);
  }
  if (intent.currency?.toUpperCase() !== quote.settlement.currency) throw new DirectPaymentQuoteError('PAYMENT_CURRENCY_MISMATCH', 409);
  return quote;
}

function validateDirectQuote(quote: DirectPaymentQuote): void {
  if (!quote.id || !quote.userId || !quote.jobId || !quote.scenario?.engineId || quote.pricing?.currency !== 'USD' ||
      !Number.isSafeInteger(quote.pricing.totalCents) || quote.pricing.totalCents < 0 ||
      !Number.isSafeInteger(quote.settlement?.amountCents) || quote.settlement.amountCents <= 0 ||
      !/^[A-Z]{3}$/.test(quote.settlement.currency) || !Number.isFinite(quote.settlement.fxRate) || quote.settlement.fxRate <= 0 || !quote.settlement.fxSource) {
    throw new DirectPaymentQuoteError('DIRECT_PAYMENT_QUOTE_UNAVAILABLE', 409);
  }
}

/** Persist before exposing a Stripe client secret. The tariff lock covers this quote's creation. */
export async function persistDirectPaymentQuote(executor: TransactionQueryExecutor, quote: DirectPaymentQuote): Promise<void> {
  if (!isTransactionQueryExecutor(executor)) throw new Error('Direct quotes require an active transaction');
  validateDirectQuote(quote);
  await lockInitialJobReservation(executor, quote.jobId);
  const jobs = await executor.query('SELECT job_id FROM app_jobs WHERE job_id = $1', [quote.jobId]);
  const receipts = await executor.query('SELECT id FROM app_receipts WHERE job_id = $1 AND type IN ($2, $3)', [quote.jobId, 'charge', 'refund']);
  const quotes = await executor.query('SELECT id FROM app_direct_payment_quotes WHERE job_id = $1', [quote.jobId]);
  if (jobs.length || receipts.length || quotes.length) throw new DirectPaymentQuoteError('DIRECT_PAYMENT_JOB_CONFLICT', 409);
  await lockQuotedCustomerTariffRevision(executor, quote.scenario.engineId, quote.pricing);
  await executor.query('INSERT INTO app_direct_payment_quotes (id, user_id, job_id, quote_json) VALUES ($1, $2, $3, $4::jsonb)',
    [quote.id, quote.userId, quote.jobId, JSON.stringify(quote)]);
}

export async function saveDirectPaymentQuote(quote: DirectPaymentQuote): Promise<DirectPaymentQuote> {
  return withDbTransaction(async executor => {
    await lockInitialJobReservation(executor, quote.jobId);
    const [existing] = await executor.query<{ quote_json: DirectPaymentQuote; created_at: Date }>(
      'SELECT quote_json, created_at FROM app_direct_payment_quotes WHERE job_id = $1', [quote.jobId]);
    if (!existing) { await persistDirectPaymentQuote(executor, quote); return quote; }
    const original = existing.quote_json;
    const jobs = await executor.query('SELECT job_id FROM app_jobs WHERE job_id = $1', [quote.jobId]);
    const receipts = await executor.query('SELECT id FROM app_receipts WHERE job_id = $1 AND type IN ($2, $3)', [quote.jobId, 'charge', 'refund']);
    if (jobs.length || receipts.length || original.userId !== quote.userId ||
        Object.entries(quote.scenario).some(([key, value]) => original.scenario[key as keyof DirectPaymentScenario] !== value) ||
        Date.now() - new Date(existing.created_at).getTime() >= 23 * 60 * 60 * 1000) {
      throw new DirectPaymentQuoteError('DIRECT_PAYMENT_JOB_CONFLICT', 409);
    }
    validateDirectQuote(original);
    return original;
  });
}

/** A captured job validates the stored paid quote, independent of later tariff revisions. */
export async function validateCapturedDirectJobQuote(executor: TransactionQueryExecutor, input: {
  userId: string; jobId: string; engineId: string; amountCents: number;
  receipt: { userId: string; jobId: string; amountCents: number; currency: string; stripePaymentIntentId?: string | null; auditPricingSnapshot?: unknown } | null;
}): Promise<void> {
  const receipt = input.receipt;
  const audit = receipt?.auditPricingSnapshot as PricingSnapshot | undefined;
  const id = audit?.meta?.directPaymentQuoteId;
  if (!receipt?.stripePaymentIntentId || typeof id !== 'string' || receipt.userId !== input.userId || receipt.jobId !== input.jobId) {
    throw new DirectPaymentQuoteError('PAYMENT_BINDING_MISMATCH', 409);
  }
  const [row] = await executor.query<{ quote_json: DirectPaymentQuote }>(
    'SELECT quote_json FROM app_direct_payment_quotes WHERE id = $1 FOR SHARE', [id]);
  const quote = row?.quote_json;
  if (!quote || quote.userId !== input.userId || quote.jobId !== input.jobId || quote.scenario.engineId !== input.engineId ||
      quote.pricing.totalCents !== input.amountCents || quote.pricing.totalCents !== receipt.amountCents || receipt.currency !== quote.pricing.currency ||
      quote.pricing.meta?.customerTariffRevision !== audit?.meta?.customerTariffRevision) {
    throw new DirectPaymentQuoteError('PAYMENT_BINDING_MISMATCH', 409);
  }
  const refunds = await executor.query('SELECT id FROM app_receipts WHERE job_id = $1 AND type = $2 LIMIT 1', [input.jobId, 'refund']);
  if (refunds.length) throw new DirectPaymentQuoteError('JOB_ALREADY_REFUNDED', 409);
}
