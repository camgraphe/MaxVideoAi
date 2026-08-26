import { BadgeDollarSign, Clock3, History, Layers3, ShieldCheck, UserRound, Wallet } from 'lucide-react';
import type { AdminMetricItem } from '@/components/admin-system/surfaces/AdminMetricGrid';
import type { AdminUserProfile, AdminUserUsage, AdminUserWallet } from './admin-user-detail-types';
import { formatCurrency, formatNumber, formatShortDate, truncateId } from './admin-user-detail-format';

export function buildMemberPulseItems({
  userId,
  profile,
  wallet,
  usage,
  lifetimeTopupsUsd,
  lifetimeChargesUsd,
  lifetimeRefundsUsd,
  lifetimeNetSpendUsd,
}: {
  userId: string;
  profile: AdminUserProfile | null;
  wallet: AdminUserWallet | null;
  usage: AdminUserUsage | null;
  lifetimeTopupsUsd: number;
  lifetimeChargesUsd: number;
  lifetimeRefundsUsd: number;
  lifetimeNetSpendUsd: number;
}): AdminMetricItem[] {
  return [
    {
      label: 'Access',
      value: profile ? (profile.isAdmin ? 'Admin' : 'Member') : 'Unknown',
      helper: profile?.email ?? truncateId(userId),
      tone: profile?.isAdmin ? 'info' : 'default',
      icon: profile?.isAdmin ? ShieldCheck : UserRound,
    },
    {
      label: 'Last sign-in',
      value: profile?.lastSignInAt ? formatShortDate(profile.lastSignInAt) : '—',
      helper: profile?.createdAt ? `Created ${formatShortDate(profile.createdAt)}` : 'No profile timestamp',
      icon: Clock3,
    },
    {
      label: 'Wallet balance',
      value: wallet ? formatCurrency(wallet.balanceCents / 100) : '—',
      helper: wallet ? 'Stored credits available' : 'Wallet aggregate unavailable',
      icon: Wallet,
    },
    {
      label: 'Lifetime top-ups',
      value: wallet ? formatCurrency(lifetimeTopupsUsd) : '—',
      helper: wallet ? 'Credits loaded into the wallet' : 'No receipt aggregate',
      icon: BadgeDollarSign,
    },
    {
      label: 'Gross charges',
      value: wallet ? formatCurrency(lifetimeChargesUsd) : '—',
      helper: wallet ? 'All render debits before refunds' : 'No receipt aggregate',
      icon: BadgeDollarSign,
    },
    {
      label: 'Refunds',
      value: wallet ? formatCurrency(lifetimeRefundsUsd) : '—',
      helper: wallet ? 'Credits returned to the wallet' : 'No receipt aggregate',
      icon: History,
    },
    {
      label: 'Net render spend',
      value: wallet ? formatCurrency(lifetimeNetSpendUsd) : '—',
      helper: wallet ? 'Gross charges minus refunds' : 'No receipt aggregate',
      icon: Wallet,
    },
    {
      label: 'Completed renders',
      value: formatNumber(usage?.totalRenders ?? 0),
      helper: `30d ${formatNumber(usage?.renders30d ?? 0)}`,
      icon: History,
    },
    {
      label: 'Engine coverage',
      value: formatNumber(usage?.engineBreakdown.length ?? 0),
      helper: usage?.engineBreakdown.length ? 'Distinct engines completed' : 'No engine usage yet',
      icon: Layers3,
    },
  ];
}
