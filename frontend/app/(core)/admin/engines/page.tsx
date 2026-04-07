import { notFound } from 'next/navigation';
import { Activity, Clock3, Cpu, DollarSign, ShieldAlert } from 'lucide-react';
import { AdminEmptyState } from '@/components/admin-system/feedback/AdminEmptyState';
import { AdminNotice } from '@/components/admin-system/feedback/AdminNotice';
import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import { AdminSectionMeta } from '@/components/admin-system/shell/AdminSectionMeta';
import { type AdminMetricItem, AdminMetricGrid } from '@/components/admin-system/surfaces/AdminMetricGrid';
import { type AdminStatColumn, AdminStatTable } from '@/components/admin-system/surfaces/AdminStatTable';
import { EngineSettingsPanel } from '@/components/admin/EngineSettingsPanel';
import { ButtonLink } from '@/components/ui/Button';
import { fetchEngineUsageMetrics } from '@/server/admin-metrics';
import { requireAdmin } from '@/server/admin';
import { ensureEngineSettingsSeed, fetchEngineSettings } from '@/server/engine-settings';
import { getAdminEngineEntries } from '@/server/engine-overrides';
import { fetchEnginePerformanceMetrics, type EnginePerformanceMetric } from '@/server/generate-metrics';

export const dynamic = 'force-dynamic';

type ConfigEntry = Awaited<ReturnType<typeof loadEngineConfigEntries>>[number];

type EngineConfigSnapshot = {
  engineId: string;
  engineLabel: string;
  active: boolean;
  availability: string;
  status: string;
  latencyTier: string;
  perSecondCents: number | null;
  flatCents: number | null;
};

type EngineOpsRow = {
  engineId: string;
  engineLabel: string;
  modes: string[];
  totalAttempts: number;
  acceptedCount: number;
  completedCount: number;
  failedCount: number;
  rejectedCount: number;
  failureRate: number;
  averageDurationMs: number | null;
  p95DurationMs: number | null;
  config: EngineConfigSnapshot | null;
};

type EngineCommercialRow = {
  engineId: string;
  engineLabel: string;
  rendersCount30d: number;
  distinctUsers30d: number;
  rendersAmount30dUsd: number;
  shareOfTotalRenders30d: number;
  shareOfTotalRevenue30d: number;
  avgSpendPerUser30d: number;
  config: EngineConfigSnapshot | null;
};

