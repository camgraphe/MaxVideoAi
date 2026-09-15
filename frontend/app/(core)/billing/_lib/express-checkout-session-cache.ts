type WalletExpressCheckoutRequestKeyParams = {
  userId: string;
  amountCents: number;
  currency: string;
  locale: string;
  captchaToken?: string | null;
  attributionKey: string;
};

type CachedSession = {
  checkoutAttemptId: number | null;
  clientSecret: string;
  sessionId: string | null;
};

// Memory only: no client secrets in browser storage. Keep selection changes from
// repeatedly creating sessions, but never reuse one past Stripe's expiry.
export function createWalletExpressSessionCache(now: () => number = Date.now) {
  const sessions = new Map<string, { value: CachedSession; expiresAt: number }>();
  return {
    get(key: string): CachedSession | null {
      const entry = sessions.get(key);
      if (!entry || entry.expiresAt <= now()) {
        sessions.delete(key);
        return null;
      }
      return entry.value;
    },
    set(key: string, value: CachedSession, expiresAt: number) {
      if (!Number.isFinite(expiresAt) || expiresAt <= now()) return;
      if (sessions.size >= 8) sessions.delete(sessions.keys().next().value!);
      sessions.set(key, { value, expiresAt });
    },
  };
}

export function buildWalletExpressCheckoutRequestKey({
  userId,
  amountCents,
  currency,
  locale,
  captchaToken,
  attributionKey,
}: WalletExpressCheckoutRequestKeyParams): string {
  const normalizedUserId = userId.trim();
  const normalizedAmount = Math.max(0, Math.round(amountCents));
  const normalizedCurrency = String(currency || 'USD').trim().toUpperCase();
  const normalizedLocale = String(locale || 'en').trim().toLowerCase();
  const captchaState = captchaToken?.trim() ? 'captcha' : 'no-captcha';
  return [normalizedUserId, normalizedAmount, normalizedCurrency, normalizedLocale, captchaState, attributionKey].join(':');
}
