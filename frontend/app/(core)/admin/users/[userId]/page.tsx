import type { ReactNode } from 'react';
import Link from 'next/link';
import { BadgeDollarSign, Clock3, History, Layers3, ShieldCheck, UserRound, Wallet } from 'lucide-react';
import { notFound } from 'next/navigation';
import { fetchAdminUserOverview } from '@/server/admin-users';
import { ManualCreditForm } from '@/components/admin/ManualCreditForm';
import { AdminEmptyState } from '@/components/admin-system/feedback/AdminEmptyState';
import { AdminNotice } from '@/components/admin-system/feedback/AdminNotice';
import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import { AdminSectionMeta } from '@/components/admin-system/shell/AdminSectionMeta';
import { AdminDataTable } from '@/components/admin-system/surfaces/AdminDataTable';
import { type AdminMetricItem, AdminMetricGrid } from '@/components/admin-system/surfaces/AdminMetricGrid';
import { AdminActionLink } from '@/components/admin-system/shell/AdminActionLink';
import { Button } from '@/components/ui/Button';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const numberFormatter = new Intl.NumberFormat('en-US');
const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const dateTimeFormatter = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' });
const shortDateFormatter = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' });

export default async function AdminUserDetailPage({ params }: { params: { userId: string } }) {
  const userId = params.userId?.trim();
  if (!userId) {
    notFound();
  }

  const overview = await fetchAdminUserOverview(userId);

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

          <AdminSection
            title="Usage & Spend"
            description="Derniers rendus et répartition par engine pour comprendre rapidement où part la dépense."
            action={
              usage ? (
                <AdminSectionMeta
                  title={`${formatNumber(usage.totalRenders)} completed renders`}
                  lines={[`30d ${formatNumber(usage.renders30d)}`, `${usage.engineBreakdown.length} engines touched`]}
                />
              ) : undefined
            }
          >
            {usage ? (
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_340px]">
                <AdminDataTable>
                  <thead className="bg-surface">
                    <tr className="text-[11px] uppercase tracking-[0.18em] text-text-muted">
                      <th className="px-4 py-3 font-semibold">Job</th>
                      <th className="px-4 py-3 font-semibold">Created</th>
                      <th className="px-4 py-3 font-semibold">Engine</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline bg-bg/30">
                    {usage.recentJobs.length ? (
                      usage.recentJobs.map((job) => (
                        <tr key={job.jobId} className="text-text-secondary">
                          <td className="px-4 py-3">
                            <Link className="font-mono text-xs text-text-primary underline-offset-2 hover:underline" href={`/admin/jobs?jobId=${job.jobId}`}>
                              {job.jobId}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-xs">{formatDateTime(job.createdAt)}</td>
                          <td className="px-4 py-3">{job.engineLabel}</td>
                          <td className="px-4 py-3">
                            <JobStatusBadge status={job.status} />
                          </td>
                          <td className="px-4 py-3 font-medium text-text-primary">{formatCurrency(job.amountUsd)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-4 py-6">
                          <AdminEmptyState>No jobs recorded yet.</AdminEmptyState>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </AdminDataTable>

                <div className="overflow-hidden rounded-2xl border border-hairline bg-bg/40">
                  <div className="border-b border-hairline px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Engine mix</p>
                    <p className="mt-1 text-sm text-text-secondary">Lifetime completed renders and spend by provider.</p>
                  </div>
                  {usage.engineBreakdown.length ? (
                    <div className="divide-y divide-hairline">
                      {usage.engineBreakdown.map((engine) => (
                        <div key={engine.engineLabel} className="flex items-start justify-between gap-3 px-4 py-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-text-primary">{engine.engineLabel}</p>
                            <p className="mt-1 text-xs text-text-secondary">{formatNumber(engine.renderCount)} renders</p>
                          </div>
                          <p className="shrink-0 text-sm font-medium text-text-primary">{formatCurrency(engine.spendUsd)}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 py-6">
                      <AdminEmptyState>No engine usage recorded yet.</AdminEmptyState>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <AdminEmptyState>Render and spend aggregates are unavailable.</AdminEmptyState>
            )}
          </AdminSection>

          <AdminSection
            title="Wallet Ledger"
            description="Historique des top-ups appliqués à ce membre. Conserve la lecture transactionnelle, sans noyer le support dans des cartes."
            action={
              wallet ? (
                <AdminSectionMeta
                  title={formatCurrency(lifetimeTopupsUsd)}
                  lines={[`Charges ${formatCurrency(lifetimeChargesUsd)}`, `${overview.topups.length} recent top-ups`]}
                />
              ) : undefined
            }
          >
            {overview.topups.length ? (
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
                  {overview.topups.map((topup) => (
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
        </div>

        <div className="xl:sticky xl:top-[5.75rem]">
          <AdminSection title="Support Actions" description="Opérations directes pour corriger un wallet ou reproduire l’expérience membre.">
            <div className="space-y-5">
              {wallet ? (
                <ManualCreditForm userId={userId} embedded />
              ) : (
                <AdminNotice tone="info">Wallet controls are unavailable because Postgres aggregates could not be loaded.</AdminNotice>
              )}

              <div className="border-t border-hairline pt-5">
                <ImpersonationPanel userId={userId} profile={profile} serviceRoleConfigured={overview.serviceRoleConfigured} />
              </div>
            </div>
          </AdminSection>
        </div>
      </div>
    </div>
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

function ImpersonationPanel({
  userId,
  profile,
  serviceRoleConfigured,
}: {
  userId: string;
  profile: Awaited<ReturnType<typeof fetchAdminUserOverview>>['profile'];
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

function buildMemberPulseItems({
  userId,
  profile,
  wallet,
  usage,
  lifetimeTopupsUsd,
  lifetimeChargesUsd,
}: {
  userId: string;
  profile: Awaited<ReturnType<typeof fetchAdminUserOverview>>['profile'];
  wallet: Awaited<ReturnType<typeof fetchAdminUserOverview>>['wallet'];
  usage: Awaited<ReturnType<typeof fetchAdminUserOverview>>['usage'];
  lifetimeTopupsUsd: number;
  lifetimeChargesUsd: number;
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
      helper: wallet ? `Charges ${formatCurrency(lifetimeChargesUsd)}` : 'No receipt aggregate',
      icon: BadgeDollarSign,
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

function JobStatusBadge({ status }: { status: string | null }) {
  const normalized = (status ?? 'unknown').toLowerCase();
  const toneClass =
    normalized === 'completed'
      ? 'border-success-border bg-success-bg text-success'
      : normalized === 'failed'
        ? 'border-error-border bg-error-bg text-error'
        : normalized === 'running' || normalized === 'pending'
          ? 'border-warning-border bg-warning-bg text-warning'
          : 'border-border bg-surface text-text-secondary';

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${toneClass}`}>
      {normalized}
    </span>
  );
}

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function formatCurrency(amount: number) {
  return currencyFormatter.format(amount);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return dateTimeFormatter.format(date);
}

function formatShortDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return shortDateFormatter.format(date);
}

function truncateId(value: string) {
  if (value.length <= 16) return value;
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}
