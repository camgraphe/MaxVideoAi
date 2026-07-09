'use client';

import type { ChangeEvent, Ref } from 'react';
import type { Stripe } from '@stripe/stripe-js';
import { USD_TOPUP_TIERS } from '@/config/topupTiers';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FastPayLogoStrip } from './FastPayLogoStrip';
import { TurnstileChallenge } from './TurnstileChallenge';
import { WalletExpressCheckout } from './WalletExpressCheckout';
import type { BillingCopy } from '../_lib/billing-copy';
import type { BillingSession, TopupQuote } from '../_lib/billing-types';

type WalletTopupPanelProps = {
  applyCustomAmount: () => void;
  checkoutCaptchaError: string | null;
  checkoutCaptchaRequired: boolean;
  checkoutCaptchaResetGeneration: number;
  checkoutCaptchaToken: string | null;
  copy: BillingCopy;
  currencyLoading: boolean;
  currencyOptions: string[];
  currencyStatus: string;
  currencyStatusClass: string;
  customAmountCents: number | null;
  customAmountError: string | null;
  customAmountInput: string;
  customAmountInputRef: Ref<HTMLInputElement>;
  customAmountValid: boolean;
  customCardActive: boolean;
  expressRequested: boolean;
  formatLocalAmount: (amountMinor: number, currency: string) => string;
  formatUsdAmount: (amountCents: number) => string;
  handleCheckoutCaptchaError: () => void;
  handleCheckoutCaptchaRequired: () => void;
  handleCheckoutCaptchaToken: (token: string | null) => void;
  handleCurrencyChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  handleExpressTopupFailed: (amountCents: number, reason?: string) => void;
  handleExpressTopupStarted: (amountCents: number) => void;
  handleTopUp: () => void;
  isTopupStarting: boolean;
  locale: string;
  normalizedChargeCurrency: string;
  onCustomAmountInputChange: (value: string) => void;
  onExpressReveal: () => void;
  onOpenCustomAmountEditor: () => void;
  onPresetSelected: (amountCents: number) => void;
  quoteError: string | null;
  quoteLoading: boolean;
  selectedTopupAmountLabel: string;
  selectedTopupCents: number;
  selectedTopupLocalLabel: string | null;
  session: BillingSession;
  stripePromise: Promise<Stripe | null> | null;
  topupQuotes: Record<number, TopupQuote>;
  turnstileSiteKey: string;
  wallet: { balance: number; currency: string; hasCompletedTopUp?: boolean } | null;
  walletQuoteLoading: string;
};

