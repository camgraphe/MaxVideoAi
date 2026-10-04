const MIN_TOPUP_CENTS = 1000;

export function getSufficientTopUpAmountCents(shortfallCents: number | undefined): number {
  if (typeof shortfallCents !== 'number' || !Number.isFinite(shortfallCents)) {
    return MIN_TOPUP_CENTS;
  }
  const normalizedShortfall = Math.max(0, Math.ceil(shortfallCents));
  return Math.max(MIN_TOPUP_CENTS, Math.ceil(normalizedShortfall / 100) * 100);
}

export function formatWorkspaceTopupPaymentAmount(
  amountMinor: number,
  currency: string,
  locale: 'en' | 'fr' | 'es',
): string {
  const normalizedCurrency = currency.toUpperCase();
  const zeroDecimal = normalizedCurrency === 'JPY';
  const amount = amountMinor / (zeroDecimal ? 1 : 100);
  const intlLocale = locale === 'fr' ? 'fr-FR' : locale === 'es' ? 'es-ES' : 'en-US';
  try {
    return new Intl.NumberFormat(intlLocale, {
      style: 'currency',
      currency: normalizedCurrency,
    }).format(amount);
  } catch {
    return `${normalizedCurrency} ${amount.toFixed(zeroDecimal ? 0 : 2)}`;
  }
}

export function buildWorkspaceTopupAnalyticsPayload(amountCents: number, chargeCurrency = 'USD'): Record<string, unknown> {
  const normalizedAmount = Number.isFinite(amountCents)
    ? Math.max(MIN_TOPUP_CENTS, Math.round(amountCents))
    : MIN_TOPUP_CENTS;
  return {
    source: 'workspace',
    route_family: 'workspace',
    payment_provider: 'stripe',
    payment_flow: 'checkout',
    charge_currency: chargeCurrency.toUpperCase(),
    wallet_amount_usd: normalizedAmount / 100,
    wallet_amount_cents: normalizedAmount,
    credits_amount: normalizedAmount / 100,
    topup_amount_usd: normalizedAmount / 100,
    topup_amount_cents: normalizedAmount,
  };
}
