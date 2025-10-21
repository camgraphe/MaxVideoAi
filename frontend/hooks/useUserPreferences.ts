"use client";

import useSWR from 'swr';

export type UserPreferencesResponse = {
  defaultSharePublic: boolean;
  defaultAllowIndex: boolean;
  onboardingDone: boolean;
};

async function fetchPreferences(): Promise<UserPreferencesResponse | null> {
  const res = await fetch('/api/user/preferences', { credentials: 'include' });
  if (!res.ok) {
    if (res.status === 401) {
      return null;
    }
    throw new Error(`Failed to load user preferences (${res.status})`);
  }
  const json = (await res.json().catch(() => null)) as
    | { ok?: boolean; preferences?: UserPreferencesResponse; error?: string }
    | null;
  if (!json?.ok) {
    throw new Error(json?.error ?? 'Unable to load user preferences');
  }
  return json.preferences ?? null;
}

export function useUserPreferences(enabled = true) {
  return useSWR<UserPreferencesResponse | null>(
    enabled ? '/api/user/preferences' : null,
    fetchPreferences,
    {
      revalidateOnFocus: false,
    }
  );
}
