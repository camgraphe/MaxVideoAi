import { ButtonLink } from '@/components/ui/Button';
import type { WalletCheckoutReturnTarget } from '@/lib/wallet/checkout-return';

export function BillingCheckoutReturnNotice({
  href,
  label,
}: {
  href: WalletCheckoutReturnTarget;
  label: string;
}) {
  return (
    <div
      role="status"
      className="mb-5 flex justify-end rounded-input border border-brand bg-surface-2 p-3"
    >
      <ButtonLink href={href} size="sm">
        {label}
      </ButtonLink>
    </div>
  );
}
