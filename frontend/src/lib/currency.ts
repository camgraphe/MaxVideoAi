import { isDatabaseConfigured, query } from '@/lib/db';
import type { NextRequest } from 'next/server';

export type Currency = 'eur' | 'usd';

export type CurrencyResolutionSource = 'user_pref' | 'geo' | 'default';

const EU_COUNTRIES = new Set([
  'FR',
  'BE',
  'DE',
  'ES',
  'IT',
  'NL',
  'PT',
  'IE',
  'AT',
  'FI',
  'GR',
  'LU',
  'SI',
  'SK',
  'EE',
  'LV',
  'LT',
  'MT',
  'CY',
  'MC',
  'SM',
  'AD',
  'CZ',
  'PL',
  'HU',
  'RO',
  'BG',
  'HR',
  'SE',
  'DK',
]);

const KNOWN_CURRENCIES: Currency[] = ['eur', 'usd'];

export function normalizeCurrencyCode(value: string | null | undefined): Currency | null {
  if (!value) return null;
  const lowered = value.trim().toLowerCase();
  return KNOWN_CURRENCIES.includes(lowered as Currency) ? (lowered as Currency) : null;
}

export function resolveEnabledCurrencies(): Currency[] {
  const raw = process.env.ENABLED_CURRENCIES ?? 'eur,usd';
  const parsed = raw
    .split(',')
    .map((entry) => normalizeCurrencyCode(entry))
    .filter((entry): entry is Currency => entry !== null);
  return parsed.length ? parsed : ['eur', 'usd'];
}

export function resolveDefaultCurrency(enabled: Currency[]): Currency {
  const fromEnv = normalizeCurrencyCode(process.env.DEFAULT_CURRENCY);
  if (fromEnv && enabled.includes(fromEnv)) {
    return fromEnv;
  }
  return enabled.includes('eur') ? 'eur' : enabled[0] ?? 'usd';
}

export function resolveCurrency(
  req: NextRequest,
  user?: { preferred_currency?: Currency | null }
): { currency: Currency; source: CurrencyResolutionSource; country?: string } {
  const enabled = resolveEnabledCurrencies();
  const fallback = resolveDefaultCurrency(enabled);

  const preferred = user?.preferred_currency ? normalizeCurrencyCode(user.preferred_currency) : null;
  if (preferred && enabled.includes(preferred)) {
    return { currency: preferred, source: 'user_pref' };
  }

  const headerCountry = req.headers.get('x-vercel-ip-country');
  const geoCountry = (req as unknown as { geo?: { country?: string | null } }).geo?.country;
  const country = (headerCountry ?? geoCountry ?? '').toUpperCase();

  if (country && EU_COUNTRIES.has(country)) {
    const euCurrency = enabled.includes('eur') ? 'eur' : fallback;
    return { currency: euCurrency, source: 'geo', country };
  }

  if (country) {
    const nonEuCurrency = enabled.includes('usd') ? 'usd' : fallback;
    return { currency: nonEuCurrency, source: 'geo', country };
  }

  return { currency: fallback, source: 'default' };
}

export async function getUserPreferredCurrency(userId: string): Promise<Currency | null> {
  if (!userId || !isDatabaseConfigured()) {
    return null;
  }
  try {
    const rows = await query<{ preferred_currency: string | null }>(
      `SELECT preferred_currency FROM profiles WHERE id = $1 LIMIT 1`,
      [userId]
    );
    return normalizeCurrencyCode(rows[0]?.preferred_currency ?? null);
  } catch (error) {
    console.warn('[currency] failed to load user preference', {
      userId,
      error: error instanceof Error ? error.message : error,
    });
    return null;
  }
}

export async function ensureUserPreferredCurrency(userId: string, currency: Currency): Promise<void> {
  if (!userId || !currency || !isDatabaseConfigured()) {
    return;
  }
  try {
    await query(
      `
        UPDATE profiles
        SET preferred_currency = $2
        WHERE id = $1
          AND (preferred_currency IS NULL OR preferred_currency = '')
      `,
      [userId, currency]
    );
  } catch (error) {
    console.warn('[currency] failed to ensure user preference', {
      userId,
      currency,
      error: error instanceof Error ? error.message : error,
    });
  }
}

export async function setUserPreferredCurrency(userId: string, currency: Currency): Promise<void> {
  if (!userId || !currency || !isDatabaseConfigured()) {
    return;
  }
  try {
    const updated = await query<{ id: string }>(
      `UPDATE profiles SET preferred_currency = $2 WHERE id = $1 RETURNING id`,
      [userId, currency]
    );
    if (updated.length > 0) {
      return;
    }
  } catch (error) {
    console.warn('[currency] update preferred currency failed, attempting upsert', {
      userId,
      currency,
      error: error instanceof Error ? error.message : error,
    });
  }

  try {
    await query(
      `
        INSERT INTO profiles (id, preferred_currency)
        VALUES ($1, $2)
        ON CONFLICT (id)
        DO UPDATE SET preferred_currency = EXCLUDED.preferred_currency
      `,
      [userId, currency]
    );
  } catch (error) {
    console.warn('[currency] upsert preferred currency failed', {
      userId,
      currency,
      error: error instanceof Error ? error.message : error,
    });
  }
}
