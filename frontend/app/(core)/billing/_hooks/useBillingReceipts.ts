'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BillingSession, ReceiptItem, ReceiptsState } from '../_lib/billing-types';
import { useBillingRequestOwner } from './useBillingRequestOwner';

export function useBillingReceipts({
  authLoading,
  session,
  loadReceiptsError,
  loadMoreError,
}: {
  authLoading: boolean;
  session: BillingSession;
  loadReceiptsError: string;
  loadMoreError: string;
}) {
  const accountId = authLoading ? null : session?.user?.id ?? null;
  const accessToken = session?.access_token ?? null;
  const { owner, requestScope, isActive } = useBillingRequestOwner(accountId);
  const [state, setState] = useState<{ owner: typeof owner; receipts: ReceiptsState }>({
    owner, receipts: { items: [], nextCursor: null, loading: false },
  });
  const receipts: ReceiptsState = accountId && state.owner === owner
    ? state.receipts
    : { items: [], nextCursor: null, loading: Boolean(accountId), error: null };
  const [receiptsCollapsed, setReceiptsCollapsed] = useState(true);
  const toggleReceipts = useCallback(() => setReceiptsCollapsed((prev) => !prev), []);
  const setReceipts = useCallback((update: ReceiptsState | ((previous: ReceiptsState) => ReceiptsState)) => {
    setState((previous) => ({
      owner,
      receipts: typeof update === 'function'
        ? update(previous.owner === owner ? previous.receipts : { items: [], nextCursor: null, loading: false })
        : update,
    }));
  }, [owner]);

  const refreshReceipts = useCallback(async (): Promise<boolean> => {
    if (!isActive() || !accountId) return false;
    const requestToken = requestScope.begin(accountId);
    const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;
    setReceipts((state) => ({ ...state, loading: true, error: null }));
    try {
      const response = await fetch('/api/receipts?limit=25', { headers, cache: 'no-store' });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok || !Array.isArray(data.receipts)) {
        throw new Error(data?.error ?? 'receipts_load_failed');
      }
      if (!isActive() || !requestScope.isCurrent(requestToken)) return false;
      setReceipts({
        items: data.receipts as ReceiptItem[],
        nextCursor: data.nextCursor ?? null,
        loading: false,
        error: null,
      });
      return true;
    } catch {
      if (!isActive() || !requestScope.isCurrent(requestToken)) return false;
      setReceipts((state) => ({ ...state, loading: false, error: loadReceiptsError }));
      return false;
    }
  }, [accessToken, accountId, isActive, loadReceiptsError, requestScope, setReceipts]);

  useEffect(() => {
    if (accountId) void refreshReceipts();
  }, [accountId, refreshReceipts]);

  const loadMoreReceipts = useCallback(async () => {
    if (!isActive() || !accountId || receipts.loading || receipts.nextCursor === null) return;
    setReceipts((state) => ({ ...state, loading: true }));
    const requestToken = requestScope.begin(accountId);
    const headers: Record<string, string> | undefined = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;
    const url = receipts.nextCursor
      ? `/api/receipts?limit=25&cursor=${encodeURIComponent(receipts.nextCursor)}`
      : '/api/receipts?limit=25';

    try {
      const response = await fetch(url, { headers });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok || !Array.isArray(data.receipts)) {
        throw new Error(data?.error ?? 'receipts_load_more_failed');
      }
      if (!isActive() || !requestScope.isCurrent(requestToken)) return;
      setReceipts((state) => ({
        ...state,
        items: [...state.items, ...((data.receipts ?? []) as ReceiptItem[])],
        nextCursor: data.nextCursor ?? null,
        loading: false,
        error: null,
      }));
    } catch {
      if (!isActive() || !requestScope.isCurrent(requestToken)) return;
      setReceipts((state) => ({ ...state, loading: false, error: loadMoreError }));
    }
  }, [accessToken, accountId, isActive, loadMoreError, receipts.loading, receipts.nextCursor, requestScope, setReceipts]);

  const exportCSV = useCallback(() => {
    if (!isActive()) return;
    const rows: string[] = [
      'id,type,amount,currency,description,created_at,job_id,tax_amount_cents,discount_amount_cents,document_type,document_url',
    ];
    const toSign = (type: string, cents: number) => (type === 'charge' ? -cents : cents);
    receipts.items.forEach((receipt) => {
      const amount = (toSign(receipt.type, receipt.amount_cents) / 100).toFixed(2);
      rows.push(
        `${receipt.id},${receipt.type},${amount},${receipt.currency},"${(receipt.description ?? '').replaceAll('"', '""')}",${receipt.created_at},${receipt.job_id ?? ''},${receipt.tax_amount_cents ?? ''},${receipt.discount_amount_cents ?? ''},${receipt.document_type ?? ''},${receipt.document_url ?? ''}`
      );
    });
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'receipts.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  }, [isActive, receipts.items]);

  const visibleReceipts = useMemo(
    () => (receiptsCollapsed ? receipts.items.slice(0, 2) : receipts.items),
    [receipts.items, receiptsCollapsed]
  );

  return {
    receipts,
    receiptsCollapsed,
    visibleReceipts,
    toggleReceipts,
    loadMoreReceipts,
    refreshReceipts,
    exportCSV,
  };
}
