'use client';

import type { Ref } from 'react';
import { USD_TOPUP_TIERS } from '@/config/topupTiers';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { BillingCopy } from '../_lib/billing-copy';
import styles from './billing-page.module.css';

type WalletAmountPickerProps = {
  applyCustomAmount: () => void;
  copy: BillingCopy;
  customAmountCents: number | null;
  customAmountError: string | null;
  customAmountInput: string;
  customAmountInputRef: Ref<HTMLInputElement>;
  customAmountValid: boolean;
  customCardActive: boolean;
  formatUsdAmount: (amountCents: number) => string;
  onCustomAmountInputChange: (value: string) => void;
  onOpenCustomAmountEditor: () => void;
  onPresetSelected: (amountCents: number) => void;
  selectedTopupCents: number;
};

export function WalletAmountPicker({
  applyCustomAmount,
  copy,
  customAmountCents,
  customAmountError,
  customAmountInput,
  customAmountInputRef,
  customAmountValid,
  customCardActive,
  formatUsdAmount,
  onCustomAmountInputChange,
  onOpenCustomAmountEditor,
  onPresetSelected,
  selectedTopupCents,
}: WalletAmountPickerProps) {
  return (
    <fieldset className={styles.amountPicker}>
      <legend className={styles.stepHeading}>
        <span>1</span>
        <span>
          <strong>{copy.wallet.stepChoose}</strong>
          <small>{copy.wallet.stepChooseHint}</small>
        </span>
      </legend>

      <div className={styles.amountGrid}>
        {USD_TOPUP_TIERS.map((tier) => {
          const isSelected = selectedTopupCents === tier.amountCents;
          return (
            <Button
              key={tier.id}
              type="button"
              size="md"
              variant="ghost"
              aria-pressed={isSelected}
              onClick={() => onPresetSelected(tier.amountCents)}
              className={styles.amountButton}
            >
              <span>{formatUsdAmount(tier.amountCents)}</span>
              <small>{isSelected ? copy.wallet.selectedAmount : copy.wallet.chooseAmount}</small>
            </Button>
          );
        })}
        <Button
          type="button"
          size="md"
          variant="ghost"
          aria-pressed={customCardActive}
          onClick={onOpenCustomAmountEditor}
          className={styles.amountButton}
        >
          <span>{copy.wallet.customPresetLabel}</span>
          <small>
            {customAmountValid && customAmountCents != null
              ? formatUsdAmount(customAmountCents)
              : copy.wallet.customPresetHint}
          </small>
        </Button>
      </div>

      {customCardActive ? (
        <div className={styles.customAmountEditor}>
          <label htmlFor="billing-custom-amount">{copy.wallet.customLabel}</label>
          <div>
            <span aria-hidden="true">$</span>
            <Input
              ref={customAmountInputRef}
              id="billing-custom-amount"
              type="number"
              min={10}
              step={1}
              inputMode="decimal"
              value={customAmountInput}
              onChange={(event) => onCustomAmountInputChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                applyCustomAmount();
              }}
              placeholder={copy.wallet.customPlaceholder}
              aria-describedby="billing-custom-amount-help"
            />
            <Button type="button" disabled={!customAmountValid} onClick={applyCustomAmount} size="md">
              {copy.wallet.customCta}
            </Button>
          </div>
          <p id="billing-custom-amount-help" data-error={Boolean(customAmountError)}>
            {customAmountError ?? copy.wallet.customHint}
          </p>
        </div>
      ) : null}
    </fieldset>
  );
}
