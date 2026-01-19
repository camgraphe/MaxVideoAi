import type { ReactNode } from 'react';
import Link from 'next/link';
import { fetchAdminHealth } from '@/server/admin-metrics';
import type { AdminHealthSnapshot } from '@/lib/admin/types';

export const dynamic = 'force-dynamic';

const SECTION_GROUPS: Array<{
  title: string;
  items: Array<{ title: string; description: string; href: string }>;
}> = [
  {
    title: 'Curation',
    items: [
      {
        title: 'Moderation queue',
        description: 'Review pending uploads, visibility flags, and indexation decisions.',
        href: '/admin/moderation',
      },
      {
        title: 'Playlists',
        description: 'Curate Starter and thematic collections surfaced in Gallery.',
        href: '/admin/playlists',
      },
      {
        title: 'Homepage programming',
        description: 'Schedule hero creatives and featured rails for the marketing homepage.',
        href: '/admin/home',
      },
    ],
  },
  {
    title: 'Operations',
    items: [
      {
        title: 'Users',
        description: 'Search, audit, and manage workspace members and permissions.',
        href: '/admin/users',
      },
      {
        title: 'Engines',
        description: 'Tune routing, pricing, and availability for model integrations.',
        href: '/admin/engines',
      },
      {
        title: 'Pricing rules',
        description: 'Manage margins, discounts, FX overrides, and membership tiers.',
        href: '/admin/pricing',
      },
      {
        title: 'Job audit',
        description: 'Verify recent renders for media availability, costs, and Fal sync.',
        href: '/admin/jobs',
      },
      {
        title: 'Transactions',
        description: 'Inspect charges and refunds, issue manual wallet credits.',
        href: '/admin/transactions',
      },
      {
        title: 'Audit log',
        description: 'Review impersonations, resyncs, and sensitive admin actions.',
        href: '/admin/audit',
      },
      {
        title: 'Service notice',
        description: 'Broadcast dashboard banners during supplier incidents.',
        href: '/admin/system',
      },
    ],
  },
  {
    title: 'Compliance',
    items: [
      {
        title: 'Legal center',
        description: 'Update terms, privacy, and cookie policies and trigger re-consent.',
        href: '/admin/legal',
      },
      {
        title: 'Marketing opt-ins',
        description: 'See how many members accepted promotional email updates and export their emails.',
        href: '/admin/marketing',
      },
      {
        title: 'Consent exports',
        description: 'Download CSV proofs of user consents for regulatory reporting.',
        href: '/admin/consents.csv',
      },
    ],
  },
];

const numberFormatter = new Intl.NumberFormat('en-US');
const percentFormatter = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 1 });

