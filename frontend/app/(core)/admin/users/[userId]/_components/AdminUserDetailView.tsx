import { AdminNotice } from '@/components/admin-system/feedback/AdminNotice';
import { AdminActionLink } from '@/components/admin-system/shell/AdminActionLink';
import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import { AdminSectionMeta } from '@/components/admin-system/shell/AdminSectionMeta';
import { AdminMetricGrid } from '@/components/admin-system/surfaces/AdminMetricGrid';
import type { AdminUserDetailViewProps } from '../_lib/admin-user-detail-types';
import { formatShortDate, truncateId } from '../_lib/admin-user-detail-format';
import { buildMemberPulseItems } from '../_lib/admin-user-detail-metrics';
import { AdminUserIdentitySection } from './AdminUserIdentitySection';
import { AdminUserSupportActionsSection } from './AdminUserSupportActionsSection';
import { AdminUserUsageSection } from './AdminUserUsageSection';
import { AdminUserWalletLedgerSection } from './AdminUserWalletLedgerSection';

export function AdminUserDetailView({ userId, overview }: AdminUserDetailViewProps) {
  const profile = overview.profile;
  const wallet = overview.wallet;
  const usage = overview.usage;
  const lifetimeTopupsUsd = wallet ? (wallet.stats.topup ?? 0) / 100 : 0;
  const lifetimeChargesUsd = wallet ? (wallet.stats.charge ?? 0) / 100 : 0;
  const metrics = buildMemberPulseItems({
    userId,
    profile,
    wallet,
    usage,
    lifetimeTopupsUsd,
    lifetimeChargesUsd,
  });
  const profileMetaLines = [
    profile?.createdAt ? `Created ${formatShortDate(profile.createdAt)}` : null,
    profile?.lastSignInAt ? `Last sign-in ${formatShortDate(profile.lastSignInAt)}` : 'No sign-in captured',
  ].filter((value): value is string => Boolean(value));

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        eyebrow="Operations"
        title={profile?.email ?? 'User detail'}
        description="Fiche support pour l’identité, le wallet, l’historique de rendus et l’impersonation. Le détail reste dense, mais sans empilement inutile de cartes."
        actions={
          <>
            <AdminActionLink href="/admin/users">
              Users
            </AdminActionLink>
            <AdminActionLink href={`/admin/jobs?userId=${encodeURIComponent(userId)}`}>
              Jobs
            </AdminActionLink>
            <AdminActionLink href={`/admin/audit?targetUserId=${encodeURIComponent(userId)}`}>
              Audit
            </AdminActionLink>
          </>
        }
      />

      {!profile ? (
        <AdminNotice tone={overview.serviceRoleConfigured ? 'info' : 'warning'}>
          {overview.serviceRoleConfigured ? (
            <>
              Supabase did not return a profile for <code className="font-mono text-xs">{userId}</code>. Wallet and render aggregates can still appear if the user has historical data in Postgres.
            </>
          ) : (
            <>
              Supabase service role key is missing. Add <code className="font-mono text-xs">SUPABASE_SERVICE_ROLE_KEY</code> to fetch profile metadata and enable impersonation.
            </>
          )}
        </AdminNotice>
      ) : null}

      {(wallet === null || usage === null) && process.env.DATABASE_URL ? (
        <AdminNotice tone="info">
          Some Postgres aggregates are unavailable for this user. The page still shows any data that could be resolved.
        </AdminNotice>
      ) : null}

      <AdminSection
        title="Member Pulse"
        description="Repères principaux pour savoir immédiatement si le sujet est un problème de compte, de wallet ou de consommation."
        action={<AdminSectionMeta title={truncateId(userId)} lines={profileMetaLines} />}
      >
        <AdminMetricGrid items={metrics} columnsClassName="sm:grid-cols-2 xl:grid-cols-3" density="compact" />
      </AdminSection>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_340px] xl:items-start">
        <div className="space-y-5">
          <AdminUserIdentitySection profile={profile} />
          <AdminUserUsageSection usage={usage} />
          <AdminUserWalletLedgerSection
            wallet={wallet}
            topups={overview.topups}
            lifetimeTopupsUsd={lifetimeTopupsUsd}
            lifetimeChargesUsd={lifetimeChargesUsd}
          />
        </div>

        <AdminUserSupportActionsSection
          userId={userId}
          profile={profile}
          wallet={wallet}
          serviceRoleConfigured={overview.serviceRoleConfigured}
        />
      </div>
    </div>
  );
}
