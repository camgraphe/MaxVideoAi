'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { USD_TOPUP_TIERS } from '@/config/topupTiers';
import {
  createInitialTopupSelection,
  createReturnedTopupSelection,
} from '../_lib/billing-selection';
import { parseAmountToCents } from '../_lib/billing-utils';
import type { BillingCopy } from '../_lib/billing-copy';

type UseBillingTopupSelectionOptions = {
  copy: BillingCopy;
  formatUsdAmount: (amountCents: number) => string;
  initialTopupCents?: number;
};

export function useBillingTopupSelection({
  copy,
  formatUsdAmount,
  initialTopupCents,
}: UseBillingTopupSelectionOptions) {
  const initialSelection = useMemo(
    () => createInitialTopupSelection(initialTopupCents),
    [initialTopupCents]
  );
  const [customAmountInput, setCustomAmountInput] = useState(initialSelection.customAmountInput);
  const [customEditorOpen, setCustomEditorOpen] = useState(false);
  const [selectedTopupCents, setSelectedTopupCents] = useState(initialSelection.selectedTopupCents);
  const customAmountInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setSelectedTopupCents(initialSelection.selectedTopupCents);
    setCustomAmountInput(initialSelection.customAmountInput);
    setCustomEditorOpen(false);
  }, [initialSelection]);

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

  const restoreTopupSelection = useCallback((amountCents: number | null) => {
    const returnedSelection = createReturnedTopupSelection(amountCents);
    if (!returnedSelection) return;
    setSelectedTopupCents(returnedSelection.selectedTopupCents);
    setCustomAmountInput(returnedSelection.customAmountInput);
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
    restoreTopupSelection,
    selectedTopupAmountLabel,
    selectedTopupCents,
  };
}
