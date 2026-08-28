import Link from 'next/link';
import { AdminEmptyState } from '@/components/admin-system/feedback/AdminEmptyState';
import { AdminNotice } from '@/components/admin-system/feedback/AdminNotice';
import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import { AdminMetricGrid } from '@/components/admin-system/surfaces/AdminMetricGrid';
import type { AdminMcpMetrics } from '@/server/admin-mcp-metrics';
import {
  ADMIN_MCP_RANGE_OPTIONS,
  buildAdminMcpHref,
  buildMcpOverviewCards,
  describeAvailability,
  formatMcpMoney,
  formatMcpNumber,
  formatMcpPercent,
  type AdminMcpRangeLabel,
} from '../_lib/admin-mcp-helpers';

type AdminMcpViewProps = {
  metrics: AdminMcpMetrics;
  selectedRange: AdminMcpRangeLabel;
};

const FUNNEL_LABELS = {
  oauth_connected: 'OAuth connected',
  trial_prepared: 'Trial prepared',
  trial_completed: 'Trial completed',
  wallet_funded: 'Wallet funded',
  first_paid_generation: 'First paid generation',
  repeat_paid_generation: 'Repeat paid generation',
} as const;

export function AdminMcpView({ metrics, selectedRange }: AdminMcpViewProps) {
  const unavailableSections = describeAvailability(metrics);
  const funnelRows = metrics.funnel ? Object.entries(metrics.funnel) : [];
  const funnelHasData = funnelRows.some(([, value]) => value > 0);
  const activity = metrics.activity;
  const knownErrors = metrics.errors?.filter((row) => row.code !== 'UNKNOWN') ?? [];
  const unknownErrorCount = metrics.errors?.find((row) => row.code === 'UNKNOWN')?.count ?? 0;
  const hasCostMetrics = [
    metrics.revenueCents,
    metrics.providerCostCents,
    metrics.trialCostCents,
    metrics.refundsCents,
  ].some((value) => value !== null);

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        eyebrow="Analytics"
        title="MCP acquisition"
        description="Authoritative acquisition, conversion and operating signals for ChatGPT, Claude, Codex and other MCP clients. Installs are not directly observable; authenticated initialization is the source of truth for connected users. All windows use UTC [from, to)."
        actions={
          <div className="flex flex-wrap gap-2" aria-label="MCP reporting range">
            {ADMIN_MCP_RANGE_OPTIONS.map((option) => (
              <Link
                key={option.value}
                href={buildAdminMcpHref(option.value)}
                prefetch={false}
                aria-current={selectedRange === option.value ? 'page' : undefined}
                className={[
                  'rounded-lg border px-3 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  selectedRange === option.value
                    ? 'border-slate-950 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950'
                    : 'border-border bg-surface text-text-secondary hover:bg-surface-hover hover:text-text-primary',
                ].join(' ')}
              >
                {option.label}
              </Link>
            ))}
          </div>
        }
      />

      <AdminSection
        title="Decision overview"
        description="Live authenticated activity first; commercial metrics appear only when their full producer chain is verified."
      >
        <AdminMetricGrid items={buildMcpOverviewCards(metrics)} columnsClassName="sm:grid-cols-2 xl:grid-cols-4" />
      </AdminSection>

      <div className="grid gap-5 xl:grid-cols-2">
        <AdminSection title="Authenticated activity" description="Privacy-safe account aggregates from successful MCP protocol traffic.">
          {activity ? (
            <MetricRows rows={[
              ['Connected users', formatMcpNumber(activity.connectedUsers)],
              ['New connections', formatMcpNumber(activity.newConnectedUsers)],
              ['Returning users', formatMcpNumber(activity.returningConnectedUsers)],
              ['Active tool users', formatMcpNumber(activity.activeToolUsers)],
              ['Initialization events', formatMcpNumber(activity.connectionEvents)],
              ['Tool calls', formatMcpNumber(activity.toolCalls)],
            ]} />
          ) : (
            <AdminNotice tone="warning">Authenticated MCP activity is unavailable for this window.</AdminNotice>
          )}
        </AdminSection>

        <AdminSection title="Tool outcomes" description="Successful and failed MCP tool responses in the selected UTC window.">
          {activity ? (
            <MetricRows rows={[
              ['Successful tool calls', formatMcpNumber(activity.successfulToolCalls)],
              ['Failed tool calls', formatMcpNumber(activity.failedToolCalls)],
              ['Tool success rate', formatMcpPercent(activity.toolSuccessRate)],
              ['Status polling calls', formatMcpNumber(metrics.pollingCalls)],
            ]} />
          ) : (
            <AdminNotice tone="warning">MCP tool outcomes are unavailable for this window.</AdminNotice>
          )}
        </AdminSection>
      </div>

      {metrics.toolUsage !== null ? (
        <AdminSection title="Tool usage" description="Top authenticated MCP tools by call volume in the selected UTC window.">
          {metrics.toolUsage.length ? (
            <MetricRows rows={metrics.toolUsage.map((row) => [
              row.tool,
              `${formatMcpNumber(row.calls)} calls · ${formatMcpNumber(row.users)} users · ${formatMcpNumber(row.failures)} failed`,
            ])} />
          ) : (
            <AdminEmptyState>No MCP tool call was recorded in this window.</AdminEmptyState>
          )}
        </AdminSection>
      ) : null}

      {unavailableSections.length ? (
        <details className="group rounded-2xl border border-border bg-surface shadow-card">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-semibold text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span>Measurement coverage</span>
            <span className="rounded-full border border-warning-border bg-warning-bg px-2.5 py-1 text-xs text-warning">
              {unavailableSections.length} measurements pending
            </span>
          </summary>
          <div className="border-t border-hairline px-5 py-4 text-sm text-text-secondary">
            <p>Pending measurements stay hidden rather than being presented as zero.</p>
            <ul className="mt-3 list-disc space-y-1 pl-5">
              {unavailableSections.map((reason) => <li key={reason}>{reason}</li>)}
            </ul>
          </div>
        </details>
      ) : null}

      {metrics.funnel !== null ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
          <AdminSection title="Funnel" description="Distinct users at each authoritative MCP stage.">
            {funnelHasData ? (
              <div className="space-y-3">
                {funnelRows.map(([stage, value], index) => {
                  const previous = index === 0 ? null : funnelRows[index - 1]?.[1] ?? null;
                  return (
                    <div key={stage} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 rounded-xl border border-hairline bg-bg/60 px-4 py-3">
                      <span className="text-sm font-medium text-text-primary">{FUNNEL_LABELS[stage as keyof typeof FUNNEL_LABELS]}</span>
                      <span className="font-semibold text-text-primary">{formatMcpNumber(value)}</span>
                      <span className="w-20 text-right text-xs text-text-muted">{previous === null ? 'Entry' : formatMcpPercent(previous === 0 ? null : value / previous)}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <AdminEmptyState>No MCP funnel events were recorded in this UTC window.</AdminEmptyState>
            )}
          </AdminSection>

          <AdminSection title="Cohort conversion" description="Rates use authoritative denominators; empty cohorts stay unavailable.">
            <MetricRows rows={[
              ['Trial to wallet', formatMcpPercent(metrics.trialToWalletRate)],
              ['Recommendation to quote', formatMcpPercent(metrics.recommendationToQuoteRate)],
              ['Quote to confirmation', formatMcpPercent(metrics.quoteToConfirmRate)],
              ['Refund rate', formatMcpPercent(metrics.refundRate)],
              ['Trial release rate', formatMcpPercent(metrics.releaseRate)],
              ['OAuth revocation rate', formatMcpPercent(metrics.revocationRate)],
            ]} />
          </AdminSection>
        </div>
      ) : null}

      {metrics.clientSplit !== null || hasCostMetrics ? (
        <div className="grid gap-5 xl:grid-cols-2">
          {metrics.clientSplit !== null ? (
            <AdminSection title="Client split" description="Completed OAuth connections by attributed client.">
              {metrics.clientSplit.some((row) => row.connections > 0) ? (
                <MetricRows rows={metrics.clientSplit.map((row) => [row.client, formatMcpNumber(row.connections)])} />
              ) : (
                <AdminEmptyState>No MCP client connection was recorded in this window.</AdminEmptyState>
              )}
            </AdminSection>
          ) : null}

          {hasCostMetrics ? (
            <AdminSection title="Cost guardrails" description="User revenue remains separate from internal provider and trial costs.">
              <MetricRows rows={[
                ['Charge receipt revenue', formatMcpMoney(metrics.revenueCents)],
                ['Provider cost', formatMcpMoney(metrics.providerCostCents)],
                ['Trial provider cost', formatMcpMoney(metrics.trialCostCents)],
                ['Refund receipts', formatMcpMoney(metrics.refundsCents)],
              ]} />
            </AdminSection>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-2">
        <AdminSection title="Errors" description="Coarse error codes only; no private request or media content.">
          {metrics.errors === null ? (
            <AdminNotice tone="warning">Unavailable while the MCP audit ledger is missing.</AdminNotice>
          ) : knownErrors.length ? (
            <div className="space-y-3">
              <MetricRows rows={knownErrors.map((row) => [row.code, formatMcpNumber(row.count)])} />
              {unknownErrorCount > 0 ? (
                <AdminNotice tone="warning">
                  {formatMcpNumber(unknownErrorCount)} tool failures lack a structured error code; use Tool usage to identify the affected tools.
                </AdminNotice>
              ) : null}
            </div>
          ) : unknownErrorCount > 0 ? (
            <AdminNotice tone="warning">
              {formatMcpNumber(unknownErrorCount)} tool failures lack a structured error code; use Tool usage to identify the affected tools.
            </AdminNotice>
          ) : (
            <AdminEmptyState>No MCP tool error was recorded in this window.</AdminEmptyState>
          )}
        </AdminSection>

        <AdminSection title="Operations alerts" description="Server-side thresholds are disabled unless configured; this page never sends externally.">
          {metrics.alerts.length ? (
            <div className="space-y-3">
              {metrics.alerts.map((alert) => (
                <AdminNotice key={alert.code} tone="warning">
                  <strong>{alert.code.replaceAll('_', ' ')}</strong>: {alert.summary} Current {alert.value}; threshold {alert.threshold}.
                </AdminNotice>
              ))}
            </div>
          ) : (
            <AdminEmptyState>No MCP operations alert is active for the configured thresholds.</AdminEmptyState>
          )}
        </AdminSection>
      </div>

      <AdminSection title="Publication flags" description="Release gates remain independent from measurement availability.">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Object.entries(metrics.featureFlags).map(([flag, enabled]) => (
            <div key={flag} className="flex items-center justify-between gap-3 rounded-xl border border-hairline bg-bg/60 px-4 py-3">
              <span className="font-mono text-xs text-text-secondary">{flag}</span>
              <span className={enabled ? 'text-sm font-semibold text-success' : 'text-sm font-semibold text-text-muted'}>{enabled ? 'Enabled' : 'Disabled'}</span>
            </div>
          ))}
        </div>
      </AdminSection>
    </div>
  );
}

function MetricRows({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="divide-y divide-hairline rounded-xl border border-hairline bg-bg/60">
      {rows.map(([label, value]) => (
        <div key={label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3">
          <dt className="text-sm text-text-secondary">{label}</dt>
          <dd className="text-sm font-semibold text-text-primary">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
