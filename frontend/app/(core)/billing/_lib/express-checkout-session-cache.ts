type WalletExpressCheckoutRequestKeyParams = {
  userId: string;
  amountCents: number;
  currency: string;
  locale: string;
  captchaToken?: string | null;
  attributionKey: string;
};

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
