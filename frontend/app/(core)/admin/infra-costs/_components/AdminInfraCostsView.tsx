import type { ReactNode } from 'react';
import {
  BadgeDollarSign,
  BellRing,
  Database,
  GitBranch,
  Network,
  Receipt,
  Server,
  ShieldAlert,
  TrendingUp,
} from 'lucide-react';
import type { AdminAuditLog } from '@/server/admin-audit';
import type {
  InfraCostAlert,
  InfraCostsReport,
  NeonInfraCostDetails,
  VercelInfraCostDetails,
} from '@/server/infra-costs';
import { AdminEmptyState } from '@/components/admin-system/feedback/AdminEmptyState';
import { AdminNotice } from '@/components/admin-system/feedback/AdminNotice';
import { AdminActionLink } from '@/components/admin-system/shell/AdminActionLink';
import { AdminInspectorPanel } from '@/components/admin-system/shell/AdminInspectorPanel';
import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import { AdminSectionMeta } from '@/components/admin-system/shell/AdminSectionMeta';
import { AdminDataTable } from '@/components/admin-system/surfaces/AdminDataTable';
import { type AdminMetricItem, AdminMetricGrid } from '@/components/admin-system/surfaces/AdminMetricGrid';
import {
  alertTone,
  formatAlertLevel,
  formatDateTime,
  formatGb,
  formatNumber,
  formatPercent,
  formatUsd,
  truncateId,
} from '../_lib/admin-infra-costs-format';

type AdminInfraCostsViewProps = {
  report: InfraCostsReport;
  auditLogs: AdminAuditLog[];
};

export function AdminInfraCostsView({ report, auditLogs }: AdminInfraCostsViewProps) {
  const neon = report.providers.neon;
  const vercel = report.providers.vercel;

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        eyebrow="Operations"
        title="Infra costs"
        description="Suivi mensuel Neon et Vercel avec estimation en cours, projection fin de mois et alertes operationnelles."
        actions={
          <>
            <AdminActionLink href="/admin/audit?action=INFRA_COST_ALERT">Alerts</AdminActionLink>
            <AdminActionLink href="/admin/checkout-report">Checkout guard</AdminActionLink>
            <AdminActionLink href="/admin/system">System</AdminActionLink>
          </>
        }
      />

      <AdminNotice tone={alertTone(report.alertLevel)}>
        <strong>{formatAlertLevel(report.alertLevel)}.</strong> {formatUsd(report.money.currentUsd)} already recorded or estimated this month,
        with {formatUsd(report.money.projectedMonthUsd)} projected by month end.
      </AdminNotice>

      <AdminSection
        title="Cost Pulse"
        description="Montants month-to-date et projection fin de mois. Vercel vient de l'API billing; Neon est estime depuis les compteurs d'usage."
        action={
          <AdminSectionMeta
            title="Projection"
            lines={[
              `${formatPercent(report.period.elapsedRatio)} of the month elapsed`,
              `Generated ${formatDateTime(report.generatedAtIso)}`,
            ]}
          />
        }
      >
        <AdminMetricGrid items={buildSummaryMetrics(report)} columnsClassName="sm:grid-cols-2 xl:grid-cols-4" density="compact" />
      </AdminSection>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_360px] xl:items-start">
        <div className="space-y-5">
          <ProviderCostSection
            title="Neon"
            description="Postgres serverless: compute, storage, egress, restore et branches."
            configured={neon.configured}
            error={neon.error}
            setup={neon.setup}
            metrics={buildNeonMetrics(report)}
          >
            {neon.details ? <NeonDetails details={neon.details} /> : null}
          </ProviderCostSection>

          <ProviderCostSection
            title="Vercel"
            description="Charges billing FOCUS: services, projets et couts factures sur la periode."
            configured={vercel.configured}
            error={vercel.error}
            setup={vercel.setup}
            metrics={buildVercelMetrics(report)}
          >
            {vercel.details ? <VercelDetails details={vercel.details} /> : null}
          </ProviderCostSection>

          <RecentAlerts auditLogs={auditLogs} />
        </div>

        <AdminInspectorPanel title="Guardrails" description="Seuils actifs pour l'alerte cron et la lecture admin.">
          <div className="space-y-4">
            <AlertList alerts={report.alerts} />

            <div className="rounded-2xl border border-hairline bg-bg/40 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Monthly thresholds</p>
              <dl className="mt-3 space-y-2 text-sm text-text-secondary">
                <ThresholdRow label="Global warning" value={formatUsd(report.thresholds.monthlyWarningUsd)} />
                <ThresholdRow label="Global critical" value={formatUsd(report.thresholds.monthlyCriticalUsd)} />
                <ThresholdRow label="Neon warning" value={formatUsd(report.thresholds.neonMonthlyWarningUsd)} />
                <ThresholdRow label="Neon critical" value={formatUsd(report.thresholds.neonMonthlyCriticalUsd)} />
                <ThresholdRow label="Vercel warning" value={formatUsd(report.thresholds.vercelMonthlyWarningUsd)} />
                <ThresholdRow label="Vercel critical" value={formatUsd(report.thresholds.vercelMonthlyCriticalUsd)} />
              </dl>
            </div>

            <div className="rounded-2xl border border-hairline bg-bg/40 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Notifications</p>
              <dl className="mt-3 space-y-2 text-sm text-text-secondary">
                <ThresholdRow label="Cron" value="/api/cron/infra-costs-alert" />
                <ThresholdRow label="Email" value={report.notifications.emailConfigured ? 'Configured' : 'Not configured'} />
                <ThresholdRow label="Slack" value={report.notifications.slackConfigured ? 'Configured' : 'Not configured'} />
              </dl>
            </div>
          </div>
        </AdminInspectorPanel>
      </div>
    </div>
  );
}

