import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { authFetch } from '@/lib/authFetch';
import { CURRENCY_LOCALE } from '@/lib/intl';
import type { PreflightResponse } from '@/types/engines';

type TopUpModalState = {
  message: string;
  amountLabel?: string;
  shortfallCents?: number;
} | null;

type WorkspaceWalletCopy = {
  wallet: {
    insufficient: string;
    insufficientWithAmount: string;
  };
};

type UseWorkspaceWalletPreflightOptions = {
  workspaceCopy: WorkspaceWalletCopy;
  setTopUpModal: Dispatch<SetStateAction<TopUpModalState>>;
  showComposerError: (message: string) => void;
};

type VerifyWalletBalanceOptions = {
  preflight: PreflightResponse | null;
  iterationCount: number;
  currencyCode: string;
};

type PresentInsufficientFundsOptions = {
  currencyCode: string;
  shortfallCents?: number;
};

function resolveWalletBalanceCents(walletJson: { balanceCents?: unknown; balance?: unknown }): number | undefined {
  if (typeof walletJson.balanceCents === 'number') return walletJson.balanceCents;
  if (typeof walletJson.balance === 'number') return Math.round(walletJson.balance * 100);
  if (typeof walletJson.balance === 'string') return Math.round(Number(walletJson.balance) * 100);
  return undefined;
}

function resolvePreflightUnitCostCents(preflight: PreflightResponse | null): number | null {
  if (typeof preflight?.pricing?.totalCents === 'number') return preflight.pricing.totalCents;
  if (typeof preflight?.total === 'number') return preflight.total;
  return null;
}

export function useWorkspaceWalletPreflight({
  workspaceCopy,
  setTopUpModal,
  showComposerError,
}: UseWorkspaceWalletPreflightOptions) {
  const presentInsufficientFunds = useCallback(
    ({ currencyCode, shortfallCents }: PresentInsufficientFundsOptions) => {
      const normalizedShortfall = typeof shortfallCents === 'number' ? Math.max(0, shortfallCents) : undefined;

      let friendlyNotice: string = workspaceCopy.wallet.insufficient;
      let formattedShortfall: string | undefined;
      if (typeof normalizedShortfall === 'number' && normalizedShortfall > 0) {
        try {
          formattedShortfall = new Intl.NumberFormat(CURRENCY_LOCALE, {
            style: 'currency',
            currency: currencyCode,
          }).format(normalizedShortfall / 100);
          friendlyNotice = workspaceCopy.wallet.insufficientWithAmount.replace('{amount}', formattedShortfall);
        } catch {
          formattedShortfall = `${currencyCode} ${(normalizedShortfall / 100).toFixed(2)}`;
          friendlyNotice = workspaceCopy.wallet.insufficientWithAmount.replace('{amount}', formattedShortfall);
        }
      }

      setTopUpModal({
        message: friendlyNotice,
        amountLabel: formattedShortfall,
        shortfallCents: typeof normalizedShortfall === 'number' ? normalizedShortfall : undefined,
      });
      showComposerError(friendlyNotice);
    },
    [setTopUpModal, showComposerError, workspaceCopy.wallet.insufficient, workspaceCopy.wallet.insufficientWithAmount]
  );

  const verifyWalletBalance = useCallback(
    async ({ preflight, iterationCount, currencyCode }: VerifyWalletBalanceOptions) => {
      const unitCostCents = resolvePreflightUnitCostCents(preflight);
      if (typeof unitCostCents !== 'number' || unitCostCents <= 0) return true;

      const requiredCents = unitCostCents * iterationCount;
      try {
        const res = await authFetch('/api/wallet');
        if (!res.ok) return true;
        const walletJson = await res.json();
        const balanceCents = resolveWalletBalanceCents(walletJson);
        if (typeof balanceCents !== 'number') return true;
        const shortfall = requiredCents - balanceCents;
        if (shortfall <= 0) return true;
        presentInsufficientFunds({ currencyCode, shortfallCents: shortfall });
        return false;
      } catch (walletError) {
        console.warn('[startRender] wallet balance check failed', walletError);
        return true;
      }
    },
    [presentInsufficientFunds]
  );

  return {
    presentInsufficientFunds,
    verifyWalletBalance,
  };
}
