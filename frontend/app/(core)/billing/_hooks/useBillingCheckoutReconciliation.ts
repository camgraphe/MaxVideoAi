'use client';

import { useCallback, useRef, useState } from 'react';
import {
  runBillingCheckoutReconciliation,
  type BillingCheckoutReconciliationResult,
} from '../_lib/billing-checkout-reconciliation';

import { useBillingRequestOwner } from './useBillingRequestOwner';

export type BillingCheckoutReconciliationStatus = 'idle' | 'refreshing' | Exclude<BillingCheckoutReconciliationResult, 'cancelled'>;

export function useBillingCheckoutReconciliation({
  accountId,
  refreshWallet,
  refreshReceipts,
}: {
  accountId: string | null;
  refreshWallet: () => Promise<boolean>;
  refreshReceipts: () => Promise<boolean>;
}) {
  const { owner, isActive } = useBillingRequestOwner(accountId);
  const [state, setState] = useState<{ owner: typeof owner; status: BillingCheckoutReconciliationStatus }>({ owner, status: 'idle' });
  const generationRef = useRef(0);

  const reconcile = useCallback(async () => {
    if (!isActive()) return;
    const generation = ++generationRef.current;
    setState({ owner, status: 'refreshing' });
    const result = await runBillingCheckoutReconciliation({
      refreshWallet,
      refreshReceipts,
      isActive: () => isActive() && generationRef.current === generation,
    });
    if (!isActive() || generationRef.current !== generation || result === 'cancelled') return;
    setState({ owner, status: result });
  }, [isActive, owner, refreshReceipts, refreshWallet]);

  return { reconcile, status: accountId && state.owner === owner ? state.status : 'idle' as const };
}
