import { ENV } from '@/lib/env';
import { fetchUsdRatesFrankfurter } from './fxProvider';

const ZERO_DECIMAL_CURRENCIES = new Set(['JPY']);
const SUPPORTED_TARGETS = new Set(['EUR', 'USD', 'GBP', 'CHF']);
const USD_MINOR_UNIT = 100;

function getMarginBps(): number {
  const raw = process.env.FX_MARGIN_BPS ?? ENV.FX_MARGIN_BPS ?? '';
  const parsed = Number(raw);
  if (Number.isFinite(parsed) && parsed >= 0) {
    return parsed;
  }
  return 100; // 1%
}

function getFallbackRate(targetCurrency: string): { rate: number; source: string } {
  const envKey = `FX_RATE_USD_${targetCurrency}`;
  const envRateRaw = process.env[envKey];
  const parsed = envRateRaw ? Number(envRateRaw) : NaN;
  if (Number.isFinite(parsed) && parsed > 0) {
    return { rate: parsed, source: `env:${envKey}` };
  }
  // Basic defaults as last resort
  switch (targetCurrency) {
    case 'EUR':
      return { rate: 0.92, source: 'default:eur' };
    case 'GBP':
      return { rate: 0.79, source: 'default:gbp' };
    case 'CHF':
      return { rate: 0.88, source: 'default:chf' };
    default:
      return { rate: 1, source: 'identity' };
  }
}

function minorUnit(currency: string): number {
  return ZERO_DECIMAL_CURRENCIES.has(currency) ? 0 : 2;
}

function applyMargin(rate: number, marginBps: number): number {
  const margin = Math.max(0, marginBps) / 10_000;
  const adjusted = rate * (1 + margin);
  return adjusted > 0 ? adjusted : rate;
}

export type FxQuote = {
  currency: string;
  amountMinor: number;
  rate: number;
  rateWithMargin: number;
  source: string;
  marginBps: number;
  rateTimestamp: string;
};

export async function convertUsdToCurrencyAmount({
  usdAmountCents,
  targetCurrency,
}: {
  usdAmountCents: number;
  targetCurrency: string;
}): Promise<FxQuote> {
  const normalizedTarget = targetCurrency?.trim().toUpperCase();
  if (!normalizedTarget || normalizedTarget === 'USD') {
    return {
      currency: normalizedTarget || 'USD',
      amountMinor: usdAmountCents,
      rate: 1,
      rateWithMargin: 1,
      source: 'identity',
      marginBps: 0,
      rateTimestamp: new Date().toISOString(),
    };
  }

  let rate: number | null = null;
  let source = 'frankfurter';
  let rateTimestamp = new Date().toISOString();

  try {
    if (!SUPPORTED_TARGETS.has(normalizedTarget)) {
      throw new Error('unsupported_target');
    }
    const { rates, asOf } = await fetchUsdRatesFrankfurter([normalizedTarget]);
    rate = Number(rates[normalizedTarget]);
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error('invalid_rate');
    }
    rateTimestamp = `${asOf}T00:00:00Z`;
  } catch {
    const fallback = getFallbackRate(normalizedTarget);
    rate = fallback.rate;
    source = fallback.source;
    rateTimestamp = new Date().toISOString();
  }

  const marginBps = getMarginBps();
  const effectiveRate = applyMargin(rate, marginBps);
  const unit = minorUnit(normalizedTarget);
  const targetMinorUnit = 10 ** unit;
  const raw = (usdAmountCents * effectiveRate * targetMinorUnit) / USD_MINOR_UNIT;
  const amountMinor = Math.max(1, Math.round(raw));

  return {
    currency: normalizedTarget,
    amountMinor,
    rate,
    rateWithMargin: effectiveRate,
    source,
    marginBps,
    rateTimestamp,
  };
}
