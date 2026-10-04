/** Payment-credit reversals change the wallet, but are not generation spending. */
export const CREDIT_REVERSAL_SQL = `COALESCE(metadata ->> 'reason', '') IN (
  'fraud_credit_reversal',
  'customer_payment_refund_credit_reversal'
)`;

export const RENDER_CHARGE_SQL = `type = 'charge' AND NOT (${CREDIT_REVERSAL_SQL})`;
