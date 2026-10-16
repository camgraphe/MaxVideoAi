'use client';

import type { ChangeEvent, Ref } from 'react';
import type { Stripe } from '@stripe/stripe-js';
import { TurnstileChallenge } from './TurnstileChallenge';
import { WalletAmountPicker } from './WalletAmountPicker';
import { WalletCheckoutSummary } from './WalletCheckoutSummary';
import { WalletExpressCheckout } from './WalletExpressCheckout';
import type { BillingCopy } from '../_lib/billing-copy';
import type { BillingSession } from '../_lib/billing-types';
import styles from './billing-topup.module.css';

type WalletTopupPanelProps = {
  applyCustomAmount: () => void;
  checkoutCaptchaError: string | null;
  checkoutCaptchaRequired: boolean;
  checkoutCaptchaResetGeneration: number;
  checkoutCaptchaToken: string | null;
  takeCheckoutCaptchaToken: () => string | null;
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
  formatUsdAmount: (amountCents: number) => string;
  handleCheckoutCaptchaError: () => void;
  handleCheckoutCaptchaRequired: () => void;
  handleCheckoutCaptchaToken: (token: string | null) => void;
  handleCurrencyChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  handleExpressTopupFailed: (amountCents: number, reason?: string) => void;
  handleExpressTopupStarted: (amountCents: number) => void;
  handleTopUp: () => void;
  isTopupStarting: boolean;
  hostedCheckoutStarting: boolean;
  locale: string;
  normalizedChargeCurrency: string;
  onCustomAmountInputChange: (value: string) => void;
  onOpenCustomAmountEditor: () => void;
  onPresetSelected: (amountCents: number) => void;
  quoteError: string | null;
  quoteLoading: boolean;
  selectedTopupAmountLabel: string;
  selectedTopupCents: number;
  selectedTopupPaymentLabel: string | null;
  session: BillingSession;
  stripePromise: Promise<Stripe | null> | null;
  retryStripeConnection?: () => void;
  turnstileSiteKey: string;
  wallet: { balance: number; currency: string; hasCompletedTopUp?: boolean } | null;
};

