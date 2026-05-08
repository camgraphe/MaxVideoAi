'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BillingSession, ReceiptItem, ReceiptsState } from '../_lib/billing-types';

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
  const [receipts, setReceipts] = useState<ReceiptsState>({ items: [], nextCursor: null, loading: false });
  const [receiptsCollapsed, setReceiptsCollapsed] = useState(true);
  const toggleReceipts = useCallback(() => setReceiptsCollapsed((prev) => !prev), []);

  useEffect(() => {
    if (authLoading) return;
    let mounted = true;

    if (!session) {
      setReceipts({ items: [], nextCursor: null, loading: false, error: null });
      return () => {
        mounted = false;
      };
    }

    const token = session.access_token ?? null;
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
    setReceipts((state) => ({ ...state, loading: true, error: null }));
    fetch('/api/receipts?limit=25', { headers })
      .then((response) => response.json())
      .then((data) =>
        mounted
          ? setReceipts({
              items: (data.receipts ?? []) as ReceiptItem[],
              nextCursor: data.nextCursor ?? null,
              loading: false,
            })
          : undefined
      )
      .catch(() =>
        mounted
          ? setReceipts({
              items: [],
              nextCursor: null,
              loading: false,
              error: loadReceiptsError,
            })
          : undefined
      );

    return () => {
      mounted = false;
    };
  }, [authLoading, loadReceiptsError, session]);

  const loadMoreReceipts = useCallback(async () => {
    if (receipts.loading || receipts.nextCursor === null) return;
    setReceipts((state) => ({ ...state, loading: true }));
    const token = session?.access_token;
    const headers: Record<string, string> | undefined = token ? { Authorization: `Bearer ${token}` } : undefined;
    const url = receipts.nextCursor
      ? `/api/receipts?limit=25&cursor=${encodeURIComponent(receipts.nextCursor)}`
      : '/api/receipts?limit=25';

    try {
      const response = await fetch(url, { headers });
      const data = await response.json();
      setReceipts((state) => ({
        ...state,
        items: [...state.items, ...((data.receipts ?? []) as ReceiptItem[])],
        nextCursor: data.nextCursor ?? null,
        loading: false,
        error: null,
      }));
    } catch {
      setReceipts((state) => ({ ...state, loading: false, error: loadMoreError }));
    }
  }, [loadMoreError, receipts.loading, receipts.nextCursor, session?.access_token]);

  const exportCSV = useCallback(() => {
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
  }, [receipts.items]);

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
    exportCSV,
  };
}
