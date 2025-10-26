"use client";

import useSWR from 'swr';

export type MarketingPreference = {
  optIn: boolean;
  updatedAt: string | null;
  requiresDoubleOptIn?: boolean;
};

type MarketingApiResponse =
  | { ok: true; optIn: boolean; updatedAt: string | null; requiresDoubleOptIn?: boolean }
  | { ok: false; error?: string };

async function fetchMarketingPreference(): Promise<MarketingPreference | null> {
  const res = await fetch('/api/account/marketing', { credentials: 'include' });
  if (res.status === 401) {
    return null;
  }
  const json = (await res.json().catch(() => null)) as MarketingApiResponse | null;
  if (!json?.ok) {
    throw new Error(json?.error ?? 'Failed to load marketing preference');
  }
  return {
    optIn: json.optIn,
    updatedAt: json.updatedAt,
    requiresDoubleOptIn: json.requiresDoubleOptIn,
  };
}

export function useMarketingPreference(enabled = true) {
  return useSWR<MarketingPreference | null>(enabled ? '/api/account/marketing' : null, fetchMarketingPreference, {
    revalidateOnFocus: false,
  });
}
