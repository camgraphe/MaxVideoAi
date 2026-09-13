'use client';

import { useState } from 'react';
import useSWR from 'swr';
import type { MembershipInventoryApiResponse, MembershipHistoryApiResponse } from '../_lib/membership-admin-view-model';

export const MEMBERSHIP_INVENTORY_ENDPOINT = '/api/admin/membership';
export const MEMBERSHIP_HISTORY_ENDPOINT = '/api/admin/membership/history?limit=100';

async function apiFetcher(url: string) {
  const response = await fetch(url, { cache: 'no-store' });
  const body = await response.json();
  if (!response.ok || !body?.ok) throw new Error(body?.error?.message ?? 'Unable to load membership history.');
  return body;
}

export function useAdminMembershipController() {
  const inventoryQuery = useSWR<MembershipInventoryApiResponse>(MEMBERSHIP_INVENTORY_ENDPOINT, apiFetcher);
  const historyQuery = useSWR<MembershipHistoryApiResponse>(MEMBERSHIP_HISTORY_ENDPOINT, apiFetcher);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<Error | null>(null);
  async function refresh() {
    setRefreshing(true);
    setRefreshError(null);
    try { await Promise.all([inventoryQuery.mutate(), historyQuery.mutate()]); }
    catch (error) { setRefreshError(error instanceof Error ? error : new Error('Unable to refresh history.')); }
    finally { setRefreshing(false); }
  }
  return {
    inventory: inventoryQuery.data?.inventory,
    history: historyQuery.data?.events ?? [],
    loading: inventoryQuery.isLoading,
    historyLoading: historyQuery.isLoading,
    error: refreshError ?? inventoryQuery.error ?? historyQuery.error,
    refreshing,
    refresh,
  };
}