export function WalletTopupPanel(props: WalletTopupPanelProps) {
  const {
    applyCustomAmount,
    checkoutCaptchaError,
    checkoutCaptchaRequired,
    checkoutCaptchaResetGeneration,
    checkoutCaptchaToken,
    takeCheckoutCaptchaToken,
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
    formatUsdAmount,
    handleCheckoutCaptchaError,
    handleCheckoutCaptchaRequired,
    handleCheckoutCaptchaToken,
    handleCurrencyChange,
    handleExpressTopupFailed,
    handleExpressTopupStarted,
    handleTopUp,
    isTopupStarting,
    hostedCheckoutStarting,
    locale,
    normalizedChargeCurrency,
    onCustomAmountInputChange,
    onOpenCustomAmountEditor,
    onPresetSelected,
    quoteError,
    quoteLoading,
    selectedTopupAmountLabel,
    selectedTopupCents,
    selectedTopupPaymentLabel,
    session,
    stripePromise,
    retryStripeConnection,
    turnstileSiteKey,
    wallet,
  } = props;

  return (
    <section className={styles.fundingSurface} aria-labelledby="billing-funding-title">
      <h2 id="billing-funding-title" className="sr-only">{copy.wallet.addCreditsTitle}</h2>

      <div className={styles.fundingBody}>
        <WalletAmountPicker
          disabled={isTopupStarting}
          applyCustomAmount={applyCustomAmount}
          copy={copy}
          customAmountCents={customAmountCents}
          customAmountError={customAmountError}
          customAmountInput={customAmountInput}
          customAmountInputRef={customAmountInputRef}
          customAmountValid={customAmountValid}
          customCardActive={customCardActive}
          formatUsdAmount={formatUsdAmount}
          onCustomAmountInputChange={onCustomAmountInputChange}
          onOpenCustomAmountEditor={onOpenCustomAmountEditor}
          onPresetSelected={onPresetSelected}
          selectedTopupCents={selectedTopupCents}
        />

        <section className={styles.reviewSection} aria-labelledby="billing-review-title">
          <div className={styles.reviewHeading}>
            <div className={styles.stepHeading}>
              <span>2</span>
              <span>
                <strong id="billing-review-title">{copy.wallet.stepReview}</strong>
              </span>
            </div>
            <CurrencySelect
              copy={copy}
              currencyLoading={currencyLoading || isTopupStarting}
              currencyOptions={currencyOptions}
              currencyStatus={currencyStatus}
              currencyStatusClass={currencyStatusClass}
              normalizedChargeCurrency={normalizedChargeCurrency}
              onChange={handleCurrencyChange}
            />
          </div>

          <WalletCheckoutSummary
            copy={copy}
            creditsLabel={selectedTopupAmountLabel}
            paymentAmountLabel={selectedTopupPaymentLabel}
            quoteLoading={quoteLoading}
            quoteError={quoteError}
            isTopupStarting={isTopupStarting}
            onCheckout={handleTopUp}
          >
            {checkoutCaptchaRequired ? (
              <section className={styles.securityCheck} aria-live="polite">
                <strong>{copy.wallet.captchaPrompt}</strong>
                {turnstileSiteKey ? (
                  <div className="mt-3">
                    <TurnstileChallenge
                      locale={locale}
                      siteKey={turnstileSiteKey}
                      onToken={handleCheckoutCaptchaToken}
                      onError={handleCheckoutCaptchaError}
                      resetGeneration={checkoutCaptchaResetGeneration}
                    />
                  </div>
                ) : null}
                <p data-error={Boolean(checkoutCaptchaError)}>
                  {checkoutCaptchaError ?? (checkoutCaptchaToken ? copy.wallet.captchaComplete : copy.wallet.captchaPrompt)}
                </p>
              </section>
            ) : null}

            {session?.user?.id ? (
              <WalletExpressCheckout
                key={session.user.id}
                enabled={!currencyLoading && !quoteLoading && !hostedCheckoutStarting}
                amountCents={selectedTopupCents}
                chargeCurrency={normalizedChargeCurrency}
                locale={locale}
                captchaToken={checkoutCaptchaToken}
                takeCaptchaToken={takeCheckoutCaptchaToken}
                captchaSiteKey={turnstileSiteKey}
                session={session}
                stripePromise={stripePromise}
                onRetryConnection={retryStripeConnection}
                labels={{
                  expressTitle: copy.wallet.expressTitle,
                  expressLoading: copy.wallet.expressLoading,
                  expressSlow: copy.wallet.expressSlow,
                  expressRetry: copy.wallet.expressRetry,
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
          </WalletCheckoutSummary>
        </section>

        {wallet && wallet.balance < 2 ? <p className="mt-3 text-sm text-state-warning">{copy.wallet.lowBalance}</p> : null}
      </div>
    </section>
  );
}

function CurrencySelect({
  copy,
  currencyLoading,
  currencyOptions,
  currencyStatus,
  currencyStatusClass,
  normalizedChargeCurrency,
  onChange,
}: {
  copy: BillingCopy;
  currencyLoading: boolean;
  currencyOptions: string[];
  currencyStatus: string;
  currencyStatusClass: string;
  normalizedChargeCurrency: string;
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
}) {
  return (
    <div className={styles.currencyField}>
      <label htmlFor="billing-currency-select">{copy.wallet.currencyLabel}</label>
      <select
        id="billing-currency-select"
        value={normalizedChargeCurrency}
        onChange={onChange}
        disabled={currencyLoading}
      >
        {!currencyOptions.includes(normalizedChargeCurrency) ? (
          <option value={normalizedChargeCurrency} disabled>{normalizedChargeCurrency}</option>
        ) : null}
        {currencyOptions.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
      <p className={`${currencyStatusClass} ${!currencyLoading && !currencyStatusClass.includes('warning') ? 'sr-only' : ''}`} data-error={currencyStatusClass.includes('warning')}>{currencyStatus}</p>
    </div>
  );
}
