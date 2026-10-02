/** Card-funded runs have their own charge/refund history and never fund the wallet. */
export const WALLET_FUNDED_RECEIPT_SQL = `(type = 'topup' OR (
  stripe_payment_intent_id IS NULL AND stripe_charge_id IS NULL
  AND COALESCE(metadata->>'original_stripe_payment_intent_id', '') = ''
  AND COALESCE(metadata->>'original_stripe_charge_id', '') = ''
))`;
