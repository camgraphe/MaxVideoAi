import { NextRequest, NextResponse } from 'next/server';
import { USD_TOPUP_TIERS } from '@/config/topupTiers';
import { convertUsdToCurrencyAmount } from '@/lib/fxQuote';
import { normalizeCurrencyCode, resolveCurrency } from '@/lib/currency';
import { getUserIdFromRequest } from '@/lib/user';

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromRequest(req).catch(() => null);
  const body = (await req.json().catch(() => null)) ?? {};
  const requestedCurrency = normalizeCurrencyCode(typeof body.currency === 'string' ? body.currency : null);

  const currencyResolution = resolveCurrency(req, requestedCurrency ? { preferred_currency: requestedCurrency } : undefined);
  const targetCurrency = requestedCurrency ?? currencyResolution.currency;

  const rawAmounts: number[] = Array.isArray(body.amounts)
    ? body.amounts
        .map((value: unknown) => (typeof value === 'number' ? Math.round(value) : Number.parseInt(String(value), 10)))
        .filter((value) => Number.isFinite(value) && value > 0)
    : [];
  const usdAmounts = rawAmounts.length ? rawAmounts : USD_TOPUP_TIERS.map((tier) => tier.amountCents);

  const quotes = [] as Array<{
    usdAmountCents: number;
    localAmountMinor: number;
    currency: string;
    rate: number;
    rateWithMargin: number;
    source: string;
    marginBps: number;
    rateTimestamp: string;
  }>;

  for (const amount of usdAmounts) {
    try {
      const quote = await convertUsdToCurrencyAmount({ usdAmountCents: amount, targetCurrency });
      quotes.push({
        usdAmountCents: amount,
        localAmountMinor: quote.amountMinor,
        currency: quote.currency,
        rate: quote.rate,
        rateWithMargin: quote.rateWithMargin,
        source: quote.source,
        marginBps: quote.marginBps,
        rateTimestamp: quote.rateTimestamp,
      });
    } catch (error) {
      console.warn('[api/topup/quote] failed to convert amount', {
        userId,
        amount,
        targetCurrency,
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  if (!quotes.length) {
    return NextResponse.json({ ok: false, error: 'Unable to compute quotes' }, { status: 500 });
  }

  const latest = quotes[quotes.length - 1];

  return NextResponse.json({
    ok: true,
    currency: latest.currency,
    source: latest.source,
    marginBps: latest.marginBps,
    rateTimestamp: latest.rateTimestamp,
    quotes,
  });
}
