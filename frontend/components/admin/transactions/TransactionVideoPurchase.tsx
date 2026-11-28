'use client';

import useSWR from 'swr';
import { PROVIDER_LABELS } from '@/lib/video-purchase-decision';
import type { AdminTransactionRecord, VideoPurchase } from '@/server/admin-transactions/types';

async function loadPurchase(url: string): Promise<VideoPurchase | null> {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error('Receipt lookup failed');
  const data: { receipt: AdminTransactionRecord | null } = await response.json();
  return data.receipt?.videoPurchase ?? null;
}

const dollars = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 6,
});

export function TransactionVideoPurchase({ receipt, initial }: {
  receipt: Pick<AdminTransactionRecord, 'receiptId' | 'type' | 'amountCents' | 'currency'>; initial: VideoPurchase | null | undefined;
}) {
  const { data, error, mutate } = useSWR(initial === undefined ? '/api/admin/transactions?receipt=' + receipt.receiptId : null,
    loadPurchase, { revalidateOnFocus: false, shouldRetryOnError: false });
  if (error) return <button type="button" className="mt-2 text-xs text-brand" onClick={() => void mutate()}>Retry purchase details</button>;
  const purchase = initial === undefined ? data : initial;
  if (!purchase) return null;
  const { quote, provider, estimate } = purchase;
  const chargeMismatch = receipt.type === 'charge' && quote && (quote.cents !== receipt.amountCents || quote.currency !== receipt.currency);
  const displayProvider = provider && (PROVIDER_LABELS[provider as keyof typeof PROVIDER_LABELS] ?? provider);
  return <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs" aria-label="Video purchase">
    <dt className="text-text-secondary">Recorded customer price</dt>
    <dd>{quote ? new Intl.NumberFormat('en-US', { style: 'currency', currency: quote.currency }).format(quote.cents / 100) : 'Unavailable'}
      {chargeMismatch && <p className="mt-1 text-warning">Customer price differs from the charge. The receipt shows the amount debited.</p>}
    </dd>
    <dt className="text-text-secondary">Confirmed supplier</dt>
    <dd>{displayProvider ?? 'Unconfirmed'}</dd>
    <dt className="text-text-secondary">{estimate?.basis === 'routing_quote' ? 'Supplier routing estimate' : 'Supplier list estimate'}</dt>
    <dd>{estimate ? dollars.format(estimate.usd) : 'Unavailable'}</dd>
  </dl>;
}
