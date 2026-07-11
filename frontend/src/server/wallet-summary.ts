import { query, type QueryExecutor } from '@/lib/db';
import { normalizeCurrencyCode, type Currency } from '@/lib/currency';

const WALLET_CURRENCY = 'USD';
const WALLET_CURRENCY_LOWER = 'usd';

type WalletLedgerSummaryRow = {
  topups_cents: number | string | null;
  charges_cents: number | string | null;
  refunds_cents: number | string | null;
  completed_topups: number | string | null;
  mismatched_currencies: string | null;
};

export type WalletSummary = {
  balanceCents: number;
  currency: string;
  pendingCents: number;
  hasCompletedTopUp: boolean;
};

function finiteNumber(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function getWalletSummary(
  userId: string,
  executor?: QueryExecutor
): Promise<WalletSummary> {
  const params = [userId, WALLET_CURRENCY, WALLET_CURRENCY_LOWER] as const;
  const sql = `SELECT
      COALESCE(SUM(CASE WHEN type = 'topup' AND (currency IS NULL OR UPPER(currency) = $2) THEN amount_cents ELSE 0 END), 0)::bigint AS topups_cents,
      COALESCE(SUM(CASE WHEN type = 'charge' AND (currency IS NULL OR UPPER(currency) = $2) THEN amount_cents ELSE 0 END), 0)::bigint AS charges_cents,
      COALESCE(SUM(CASE WHEN type = 'refund' AND (currency IS NULL OR UPPER(currency) = $2) THEN amount_cents ELSE 0 END), 0)::bigint AS refunds_cents,
      COUNT(*) FILTER (WHERE type = 'topup' AND amount_cents > 0)::int AS completed_topups,
      COALESCE(STRING_AGG(DISTINCT LOWER(currency), ',') FILTER (WHERE currency IS NOT NULL AND LOWER(currency) <> $3), '') AS mismatched_currencies
     FROM app_receipts
    WHERE user_id = $1`;
  const rows = executor
    ? await executor.query<WalletLedgerSummaryRow>(sql, params)
    : await query<WalletLedgerSummaryRow>(sql, params);
  const summary = rows[0];
  const walletCurrency = WALLET_CURRENCY_LOWER as Currency;
  const normalizedMismatches = (summary?.mismatched_currencies ?? '')
    .split(',')
    .map((currency) => normalizeCurrencyCode(currency))
    .filter((currency): currency is Currency => Boolean(currency) && currency !== walletCurrency);

  if (normalizedMismatches.length) {
    console.warn('[wallet] detected receipts with mismatched currency', {
      userId,
      walletCurrency,
      mismatched: normalizedMismatches,
    });
  }

  const topups = finiteNumber(summary?.topups_cents);
  const charges = finiteNumber(summary?.charges_cents);
  const refunds = finiteNumber(summary?.refunds_cents);

  return {
    balanceCents: Math.max(0, topups + refunds - charges),
    currency: WALLET_CURRENCY,
    pendingCents: 0,
    hasCompletedTopUp: finiteNumber(summary?.completed_topups) > 0,
  };
}