export default async function AdminIndexPage() {
  const health = await fetchAdminHealth();
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.4em] text-text-muted">Hub &amp; Health</p>
        <h1 className="text-3xl font-semibold text-text-primary">Admin dashboard</h1>
        <p className="text-sm text-text-secondary">
          Single entry point for analytics, support tooling, curation, and compliance workflows.
        </p>
      </header>

      <HealthStrip health={health} />
      <QuickToolsCard />

      {SECTION_GROUPS.map((group) => (
        <section key={group.title} className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-micro text-text-muted">{group.title}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-card border border-border bg-white p-6 shadow-card transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <h3 className="text-lg font-semibold text-text-primary">{item.title}</h3>
                <p className="mt-2 text-sm text-text-secondary">{item.description}</p>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function HealthStrip({ health }: { health: AdminHealthSnapshot }) {
  const atRisk = health.engineStats.filter((stat) => stat.failureRate >= 0.15 && stat.failedCount >= 3);
  const engineHelper: ReactNode =
    atRisk.length === 0
      ? 'No elevated failure rates detected in the past 24h.'
      : (
          <>
            {atRisk.slice(0, 3).map((stat, index) => (
              <span key={stat.engineId}>
                {index > 0 ? ', ' : null}
                <Link
                  href={buildJobsHref({ status: 'failed', engineId: stat.engineId })}
                  className="font-medium text-text-primary underline-offset-2 hover:underline"
                >
                  {stat.engineLabel}
                </Link>{' '}
                <span className="text-text-muted">({formatPercent(stat.failureRate)})</span>
              </span>
            ))}
            {atRisk.length > 3 ? ` +${atRisk.length - 3} more` : null}
          </>
        );

  return (
    <section className="rounded-[32px] border border-border/80 bg-white/95 p-5 shadow-card">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <HealthTile
          label="Engine signals"
          value={atRisk.length ? `${atRisk.length} incident${atRisk.length > 1 ? 's' : ''}` : 'All clear'}
          helper={engineHelper}
          variant={atRisk.length ? 'warn' : 'ok'}
        />
        <HealthTile
          label="Failed renders (24h)"
          value={formatNumber(health.failedRenders24h)}
          helper="Aggregated across all engines"
          variant={health.failedRenders24h > 0 ? 'warn' : 'ok'}
          href={buildJobsHref({ status: 'failed' })}
        />
        <HealthTile
          label="Pending jobs (stuck)"
          value={formatNumber(health.stalePendingJobs)}
          helper="Status = pending for 15+ minutes"
          variant={health.stalePendingJobs > 0 ? 'warn' : 'ok'}
          href={buildJobsHref({ status: 'pending' })}
        />
        <HealthTile
          label="Service notice"
          value={health.serviceNotice.active ? 'Active' : 'Clear'}
          helper={
            health.serviceNotice.active
              ? health.serviceNotice.message ?? 'Broadcast currently enabled'
              : 'Members do not see any incident banner.'
          }
          variant={health.serviceNotice.active ? 'warn' : 'ok'}
        />
      </div>
    </section>
  );
}

function HealthTile({
  label,
  value,
  helper,
  variant = 'ok',
  href,
}: {
  label: string;
  value: string;
  helper?: ReactNode;
  variant?: 'ok' | 'warn';
  href?: string;
}) {
  const intentClasses = variant === 'warn' ? 'text-rose-600' : 'text-text-primary';
  const baseClasses = 'block rounded-2xl border border-border/70 bg-white px-5 py-4';
  const interactiveClasses = href
    ? 'transition hover:-translate-y-0.5 hover:border-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
    : '';
  const content = (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-text-muted">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${intentClasses}`}>{value}</p>
      {helper ? <p className="mt-1 text-xs text-text-secondary">{helper}</p> : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={`${baseClasses} ${interactiveClasses}`}>
        {content}
      </Link>
    );
  }

  return <div className={baseClasses}>{content}</div>;
}

function QuickToolsCard() {
  return (
    <section className="rounded-[28px] border border-border/70 bg-white/95 p-5 shadow-card">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-text-muted">Admin quick tools</p>
        <p className="text-sm text-text-secondary">Jump to common support flows without loading the full modules first.</p>
      </header>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <form action="/admin/users" method="get" className="flex flex-col gap-2 rounded-2xl border border-border/70 bg-bg p-4">
          <label htmlFor="quick-user" className="text-xs font-semibold uppercase tracking-[0.25em] text-text-muted">
            Find user
          </label>
          <input
            id="quick-user"
            name="search"
            type="text"
            placeholder="Email or Supabase user ID"
            className="rounded-lg border border-border/60 bg-white px-3 py-2 text-sm text-text-primary focus:border-text-muted focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-full bg-text-primary px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white"
          >
            Search
          </button>
        </form>

        <form action="/admin/jobs" method="get" className="flex flex-col gap-2 rounded-2xl border border-border/70 bg-bg p-4">
          <label htmlFor="quick-job" className="text-xs font-semibold uppercase tracking-[0.25em] text-text-muted">
            Find render job
          </label>
          <input
            id="quick-job"
            name="jobId"
            type="text"
            placeholder="Job id or Fal request id"
            className="rounded-lg border border-border/60 bg-white px-3 py-2 text-sm text-text-primary focus:border-text-muted focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-full bg-text-primary px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white"
          >
            Search
          </button>
        </form>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          href="/admin/insights"
          className="inline-flex items-center rounded-full border border-border/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-text-secondary transition hover:bg-bg"
        >
          Go to analytics
        </Link>
        <Link
          href="/admin/engines"
          className="inline-flex items-center rounded-full border border-border/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-text-secondary transition hover:bg-bg"
        >
          Engine performance
        </Link>
        <Link
          href="/admin/system"
          className="inline-flex items-center rounded-full border border-border/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-text-secondary transition hover:bg-bg"
        >
          Service notice
        </Link>
      </div>
    </section>
  );
}

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) {
    return '0%';
  }
  return percentFormatter.format(value);
}

function buildJobsHref(filters: { status?: string; engineId?: string }) {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.engineId) params.set('engineId', filters.engineId);
  const query = params.toString();
  return query.length ? `/admin/jobs?${query}` : '/admin/jobs';
}