const numberFormatter = new Intl.NumberFormat('en-US');
const usdFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export default async function AdminEnginesPage() {
  try {
    await requireAdmin();
  } catch (error) {
    console.warn('[admin/engines] access denied', error);
    notFound();
  }

  const databaseAvailable = Boolean(process.env.DATABASE_URL);

  const [performanceMetrics, usageMetrics, configEntries] = await Promise.all([
    fetchEnginePerformanceMetrics(),
    fetchEngineUsageMetrics(),
    databaseAvailable ? loadEngineConfigEntries() : Promise.resolve([]),
  ]);

  const configSnapshots = configEntries.map(buildConfigSnapshot);
  const overviewCards = buildOverviewCards(performanceMetrics, usageMetrics, configSnapshots);
  const opsRows = buildOperationalRows(performanceMetrics, configSnapshots);
  const commercialRows = buildCommercialRows(usageMetrics, configSnapshots);
  const configMeta = summarizeConfig(configSnapshots);
  const opsColumns: AdminStatColumn<EngineOpsRow>[] = [
    {
      key: 'engine',
      header: 'Engine',
      cellClassName: 'px-5',
      render: (row) => (
        <div className="flex flex-col gap-1">
          <p className="font-medium text-text-primary">{row.engineLabel}</p>
          <p className="font-mono text-xs text-text-muted">{row.engineId}</p>
        </div>
      ),
    },
    {
      key: 'modes',
      header: 'Modes',
      render: (row) => <span className="text-text-secondary">{row.modes.length ? row.modes.join(', ') : '—'}</span>,
    },
    {
      key: 'attempts',
      header: 'Attempts',
      headerClassName: 'text-right',
      cellClassName: 'text-right font-medium text-text-primary',
      render: (row) => formatNumber(row.totalAttempts),
    },
    {
      key: 'completed',
      header: 'Completed',
      headerClassName: 'text-right',
      cellClassName: 'text-right text-text-secondary',
      render: (row) => formatNumber(row.completedCount),
    },
    {
      key: 'failed',
      header: 'Failed',
      headerClassName: 'text-right',
      cellClassName: 'text-right text-text-secondary',
      render: (row) => formatNumber(row.failedCount),
    },
    {
      key: 'rejected',
      header: 'Rejected',
      headerClassName: 'text-right',
      cellClassName: 'text-right text-text-secondary',
      render: (row) => formatNumber(row.rejectedCount),
    },
    {
      key: 'rate',
      header: 'Fail rate',
      headerClassName: 'text-right',
      cellClassName: (row) =>
        [
          'text-right font-medium',
          row.failureRate >= 0.15 ? 'text-warning' : row.failureRate > 0 ? 'text-text-primary' : 'text-success',
        ].join(' '),
      render: (row) => formatPercent(row.failureRate),
    },
    {
      key: 'avg',
      header: 'Avg',
      headerClassName: 'text-right',
      cellClassName: 'text-right text-text-primary',
      render: (row) => formatDuration(row.averageDurationMs),
    },
    {
      key: 'p95',
      header: 'P95',
      headerClassName: 'text-right',
      cellClassName: 'text-right text-text-primary',
      render: (row) => formatDuration(row.p95DurationMs),
    },
    {
      key: 'config',
      header: 'Config',
      cellClassName: 'px-5',
      render: (row) => <ConfigInlineSummary config={row.config} />,
    },
  ];
  const commercialColumns: AdminStatColumn<EngineCommercialRow>[] = [
    {
      key: 'engine',
      header: 'Engine',
      cellClassName: 'px-5',
      render: (row) => (
        <div className="flex flex-col gap-1">
          <p className="font-medium text-text-primary">{row.engineLabel}</p>
          <p className="font-mono text-xs text-text-muted">{row.engineId}</p>
        </div>
      ),
    },
    {
      key: 'renders',
      header: 'Renders',
      headerClassName: 'text-right',
      cellClassName: 'text-right font-medium text-text-primary',
      render: (row) => formatNumber(row.rendersCount30d),
    },
    {
      key: 'users',
      header: 'Users',
      headerClassName: 'text-right',
      cellClassName: 'text-right text-text-secondary',
      render: (row) => formatNumber(row.distinctUsers30d),
    },
    {
      key: 'revenue',
      header: 'Revenue',
      headerClassName: 'text-right',
      cellClassName: 'text-right font-medium text-text-primary',
      render: (row) => formatCurrency(row.rendersAmount30dUsd),
    },
    {
      key: 'renderShare',
      header: 'Render share',
      headerClassName: 'text-right',
      cellClassName: 'text-right text-text-secondary',
      render: (row) => formatPercent(row.shareOfTotalRenders30d),
    },
    {
      key: 'revenueShare',
      header: 'Revenue share',
      headerClassName: 'text-right',
      cellClassName: 'text-right text-text-secondary',
      render: (row) => formatPercent(row.shareOfTotalRevenue30d),
    },
    {
      key: 'avgPerUser',
      header: 'Avg / user',
      headerClassName: 'text-right',
      cellClassName: 'text-right text-text-secondary',
      render: (row) => formatCurrency(row.avgSpendPerUser30d),
    },
    {
      key: 'config',
      header: 'Config',
      cellClassName: 'px-5',
      render: (row) => <ConfigInlineSummary config={row.config} />,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        eyebrow="Operations"
        title="Engines"
        description="Surface de pilotage des moteurs Fal : sante, demande, revenus et configuration active."
        actions={
          <>
            <ButtonLink href="/admin/insights" variant="outline" size="sm" className="border-border bg-surface">
              Insights
            </ButtonLink>
            <ButtonLink href="/admin/jobs" variant="outline" size="sm" className="border-border bg-surface">
              Jobs
            </ButtonLink>
            <ButtonLink href="/admin/transactions" variant="outline" size="sm" className="border-border bg-surface">
              Transactions
            </ButtonLink>
          </>
        }
      />

      <AdminSection
        title="Engine Overview"
        description="Signal rapide pour savoir combien de moteurs tournent vraiment, combien degradent, et ou part le revenu."
      >
        <AdminMetricGrid items={overviewCards} columnsClassName="sm:grid-cols-2 xl:grid-cols-6" className="border-0" />
      </AdminSection>

      <AdminSection
        title="Operational Health"
        description="Lecture operations-first des tentatives Fal sur 30 jours, avec le statut de config en face."
        action={<AdminSectionMeta title="Health" lines={[`${formatNumber(opsRows.length)} engines tracked`, buildOpsAttentionLabel(opsRows)]} />}
        contentClassName="p-0"
      >
        {opsRows.length ? (
          <AdminStatTable
            columns={opsColumns}
            rows={opsRows}
            getRowKey={(row) => row.engineId}
            empty={<AdminEmptyState>No Fal attempt metrics recorded yet.</AdminEmptyState>}
            className="rounded-none border-0"
            tableClassName="min-w-full"
          />
        ) : (
          <div className="px-5 py-5">
            <AdminEmptyState>No Fal attempt metrics recorded yet.</AdminEmptyState>
          </div>
        )}
      </AdminSection>

      <AdminSection
        title="Demand & Revenue"
        description="Les moteurs qui captent le volume et le cash-in actuellement, sans passer par insights."
        action={<AdminSectionMeta title="Demand" lines={[`${formatNumber(commercialRows.length)} engines with usage or config`, buildRevenueLabel(commercialRows)]} />}
        contentClassName="p-0"
      >
        {commercialRows.length ? (
          <AdminStatTable
            columns={commercialColumns}
            rows={commercialRows}
            getRowKey={(row) => row.engineId}
            empty={<AdminEmptyState>No engine usage recorded over the last 30 days.</AdminEmptyState>}
            className="rounded-none border-0"
            tableClassName="min-w-full"
          />
        ) : (
          <div className="px-5 py-5">
            <AdminEmptyState>No engine usage recorded over the last 30 days.</AdminEmptyState>
          </div>
        )}
      </AdminSection>

      <AdminSection
        title="Configuration"
        description="Overrides, disponibilite et pricing par moteur. Les changements s’appliquent sur les prochains quotes."
        action={
          <AdminSectionMeta
            title="Config"
            lines={[
              `${formatNumber(configMeta.total)} registered`,
              `${formatNumber(configMeta.attention)} needs attention · ${formatNumber(configMeta.active)} active`,
            ]}
          />
        }
        contentClassName="p-0"
      >
        {databaseAvailable ? (
          configEntries.length ? (
            <div className="divide-y divide-border">
              {configEntries.map((entry) => (
                <EngineSettingsPanel
                  key={entry.engine.id}
                  engineId={entry.engine.id}
                  engineLabel={entry.engine.label}
                  baseline={{
                    availability: entry.engine.availability,
                    status: entry.engine.status,
                    latencyTier: entry.engine.latencyTier,
                    maxDurationSec: entry.engine.maxDurationSec ?? null,
                    resolutions: entry.engine.resolutions ?? [],
                    currency: entry.engine.pricingDetails?.currency ?? 'USD',
                    perSecondCents: entry.engine.pricingDetails?.perSecondCents?.default ?? null,
                    flatCents: entry.engine.pricingDetails?.flatCents?.default ?? null,
                  }}
                  initialForm={buildInitialForm(entry)}
                />
              ))}
            </div>
          ) : (
            <div className="px-5 py-5">
              <AdminEmptyState>No engines registered yet. Seed engine settings to enable configuration.</AdminEmptyState>
            </div>
          )
        ) : (
          <div className="px-5 py-5">
            <AdminNotice tone="warning">
              Database connection missing. Set <code className="font-mono text-xs">DATABASE_URL</code> to edit engine overrides.
            </AdminNotice>
          </div>
        )}
      </AdminSection>
    </div>
  );
}

async function loadEngineConfigEntries() {
  await ensureEngineSettingsSeed();
  const [entries, settingsMap] = await Promise.all([getAdminEngineEntries(), fetchEngineSettings()]);
  return entries.map((entry) => ({
    engine: entry.engine,
    disabled: entry.disabled,
    override: entry.override,
    settings: settingsMap.get(entry.engine.id) ?? null,
  }));
}

function buildInitialForm(entry: ConfigEntry) {
  const { engine, override, settings } = entry;
  const options = (settings?.options ?? null) as
    | {
        maxDurationSec?: number;
        resolutions?: unknown;
      }
    | null;
  const pricing = settings?.pricing ?? null;

  const active = !(override?.active === false);
  const availability = (override?.availability ?? engine.availability).toLowerCase();
  const status = (override?.status ?? engine.status ?? 'live').toLowerCase();
  const latencyTier = (override?.latency_tier ?? engine.latencyTier ?? 'standard').toLowerCase();
  const maxDuration =
    options?.maxDurationSec && Number.isFinite(options.maxDurationSec) ? String(options.maxDurationSec) : '';
  const resolvedResolutions = Array.isArray(options?.resolutions)
    ? (options?.resolutions as unknown[]).reduce<string[]>((acc, value) => {
        if (typeof value === 'string') {
          const trimmed = value.trim();
          if (trimmed.length) {
            acc.push(trimmed);
          }
        }
        return acc;
      }, [])
    : Array.isArray(engine.resolutions)
      ? engine.resolutions
      : [];
  const resolutions = resolvedResolutions.join(', ');
  const currency = pricing?.currency ?? engine.pricingDetails?.currency ?? 'USD';
  const perSecond = pricing?.perSecondCents?.default ?? engine.pricingDetails?.perSecondCents?.default ?? '';
  const flat = pricing?.flatCents?.default ?? engine.pricingDetails?.flatCents?.default ?? '';

  return {
    active,
    availability,
    status,
    latencyTier,
    maxDurationSec: maxDuration,
    resolutions,
    currency,
    perSecondCents: perSecond === '' ? '' : String(perSecond),
    flatCents: flat === '' ? '' : String(flat),
  };
}

function buildConfigSnapshot(entry: ConfigEntry): EngineConfigSnapshot {
  const effective = buildInitialForm(entry);

  return {
    engineId: entry.engine.id,
    engineLabel: entry.engine.label,
    active: effective.active,
    availability: effective.availability,
    status: effective.status,
    latencyTier: effective.latencyTier,
    perSecondCents: effective.perSecondCents.length ? Number(effective.perSecondCents) : null,
    flatCents: effective.flatCents.length ? Number(effective.flatCents) : null,
  };
}

function buildOverviewCards(
  performanceMetrics: EnginePerformanceMetric[],
  usageMetrics: Awaited<ReturnType<typeof fetchEngineUsageMetrics>>,
  configSnapshots: EngineConfigSnapshot[]
): AdminMetricItem[] {
  const attemptTotals = performanceMetrics.reduce(
    (acc, row) => {
      acc.total += row.acceptedCount + row.rejectedCount + row.completedCount + row.failedCount;
      acc.failed += row.failedCount;
      acc.completed += row.completedCount;
      acc.durationWeight += (row.averageDurationMs ?? 0) * row.completedCount;
      return acc;
    },
    { total: 0, failed: 0, completed: 0, durationWeight: 0 }
  );

  const liveEngines = usageMetrics.filter((row) => row.rendersCount30d > 0).length;
  const revenue30d = usageMetrics.reduce((sum, row) => sum + row.rendersAmount30dUsd, 0);
  const activeConfigs = configSnapshots.filter((row) => row.active).length;
  const attentionConfigs = configSnapshots.filter(needsConfigAttention).length;
  const weightedAverageDurationMs =
    attemptTotals.completed > 0 ? attemptTotals.durationWeight / attemptTotals.completed : null;

  return [
    {
      label: 'Registered',
      value: formatNumber(configSnapshots.length),
      helper: 'Configurable engines in the current catalog',
      icon: Cpu,
    },
    {
      label: 'Active config',
      value: formatNumber(activeConfigs),
      helper: `${formatNumber(configSnapshots.length - activeConfigs)} disabled override${configSnapshots.length - activeConfigs === 1 ? '' : 's'}`,
      tone: activeConfigs === configSnapshots.length ? 'success' : 'warning',
      icon: Activity,
    },
    {
      label: 'Live engines',
      value: formatNumber(liveEngines),
      helper: 'Engines with renders over the last 30 days',
      tone: liveEngines > 0 ? 'success' : 'default',
      icon: Cpu,
    },
    {
      label: 'Failure rate',
      value: formatPercent(attemptTotals.total ? attemptTotals.failed / attemptTotals.total : 0),
      helper: `${formatNumber(attemptTotals.failed)} failed attempt${attemptTotals.failed === 1 ? '' : 's'} in 30d`,
      tone: attemptTotals.failed > 0 ? 'warning' : 'success',
      icon: ShieldAlert,
    },
    {
      label: 'Avg completion',
      value: formatDuration(weightedAverageDurationMs),
      helper: `${formatNumber(attemptTotals.completed)} completed attempt${attemptTotals.completed === 1 ? '' : 's'} tracked`,
      icon: Clock3,
    },
    {
      label: 'Revenue 30d',
      value: formatCurrency(revenue30d),
      helper: `${formatNumber(attentionConfigs)} config${attentionConfigs === 1 ? '' : 's'} currently degraded or limited`,
      tone: attentionConfigs > 0 ? 'warning' : 'success',
      icon: DollarSign,
    },
  ];
}

function buildOperationalRows(performanceMetrics: EnginePerformanceMetric[], configSnapshots: EngineConfigSnapshot[]): EngineOpsRow[] {
  const configMap = new Map(configSnapshots.map((row) => [row.engineId, row] as const));
  const metricsByEngine = new Map<string, EnginePerformanceMetric[]>();

  performanceMetrics.forEach((row) => {
    const list = metricsByEngine.get(row.engineId) ?? [];
    list.push(row);
    metricsByEngine.set(row.engineId, list);
  });

  const engineIds = new Set<string>([...metricsByEngine.keys(), ...configMap.keys()]);

  const rows = Array.from(engineIds).map((engineId) => {
    const metrics = metricsByEngine.get(engineId) ?? [];
    const config = configMap.get(engineId) ?? null;
    const completedCount = metrics.reduce((sum, row) => sum + row.completedCount, 0);
    const failedCount = metrics.reduce((sum, row) => sum + row.failedCount, 0);
    const acceptedCount = metrics.reduce((sum, row) => sum + row.acceptedCount, 0);
    const rejectedCount = metrics.reduce((sum, row) => sum + row.rejectedCount, 0);
    const totalAttempts = acceptedCount + rejectedCount + completedCount + failedCount;
    const averageDurationMs =
      completedCount > 0
        ? metrics.reduce((sum, row) => sum + (row.averageDurationMs ?? 0) * row.completedCount, 0) / completedCount
        : null;
    const p95DurationMs = metrics.reduce<number | null>(
      (max, row) => {
        if (row.p95DurationMs == null) return max;
        if (max == null || row.p95DurationMs > max) return row.p95DurationMs;
        return max;
      },
      null
    );

    return {
      engineId,
      engineLabel: metrics[0]?.engineLabel ?? config?.engineLabel ?? engineId,
      modes: metrics.map((row) => row.mode),
      totalAttempts,
      acceptedCount,
      completedCount,
      failedCount,
      rejectedCount,
      failureRate: totalAttempts ? failedCount / totalAttempts : 0,
      averageDurationMs,
      p95DurationMs,
      config,
    };
  });

  return rows.sort((a, b) => {
    if (b.failedCount !== a.failedCount) return b.failedCount - a.failedCount;
    if (b.totalAttempts !== a.totalAttempts) return b.totalAttempts - a.totalAttempts;
    return a.engineLabel.localeCompare(b.engineLabel);
  });
}

function buildCommercialRows(
  usageMetrics: Awaited<ReturnType<typeof fetchEngineUsageMetrics>>,
  configSnapshots: EngineConfigSnapshot[]
): EngineCommercialRow[] {
  const configMap = new Map(configSnapshots.map((row) => [row.engineId, row] as const));
  const usageMap = new Map(usageMetrics.map((row) => [row.engineId, row] as const));
  const engineIds = new Set<string>([...usageMap.keys(), ...configMap.keys()]);

  const rows = Array.from(engineIds).map((engineId) => {
    const usage = usageMap.get(engineId);
    const config = configMap.get(engineId) ?? null;

    return {
      engineId,
      engineLabel: usage?.engineLabel ?? config?.engineLabel ?? engineId,
      rendersCount30d: usage?.rendersCount30d ?? 0,
      distinctUsers30d: usage?.distinctUsers30d ?? 0,
      rendersAmount30dUsd: usage?.rendersAmount30dUsd ?? 0,
      shareOfTotalRenders30d: usage?.shareOfTotalRenders30d ?? 0,
      shareOfTotalRevenue30d: usage?.shareOfTotalRevenue30d ?? 0,
      avgSpendPerUser30d: usage?.avgSpendPerUser30d ?? 0,
      config,
    };
  });

  return rows.sort((a, b) => {
    if (b.rendersAmount30dUsd !== a.rendersAmount30dUsd) return b.rendersAmount30dUsd - a.rendersAmount30dUsd;
    if (b.rendersCount30d !== a.rendersCount30d) return b.rendersCount30d - a.rendersCount30d;
    return a.engineLabel.localeCompare(b.engineLabel);
  });
}

function summarizeConfig(configSnapshots: EngineConfigSnapshot[]) {
  return {
    total: configSnapshots.length,
    active: configSnapshots.filter((row) => row.active).length,
    attention: configSnapshots.filter(needsConfigAttention).length,
  };
}

function needsConfigAttention(config: EngineConfigSnapshot) {
  if (!config.active) return true;
  return config.availability !== 'available' || !['live', 'busy'].includes(config.status);
}

function buildOpsAttentionLabel(rows: EngineOpsRow[]) {
  const attention = rows.filter((row) => row.failureRate >= 0.15 || needsConfigAttention(row.config ?? fallbackConfig(row))).length;
  return attention ? `${formatNumber(attention)} engine${attention === 1 ? '' : 's'} to review` : 'No engine currently flagged';
}

function buildRevenueLabel(rows: EngineCommercialRow[]) {
  const totalRevenue = rows.reduce((sum, row) => sum + row.rendersAmount30dUsd, 0);
  return totalRevenue > 0 ? `${formatCurrency(totalRevenue)} total 30d revenue` : 'No revenue tracked in the current window';
}

function fallbackConfig(row: { engineId: string; engineLabel: string }): EngineConfigSnapshot {
  return {
    engineId: row.engineId,
    engineLabel: row.engineLabel,
    active: true,
    availability: 'available',
    status: 'live',
    latencyTier: 'standard',
    perSecondCents: null,
    flatCents: null,
  };
}

function ConfigInlineSummary({ config }: { config: EngineConfigSnapshot | null }) {
  if (!config) {
    return <span className="text-sm text-text-muted">No override record</span>;
  }

  const stateTone = !config.active || config.availability !== 'available' || config.status !== 'live' ? 'warning' : 'default';

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <span
          className={[
            'rounded-full border px-2.5 py-1 text-xs font-medium',
            config.active ? 'border-success-border bg-success-bg text-success' : 'border-warning-border bg-warning-bg text-warning',
          ].join(' ')}
        >
          {config.active ? 'active' : 'disabled'}
        </span>
        <span
          className={[
            'rounded-full border px-2.5 py-1 text-xs font-medium capitalize',
            stateTone === 'warning' ? 'border-warning-border bg-warning-bg text-warning' : 'border-border bg-bg text-text-secondary',
          ].join(' ')}
        >
          {config.availability}
        </span>
        <span className="rounded-full border border-border bg-bg px-2.5 py-1 text-xs font-medium capitalize text-text-secondary">
          {config.status.replace('_', ' ')}
        </span>
      </div>
      <p className="text-xs text-text-secondary">
        {config.latencyTier} latency
        {config.perSecondCents != null ? ` · ${formatMoneyCents(config.perSecondCents)} / sec` : ''}
        {config.flatCents != null ? ` · ${formatMoneyCents(config.flatCents)} flat` : ''}
      </p>
    </div>
  );
}

function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

function formatCurrency(value: number): string {
  return usdFormatter.format(value);
}

function formatMoneyCents(value: number): string {
  return usdFormatter.format(value / 100);
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatDuration(ms: number | null): string {
  if (ms == null) return '—';
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}
