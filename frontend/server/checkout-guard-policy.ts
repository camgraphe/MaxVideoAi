// Shared by enforcement and the read-only admin policy summary.
export const CHECKOUT_GUARD_LIMITS = {
  firstTopupCaptcha: 3,
  firstTopupWithoutCaptcha: 6,
  firstTopupWithCaptcha: 12,
  ipCaptcha: 8,
  ipHard: 16,
  returningCaptcha: 8,
  returningHard: 12,
  windowSeconds: 15 * 60,
  returningWindowSeconds: 60 * 60,
  failedCardAttempts: 5,
  failedCardCooldownSeconds: 30 * 60,
} as const;
