import { NextRequest, NextResponse } from 'next/server';
import { isDatabaseConfigured } from '@/lib/db';
import { ensureBillingSchema } from '@/lib/schema';
import {
  getUserPreferredCurrency,
  normalizeCurrencyCode,
  resolveDefaultCurrency,
  resolveEnabledCurrencies,
  setUserPreferredCurrency,
  type Currency,
} from '@/lib/currency';
import { getWalletBalancesByCurrency } from '@/lib/wallet';
import { getRouteAuthContext } from '@/lib/supabase-ssr';

type CurrencySummaryResponse = {
  ok: boolean;
  error?: string;
  currency?: string | null;
  defaultCurrency?: string;
  enabled?: string[];
  balances?: Array<{ currency: string | null; balanceCents: number }>;
  locked?: boolean;
  conflictCurrency?: string | null;
  conflictBalanceCents?: number;
};

function normalizeForResponse(value: Currency | null): string | null {
  return value ? value.toUpperCase() : null;
}

export async function GET(req: NextRequest) {
  const enabledLower = resolveEnabledCurrencies();
  const enabledUpper = enabledLower.map((currency) => currency.toUpperCase());
  const defaultCurrency = resolveDefaultCurrency(enabledLower).toUpperCase();

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Database unavailable',
        enabled: enabledUpper,
        defaultCurrency,
      } satisfies CurrencySummaryResponse,
      { status: 503 }
    );
  }

  const { userId } = await getRouteAuthContext(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' } satisfies CurrencySummaryResponse, { status: 401 });
  }

  try {
    await ensureBillingSchema();
  } catch (error) {
    console.warn('[api/me/currency] ensureBillingSchema failed', error instanceof Error ? error.message : error);
  }

  const preferred = await getUserPreferredCurrency(userId);
  const balances = await getWalletBalancesByCurrency(userId);
  const formattedBalances = balances.map((entry) => ({
    currency: entry.currency ? entry.currency.toUpperCase() : null,
    balanceCents: entry.balanceCents,
  }));

  return NextResponse.json(
    {
      ok: true,
      currency: normalizeForResponse(preferred),
      defaultCurrency,
      enabled: enabledUpper,
      balances: formattedBalances,
      locked: Boolean(preferred),
    } satisfies CurrencySummaryResponse
  );
}

export async function POST(req: NextRequest) {
  const enabledLower = resolveEnabledCurrencies();
  const enabledSet = new Set(enabledLower);
  const enabledUpper = enabledLower.map((currency) => currency.toUpperCase());
  const defaultCurrency = resolveDefaultCurrency(enabledLower).toUpperCase();

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Database unavailable',
        enabled: enabledUpper,
        defaultCurrency,
      } satisfies CurrencySummaryResponse,
      { status: 503 }
    );
  }

  const { userId } = await getRouteAuthContext(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' } satisfies CurrencySummaryResponse, { status: 401 });
  }

  try {
    await ensureBillingSchema();
  } catch (error) {
    console.warn('[api/me/currency] ensureBillingSchema failed', error instanceof Error ? error.message : error);
  }

  const body = await req.json().catch(() => ({}));
  const requestedCurrency = normalizeCurrencyCode(body?.currency);
  const confirm = body?.confirm === true;

  if (!requestedCurrency || !enabledSet.has(requestedCurrency)) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Unsupported currency',
        enabled: enabledUpper,
      } satisfies CurrencySummaryResponse,
      { status: 400 }
    );
  }

  if (!confirm) {
    return NextResponse.json(
      { ok: false, error: 'Confirmation required' } satisfies CurrencySummaryResponse,
      { status: 400 }
    );
  }

  const currentPreferred = await getUserPreferredCurrency(userId);
  if (currentPreferred === requestedCurrency) {
    return NextResponse.json(
      {
        ok: true,
        currency: normalizeForResponse(currentPreferred),
        defaultCurrency,
        enabled: enabledUpper,
        locked: Boolean(currentPreferred),
      } satisfies CurrencySummaryResponse
    );
  }

  const balances = await getWalletBalancesByCurrency(userId);
  const conflicting = balances.find(
    (entry) => entry.currency && entry.currency !== requestedCurrency && entry.balanceCents > 0
  );

  if (conflicting?.currency) {
    const conflictCurrency = conflicting.currency.toUpperCase();
    return NextResponse.json(
      {
        ok: false,
        error: `Existing wallet balance detected in ${conflictCurrency}. Spend or refund before changing currency.`,
        currency: normalizeForResponse(currentPreferred),
        defaultCurrency,
        enabled: enabledUpper,
        conflictCurrency,
        conflictBalanceCents: conflicting.balanceCents,
      } satisfies CurrencySummaryResponse,
      { status: 409 }
    );
  }

  await setUserPreferredCurrency(userId, requestedCurrency);

  console.info('[api/me/currency] preferred currency updated', {
    userId,
    currency: requestedCurrency.toUpperCase(),
  });

  return NextResponse.json(
    {
      ok: true,
      currency: requestedCurrency.toUpperCase(),
      defaultCurrency,
      enabled: enabledUpper,
      locked: true,
    } satisfies CurrencySummaryResponse
  );
}
