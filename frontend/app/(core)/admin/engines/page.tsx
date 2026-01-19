import { notFound } from 'next/navigation';
import { requireAdmin } from '@/server/admin';
import { fetchEnginePerformanceMetrics } from '@/server/generate-metrics';
import { fetchEngineUsageMetrics } from '@/server/admin-metrics';
import { ensureEngineSettingsSeed, fetchEngineSettings } from '@/server/engine-settings';
import { getAdminEngineEntries } from '@/server/engine-overrides';
import { EngineSettingsPanel } from '@/components/admin/EngineSettingsPanel';

export const dynamic = 'force-dynamic';

function formatDuration(ms: number | null): string {
  if (ms == null) return '—';
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  return `${ms}ms`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

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

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-text-muted">Operations</p>
        <h1 className="text-3xl font-semibold text-text-primary">Engine performance &amp; configuration</h1>
        <p className="text-sm text-text-secondary">
          Track Fal status per engine, review usage and revenue, and tune availability without reaching for a separate tool.
        </p>
      </header>

      <section className="rounded-card border border-white/30 bg-white/80 p-6 shadow-card">
        <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-text-muted">Fal attempt metrics</h2>
        <p className="text-xs text-text-secondary">Rolling 30-day summary of Fal attempts grouped by engine and mode.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-white/60 text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-[0.3em] text-text-muted">
                <th className="pb-3 text-left">Engine</th>
                <th className="pb-3 text-left">Mode</th>
                <th className="pb-3 text-right">Accepted</th>
                <th className="pb-3 text-right">Rejected</th>
                <th className="pb-3 text-right">Completed</th>
                <th className="pb-3 text-right">Failed</th>
                <th className="pb-3 text-right">Avg duration</th>
                <th className="pb-3 text-right">P95 duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/50">
              {performanceMetrics.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-text-secondary">
                    No Fal attempt metrics recorded yet.
                  </td>
                </tr>
              ) : (
                performanceMetrics.map((row) => (
                  <tr key={`${row.engineId}-${row.mode}`}>
                    <td className="py-3 font-medium text-text-primary">{row.engineLabel}</td>
                    <td className="py-3 text-text-secondary">{row.mode}</td>
                    <td className="py-3 text-right font-semibold text-text-primary">{formatNumber(row.acceptedCount)}</td>
                    <td className="py-3 text-right text-text-secondary">{formatNumber(row.rejectedCount)}</td>
                    <td className="py-3 text-right text-text-secondary">{formatNumber(row.completedCount)}</td>
                    <td className="py-3 text-right text-text-secondary">{formatNumber(row.failedCount)}</td>
                    <td className="py-3 text-right text-text-primary">{formatDuration(row.averageDurationMs)}</td>
                    <td className="py-3 text-right text-text-primary">{formatDuration(row.p95DurationMs)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-card border border-white/30 bg-white/80 p-6 shadow-card">
        <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-text-muted">Usage &amp; revenue (30d)</h2>
        <p className="text-xs text-text-secondary">Renders, distinct users, revenue share, and average spend per engine.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-[0.3em] text-text-muted">
                <th className="py-2 font-semibold">Engine</th>
                <th className="py-2 font-semibold">Renders</th>
                <th className="py-2 font-semibold">Distinct users</th>
                <th className="py-2 font-semibold">Revenue</th>
                <th className="py-2 font-semibold">Share of renders</th>
                <th className="py-2 font-semibold">Share of revenue</th>
                <th className="py-2 font-semibold">Avg spend / user</th>
              </tr>
            </thead>
            <tbody>
              {usageMetrics.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-4 text-center text-sm text-text-secondary">
                    No engine usage recorded over the last 30 days.
                  </td>
                </tr>
              ) : (
                usageMetrics.map((engine) => (
                  <tr key={engine.engineId} className="border-t border-white/40 text-text-secondary">
                    <td className="py-2 font-semibold text-text-primary">{engine.engineLabel}</td>
                    <td className="py-2">{formatNumber(engine.rendersCount30d)}</td>
                    <td className="py-2">{formatNumber(engine.distinctUsers30d)}</td>
                    <td className="py-2">{formatCurrency(engine.rendersAmount30dUsd)}</td>
                    <td className="py-2">{(engine.shareOfTotalRenders30d * 100).toFixed(1)}%</td>
                    <td className="py-2">{(engine.shareOfTotalRevenue30d * 100).toFixed(1)}%</td>
                    <td className="py-2">{engine.avgSpendPerUser30d ? formatCurrency(engine.avgSpendPerUser30d) : '$0'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <header>
          <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-text-muted">Configuration</h2>
          <p className="text-xs text-text-secondary">
            Edit availability, overrides, and pricing for each engine. Changes take effect immediately on the next quote.
          </p>
        </header>
        {databaseAvailable ? (
          configEntries.length ? (
            <div className="space-y-4">
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
            <div className="rounded-2xl border border-white/30 bg-white/80 p-5 text-sm text-text-secondary shadow-card">
              No engines registered yet. Seed engine settings to enable configuration.
            </div>
          )
        ) : (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-700">
            Database connection missing. Set <code className="font-mono text-xs">DATABASE_URL</code> to edit engine overrides.
          </div>
        )}
      </section>
    </div>
  );
}

type ConfigEntry = Awaited<ReturnType<typeof loadEngineConfigEntries>>[number];

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
