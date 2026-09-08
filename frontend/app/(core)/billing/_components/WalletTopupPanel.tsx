'use client';

import type { ChangeEvent, Ref } from 'react';
import type { Stripe } from '@stripe/stripe-js';
import { CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FastPayLogoStrip } from './FastPayLogoStrip';
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
  selectedTopupPaymentLabel: string | null;
  session: BillingSession;
  stripePromise: Promise<Stripe | null> | null;
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
    selectedTopupPaymentLabel,
    session,
    stripePromise,
    turnstileSiteKey,
    wallet,
  } = props;
  const shouldShowFirstTopupAmexNotice = wallet?.hasCompletedTopUp === false;

  return (
    <section className={styles.fundingSurface} aria-labelledby="billing-funding-title">
      <header className={styles.fundingHeader}>
        <span aria-hidden="true"><CreditCard size={19} /></span>
        <div>
          <h2 id="billing-funding-title">{copy.wallet.addCreditsTitle}</h2>
          <p>{copy.wallet.description}</p>
        </div>
      </header>

      <div className={styles.fundingBody}>
        <WalletAmountPicker
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
                <small>{copy.wallet.stepReviewHint}</small>
              </span>
            </div>
            <CurrencySelect
              copy={copy}
              currencyLoading={currencyLoading}
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
          />
        </section>

        {checkoutCaptchaRequired ? (
          <section className={styles.securityCheck} aria-live="polite">
            <strong>{copy.wallet.captchaPrompt}</strong>
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
            <p data-error={Boolean(checkoutCaptchaError)}>
              {checkoutCaptchaError ?? (checkoutCaptchaToken ? copy.wallet.captchaComplete : copy.wallet.captchaPrompt)}
            </p>
          </section>
        ) : null}

        {session && !expressRequested ? (
          <section className={styles.secondaryPayment}>
            <div>
              <span>
                <strong>{copy.wallet.expressTitle}</strong>
                <p>{copy.wallet.expressSubtitle}</p>
              </span>
              <Button type="button" size="md" variant="outline" onClick={onExpressReveal} aria-label={copy.wallet.expressRevealCta}>
                {copy.wallet.expressRevealAction}
                <FastPayLogoStrip />
              </Button>
            </div>
          </section>
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

        {shouldShowFirstTopupAmexNotice ? <p className={styles.firstTopupNotice}>{copy.wallet.firstTopupAmexNotice}</p> : null}
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
        {currencyOptions.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
      <p className={currencyStatusClass} data-error={currencyStatusClass.includes('warning')}>{currencyStatus}</p>
    </div>
  );
}
