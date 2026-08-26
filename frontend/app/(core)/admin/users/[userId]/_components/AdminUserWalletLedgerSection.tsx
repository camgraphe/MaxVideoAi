import { AdminEmptyState } from '@/components/admin-system/feedback/AdminEmptyState';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import { AdminSectionMeta } from '@/components/admin-system/shell/AdminSectionMeta';
import { AdminDataTable } from '@/components/admin-system/surfaces/AdminDataTable';
import type { AdminUserTopup, AdminUserWallet } from '../_lib/admin-user-detail-types';
import { formatCurrency, formatDateTime } from '../_lib/admin-user-detail-format';

export function AdminUserWalletLedgerSection({
  wallet,
  topups,
  lifetimeTopupsUsd,
  lifetimeChargesUsd,
  lifetimeRefundsUsd,
  lifetimeNetSpendUsd,
}: {
  wallet: AdminUserWallet | null;
  topups: AdminUserTopup[];
  lifetimeTopupsUsd: number;
  lifetimeChargesUsd: number;
  lifetimeRefundsUsd: number;
  lifetimeNetSpendUsd: number;
}) {
  return (
    <AdminSection
      title="Wallet Ledger"
      description="Historique des top-ups avec synthèse explicite des débits bruts, remboursements et dépenses nettes."
      action={
        wallet ? (
          <AdminSectionMeta
            title={formatCurrency(lifetimeTopupsUsd)}
            lines={[
              `Gross charges ${formatCurrency(lifetimeChargesUsd)}`,
              `Refunds ${formatCurrency(lifetimeRefundsUsd)}`,
              `Net render spend ${formatCurrency(lifetimeNetSpendUsd)}`,
              `${topups.length} recent top-ups`,
            ]}
          />
        ) : undefined
      }
    >
      {topups.length ? (
        <AdminDataTable>
          <thead className="bg-surface">
            <tr className="text-[11px] uppercase tracking-[0.18em] text-text-muted">
              <th className="px-4 py-3 font-semibold">Date</th>
              <th className="px-4 py-3 font-semibold">Amount</th>
              <th className="px-4 py-3 font-semibold">Description</th>
              <th className="px-4 py-3 font-semibold">Stripe ref</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline bg-bg/30">
            {topups.map((topup) => (
              <tr key={topup.id} className="text-text-secondary">
                <td className="px-4 py-3 text-xs">{formatDateTime(topup.createdAt)}</td>
                <td className="px-4 py-3 font-medium text-text-primary">
                  {formatCurrency(topup.amountUsd)} {topup.currency}
                </td>
                <td className="px-4 py-3">{topup.description ?? '—'}</td>
                <td className="px-4 py-3 font-mono text-xs">{topup.stripePaymentIntentId ?? topup.stripeChargeId ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </AdminDataTable>
      ) : (
        <AdminEmptyState>No top-ups recorded yet.</AdminEmptyState>
      )}
    </AdminSection>
  );
}
