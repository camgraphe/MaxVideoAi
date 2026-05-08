'use client';

import { useEffect, useState } from 'react';
import { authFetch } from '@/lib/authFetch';
import {
  readLastKnownUserId,
  writeLastKnownMember,
  writeLastKnownWallet,
} from '@/lib/last-known';

export type DashboardWalletSummary = { balance: number; currency: string };
export type DashboardMemberSummary = { spentToday?: number; spent30?: number };

export function useDashboardAccountSummary({
  authLoading,
  user,
}: {
  authLoading: boolean;
  user: unknown;
}) {
  const [walletSummary, setWalletSummary] = useState<DashboardWalletSummary | null>(null);
  const [memberSummary, setMemberSummary] = useState<DashboardMemberSummary | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setWalletSummary(null);
      setMemberSummary(null);
      return;
    }
    let mounted = true;

    const fetchAccountState = async () => {
      try {
        const [walletRes, memberRes] = await Promise.all([
          authFetch('/api/wallet', { cache: 'no-store' }),
          authFetch('/api/member-status', { cache: 'no-store' }),
        ]);
        if (!mounted) return;
        const wallet = (await walletRes.json().catch(() => null)) as { balance?: number; currency?: string } | null;
        const member = (await memberRes.json().catch(() => null)) as { spentToday?: number; spent30?: number } | null;
        if (walletRes.ok) {
          const nextBalance = typeof wallet?.balance === 'number' ? wallet.balance : null;
          if (nextBalance !== null) {
            const nextSummary = {
              balance: nextBalance,
              currency: typeof wallet?.currency === 'string' ? wallet.currency.toUpperCase() : 'USD',
            };
            setWalletSummary(nextSummary);
            writeLastKnownWallet(nextSummary, readLastKnownUserId());
          }
        }
        if (memberRes.ok) {
          const memberPayload = member as {
            tier?: string;
            spentToday?: number;
            spent30?: number;
            savingsPct?: number;
          } | null;
          const nextMember = {
            tier: typeof memberPayload?.tier === 'string' ? memberPayload.tier : undefined,
            spentToday: typeof memberPayload?.spentToday === 'number' ? memberPayload.spentToday : undefined,
            spent30: typeof memberPayload?.spent30 === 'number' ? memberPayload.spent30 : undefined,
            savingsPct: typeof memberPayload?.savingsPct === 'number' ? memberPayload.savingsPct : undefined,
          };
          setMemberSummary({ spentToday: nextMember.spentToday, spent30: nextMember.spent30 });
          writeLastKnownMember(nextMember, readLastKnownUserId());
        }
      } catch {
        // Keep last known values on transient failures.
      }
    };

    void fetchAccountState();

    const handleInvalidate = () => {
      void fetchAccountState();
    };
    window.addEventListener('wallet:invalidate', handleInvalidate);

    return () => {
      mounted = false;
      window.removeEventListener('wallet:invalidate', handleInvalidate);
    };
  }, [authLoading, user]);

  return { walletSummary, memberSummary };
}
