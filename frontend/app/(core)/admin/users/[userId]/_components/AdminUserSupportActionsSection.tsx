import { ManualCreditForm } from '@/components/admin/ManualCreditForm';
import { AdminNotice } from '@/components/admin-system/feedback/AdminNotice';
import { AdminInspectorPanel } from '@/components/admin-system/shell/AdminInspectorPanel';
import { Button } from '@/components/ui/Button';
import type { AdminUserProfile, AdminUserWallet } from '../_lib/admin-user-detail-types';

export function AdminUserSupportActionsSection({
  userId,
  profile,
  wallet,
  serviceRoleConfigured,
}: {
  userId: string;
  profile: AdminUserProfile | null;
  wallet: AdminUserWallet | null;
  serviceRoleConfigured: boolean;
}) {
  return (
    <AdminInspectorPanel title="Support Actions" description="Opérations directes pour corriger un wallet ou reproduire l’expérience membre.">
      <div className="space-y-5">
        {wallet ? (
          <ManualCreditForm userId={userId} embedded />
        ) : (
          <AdminNotice tone="info">Wallet controls are unavailable because Postgres aggregates could not be loaded.</AdminNotice>
        )}

        <div className="border-t border-hairline pt-5">
          <ImpersonationPanel userId={userId} profile={profile} serviceRoleConfigured={serviceRoleConfigured} />
        </div>
      </div>
    </AdminInspectorPanel>
  );
}

function ImpersonationPanel({
  userId,
  profile,
  serviceRoleConfigured,
}: {
  userId: string;
  profile: AdminUserProfile | null;
  serviceRoleConfigured: boolean;
}) {
  const disabled = !serviceRoleConfigured || !profile?.email;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-text-muted">Impersonation</p>
        <p className="text-sm text-text-secondary">
          Sign into the workspace as this user to debug renders, wallet issues, or onboarding flow. Your admin session is preserved and can be restored at any time.
        </p>
      </div>
      {disabled ? (
        <p className="rounded-lg border border-warning-border bg-warning-bg px-3 py-2 text-xs text-warning">
          {serviceRoleConfigured
            ? 'This user record has no email associated with it.'
            : 'Supabase service role key missing — impersonation requires service role access.'}
        </p>
      ) : null}
      <form action="/api/admin/impersonate" method="post" className="space-y-2">
        <input type="hidden" name="userId" value={userId} />
        <input type="hidden" name="redirectTo" value="/app" />
        <input type="hidden" name="returnTo" value={`/admin/users/${userId}`} />
        <Button
          type="submit"
          size="sm"
          disabled={disabled}
          className="rounded-xl bg-text-primary px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-on-inverse hover:bg-text-primary/90"
        >
          View workspace as this user
        </Button>
      </form>
      {profile?.isAdmin ? (
        <p className="text-xs text-error">
          This account is an admin. Impersonating another admin will inherit their permissions; exit immediately after debugging.
        </p>
      ) : null}
    </div>
  );
}
