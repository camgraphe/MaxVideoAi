export const STANDARD_PAYMENT_MESSAGES = {
  refundInitiated:
    'Your payment is being refunded. It can take 5–10 business days to appear on your statement.',
  partialRefund:
    'We’ve issued a partial refund of {refundedAmount}. The remaining {remainingAmount} will stay on your statement.',
  paymentRetried:
    'We’ve safely retried your payment using the original idempotency key. You won’t be double-charged.',
} as const;
