'use client';

import { useCallback, useRef, useState } from 'react';
import { USD_TOPUP_TIERS } from '@/config/topupTiers';
import { parseAmountToCents } from '../_lib/billing-utils';
import type { BillingCopy } from '../_lib/billing-copy';

type UseBillingTopupSelectionOptions = {
  copy: BillingCopy;
  formatUsdAmount: (amountCents: number) => string;
};

export function useBillingTopupSelection({ copy, formatUsdAmount }: UseBillingTopupSelectionOptions) {
  const [customAmountInput, setCustomAmountInput] = useState('');
  const [customEditorOpen, setCustomEditorOpen] = useState(false);
  const [selectedTopupCents, setSelectedTopupCents] = useState(USD_TOPUP_TIERS[0]?.amountCents ?? 1000);
  const customAmountInputRef = useRef<HTMLInputElement | null>(null);
  const customAmountCents = parseAmountToCents(customAmountInput);
  const customAmountError = !customAmountInput.trim()
    ? null
    : customAmountCents == null
      ? copy.wallet.customInvalid
      : customAmountCents < 1000
        ? copy.wallet.customMin
        : null;
  const customAmountValid = customAmountCents != null && customAmountCents >= 1000;
  const selectedPresetTier = USD_TOPUP_TIERS.find((entry) => entry.amountCents === selectedTopupCents) ?? null;
  const customAmountSelected =
    customAmountValid && selectedPresetTier == null && selectedTopupCents === customAmountCents;
  const customCardActive = customEditorOpen || customAmountSelected;
  const selectedTopupAmountLabel = formatUsdAmount(selectedTopupCents);

  const focusCustomAmountInput = useCallback(() => {
    window.setTimeout(() => {
      customAmountInputRef.current?.focus();
      customAmountInputRef.current?.select();
    }, 0);
  }, []);

  const openCustomAmountEditor = useCallback(() => {
    setCustomEditorOpen(true);
    focusCustomAmountInput();
  }, [focusCustomAmountInput]);

  const applyCustomAmount = useCallback(() => {
    if (!customAmountValid || customAmountCents == null) return;
    setSelectedTopupCents(customAmountCents);
    setCustomEditorOpen(false);
  }, [customAmountCents, customAmountValid]);

  const handlePresetSelected = useCallback((amountCents: number) => {
    setSelectedTopupCents(amountCents);
    setCustomEditorOpen(false);
  }, []);

  return {
    applyCustomAmount,
    customAmountCents,
    customAmountError,
    customAmountInput,
    customAmountInputRef,
    customAmountValid,
    customCardActive,
    handlePresetSelected,
    onCustomAmountInputChange: setCustomAmountInput,
    openCustomAmountEditor,
    selectedTopupAmountLabel,
    selectedTopupCents,
  };
}