function buildSummaryMetrics(report: InfraCostsReport): AdminMetricItem[] {
  return [
    {
      label: 'Current month',
      value: formatUsd(report.money.currentUsd),
      helper: 'Recorded or estimated so far',
      tone: report.alertLevel === 'ok' ? 'success' : report.alertLevel === 'warning' ? 'warning' : 'warning',
      icon: BadgeDollarSign,
    },
    {
      label: 'Projected EOM',
      value: formatUsd(report.money.projectedMonthUsd),
      helper: 'Linear projection to month end',
      tone: report.alertLevel === 'critical' ? 'warning' : 'info',
      icon: TrendingUp,
    },
    {
      label: 'Neon projected',
      value: formatUsd(report.providers.neon.money.projectedMonthUsd),
      helper: report.providers.neon.money.source === 'estimated' ? 'Estimated from usage metrics' : report.providers.neon.money.source,
      icon: Database,
    },
    {
      label: 'Vercel projected',
      value: formatUsd(report.providers.vercel.money.projectedMonthUsd),
      helper: report.providers.vercel.money.source === 'actual' ? 'Billing API charges' : report.providers.vercel.money.source,
      icon: Server,
    },
  ];
}

function buildNeonMetrics(report: InfraCostsReport): AdminMetricItem[] {
  const provider = report.providers.neon;
  const details = provider.details;
  return [
    {
      label: 'Current',
      value: formatUsd(provider.money.currentUsd),
      helper: provider.money.source === 'estimated' ? 'Estimated MTD' : provider.money.source,
      icon: BadgeDollarSign,
    },
    {
      label: 'Projected EOM',
      value: formatUsd(provider.money.projectedMonthUsd),
      helper: 'Usage projected to month end',
      icon: TrendingUp,
    },
    {
      label: 'Branches',
      value: details?.totals.currentBranchCount ?? 'n/a',
      helper: details ? `Guard limit ${details.branchGuardLimit}` : 'Branch API not available',
      tone: details && details.totals.currentBranchCount !== null && details.totals.currentBranchCount > details.branchGuardLimit ? 'warning' : 'default',
      icon: GitBranch,
    },
    {
      label: 'Public transfer',
      value: details ? formatGb(details.projectedTotals.publicTransferGb) : 'n/a',
      helper: details ? `${formatGb(details.includedPublicTransferGb)} included` : 'Consumption API not available',
      icon: Network,
    },
  ];
}

function buildVercelMetrics(report: InfraCostsReport): AdminMetricItem[] {
  const provider = report.providers.vercel;
  const details = provider.details;
  return [
    {
      label: 'Current',
      value: formatUsd(provider.money.currentUsd),
      helper: 'Billed cost MTD',
      icon: BadgeDollarSign,
    },
    {
      label: 'Projected EOM',
      value: formatUsd(provider.money.projectedMonthUsd),
      helper: 'Billing charges projected',
      icon: TrendingUp,
    },
    {
      label: 'Charge lines',
      value: details ? formatNumber(details.chargesCount, { integer: true }) : 'n/a',
      helper: 'FOCUS JSONL rows',
      icon: Receipt,
    },
    {
      label: 'Top service',
      value: details?.serviceRows[0]?.label ?? 'n/a',
      helper: details?.serviceRows[0] ? formatUsd(details.serviceRows[0].currentUsd) : 'No charges',
      icon: Server,
    },
  ];
}

