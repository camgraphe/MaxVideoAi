import { normalizeCurrencyCode } from '@/lib/currency';

type FxRateResult = {
  rate: number;
  source: string;
};

const DEFAULT_RATES: Record<string, FxRateResult> = {
  'usd:eur': { rate: 0.92, source: 'config-default' },
};

function makeKey(base: string, target: string): string {
  return `${base}:${target}`.toLowerCase();
}

function parsePositiveNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function getFxRate(base: string, target: string): FxRateResult {
  const normalizedBase = normalizeCurrencyCode(base)?.toLowerCase();
  const normalizedTarget = normalizeCurrencyCode(target)?.toLowerCase();

  if (!normalizedBase || !normalizedTarget) {
    return { rate: 1, source: 'identity' };
  }

  if (normalizedBase === normalizedTarget) {
    return { rate: 1, source: 'identity' };
  }

  const envKey = `FX_RATE_${normalizedBase.toUpperCase()}_${normalizedTarget.toUpperCase()}`;
  const envRate = parsePositiveNumber(process.env[envKey] ?? null);
  if (envRate) {
    return { rate: envRate, source: `env:${envKey}` };
  }

  const key = makeKey(normalizedBase, normalizedTarget);
  const fallback = DEFAULT_RATES[key];
  if (fallback) {
    return fallback;
  }

  return { rate: 1, source: 'identity' };
}

export function convertCents(amountCents: number, base: string, target: string): {
  cents: number;
  rate: number;
  source: string;
} {
  const { rate, source } = getFxRate(base, target);
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return { cents: 0, rate, source };
  }
  const converted = Math.max(1, Math.round(amountCents * rate));
  return { cents: converted, rate, source };
}
