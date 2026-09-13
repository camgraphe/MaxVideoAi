export type BillingCheckoutReconciliationResult = 'refreshed' | 'delayed' | 'cancelled';

type BillingCheckoutReconciliationOptions = {
  refreshWallet: () => Promise<boolean>;
  refreshReceipts: () => Promise<boolean>;
  isActive: () => boolean;
  wait?: (milliseconds: number) => Promise<void>;
};

const FOLLOW_UP_DELAY_MS = 1800;

export async function runBillingCheckoutReconciliation({
  refreshWallet,
  refreshReceipts,
  isActive,
  wait = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds)),
}: BillingCheckoutReconciliationOptions): Promise<BillingCheckoutReconciliationResult> {
  if (!isActive()) return 'cancelled';
  await Promise.all([refreshWallet(), refreshReceipts()]);
  await wait(FOLLOW_UP_DELAY_MS);
  if (!isActive()) return 'cancelled';
  const [walletRefreshed, receiptsRefreshed] = await Promise.all([refreshWallet(), refreshReceipts()]);
  if (!isActive()) return 'cancelled';
  return walletRefreshed && receiptsRefreshed ? 'refreshed' : 'delayed';
}
