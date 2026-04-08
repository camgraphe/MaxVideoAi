import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, AudioWaveform, BellRing, BriefcaseBusiness, CircleAlert, Cpu, ExternalLink, ShieldCheck, Users } from 'lucide-react';
import { fetchAdminHealth } from '@/server/admin-metrics';
import type { AdminHealthSnapshot } from '@/lib/admin/types';
import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import { AdminWatchlistCard } from '@/components/admin-system/surfaces/AdminWatchlistCard';
import { AdminActionLink } from '@/components/admin-system/shell/AdminActionLink';
import { Button } from '@/components/ui/Button';

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
  const atRisk = health.engineStats.filter((stat) => stat.failureRate >= 0.15 && stat.failedCount >= 3);

  return (
    <>
      <AdminPageHeader
        eyebrow="Admin System"
        title="Operations control"
        description="Pilotage central des incidents, outils de support, surfaces éditoriales et workflows de conformité."
        actions={
          <>
            <AdminActionLink href="/admin/insights">
              Insights
            </AdminActionLink>
            <AdminActionLink href="/admin/jobs">
              Jobs
            </AdminActionLink>
            <AdminActionLink href="/admin/users">
              Users
            </AdminActionLink>
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_360px] xl:items-start">
        <div className="space-y-5">
          <AdminSection
            title="Signal Board"
            description="Lecture immédiate des incidents et métriques critiques sur les dernières 24 heures."
            contentClassName="p-0"
          >
            <HealthStrip health={health} />
          </AdminSection>

          <AdminSection
            title="Current Watchlist"
            description="Résumé opérationnel sur les surfaces qui ont le plus de probabilité de nécessiter une intervention humaine."
          >
            <div className="grid gap-4 lg:grid-cols-3">
              <AdminWatchlistCard
                icon={CircleAlert}
                title="Engines at risk"
                value={atRisk.length ? `${atRisk.length} engines` : 'No engine risk'}
                description={
                  atRisk.length === 0
                    ? 'Aucun moteur ne dépasse le seuil d’alerte actuellement.'
                    : atRisk
                        .slice(0, 3)
                        .map((stat) => `${stat.engineLabel} (${formatPercent(stat.failureRate)})`)
                        .join(', ')
                }
                href={buildJobsHref({ outcome: 'failed_action_required' })}
                footer={
                  <span className="inline-flex items-center gap-2">
                    Open surface
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                  </span>
                }
              />
              <AdminWatchlistCard
                icon={BellRing}
                title="Service notice"
                value={health.serviceNotice.active ? 'Banner active' : 'No banner'}
                description={
                  health.serviceNotice.active
                    ? health.serviceNotice.message ?? 'Un message incident est actuellement visible côté produit.'
                    : 'Aucun bandeau d’incident n’est affiché pour les membres.'
                }
                href="/admin/system"
                footer={
                  <span className="inline-flex items-center gap-2">
                    Open surface
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                  </span>
                }
              />
              <AdminWatchlistCard
                icon={ShieldCheck}
                title="Support coverage"
                value={`${formatNumber(health.failedRenders24h + health.stalePendingJobs)} open items`}
                description="Combine échecs non résolus et jobs encore bloqués dans la file pending."
                href="/admin/jobs"
                footer={
                  <span className="inline-flex items-center gap-2">
                    Open surface
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                  </span>
                }
              />
            </div>
          </AdminSection>
        </div>

        <div className="xl:sticky xl:top-[5.75rem]">
          <AdminSection
            title="Triage"
            description="Entrées rapides vers les recherches et files qui demandent une action."
            contentClassName="p-0"
          >
            <QuickTools health={health} />
          </AdminSection>
        </div>
      </div>

      <AdminSection
        title="Operating Areas"
        description="Surfaces admin regroupées par domaine, avec un routage plus lisible que la grille de cartes précédente."
      >
        <div className="grid gap-8 xl:grid-cols-3">
          {SECTION_GROUPS.map((group) => (
            <section key={group.title} className="min-w-0">
              <div className="flex items-end justify-between gap-3 border-b border-hairline pb-3">
                <div>
                  <h2 className="text-sm font-semibold text-text-primary">{group.title}</h2>
                  <p className="mt-1 text-xs text-text-secondary">{group.items.length} admin surfaces</p>
                </div>
              </div>
              <div className="divide-y divide-hairline">
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group flex items-start justify-between gap-4 py-3 transition hover:bg-surface-hover/60"
                  >
                    <div className="min-w-0">
                      <h3 className="text-sm font-medium text-text-primary transition group-hover:text-brand">{item.title}</h3>
                      <p className="mt-1 text-sm leading-6 text-text-secondary">{item.description}</p>
                    </div>
                    <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-text-muted transition group-hover:translate-x-0.5 group-hover:text-brand" />
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </AdminSection>

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
    <div className="grid divide-y divide-hairline md:grid-cols-2 md:divide-x md:[&>*:nth-child(2n+1)]:border-r-0 xl:grid-cols-5 xl:divide-x xl:divide-y-0">
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
  const toneClasses =
    variant === 'warn'
      ? 'bg-error'
      : variant === 'info'
        ? 'bg-info'
        : 'bg-emerald-500';
  const intentClasses = variant === 'warn' ? 'text-error' : variant === 'info' ? 'text-info' : 'text-text-primary';
  const baseClasses = 'block bg-transparent px-5 py-4';
  const interactiveClasses = href
    ? 'transition hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
    : '';
  const content = (
    <>
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${toneClasses}`} aria-hidden />
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">{label}</p>
      </div>
      <p className={`mt-3 text-2xl font-semibold ${intentClasses}`}>{value}</p>
      {helper ? <p className="mt-2 text-xs leading-5 text-text-secondary">{helper}</p> : null}
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

function QuickTools({ health }: { health: AdminHealthSnapshot }) {
  return (
    <div className="divide-y divide-hairline">
      <QuickSearchForm
        action="/admin/users"
        id="quick-user"
        label="Find user"
        description="Open a member record from email or Supabase ID."
        name="search"
        placeholder="Email or Supabase user ID"
        cta="Open user"
      />
      <QuickSearchForm
        action="/admin/jobs"
        id="quick-job"
        label="Find render job"
        description="Jump straight to a job using the local job id or Fal request id."
        name="jobId"
        placeholder="Job id or Fal request id"
        cta="Open job"
      />
      <div className="space-y-3 px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Queues</p>
            <p className="mt-1 text-sm text-text-secondary">Liens directs vers les surfaces à surveiller en premier.</p>
          </div>
        </div>
        <div className="space-y-2">
          <TriageLink
            href="/admin/insights"
            icon={AudioWaveform}
            label="Insights"
            meta="Metrics and financial pulse"
          />
          <TriageLink
            href="/admin/engines"
            icon={Cpu}
            label="Engines"
            meta={`${formatNumber(health.engineStats.length)} integrations tracked`}
          />
          <TriageLink
            href="/admin/jobs?outcome=failed_action_required"
            icon={CircleAlert}
            label="Failed jobs"
            meta={`${formatNumber(health.failedRenders24h)} unresolved over 24h`}
          />
          <TriageLink
            href="/admin/users"
            icon={Users}
            label="Users"
            meta="Support and impersonation flows"
          />
          <TriageLink
            href="/admin/system"
            icon={BriefcaseBusiness}
            label="Service notice"
            meta={health.serviceNotice.active ? 'Banner currently enabled' : 'No active banner'}
          />
        </div>
      </div>
    </div>
  );
}

function QuickSearchForm({
  action,
  id,
  label,
  description,
  name,
  placeholder,
  cta,
}: {
  action: string;
  id: string;
  label: string;
  description: string;
  name: string;
  placeholder: string;
  cta: string;
}) {
  return (
    <form action={action} method="get" className="space-y-3 px-5 py-4">
      <div>
        <label htmlFor={id} className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
          {label}
        </label>
        <p className="mt-1 text-sm text-text-secondary">{description}</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={id}
          name={name}
          type="text"
          placeholder={placeholder}
          className="min-h-[40px] flex-1 rounded-xl border border-border bg-bg px-3 text-sm text-text-primary focus:border-border-hover focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <Button type="submit" size="sm" className="rounded-xl px-4">
          {cta}
        </Button>
      </div>
    </form>
  );
}

function TriageLink({
  href,
  icon: Icon,
  label,
  meta,
}: {
  href: string;
  icon: typeof AudioWaveform;
  label: string;
  meta: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between gap-3 rounded-xl border border-transparent px-3 py-2 transition hover:border-hairline hover:bg-surface-hover"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-white">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-text-primary">{label}</p>
          <p className="truncate text-xs text-text-secondary">{meta}</p>
        </div>
      </div>
      <ExternalLink className="h-4 w-4 shrink-0 text-text-muted transition group-hover:text-text-primary" />
    </Link>
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