function ProviderCostSection({
  title,
  description,
  configured,
  error,
  setup,
  metrics,
  children,
}: {
  title: string;
  description: string;
  configured: boolean;
  error: string | null;
  setup: string[];
  metrics: AdminMetricItem[];
  children: ReactNode;
}) {
  return (
    <AdminSection title={title} description={description}>
      <div className="space-y-5">
        {!configured ? (
          <AdminNotice tone="warning">
            {setup.length ? setup.join(' ') : `${title} API credentials are not configured.`}
          </AdminNotice>
        ) : null}
        {error ? <AdminNotice tone="error">{error}</AdminNotice> : null}
        <AdminMetricGrid items={metrics} columnsClassName="sm:grid-cols-2 xl:grid-cols-4" density="compact" />
        {children}
      </div>
    </AdminSection>
  );
}

function NeonDetails({ details }: { details: NeonInfraCostDetails }) {
  const rows = [
    {
      label: 'Compute',
      usage: `${formatNumber(details.totals.computeCuHours)} CU-hr`,
      current: details.costBreakdown.computeUsd,
      projected: details.projectedCostBreakdown.computeUsd,
    },
    {
      label: 'Database storage',
      usage: `${formatNumber(details.totals.rootBranchGbMonth + details.totals.childBranchGbMonth)} GB-month`,
      current: details.costBreakdown.storageUsd,
      projected: details.projectedCostBreakdown.storageUsd,
    },
    {
      label: 'Instant restore',
      usage: `${formatNumber(details.totals.instantRestoreGbMonth)} GB-month`,
      current: details.costBreakdown.instantRestoreUsd,
      projected: details.projectedCostBreakdown.instantRestoreUsd,
    },
    {
      label: 'Snapshot storage',
      usage: `${formatNumber(details.totals.snapshotStorageGbMonth)} GB-month`,
      current: details.costBreakdown.snapshotStorageUsd,
      projected: details.projectedCostBreakdown.snapshotStorageUsd,
    },
    {
      label: 'Public transfer',
      usage: formatGb(details.totals.publicTransferGb),
      current: details.costBreakdown.publicTransferUsd,
      projected: details.projectedCostBreakdown.publicTransferUsd,
    },
    {
      label: 'Private transfer',
      usage: formatGb(details.totals.privateTransferGb),
      current: details.costBreakdown.privateTransferUsd,
      projected: details.projectedCostBreakdown.privateTransferUsd,
    },
    {
      label: 'Extra branches',
      usage: `${formatNumber(details.totals.extraBranchesMonth)} branch-hours`,
      current: details.costBreakdown.extraBranchUsd,
      projected: details.projectedCostBreakdown.extraBranchUsd,
    },
  ];

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <AdminDataTable>
        <thead className="bg-surface">
          <tr className="text-[11px] uppercase tracking-[0.18em] text-text-muted">
            <th className="px-4 py-3 font-semibold">Metric</th>
            <th className="px-4 py-3 font-semibold">Usage</th>
            <th className="px-4 py-3 font-semibold">Current</th>
            <th className="px-4 py-3 font-semibold">Projected</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline bg-bg/30">
          {rows.map((row) => (
            <tr key={row.label} className="text-text-secondary">
              <td className="px-4 py-3 font-medium text-text-primary">{row.label}</td>
              <td className="px-4 py-3">{row.usage}</td>
              <td className="px-4 py-3">{formatUsd(row.current)}</td>
              <td className="px-4 py-3 font-medium text-text-primary">{formatUsd(row.projected)}</td>
            </tr>
          ))}
        </tbody>
      </AdminDataTable>

      <div className="rounded-2xl border border-hairline bg-bg/40 px-4 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Branch state</p>
        {details.branches.length ? (
          <div className="mt-3 space-y-3 text-sm text-text-secondary">
            {details.branches.map((branch) => (
              <div key={branch.projectId} className="rounded-xl border border-hairline bg-surface px-3 py-3">
                <p className="font-mono text-xs text-text-primary">{truncateId(branch.projectId)}</p>
                <p className="mt-1">{branch.total} total, {branch.nonPrimary} non-primary</p>
                <p className="mt-1 text-xs text-text-muted">{formatBranchStates(branch.byState)}</p>
              </div>
            ))}
          </div>
        ) : (
          <AdminEmptyState>No branch data returned.</AdminEmptyState>
        )}
      </div>
    </div>
  );
}

