import { Activity, Clock3, Cpu, DollarSign, ShieldAlert } from 'lucide-react';
import type { AdminMetricItem } from '@/components/admin-system/surfaces/AdminMetricGrid';
import { fetchEngineUsageMetrics } from '@/server/admin-metrics';
import { ensureEngineSettingsSeed, fetchEngineSettings } from '@/server/engine-settings';
import { getAdminEngineEntries } from '@/server/engine-overrides';
import { fetchEnginePerformanceMetrics, type EnginePerformanceMetric } from '@/server/generate-metrics';

export type AdminEngineConfigEntry = Awaited<ReturnType<typeof loadEngineConfigEntries>>[number];

export type EngineConfigSnapshot = {
  engineId: string;
  engineLabel: string;
  active: boolean;
  availability: string;
  status: string;
  latencyTier: string;
  perSecondCents: number | null;
  flatCents: number | null;
};

export type EngineOpsRow = {
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

export type EngineCommercialRow = {
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

export type AdminEnginesViewModel = {
  databaseAvailable: boolean;
  configEntries: AdminEngineConfigEntry[];
  configSnapshotByEngineId: Map<string, EngineConfigSnapshot>;
  overviewCards: AdminMetricItem[];
  opsRows: EngineOpsRow[];
  commercialRows: EngineCommercialRow[];
  configMeta: {
    total: number;
    active: number;
    attention: number;
  };
  attentionConfigEntries: AdminEngineConfigEntry[];
  stableConfigEntries: AdminEngineConfigEntry[];
  disabledConfigs: number;
  limitedConfigs: number;
  degradedConfigs: number;
};

const numberFormatter = new Intl.NumberFormat('en-US');
const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

export async function loadAdminEnginesViewModel({
  databaseAvailable,
}: {
  databaseAvailable: boolean;
}): Promise<AdminEnginesViewModel> {
  const [performanceMetrics, usageMetrics, configEntries] = await Promise.all([
    fetchEnginePerformanceMetrics(),
    fetchEngineUsageMetrics(),
    databaseAvailable ? loadEngineConfigEntries() : Promise.resolve([]),
  ]);

  const configSnapshots = configEntries.map(buildConfigSnapshot);
  const configSnapshotByEngineId = new Map(configSnapshots.map((snapshot) => [snapshot.engineId, snapshot] as const));
  const overviewCards = buildOverviewCards(performanceMetrics, usageMetrics, configSnapshots);
  const opsRows = buildOperationalRows(performanceMetrics, configSnapshots);
  const commercialRows = buildCommercialRows(usageMetrics, configSnapshots);
  const configMeta = summarizeConfig(configSnapshots);
  const attentionConfigEntries = configEntries.filter((entry) => {
    const snapshot = configSnapshotByEngineId.get(entry.engine.id);
    return snapshot ? needsConfigAttention(snapshot) : false;
  });
  const stableConfigEntries = configEntries.filter((entry) => {
    const snapshot = configSnapshotByEngineId.get(entry.engine.id);
    return snapshot ? !needsConfigAttention(snapshot) : false;
  });

  return {
    databaseAvailable,
    configEntries,
    configSnapshotByEngineId,
    overviewCards,
    opsRows,
    commercialRows,
    configMeta,
    attentionConfigEntries,
    stableConfigEntries,
    disabledConfigs: configSnapshots.filter((snapshot) => !snapshot.active).length,
    limitedConfigs: configSnapshots.filter((snapshot) => snapshot.availability !== 'available').length,
    degradedConfigs: configSnapshots.filter((snapshot) => !['live', 'busy'].includes(snapshot.status)).length,
  };
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

export function buildInitialForm(entry: AdminEngineConfigEntry) {
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

export function buildBaseline(entry: AdminEngineConfigEntry) {
  return {
    availability: entry.engine.availability,
    status: entry.engine.status,
    latencyTier: entry.engine.latencyTier,
    maxDurationSec: entry.engine.maxDurationSec ?? null,
    resolutions: entry.engine.resolutions ?? [],
    currency: entry.engine.pricingDetails?.currency ?? 'USD',
    perSecondCents: entry.engine.pricingDetails?.perSecondCents?.default ?? null,
    flatCents: entry.engine.pricingDetails?.flatCents?.default ?? null,
  };
}

export function buildConfigSnapshot(entry: AdminEngineConfigEntry): EngineConfigSnapshot {
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

export function buildOverviewCards(
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
      helper: `${formatNumber(configSnapshots.length - activeConfigs)} disabled override${
        configSnapshots.length - activeConfigs === 1 ? '' : 's'
      }`,
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
      helper: `${formatNumber(attemptTotals.completed)} completed attempt${
        attemptTotals.completed === 1 ? '' : 's'
      } tracked`,
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

export function buildOperationalRows(
  performanceMetrics: EnginePerformanceMetric[],
  configSnapshots: EngineConfigSnapshot[]
): EngineOpsRow[] {
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
    const p95DurationMs = metrics.reduce<number | null>((max, row) => {
      if (row.p95DurationMs == null) return max;
      if (max == null || row.p95DurationMs > max) return row.p95DurationMs;
      return max;
    }, null);

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

export function buildCommercialRows(
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

export function summarizeConfig(configSnapshots: EngineConfigSnapshot[]) {
  return {
    total: configSnapshots.length,
    active: configSnapshots.filter((row) => row.active).length,
    attention: configSnapshots.filter(needsConfigAttention).length,
  };
}

export function needsConfigAttention(config: EngineConfigSnapshot) {
  if (!config.active) return true;
  return config.availability !== 'available' || !['live', 'busy'].includes(config.status);
}

export function buildOpsAttentionLabel(rows: EngineOpsRow[]) {
  const attention = rows.filter((row) => row.failureRate >= 0.15 || needsConfigAttention(row.config ?? fallbackConfig(row))).length;
  return attention ? `${formatNumber(attention)} engine${attention === 1 ? '' : 's'} to review` : 'No engine currently flagged';
}

export function buildRevenueLabel(rows: EngineCommercialRow[]) {
  const totalRevenue = rows.reduce((sum, row) => sum + row.rendersAmount30dUsd, 0);
  return totalRevenue > 0 ? `${formatCurrency(totalRevenue)} total 30d revenue` : 'No revenue tracked in the current window';
}

export function summarizeConfigIssue(config: EngineConfigSnapshot) {
  const notes: string[] = [];

  if (!config.active) notes.push('disabled');
  if (config.availability !== 'available') notes.push(config.availability);
  if (!['live', 'busy'].includes(config.status)) notes.push(config.status.replace('_', ' '));

  return notes.length ? notes.join(' · ') : 'Healthy';
}

export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

export function formatCurrency(value: number): string {
  return usdFormatter.format(value);
}

export function formatMoneyCents(value: number): string {
  return usdFormatter.format(value / 100);
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function formatDuration(ms: number | null): string {
  if (ms == null) return '—';
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
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
