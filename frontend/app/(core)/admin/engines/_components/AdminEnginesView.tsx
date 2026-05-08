import { AdminEmptyState } from '@/components/admin-system/feedback/AdminEmptyState';
import { AdminNotice } from '@/components/admin-system/feedback/AdminNotice';
import { AdminActionLink } from '@/components/admin-system/shell/AdminActionLink';
import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import { AdminSectionMeta } from '@/components/admin-system/shell/AdminSectionMeta';
import { AdminMetricGrid } from '@/components/admin-system/surfaces/AdminMetricGrid';
import { type AdminStatColumn, AdminStatTable } from '@/components/admin-system/surfaces/AdminStatTable';
import { EngineSettingsPanel } from '@/components/admin/EngineSettingsPanel';
import {
  type AdminEnginesViewModel,
  type EngineCommercialRow,
  type EngineConfigSnapshot,
  type EngineOpsRow,
  buildBaseline,
  buildInitialForm,
  buildOpsAttentionLabel,
  buildRevenueLabel,
  formatCurrency,
  formatDuration,
  formatMoneyCents,
  formatNumber,
  formatPercent,
  summarizeConfigIssue,
} from '../_lib/admin-engines-view-model';

type AdminEnginesViewProps = {
  model: AdminEnginesViewModel;
};