function VercelDetails({ details }: { details: VercelInfraCostDetails }) {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <AdminDataTable>
        <thead className="bg-surface">
          <tr className="text-[11px] uppercase tracking-[0.18em] text-text-muted">
            <th className="px-4 py-3 font-semibold">Service</th>
            <th className="px-4 py-3 font-semibold">Current</th>
            <th className="px-4 py-3 font-semibold">Projected</th>
            <th className="px-4 py-3 font-semibold">Rows</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline bg-bg/30">
          {details.serviceRows.map((row) => (
            <tr key={row.key} className="text-text-secondary">
              <td className="px-4 py-3 font-medium text-text-primary">{row.label}</td>
              <td className="px-4 py-3">{formatUsd(row.currentUsd)}</td>
              <td className="px-4 py-3 font-medium text-text-primary">{formatUsd(row.projectedMonthUsd)}</td>
              <td className="px-4 py-3">{row.chargeCount}</td>
            </tr>
          ))}
        </tbody>
      </AdminDataTable>

      <AdminDataTable>
        <thead className="bg-surface">
          <tr className="text-[11px] uppercase tracking-[0.18em] text-text-muted">
            <th className="px-4 py-3 font-semibold">Project</th>
            <th className="px-4 py-3 font-semibold">Current</th>
            <th className="px-4 py-3 font-semibold">Projected</th>
            <th className="px-4 py-3 font-semibold">Rows</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline bg-bg/30">
          {details.projectRows.map((row) => (
            <tr key={row.key} className="text-text-secondary">
              <td className="px-4 py-3 font-medium text-text-primary">{row.label}</td>
              <td className="px-4 py-3">{formatUsd(row.currentUsd)}</td>
              <td className="px-4 py-3 font-medium text-text-primary">{formatUsd(row.projectedMonthUsd)}</td>
              <td className="px-4 py-3">{row.chargeCount}</td>
            </tr>
          ))}
        </tbody>
      </AdminDataTable>
    </div>
  );
}

function AlertList({ alerts }: { alerts: InfraCostAlert[] }) {
  if (!alerts.length) {
    return (
      <AdminNotice tone="success">
        No infra cost alert is currently active.
      </AdminNotice>
    );
  }

  return (
    <div className="space-y-2">
      {alerts.slice(0, 8).map((alert, index) => (
        <div
          key={`${alert.provider}-${alert.kind}-${index}`}
          className="rounded-2xl border border-hairline bg-bg/40 px-4 py-3 text-sm text-text-secondary"
        >
          <div className="flex items-start gap-2">
            {alert.level === 'critical' ? (
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-error" />
            ) : (
              <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            )}
            <div>
              <p className="font-medium text-text-primary">{alert.title}</p>
              <p className="mt-1">{alert.detail}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function RecentAlerts({ auditLogs }: { auditLogs: AdminAuditLog[] }) {
  return (
    <AdminSection title="Recent Alerts" description="Dernieres notifications infra ecrites dans l'audit admin.">
      {auditLogs.length ? (
        <AdminDataTable>
          <thead className="bg-surface">
            <tr className="text-[11px] uppercase tracking-[0.18em] text-text-muted">
              <th className="px-4 py-3 font-semibold">Time</th>
              <th className="px-4 py-3 font-semibold">Level</th>
              <th className="px-4 py-3 font-semibold">Current</th>
              <th className="px-4 py-3 font-semibold">Projected</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline bg-bg/30">
            {auditLogs.map((log) => {
              const metadata = log.metadata ?? {};
              return (
                <tr key={log.id} className="text-text-secondary">
                  <td className="px-4 py-3">{formatDateTime(log.createdAt)}</td>
                  <td className="px-4 py-3">{String(metadata.alertLevel ?? 'unknown')}</td>
                  <td className="px-4 py-3">{formatMaybeUsd(metadata.currentUsd)}</td>
                  <td className="px-4 py-3 font-medium text-text-primary">{formatMaybeUsd(metadata.projectedMonthUsd)}</td>
                </tr>
              );
            })}
          </tbody>
        </AdminDataTable>
      ) : (
        <AdminEmptyState>No infra cost alert has been recorded yet.</AdminEmptyState>
      )}
    </AdminSection>
  );
}

function ThresholdRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt>{label}</dt>
      <dd className="text-right font-medium text-text-primary">{value}</dd>
    </div>
  );
}

function formatBranchStates(states: Record<string, number>) {
  const entries = Object.entries(states);
  if (!entries.length) return 'No states';
  return entries.map(([state, count]) => `${state}:${count}`).join(', ');
}

function formatMaybeUsd(value: unknown) {
  return typeof value === 'number' ? formatUsd(value) : 'n/a';
}
