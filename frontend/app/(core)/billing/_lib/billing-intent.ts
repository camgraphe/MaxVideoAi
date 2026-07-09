import { USD_TOPUP_TIERS } from '@/config/topupTiers';

const DEFAULT_AMOUNT_CENTS = USD_TOPUP_TIERS[0]?.amountCents ?? 1000;

export type BillingIntent = {
  amountCents: number;
  currency: 'USD';
  isExplicit: boolean;
};

export const DEFAULT_BILLING_INTENT: BillingIntent = {
  amountCents: DEFAULT_AMOUNT_CENTS,
  currency: 'USD',
  isExplicit: false,
};

type SearchParamsReader = Pick<URLSearchParams, 'get'>;

function normalizeAmountCents(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < DEFAULT_AMOUNT_CENTS) return null;
  return parsed;
}

export function parseBillingIntent(searchParams: SearchParamsReader): BillingIntent {
  const rawAmount = searchParams.get('amount');
  const rawCurrency = searchParams.get('currency');
  const amountCents = rawAmount == null || rawAmount.trim() === '' ? null : normalizeAmountCents(rawAmount);
  const currency = rawCurrency?.trim().toUpperCase();

  if (amountCents == null || currency !== 'USD') {
    return DEFAULT_BILLING_INTENT;
  }

  return { amountCents, currency: 'USD', isExplicit: true };
}

export function buildBillingIntentTarget(intent: { amountCents: number; currency: string }): string {
  const currency = intent.currency.trim().toUpperCase();
  const amountCents = currency === 'USD'
    ? normalizeAmountCents(intent.amountCents) ?? DEFAULT_AMOUNT_CENTS
    : DEFAULT_AMOUNT_CENTS;
  return `/billing?amount=${amountCents}&currency=USD`;
}
