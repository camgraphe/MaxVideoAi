import type { ReactNode } from 'react';
import { AdminEmptyState } from '@/components/admin-system/feedback/AdminEmptyState';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import { AdminSectionMeta } from '@/components/admin-system/shell/AdminSectionMeta';
import type { AdminUserProfile } from '../_lib/admin-user-detail-types';
import { formatDateTime, formatShortDate } from '../_lib/admin-user-detail-format';

export function AdminUserIdentitySection({ profile }: { profile: AdminUserProfile | null }) {
  return (
    <AdminSection
      title="Identity & Access"
      description="Email, timestamps, rôle et métadonnées associées au compte Supabase."
      action={
        profile ? (
          <AdminSectionMeta
            title={profile.isAdmin ? 'Admin account' : 'Member account'}
            lines={[profile.email ?? 'No email', profile.lastSignInAt ? `Last sign-in ${formatShortDate(profile.lastSignInAt)}` : 'No sign-in captured']}
          />
        ) : undefined
      }
    >
      {profile ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <ProfileField label="Email">{profile.email ?? '—'}</ProfileField>
            <ProfileField label="User ID">
              <span className="font-mono text-xs">{profile.id}</span>
            </ProfileField>
            <ProfileField label="Created">{formatDateTime(profile.createdAt)}</ProfileField>
            <ProfileField label="Last sign-in">{formatDateTime(profile.lastSignInAt)}</ProfileField>
            <ProfileField label="Role">{profile.isAdmin ? 'Admin' : 'Member'}</ProfileField>
            <ProfileField label="App metadata">{profile.appMetadata ? `${Object.keys(profile.appMetadata).length} keys` : 'None'}</ProfileField>
          </dl>
          <div className="space-y-3">
            <MetadataPanel label="User metadata" value={profile.userMetadata} />
            <MetadataPanel label="App metadata" value={profile.appMetadata} />
          </div>
        </div>
      ) : (
        <AdminEmptyState>Profile metadata is unavailable for this user.</AdminEmptyState>
      )}
    </AdminSection>
  );
}

function ProfileField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[0.25em] text-text-muted">{label}</dt>
      <dd className="mt-1 text-sm text-text-primary">{children}</dd>
    </div>
  );
}

function MetadataPanel({
  label,
  value,
}: {
  label: string;
  value: Record<string, unknown> | null;
}) {
  const hasValue = Boolean(value && Object.keys(value).length);

  return (
    <details className="rounded-2xl border border-hairline bg-bg/40 px-4 py-3" open={!hasValue}>
      <summary className="cursor-pointer list-none text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
        {label}
      </summary>
      {hasValue ? (
        <pre className="mt-3 max-h-44 overflow-auto text-[11px] leading-5 text-text-secondary">{JSON.stringify(value, null, 2)}</pre>
      ) : (
        <p className="mt-3 text-sm text-text-secondary">No metadata captured.</p>
      )}
    </details>
  );
}
