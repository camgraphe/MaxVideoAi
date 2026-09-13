'use client';

import useSWR from 'swr';

async function readAdminNavigationAccess(): Promise<boolean> {
  const response = await fetch('/api/admin/access', {
    cache: 'no-store',
    credentials: 'same-origin',
  });
  if (!response.ok) return false;
  const body = await response.json().catch(() => null);
  return body?.ok === true;
}

export function useAdminNavigationAccess(enabled: boolean): boolean {
  const { data } = useSWR(
    enabled ? 'app-admin-navigation-access' : null,
    readAdminNavigationAccess,
    {
      dedupingInterval: 30_000,
      revalidateOnFocus: true,
      shouldRetryOnError: false,
    },
  );

  return data === true;
}
