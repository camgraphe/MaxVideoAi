import { CHECKOUT_GUARD_LIMITS as limits } from '@/server/checkout-guard-policy';
import { isCheckoutCaptchaConfigured } from '@/server/checkout-guard';
import { resolveEnabledCurrencies } from '@/lib/currency';

export function CheckoutGuardPolicy() {
  const captcha = isCheckoutCaptchaConfigured();
  return (
    <section className="rounded-xl border border-hairline bg-surface p-4" aria-label="Current checkout guard policy">
      <h2 className="text-sm font-semibold text-text-primary">Current policy</h2>
      <p className="mt-2 text-sm text-text-secondary">
        Native wallets prepare a Stripe session automatically. Editing an unapplied amount, refreshing the buttons,
        reusing a session or cancelling a wallet sheet does not count as a new session or a failed card.
      </p>
      <dl className="mt-4 grid gap-4 text-sm md:grid-cols-2 xl:grid-cols-4">
        <div><dt className="font-semibold">First top-up</dt><dd className="mt-1 text-text-secondary">
          CAPTCHA after {limits.firstTopupCaptcha} sessions or for a custom amount.
          Maximum {captcha ? limits.firstTopupWithCaptcha : limits.firstTopupWithoutCaptcha} new sessions / {limits.windowSeconds / 60} min.
        </dd></div>
        <div><dt className="font-semibold">Returning customer / IP</dt><dd className="mt-1 text-text-secondary">
          Customer: CAPTCHA after {limits.returningCaptcha}, maximum {limits.returningHard} / {limits.returningWindowSeconds / 60} min.
          IP: CAPTCHA after {limits.ipCaptcha}, maximum {limits.ipHard} / {limits.windowSeconds / 60} min.
        </dd></div>
        <div><dt className="font-semibold">Card testing protection</dt><dd className="mt-1 text-text-secondary">
          {limits.failedCardAttempts} failed card attempts expire the first-top-up session and start a {limits.failedCardCooldownSeconds / 60} min cooldown.
          Amex has no blanket brand restriction.
        </dd></div>
        <div><dt className="font-semibold">Configuration</dt><dd className="mt-1 text-text-secondary">
          CAPTCHA: {captcha ? 'configured' : 'unavailable or disabled; lower session cap applies'}.
          Payment currencies: {resolveEnabledCurrencies().map((value) => value.toUpperCase()).join(', ')}.
          Stripe Radar rules are managed in Stripe.
        </dd></div>
      </dl>
    </section>
  );
}
