'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  BillingReceiptsView,
  BillingSession,
  ReceiptItem,
  ReceiptsState,
} from '../_lib/billing-types';
import { useBillingRequestOwner } from './useBillingRequestOwner';

const EMPTY_RECEIPTS: ReceiptsState = { items: [], nextCursor: null, loading: false, error: null };

function createReceiptViews(): Record<BillingReceiptsView, ReceiptsState> {
  return {
    documents: { ...EMPTY_RECEIPTS },
    activity: { ...EMPTY_RECEIPTS },
  };
}

function pageSizeFor(view: BillingReceiptsView): number {
  return view === 'documents' ? 8 : 25;
}

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
  const [receiptsView, setReceiptsView] = useState<BillingReceiptsView>('documents');
  const [state, setState] = useState<{
    owner: typeof owner;
    views: Record<BillingReceiptsView, ReceiptsState>;
  }>({ owner, views: createReceiptViews() });
  const receipts = accountId && state.owner === owner
    ? state.views[receiptsView]
    : { ...EMPTY_RECEIPTS, loading: Boolean(accountId) };
  const [receiptsCollapsed, setReceiptsCollapsed] = useState(true);
  const toggleReceipts = useCallback(() => setReceiptsCollapsed((previous) => !previous), []);

  const setScopedReceipts = useCallback((
    view: BillingReceiptsView,
    update: ReceiptsState | ((previous: ReceiptsState) => ReceiptsState),
  ) => {
    setState((previous) => {
      const views = previous.owner === owner ? previous.views : createReceiptViews();
      return {
        owner,
        views: {
          ...views,
          [view]: typeof update === 'function' ? update(views[view]) : update,
        },
      };
    });
  }, [owner]);

  const refreshReceiptScope = useCallback(async (view: BillingReceiptsView): Promise<boolean> => {
    if (!isActive() || !accountId) return false;
    const requestToken = requestScope.begin(accountId);
    const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;
    setScopedReceipts(view, (current) => ({ ...current, loading: true, error: null }));
    try {
      const response = await fetch(`/api/receipts?limit=${pageSizeFor(view)}&scope=${view}`, { headers, cache: 'no-store' });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok || !Array.isArray(data.receipts)) {
        throw new Error(data?.error ?? 'receipts_load_failed');
      }
      if (!isActive() || !requestScope.isCurrent(requestToken)) return false;
      setScopedReceipts(view, {
        items: data.receipts as ReceiptItem[],
        nextCursor: data.nextCursor ?? null,
        loading: false,
        error: null,
      });
      return true;
    } catch {
      if (!isActive() || !requestScope.isCurrent(requestToken)) return false;
      setScopedReceipts(view, (current) => ({ ...current, loading: false, error: loadReceiptsError }));
      return false;
    }
  }, [accessToken, accountId, isActive, loadReceiptsError, requestScope, setScopedReceipts]);

  const refreshReceipts = useCallback(
    () => refreshReceiptScope(receiptsView),
    [receiptsView, refreshReceiptScope],
  );

  useEffect(() => {
    if (accountId) void refreshReceiptScope('documents');
  }, [accountId, refreshReceiptScope]);

  const selectReceiptsView = useCallback((view: BillingReceiptsView) => {
    setReceiptsView(view);
    void refreshReceiptScope(view);
  }, [refreshReceiptScope]);

  const loadMoreReceipts = useCallback(async () => {
    if (!isActive() || !accountId || receipts.loading || receipts.nextCursor === null) return;
    const view = receiptsView;
    setScopedReceipts(view, (current) => ({ ...current, loading: true }));
    const requestToken = requestScope.begin(accountId);
    const headers: Record<string, string> | undefined = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;
    const url = `/api/receipts?limit=${pageSizeFor(view)}&scope=${view}&cursor=${encodeURIComponent(receipts.nextCursor)}`;

    try {
      const response = await fetch(url, { headers });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok || !Array.isArray(data.receipts)) {
        throw new Error(data?.error ?? 'receipts_load_more_failed');
      }
      if (!isActive() || !requestScope.isCurrent(requestToken)) return;
      setScopedReceipts(view, (current) => ({
        ...current,
        items: [...current.items, ...((data.receipts ?? []) as ReceiptItem[])],
        nextCursor: data.nextCursor ?? null,
        loading: false,
        error: null,
      }));
    } catch {
      if (!isActive() || !requestScope.isCurrent(requestToken)) return;
      setScopedReceipts(view, (current) => ({ ...current, loading: false, error: loadMoreError }));
    }
  }, [accessToken, accountId, isActive, loadMoreError, receipts.loading, receipts.nextCursor, receiptsView, requestScope, setScopedReceipts]);

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
    anchor.download = 'wallet-activity.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  }, [isActive, receipts.items]);

  const visibleReceipts = useMemo(
    () => receiptsView === 'activity' && receiptsCollapsed ? receipts.items.slice(0, 2) : receipts.items,
    [receipts.items, receiptsCollapsed, receiptsView]
  );

  return {
    receipts,
    receiptsCollapsed,
    receiptsView,
    visibleReceipts,
    selectReceiptsView,
    toggleReceipts,
    loadMoreReceipts,
    refreshReceipts,
    exportCSV,
  };
}