export function WalletTopupPanel({
  applyCustomAmount,
  checkoutCaptchaError,
  checkoutCaptchaRequired,
  checkoutCaptchaResetGeneration,
  checkoutCaptchaToken,
  copy,
  currencyLoading,
  currencyOptions,
  currencyStatus,
  currencyStatusClass,
  customAmountCents,
  customAmountError,
  customAmountInput,
  customAmountInputRef,
  customAmountValid,
  customCardActive,
  expressRequested,
  formatLocalAmount,
  formatUsdAmount,
  handleCheckoutCaptchaError,
  handleCheckoutCaptchaRequired,
  handleCheckoutCaptchaToken,
  handleCurrencyChange,
  handleExpressTopupFailed,
  handleExpressTopupStarted,
  handleTopUp,
  isTopupStarting,
  locale,
  normalizedChargeCurrency,
  onCustomAmountInputChange,
  onExpressReveal,
  onOpenCustomAmountEditor,
  onPresetSelected,
  quoteError,
  quoteLoading,
  selectedTopupAmountLabel,
  selectedTopupCents,
  selectedTopupLocalLabel,
  session,
  stripePromise,
  topupQuotes,
  turnstileSiteKey,
  wallet,
  walletQuoteLoading,
}: WalletTopupPanelProps) {
  const shouldShowFirstTopupAmexNotice = wallet?.hasCompletedTopUp === false;

  return (
    <div className="rounded-card border border-border bg-surface p-3 shadow-card sm:p-5">
      <div className="flex flex-col gap-2 border-b border-border pb-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:pb-4">
        <div>
          <h2 className="text-base font-semibold text-text-primary sm:text-lg">{copy.wallet.selectedAmount}</h2>
          <p className="mt-1 text-xs text-text-secondary sm:text-sm">{copy.wallet.description}</p>
        </div>
        <CurrencySelect
          className="hidden flex-col gap-1 text-left sm:flex sm:min-w-[160px]"
          copy={copy}
          currencyLoading={currencyLoading}
          currencyOptions={currencyOptions}
          currencyStatus={currencyStatus}
          currencyStatusClass={currencyStatusClass}
          id="billing-currency-select"
          normalizedChargeCurrency={normalizedChargeCurrency}
          onChange={handleCurrencyChange}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 sm:grid-cols-5">
        {USD_TOPUP_TIERS.map((tier) => {
          const isSelected = selectedTopupCents === tier.amountCents;
          const quote = topupQuotes[tier.amountCents];
          return (
            <Button
              key={tier.id}
              type="button"
              size="md"
              variant="ghost"
              aria-pressed={isSelected}
              onClick={() => onPresetSelected(tier.amountCents)}
              className={`min-h-[58px] w-full flex-col items-start justify-between rounded-input border px-3 py-2 text-left sm:min-h-[74px] sm:py-3 ${
                isSelected
                  ? 'border-brand bg-surface-2 text-text-primary shadow-card'
                  : 'border-border bg-bg text-text-secondary hover:border-border-hover hover:bg-surface-hover'
              }`}
            >
              <span className="text-base font-semibold sm:text-lg">{copy.wallet.addFunds.replace('{amount}', formatUsdAmount(tier.amountCents))}</span>
              {quote && normalizedChargeCurrency !== 'USD' ? (
                <span className="text-xs font-medium text-text-muted">
                  ≈ {formatLocalAmount(quote.amountMinor, quote.currency)}
                </span>
              ) : (
                <span className="text-xs font-medium text-text-muted">{isSelected ? copy.wallet.selectedAmount : copy.wallet.chooseAmount}</span>
              )}
            </Button>
          );
        })}
        <Button
          type="button"
          size="md"
          variant="ghost"
          aria-pressed={customCardActive}
          onClick={onOpenCustomAmountEditor}
          className={`col-span-2 min-h-[58px] w-full flex-col items-start justify-between rounded-input border px-3 py-2 text-left sm:col-span-1 sm:min-h-[74px] sm:py-3 ${
            customCardActive
              ? 'border-brand bg-surface-2 text-text-primary shadow-card'
              : 'border-border bg-bg text-text-secondary hover:border-border-hover hover:bg-surface-hover'
          }`}
        >
          <span className="text-sm font-semibold sm:text-base">{copy.wallet.customPresetLabel}</span>
          <span className="text-xs font-medium text-text-muted">
            {customAmountValid && customAmountCents != null
              ? formatUsdAmount(customAmountCents)
              : copy.wallet.customPresetHint}
          </span>
        </Button>
      </div>

      {customCardActive ? (
        <div className="mt-3 rounded-input border border-border bg-bg p-3">
          <label className="text-xs font-semibold uppercase tracking-micro text-text-muted" htmlFor="billing-custom-amount">
            {copy.wallet.customLabel}
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-text-muted">$</span>
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
                className="bg-surface px-7"
              />
            </div>
            <Button
              type="button"
              disabled={!customAmountValid}
              onClick={applyCustomAmount}
              size="md"
              className={`px-4 ${
                customAmountValid ? '' : 'bg-surface-disabled text-text-muted hover:bg-surface-disabled disabled:opacity-100'
              }`}
            >
              {copy.wallet.customCta}
            </Button>
          </div>
          <p className={`mt-2 text-xs ${customAmountError ? 'text-state-warning' : 'text-text-muted'}`}>
            {customAmountError ?? copy.wallet.customHint}
          </p>
        </div>
      ) : null}

      <div className="mt-3 rounded-input border border-brand bg-surface-2 p-3 sm:mt-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{copy.wallet.selectedAmount}</p>
            <p className="text-xl font-semibold text-text-primary sm:text-2xl">{selectedTopupAmountLabel}</p>
            {selectedTopupLocalLabel ? <p className="text-xs text-text-secondary">{selectedTopupLocalLabel}</p> : null}
          </div>
          <Button
            type="button"
            size="lg"
            disabled={isTopupStarting}
            onClick={handleTopUp}
            className="w-full whitespace-normal px-4 text-center leading-snug sm:w-auto sm:px-5"
          >
            {copy.wallet.checkoutCta.replace('{amount}', selectedTopupAmountLabel)}
          </Button>
        </div>
        <p className="mt-2 text-xs text-text-secondary">{copy.wallet.checkoutNote}</p>
        {shouldShowFirstTopupAmexNotice ? (
          <p className="mt-1 text-[11px] leading-4 text-text-muted">{copy.wallet.firstTopupAmexNotice}</p>
        ) : null}
      </div>

      {checkoutCaptchaRequired ? (
        <div className="mt-3 rounded-input border border-border bg-bg p-3">
          <p className="text-sm font-semibold text-text-primary">{copy.wallet.captchaPrompt}</p>
          {turnstileSiteKey ? (
            <div className="mt-3">
              <TurnstileChallenge
                siteKey={turnstileSiteKey}
                onToken={handleCheckoutCaptchaToken}
                onError={handleCheckoutCaptchaError}
                resetGeneration={checkoutCaptchaResetGeneration}
              />
            </div>
          ) : null}
          <p className={`mt-2 text-xs ${checkoutCaptchaError ? 'text-state-warning' : checkoutCaptchaToken ? 'text-success' : 'text-text-secondary'}`}>
            {checkoutCaptchaError ?? (checkoutCaptchaToken ? copy.wallet.captchaComplete : copy.wallet.captchaPrompt)}
          </p>
        </div>
      ) : null}

      {session && !expressRequested ? (
        <div className="mt-4 rounded-input border border-border bg-bg p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-text-primary">{copy.wallet.expressTitle}</p>
              <p className="mt-0.5 text-xs text-text-secondary">{copy.wallet.expressSubtitle}</p>
            </div>
            <Button
              type="button"
              size="md"
              variant="outline"
              onClick={onExpressReveal}
              aria-label={copy.wallet.expressRevealCta}
              className="w-full whitespace-normal px-3 text-center leading-snug sm:w-auto sm:px-4"
            >
              <span className="flex flex-col items-center justify-center gap-2">
                <span className="text-xs font-semibold">{copy.wallet.expressRevealAction}</span>
                <FastPayLogoStrip />
              </span>
            </Button>
          </div>
        </div>
      ) : null}

      {expressRequested ? (
        <WalletExpressCheckout
          amountCents={selectedTopupCents}
          chargeCurrency={normalizedChargeCurrency}
          localAmountLabel={selectedTopupLocalLabel}
          locale={locale}
          captchaToken={checkoutCaptchaToken}
          session={session}
          stripePromise={stripePromise}
          labels={{
            selectedAmount: copy.wallet.selectedAmount,
            expressTitle: copy.wallet.expressTitle,
            expressSubtitle: copy.wallet.expressSubtitle,
            expressLoading: copy.wallet.expressLoading,
            expressUnavailable: copy.wallet.expressUnavailable,
            expressError: copy.wallet.expressError,
            expressClosed: copy.wallet.expressClosed,
            expressAriaLabel: copy.wallet.expressAriaLabel,
            rateLimited: copy.wallet.rateLimited,
          }}
          onCaptchaRequired={handleCheckoutCaptchaRequired}
          onPaymentStarted={handleExpressTopupStarted}
          onPaymentFailed={handleExpressTopupFailed}
        />
      ) : null}

      <CurrencySelect
        className="mt-3 flex flex-col gap-1 text-left sm:hidden"
        copy={copy}
        currencyLoading={currencyLoading}
        currencyOptions={currencyOptions}
        currencyStatus={currencyStatus}
        currencyStatusClass={currencyStatusClass}
        id="billing-currency-select-mobile"
        normalizedChargeCurrency={normalizedChargeCurrency}
        onChange={handleCurrencyChange}
      />
      {quoteLoading && <p className="mt-2 text-xs text-text-secondary">{walletQuoteLoading}</p>}
      {quoteError && <p className="mt-2 text-xs text-state-warning">{quoteError}</p>}
      {wallet && wallet.balance < 2 && <p className="mt-2 text-sm text-state-warning">{copy.wallet.lowBalance}</p>}
    </div>
  );
}

function CurrencySelect({
  className,
  copy,
  currencyLoading,
  currencyOptions,
  currencyStatus,
  currencyStatusClass,
  id,
  normalizedChargeCurrency,
  onChange,
}: {
  className: string;
  copy: BillingCopy;
  currencyLoading: boolean;
  currencyOptions: string[];
  currencyStatus: string;
  currencyStatusClass: string;
  id: string;
  normalizedChargeCurrency: string;
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
}) {
  return (
    <div className={className}>
      <label className="text-xs font-medium text-text-secondary" htmlFor={id}>
        {copy.wallet.currencyLabel}
      </label>
      <select
        id={id}
        className="w-full rounded-input border border-border bg-bg px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        value={normalizedChargeCurrency}
        onChange={onChange}
        disabled={currencyLoading}
      >
        {currencyOptions.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <p className={`text-xs ${currencyStatusClass}`}>{currencyStatus}</p>
    </div>
  );
}
