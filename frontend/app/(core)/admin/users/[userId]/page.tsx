import Link from 'next/link';
import { notFound } from 'next/navigation';
import { fetchAdminUserOverview } from '@/server/admin-users';
import { ManualCreditForm } from '@/components/admin/ManualCreditForm';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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

  return (
    <div className="space-y-8">
      <Link href="/admin/users" className="text-sm text-text-secondary transition hover:text-text-primary">
        ← Back to users
      </Link>

      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.4em] text-text-muted">User overview</p>
        <h1 className="text-3xl font-semibold text-text-primary">{profile?.email ?? 'Unknown email'}</h1>
        <p className="text-sm text-text-secondary">
          {profile ? 'Supabase user ' : 'Supabase service role missing · user ID '}
          <span className="font-mono text-xs">{userId}</span>
        </p>
      </header>

      <section className="rounded-[28px] border border-border/70 bg-white/95 p-5 shadow-card">
        <h2 className="text-sm font-semibold uppercase tracking-[0.35em] text-text-muted">Profile</h2>
        {profile ? (
          <dl className="mt-4 grid gap-4 md:grid-cols-2">
            <ProfileField label="Email">{profile.email ?? '—'}</ProfileField>
            <ProfileField label="User ID">{profile.id}</ProfileField>
            <ProfileField label="Created">{formatDate(profile.createdAt)}</ProfileField>
            <ProfileField label="Last sign-in">{formatDate(profile.lastSignInAt)}</ProfileField>
            <ProfileField label="Role">{profile.isAdmin ? 'Admin' : 'Member'}</ProfileField>
            <ProfileField label="Metadata">
              <pre className="overflow-auto rounded-lg bg-bg px-3 py-2 text-xs text-text-secondary">
                {JSON.stringify(profile.userMetadata ?? {}, null, 2)}
              </pre>
            </ProfileField>
          </dl>
        ) : (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
            Supabase service role key is not configured. Add <code className="font-mono text-xs">SUPABASE_SERVICE_ROLE_KEY</code> to
            fetch profile metadata and enable impersonation.
          </p>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total renders" value={formatNumber(usage?.totalRenders ?? 0)} helper="Lifetime completed jobs" />
        <StatCard label="Renders (30d)" value={formatNumber(usage?.renders30d ?? 0)} helper="Completed in last 30 days" />
        <StatCard label="Wallet balance" value={wallet ? formatCurrency(wallet.balanceCents / 100) : '—'} helper="Stored credits" />
        <StatCard
          label="Lifetime top-ups"
          value={formatCurrency(lifetimeTopupsUsd)}
          helper={`Charges: ${formatCurrency(lifetimeChargesUsd)}`}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        {wallet ? <ManualCreditForm userId={userId} /> : null}
        <ImpersonationCard userId={userId} profile={profile} serviceRoleConfigured={overview.serviceRoleConfigured} />
      </section>

      <section className="rounded-[28px] border border-border/70 bg-white/95 p-5 shadow-card">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-text-muted">Engine usage</p>
            <p className="text-sm text-text-secondary">Lifetime completed renders &amp; spend per engine.</p>
          </div>
        </header>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-[0.2em] text-text-muted">
                <th className="py-2 font-semibold">Engine</th>
                <th className="py-2 font-semibold">Renders</th>
                <th className="py-2 font-semibold">Spend</th>
              </tr>
            </thead>
            <tbody>
              {usage?.engineBreakdown.length ? (
                usage.engineBreakdown.map((engine) => (
                  <tr key={engine.engineLabel} className="border-t border-border/40 text-text-secondary">
                    <td className="py-2 font-semibold text-text-primary">{engine.engineLabel}</td>
                    <td className="py-2">{formatNumber(engine.renderCount)}</td>
                    <td className="py-2">{formatCurrency(engine.spendUsd)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="py-3 text-center text-sm text-text-secondary">
                    No renders recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-[28px] border border-border/70 bg-white/95 p-5 shadow-card">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-text-muted">Recent jobs</p>
            <p className="text-sm text-text-secondary">Newest 10 renders for investigation.</p>
          </div>
        </header>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-[0.2em] text-text-muted">
                <th className="py-2 font-semibold">Job</th>
                <th className="py-2 font-semibold">Created</th>
                <th className="py-2 font-semibold">Engine</th>
                <th className="py-2 font-semibold">Status</th>
                <th className="py-2 font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {usage?.recentJobs.length ? (
                usage.recentJobs.map((job) => (
                  <tr key={job.jobId} className="border-t border-border/40 text-text-secondary">
                    <td className="py-2 font-mono text-xs">
                      <Link className="text-accent underline-offset-2 hover:underline" href={`/admin/jobs?jobId=${job.jobId}`}>
                        {job.jobId}
                      </Link>
                    </td>
                    <td className="py-2">{formatDate(job.createdAt)}</td>
                    <td className="py-2">{job.engineLabel}</td>
                    <td className="py-2 capitalize">{job.status ?? '—'}</td>
                    <td className="py-2">{formatCurrency(job.amountUsd)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-3 text-center text-sm text-text-secondary">
                    No jobs recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-[28px] border border-border/70 bg-white/95 p-5 shadow-card">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-text-muted">Top-ups</p>
            <p className="text-sm text-text-secondary">Last 20 wallet loads for this workspace.</p>
          </div>
        </header>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-[0.2em] text-text-muted">
                <th className="py-2 font-semibold">Date</th>
                <th className="py-2 font-semibold">Amount</th>
                <th className="py-2 font-semibold">Description</th>
                <th className="py-2 font-semibold">Stripe ref</th>
              </tr>
            </thead>
            <tbody>
              {overview.topups.length ? (
                overview.topups.map((topup) => (
                  <tr key={topup.id} className="border-t border-border/40 text-text-secondary">
                    <td className="py-2">{formatDate(topup.createdAt)}</td>
                    <td className="py-2 font-semibold text-text-primary">
                      {formatCurrency(topup.amountUsd)} {topup.currency}
                    </td>
                    <td className="py-2">{topup.description ?? '—'}</td>
                    <td className="py-2 text-xs font-mono">
                      {topup.stripePaymentIntentId ?? topup.stripeChargeId ?? '—'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-3 text-center text-sm text-text-secondary">
                    No top-ups recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ProfileField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[0.25em] text-text-muted">{label}</dt>
      <dd className="mt-1 text-sm text-text-primary">{children}</dd>
    </div>
  );
}

function StatCard({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-white px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-text-primary">{value}</p>
      {helper ? <p className="text-xs text-text-secondary">{helper}</p> : null}
    </div>
  );
}

function ImpersonationCard({
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
    <div className="space-y-3 rounded-2xl border border-border/70 bg-white p-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-text-muted">Impersonation</p>
        <p className="text-sm text-text-secondary">
          Sign into the workspace as this user to debug renders, wallet issues, or onboarding flow. Your admin session is preserved and can be restored at any time.
        </p>
      </div>
      {disabled ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {serviceRoleConfigured
            ? 'This user record has no email associated with it.'
            : 'Supabase service role key missing — impersonation requires service role access.'}
        </p>
      ) : null}
      <form action="/api/admin/impersonate" method="post" className="space-y-2">
        <input type="hidden" name="userId" value={userId} />
        <input type="hidden" name="redirectTo" value="/app" />
        <input type="hidden" name="returnTo" value={`/admin/users/${userId}`} />
        <button
          type="submit"
          disabled={disabled}
          className="inline-flex items-center rounded-full bg-text-primary px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white disabled:opacity-50"
        >
          View workspace as this user
        </button>
      </form>
      {profile?.isAdmin ? (
        <p className="text-xs text-rose-600">
          This account is an admin. Impersonating another admin will inherit their permissions; exit immediately after debugging.
        </p>
      ) : null}
    </div>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(value);
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}
