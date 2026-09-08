import { CheckCircle2, CircleX, LoaderCircle } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import type { WalletCheckoutReturnTarget } from '@/lib/wallet/checkout-return';
import type { BillingCheckoutReconciliationStatus } from '../_hooks/useBillingCheckoutReconciliation';
import type { BillingCopy } from '../_lib/billing-copy';
import styles from './billing-page.module.css';

export function BillingCheckoutReturnNotice({
  copy,
  href,
  reconciliationStatus,
  status,
}: {
  copy: BillingCopy;
  href: WalletCheckoutReturnTarget | null;
  reconciliationStatus: BillingCheckoutReconciliationStatus;
  status: 'success' | 'cancelled';
}) {
  const isSuccess = status === 'success';
  const detail = !isSuccess
    ? copy.checkoutReturn.cancelledDetail
    : reconciliationStatus === 'refreshing' || reconciliationStatus === 'idle'
      ? copy.checkoutReturn.refreshingDetail
      : reconciliationStatus === 'delayed'
        ? copy.checkoutReturn.delayedDetail
        : copy.checkoutReturn.refreshedDetail;
  const Icon = !isSuccess
    ? CircleX
    : reconciliationStatus === 'refreshing' || reconciliationStatus === 'idle'
      ? LoaderCircle
      : CheckCircle2;

  return (
    <section className={styles.returnNotice} data-status={status} role="status" aria-live="polite">
      <Icon
        size={20}
        aria-hidden="true"
        className={reconciliationStatus === 'refreshing' ? styles.spinning : undefined}
      />
      <div>
        <strong>{isSuccess ? copy.checkoutReturn.successTitle : copy.checkoutReturn.cancelledTitle}</strong>
        <p>{detail}</p>
      </div>
      {href ? <ButtonLink href={href} size="sm">{copy.toasts.returnToWorkspace}</ButtonLink> : null}
    </section>
  );
}
