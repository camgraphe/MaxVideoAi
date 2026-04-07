import type { ReactNode } from 'react';
import Link from 'next/link';
import { fetchAdminHealth } from '@/server/admin-metrics';
import type { AdminHealthSnapshot } from '@/lib/admin/types';
import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import { Button, ButtonLink } from '@/components/ui/Button';

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
        title: 'Video SEO watch pages',
        description: 'Inspect the curated /video rollout, public links, and runtime blockers before pushing pages to Google.',
        href: '/admin/video-seo',
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
      {
        title: 'Theme tokens',
        description: 'Adjust global UI colors, radius, spacing, and shadows.',
        href: '/admin/theme',
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
    <>
      <AdminPageHeader
        eyebrow="Hub & Health"
        title="Admin Dashboard"
        description="Single entry point for analytics, support tooling, curation, and compliance workflows."
        actions={
          <>
            <ButtonLink href="/admin/insights" variant="outline" size="sm" className="border-surface-on-media-25">
              Insights
            </ButtonLink>
            <ButtonLink href="/admin/jobs" variant="outline" size="sm" className="border-surface-on-media-25">
              Jobs
            </ButtonLink>
            <ButtonLink href="/admin/users" variant="outline" size="sm" className="border-surface-on-media-25">
              Users
            </ButtonLink>
          </>
        }
      />

      <AdminSection
        title="Live Operations"
        description="Incident and health signals for the last 24 hours, kept immediately actionable."
      >
        <HealthStrip health={health} />
      </AdminSection>

      <AdminSection
        title="Quick Tools"
        description="Direct jumps into the most common support and investigation flows."
      >
        <QuickTools />
      </AdminSection>

      {SECTION_GROUPS.map((group) => (
        <AdminSection
          key={group.title}
          title={group.title}
          description="Core admin surfaces grouped by operating domain."
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-xl border border-surface-on-media-25 bg-bg/50 px-4 py-4 transition hover:border-text-muted hover:bg-bg"
              >
                <h3 className="text-base font-semibold text-text-primary">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-text-secondary">{item.description}</p>
              </Link>
            ))}
          </div>
        </AdminSection>
      ))}
    </>
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
                  href={buildJobsHref({ outcome: 'failed_action_required', engineId: stat.engineId })}
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
    <div className="grid gap-px overflow-hidden rounded-xl border border-surface-on-media-25 bg-surface-on-media-25 md:grid-cols-2 xl:grid-cols-5">
      <HealthTile
        label="Engine signals"
        value={atRisk.length ? `${atRisk.length} incident${atRisk.length > 1 ? 's' : ''}` : 'All clear'}
        helper={engineHelper}
        variant={atRisk.length ? 'warn' : 'ok'}
      />
      <HealthTile
        label="Failed unresolved (24h)"
        value={formatNumber(health.failedRenders24h)}
        helper="Failed jobs without refund resolution"
        variant={health.failedRenders24h > 0 ? 'warn' : 'ok'}
        href={buildJobsHref({ outcome: 'failed_action_required' })}
      />
      <HealthTile
        label="Refunded failures (24h)"
        value={formatNumber(health.refundedFailures24h)}
        helper="Failed jobs already refunded"
        variant={health.refundedFailures24h > 0 ? 'info' : 'ok'}
        href={buildJobsHref({ outcome: 'refunded_failure_resolved' })}
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
  variant?: 'ok' | 'warn' | 'info';
  href?: string;
}) {
  const intentClasses =
    variant === 'warn' ? 'text-error' : variant === 'info' ? 'text-info' : 'text-text-primary';
  const baseClasses = 'block bg-surface px-4 py-4';
  const interactiveClasses = href
    ? 'transition hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
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

function QuickTools() {
  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_280px]">
      <form action="/admin/users" method="get" className="flex flex-col gap-3 rounded-xl border border-surface-on-media-25 bg-bg/60 p-4">
        <div>
          <label htmlFor="quick-user" className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-muted">
            Find user
          </label>
          <p className="mt-1 text-sm text-text-secondary">Open a member record directly from email or Supabase ID.</p>
        </div>
        <input
          id="quick-user"
          name="search"
          type="text"
          placeholder="Email or Supabase user ID"
          className="rounded-lg border border-surface-on-media-25 bg-surface px-3 py-2 text-sm text-text-primary focus:border-text-muted focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <Button type="submit" size="sm" className="w-fit rounded-lg px-4">
          Search user
        </Button>
      </form>

      <form action="/admin/jobs" method="get" className="flex flex-col gap-3 rounded-xl border border-surface-on-media-25 bg-bg/60 p-4">
        <div>
          <label htmlFor="quick-job" className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-muted">
            Find render job
          </label>
          <p className="mt-1 text-sm text-text-secondary">Jump straight to a job using the local job id or Fal request id.</p>
        </div>
        <input
          id="quick-job"
          name="jobId"
          type="text"
          placeholder="Job id or Fal request id"
          className="rounded-lg border border-surface-on-media-25 bg-surface px-3 py-2 text-sm text-text-primary focus:border-text-muted focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <Button type="submit" size="sm" className="w-fit rounded-lg px-4">
          Search job
        </Button>
      </form>

      <div className="rounded-xl border border-surface-on-media-25 bg-bg/60 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-muted">Fast links</p>
        <div className="mt-3 flex flex-col gap-2">
          <ButtonLink href="/admin/insights" variant="outline" size="sm" className="justify-start border-surface-on-media-25">
            Analytics
          </ButtonLink>
          <ButtonLink href="/admin/engines" variant="outline" size="sm" className="justify-start border-surface-on-media-25">
            Engines
          </ButtonLink>
          <ButtonLink href="/admin/system" variant="outline" size="sm" className="justify-start border-surface-on-media-25">
            Service notice
          </ButtonLink>
        </div>
      </div>
    </div>
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

function buildJobsHref(filters: { status?: string; outcome?: string; engineId?: string }) {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.outcome) params.set('outcome', filters.outcome);
  if (filters.engineId) params.set('engineId', filters.engineId);
  const query = params.toString();
  return query.length ? `/admin/jobs?${query}` : '/admin/jobs';
}
