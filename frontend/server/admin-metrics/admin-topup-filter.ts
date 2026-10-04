/** Keep manual wallet grants out of customer activity without changing ledger records. */
export function manualAdminCreditExclusionClause(exclude: boolean): string {
  return exclude ? "AND (type <> 'topup' OR COALESCE(metadata ->> 'reason', '') <> 'manual_admin_topup')" : '';
}