export function AdminEnginesView({ model }: AdminEnginesViewProps) {
  const {
    databaseAvailable,
    configEntries,
    configSnapshotByEngineId,
    overviewCards,
    opsRows,
    commercialRows,
    configMeta,
    attentionConfigEntries,
    stableConfigEntries,
    disabledConfigs,
    limitedConfigs,
    degradedConfigs,
  } = model;
  const opsColumns = buildOperationalColumns();
  const commercialColumns = buildCommercialColumns();

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        eyebrow="Operations"
        title="Engines"
        description="Surface de pilotage des moteurs Fal : sante, demande, revenus et configuration active."
        actions={
          <>
            <AdminActionLink href="/admin/insights">Insights</AdminActionLink>
            <AdminActionLink href="/admin/jobs">Jobs</AdminActionLink>
            <AdminActionLink href="/admin/transactions">Transactions</AdminActionLink>
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
        action={
          <AdminSectionMeta
            title="Health"
            lines={[`${formatNumber(opsRows.length)} engines tracked`, buildOpsAttentionLabel(opsRows)]}
          />
        }
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
            viewportClassName="max-h-[30rem] overflow-auto"
            stickyHeader
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
        action={
          <AdminSectionMeta
            title="Demand"
            lines={[`${formatNumber(commercialRows.length)} engines with usage or config`, buildRevenueLabel(commercialRows)]}
          />
        }
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
            viewportClassName="max-h-[26rem] overflow-auto"
            stickyHeader
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
            <AdminEngineConfigurationPanel
              attentionConfigEntries={attentionConfigEntries}
              stableConfigEntries={stableConfigEntries}
              configSnapshotByEngineId={configSnapshotByEngineId}
              configMeta={configMeta}
              disabledConfigs={disabledConfigs}
              limitedConfigs={limitedConfigs}
              degradedConfigs={degradedConfigs}
            />
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

function buildOperationalColumns(): AdminStatColumn<EngineOpsRow>[] {
  return [
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
}

function buildCommercialColumns(): AdminStatColumn<EngineCommercialRow>[] {
  return [
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
}

type AdminEngineConfigurationPanelProps = {
  attentionConfigEntries: AdminEnginesViewModel['attentionConfigEntries'];
  stableConfigEntries: AdminEnginesViewModel['stableConfigEntries'];
  configSnapshotByEngineId: AdminEnginesViewModel['configSnapshotByEngineId'];
  configMeta: AdminEnginesViewModel['configMeta'];
  disabledConfigs: number;
  limitedConfigs: number;
  degradedConfigs: number;
};

function AdminEngineConfigurationPanel({
  attentionConfigEntries,
  stableConfigEntries,
  configSnapshotByEngineId,
  configMeta,
  disabledConfigs,
  limitedConfigs,
  degradedConfigs,
}: AdminEngineConfigurationPanelProps) {
  return (
    <div className="grid xl:grid-cols-[320px_minmax(0,1fr)]">
      <div className="border-b border-hairline px-5 py-5 xl:border-b-0 xl:border-r">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Config pulse</p>
        <p className="mt-1 text-sm leading-6 text-text-secondary">
          Les moteurs en anomalie restent visibles immédiatement. Le reste du catalogue est replié pour garder la page pilotable.
        </p>

        <div className="mt-4 grid gap-px overflow-hidden rounded-2xl border border-hairline bg-hairline sm:grid-cols-2">
          <CompactConfigCell label="Needs attention" value={formatNumber(configMeta.attention)} tone={configMeta.attention ? 'warning' : 'success'} />
          <CompactConfigCell label="Disabled" value={formatNumber(disabledConfigs)} tone={disabledConfigs ? 'warning' : 'success'} />
          <CompactConfigCell label="Limited" value={formatNumber(limitedConfigs)} tone={limitedConfigs ? 'warning' : 'success'} />
          <CompactConfigCell label="Degraded" value={formatNumber(degradedConfigs)} tone={degradedConfigs ? 'warning' : 'success'} />
        </div>

        <div className="mt-4 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Priority engines</p>
          {attentionConfigEntries.length ? (
            attentionConfigEntries.slice(0, 6).map((entry) => {
              const snapshot = configSnapshotByEngineId.get(entry.engine.id) ?? null;
              return (
                <div key={`priority-${entry.engine.id}`} className="rounded-xl border border-hairline bg-bg/40 px-3 py-2">
                  <p className="text-sm font-medium text-text-primary">{entry.engine.label}</p>
                  <p className="mt-1 text-xs text-text-secondary">
                    {snapshot ? summarizeConfigIssue(snapshot) : 'Override requires review.'}
                  </p>
                </div>
              );
            })
          ) : (
            <div className="rounded-xl border border-hairline bg-bg/40 px-3 py-3 text-sm text-text-secondary">
              All registered engine overrides are currently healthy.
            </div>
          )}
        </div>
      </div>

      <div className="divide-y divide-border">
        {attentionConfigEntries.length ? (
          <div>
            <div className="border-b border-hairline px-5 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Priority overrides</p>
              <p className="mt-1 text-sm text-text-secondary">Review these engines first before opening the broader catalog.</p>
            </div>
            <div className="divide-y divide-border">
              {attentionConfigEntries.map((entry) => (
                <EngineSettingsPanel
                  key={entry.engine.id}
                  engineId={entry.engine.id}
                  engineLabel={entry.engine.label}
                  baseline={buildBaseline(entry)}
                  initialForm={buildInitialForm(entry)}
                />
              ))}
            </div>
          </div>
        ) : null}

        {stableConfigEntries.length ? (
          <details className="group" open={!attentionConfigEntries.length && stableConfigEntries.length <= 6}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 marker:hidden">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Engine catalog</p>
                <p className="mt-1 text-sm text-text-secondary">
                  {attentionConfigEntries.length
                    ? `${formatNumber(stableConfigEntries.length)} stable engines remain available in the folded catalog.`
                    : 'Open the full catalog to inspect or edit a healthy engine override.'}
                </p>
              </div>
              <span className="rounded-full border border-border bg-bg px-2.5 py-1 text-xs font-semibold text-text-primary">
                {formatNumber(stableConfigEntries.length)}
              </span>
            </summary>
            <div className="border-t border-hairline divide-y divide-border">
              {stableConfigEntries.map((entry) => (
                <EngineSettingsPanel
                  key={entry.engine.id}
                  engineId={entry.engine.id}
                  engineLabel={entry.engine.label}
                  baseline={buildBaseline(entry)}
                  initialForm={buildInitialForm(entry)}
                />
              ))}
            </div>
          </details>
        ) : null}
      </div>
    </div>
  );
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

function CompactConfigCell({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'success' | 'warning';
}) {
  return (
    <div className="bg-surface px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">{label}</p>
      <p
        className={[
          'mt-2 text-lg font-semibold',
          tone === 'warning' ? 'text-warning' : tone === 'success' ? 'text-success' : 'text-text-primary',
        ].join(' ')}
      >
        {value}
      </p>
    </div>
  );
}
