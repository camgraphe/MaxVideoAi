import type { EnvLike, FetchLike, InfraCostAlert, InfraCostPeriod, InfraCostProviderReport, InfraCostThresholds, NeonBranchSummary, NeonDailyUsageRow, NeonInfraCostDetails, NeonUsageTotals } from '@/server/infra-costs-types';
import {
  fetchJson,
  GIB,
  normalizeApiBaseUrl,
  normalizeDateKey,
  readArray,
  readCsvEnv,
  readEnv,
  readNumber,
  readNumberEnv,
  readPositiveInteger,
  readString,
  roundUsage,
  sumObjectValues,
  toRecord,
} from '@/server/infra-costs-utils';

const DEFAULT_NEON_API_BASE_URL = 'https://console.neon.tech/api/v2';
const DEFAULT_NEON_ORG_ID = 'org-red-feather-54991024';
const DEFAULT_NEON_PROJECT_ID = 'shy-flower-71253790';

const NEON_METRICS = [
  'compute_unit_seconds',
  'root_branch_bytes_month',
  'child_branch_bytes_month',
  'instant_restore_bytes_month',
  'public_network_transfer_bytes',
  'private_network_transfer_bytes',
  'extra_branches_month',
  'snapshot_storage_bytes_month',
] as const;

type NeonMetricName = (typeof NEON_METRICS)[number];
type NeonMetricMap = Record<NeonMetricName, number>;

type NeonProjectUsage = {
  projectId: string;
  projectName: string | null;
  rows: Array<{
    date: string;
    metrics: NeonMetricMap;
  }>;
};

const EMPTY_NEON_METRICS: NeonMetricMap = {
  compute_unit_seconds: 0,
  root_branch_bytes_month: 0,
  child_branch_bytes_month: 0,
  instant_restore_bytes_month: 0,
  public_network_transfer_bytes: 0,
  private_network_transfer_bytes: 0,
  extra_branches_month: 0,
  snapshot_storage_bytes_month: 0,
};

export async function fetchNeonInfraCostReport({
  env,
  fetchFn,
  period,
}: {
  env: EnvLike;
  fetchFn: FetchLike;
  period: InfraCostPeriod;
}): Promise<InfraCostProviderReport<NeonInfraCostDetails>> {
  const token = readEnv(env, 'NEON_API_KEY', 'NEON_API_TOKEN');
  const orgId = readEnv(env, 'NEON_USAGE_ORG_ID', 'NEON_ORG_ID') ?? DEFAULT_NEON_ORG_ID;
  const projectIds = readCsvEnv(env, 'NEON_USAGE_PROJECT_IDS', 'NEON_PROJECT_ID', 'NEON_BRANCH_GUARD_PROJECT_ID');
  const resolvedProjectIds = projectIds.length ? projectIds : [DEFAULT_NEON_PROJECT_ID];
  const plan = readEnv(env, 'NEON_USAGE_PLAN')?.toLowerCase() === 'scale' ? 'scale' : 'launch';
  const rates = readNeonRates(env, plan);
  const branchGuardLimit = readPositiveInteger(env, ['NEON_BRANCH_LIMIT', 'NEON_USAGE_BRANCH_CRITICAL'], 8);
  const apiBaseUrl = readEnv(env, 'NEON_API_BASE_URL') ?? DEFAULT_NEON_API_BASE_URL;

  if (!token) {
    return buildUnconfiguredProvider('neon', 'Neon', [
      'Set NEON_API_KEY or NEON_API_TOKEN in Vercel.',
      'Set NEON_USAGE_ORG_ID and NEON_USAGE_PROJECT_IDS if the defaults do not match the production Neon project.',
    ]);
  }

  try {
    const usage = await fetchNeonConsumption({ apiBaseUrl, token, orgId, projectIds: resolvedProjectIds, period, fetchFn });
    const branches = await Promise.all(
      resolvedProjectIds.map((projectId) => fetchNeonBranchSummary({ apiBaseUrl, token, projectId, fetchFn }))
    );
    const totals = buildNeonTotals(usage, branches);
    const projectedTotals = projectNeonTotals(totals, period.projectionFactor);
    const costBreakdown = estimateNeonCosts(totals, rates);
    const projectedCostBreakdown = estimateNeonCosts(projectedTotals, rates);
    const details: NeonInfraCostDetails = {
      orgId,
      projectIds: resolvedProjectIds,
      plan,
      branchGuardLimit,
      includedPublicTransferGb: rates.includedPublicTransferGb,
      rates,
      totals,
      projectedTotals,
      costBreakdown,
      projectedCostBreakdown,
      branches,
      dailyRows: buildNeonDailyRows(usage, rates),
    };

    return {
      id: 'neon',
      label: 'Neon',
      configured: true,
      status: 'ok',
      money: {
        currentUsd: sumObjectValues(costBreakdown),
        projectedMonthUsd: sumObjectValues(projectedCostBreakdown),
        currency: 'USD',
        source: 'estimated',
      },
      error: null,
      setup: [],
      details,
    };
  } catch (error) {
    return buildErroredProvider('neon', 'Neon', error);
  }
}

export function buildNeonAlerts(
  provider: InfraCostProviderReport<NeonInfraCostDetails>,
  thresholds: InfraCostThresholds
): InfraCostAlert[] {
  if (!provider.configured) {
    return [
      {
        provider: 'neon',
        level: 'warning',
        kind: 'configuration',
        title: 'Neon usage is not configured',
        detail: provider.setup[0] ?? 'Missing Neon API credentials.',
      },
    ];
  }

  if (provider.error || !provider.details) {
    return [
      {
        provider: 'neon',
        level: 'warning',
        kind: 'configuration',
        title: 'Neon usage fetch failed',
        detail: provider.error ?? 'No Neon details were returned.',
      },
    ];
  }

  const alerts: InfraCostAlert[] = [];
  pushCostAlert(alerts, 'neon', provider.money.projectedMonthUsd, thresholds.neonMonthlyWarningUsd, thresholds.neonMonthlyCriticalUsd);

  const branchCount = provider.details.totals.currentBranchCount;
  if (branchCount !== null) {
    const limit = provider.details.branchGuardLimit;
    if (branchCount > limit) {
      alerts.push({
        provider: 'neon',
        level: 'critical',
        kind: 'branch',
        title: 'Neon branch guard exceeded',
        detail: `${branchCount} active branches for a guard limit of ${limit}.`,
      });
    } else if (branchCount >= Math.max(1, limit - 1)) {
      alerts.push({
        provider: 'neon',
        level: 'warning',
        kind: 'branch',
        title: 'Neon branch count near guard',
        detail: `${branchCount} active branches for a guard limit of ${limit}.`,
      });
    }
  }

  const projectedPublicGb = provider.details.projectedTotals.publicTransferGb;
  const includedGb = provider.details.includedPublicTransferGb;
  if (projectedPublicGb >= includedGb) {
    alerts.push({
      provider: 'neon',
      level: 'critical',
      kind: 'usage',
      title: 'Neon public transfer projected over allowance',
      detail: `${roundUsage(projectedPublicGb)} GB projected for ${includedGb} GB included.`,
    });
  } else if (projectedPublicGb >= includedGb * 0.8) {
    alerts.push({
      provider: 'neon',
      level: 'warning',
      kind: 'usage',
      title: 'Neon public transfer near allowance',
      detail: `${roundUsage(projectedPublicGb)} GB projected for ${includedGb} GB included.`,
    });
  }

  return alerts;
}

async function fetchNeonConsumption({
  apiBaseUrl,
  token,
  orgId,
  projectIds,
  period,
  fetchFn,
}: {
  apiBaseUrl: string;
  token: string;
  orgId: string;
  projectIds: string[];
  period: InfraCostPeriod;
  fetchFn: FetchLike;
}): Promise<NeonProjectUsage[]> {
  const url = new URL('/api/v2/consumption_history/v2/projects', normalizeApiBaseUrl(apiBaseUrl, DEFAULT_NEON_API_BASE_URL));
  url.searchParams.set('org_id', orgId);
  url.searchParams.set('from', period.startIso);
  url.searchParams.set('to', period.endIso);
  url.searchParams.set('granularity', 'daily');
  url.searchParams.set('metrics', NEON_METRICS.join(','));
  url.searchParams.set('project_ids', projectIds.join(','));
  url.searchParams.set('limit', String(Math.max(10, projectIds.length)));

  const payload = await fetchJson(url, token, fetchFn);
  return parseNeonConsumptionPayload(payload);
}

async function fetchNeonBranchSummary({
  apiBaseUrl,
  token,
  projectId,
  fetchFn,
}: {
  apiBaseUrl: string;
  token: string;
  projectId: string;
  fetchFn: FetchLike;
}): Promise<NeonBranchSummary> {
  const url = new URL(`/api/v2/projects/${encodeURIComponent(projectId)}/branches`, normalizeApiBaseUrl(apiBaseUrl, DEFAULT_NEON_API_BASE_URL));
  const payload = await fetchJson(url, token, fetchFn);
  const branches = Array.isArray((payload as { branches?: unknown[] }).branches)
    ? ((payload as { branches: unknown[] }).branches)
    : [];
  const byState: Record<string, number> = {};
  let primary = 0;
  let oldestNonPrimaryCreatedAt: string | null = null;

  for (const branch of branches) {
    const record = toRecord(branch);
    const state = readString(record.current_state) ?? readString(record.state) ?? 'unknown';
    byState[state] = (byState[state] ?? 0) + 1;
    if (record.primary === true) {
      primary += 1;
    } else {
      const createdAt = readString(record.created_at);
      if (createdAt && (!oldestNonPrimaryCreatedAt || createdAt < oldestNonPrimaryCreatedAt)) {
        oldestNonPrimaryCreatedAt = createdAt;
      }
    }
  }

  return {
    projectId,
    total: branches.length,
    primary,
    nonPrimary: Math.max(0, branches.length - primary),
    byState,
    oldestNonPrimaryCreatedAt,
  };
}

function parseNeonConsumptionPayload(payload: unknown): NeonProjectUsage[] {
  const root = toRecord(payload);
  const projects = readArray(root.projects) ?? readArray(root.consumption_history) ?? [];

  return projects.map((project, index) => {
    const projectRecord = toRecord(project);
    const projectId =
      readString(projectRecord.project_id) ??
      readString(projectRecord.id) ??
      readString(projectRecord.projectId) ??
      `project-${index + 1}`;
    const projectName = readString(projectRecord.project_name) ?? readString(projectRecord.name);
    const periods = readArray(projectRecord.periods) ?? [projectRecord];
    const rows = periods.flatMap((period) => parseNeonPeriodRows(period));

    return { projectId, projectName, rows };
  });
}

function parseNeonPeriodRows(period: unknown): NeonProjectUsage['rows'] {
  const periodRecord = toRecord(period);
  const records =
    readArray(periodRecord.consumption) ??
    readArray(periodRecord.metrics) ??
    readArray(periodRecord.data) ??
    [];

  return records.map((record) => {
    const metricRecord = toRecord(record);
    return {
      date: normalizeDateKey(
        readString(metricRecord.timeframe_start) ??
          readString(metricRecord.period_start) ??
          readString(metricRecord.start_time) ??
          readString(metricRecord.time) ??
          readString(metricRecord.date) ??
          readString(periodRecord.period_start) ??
          ''
      ),
      metrics: readNeonMetrics(metricRecord),
    };
  });
}

function readNeonMetrics(record: Record<string, unknown>): NeonMetricMap {
  const metrics = { ...EMPTY_NEON_METRICS };
  const metricEntries = readArray(record.metrics) ?? [];

  if (metricEntries.length) {
    for (const entry of metricEntries) {
      const metric = toRecord(entry);
      const name = readString(metric.metric_name) ?? readString(metric.name);
      if (isNeonMetricName(name)) {
        metrics[name] += readNumber(metric.value) ?? 0;
      }
    }
    return metrics;
  }

  for (const metricName of NEON_METRICS) {
    metrics[metricName] += readNumber(record[metricName]) ?? 0;
  }

  return metrics;
}

function buildNeonTotals(usage: NeonProjectUsage[], branches: NeonBranchSummary[]): NeonUsageTotals {
  const metricTotals = usage.flatMap((project) => project.rows).reduce((totals, row) => addNeonMetricMaps(totals, row.metrics), { ...EMPTY_NEON_METRICS });
  return {
    computeCuHours: metricTotals.compute_unit_seconds / 3600,
    rootBranchGbMonth: metricTotals.root_branch_bytes_month / GIB,
    childBranchGbMonth: metricTotals.child_branch_bytes_month / GIB,
    instantRestoreGbMonth: metricTotals.instant_restore_bytes_month / GIB,
    snapshotStorageGbMonth: metricTotals.snapshot_storage_bytes_month / GIB,
    publicTransferGb: metricTotals.public_network_transfer_bytes / GIB,
    privateTransferGb: metricTotals.private_network_transfer_bytes / GIB,
    extraBranchesMonth: metricTotals.extra_branches_month,
    currentBranchCount: branches.length ? branches.reduce((sum, branch) => sum + branch.total, 0) : null,
  };
}

function projectNeonTotals(totals: NeonUsageTotals, factor: number): NeonUsageTotals {
  return {
    ...totals,
    computeCuHours: totals.computeCuHours * factor,
    rootBranchGbMonth: totals.rootBranchGbMonth * factor,
    childBranchGbMonth: totals.childBranchGbMonth * factor,
    instantRestoreGbMonth: totals.instantRestoreGbMonth * factor,
    snapshotStorageGbMonth: totals.snapshotStorageGbMonth * factor,
    publicTransferGb: totals.publicTransferGb * factor,
    privateTransferGb: totals.privateTransferGb * factor,
    extraBranchesMonth: totals.extraBranchesMonth * factor,
  };
}

function estimateNeonCosts(totals: NeonUsageTotals, rates: NeonInfraCostDetails['rates']) {
  return {
    computeUsd: totals.computeCuHours * rates.computeCuHourUsd,
    storageUsd: (totals.rootBranchGbMonth + totals.childBranchGbMonth) * rates.storageGbMonthUsd,
    instantRestoreUsd: totals.instantRestoreGbMonth * rates.instantRestoreGbMonthUsd,
    snapshotStorageUsd: totals.snapshotStorageGbMonth * rates.snapshotStorageGbMonthUsd,
    publicTransferUsd: Math.max(0, totals.publicTransferGb - rates.includedPublicTransferGb) * rates.publicTransferGbUsd,
    privateTransferUsd: totals.privateTransferGb * rates.privateTransferGbUsd,
    extraBranchUsd: totals.extraBranchesMonth * rates.extraBranchMonthUsd,
  };
}

function buildNeonDailyRows(usage: NeonProjectUsage[], rates: NeonInfraCostDetails['rates']): NeonDailyUsageRow[] {
  return usage
    .flatMap((project) =>
      project.rows.map((row) => {
        const totals: NeonUsageTotals = {
          computeCuHours: row.metrics.compute_unit_seconds / 3600,
          rootBranchGbMonth: row.metrics.root_branch_bytes_month / GIB,
          childBranchGbMonth: row.metrics.child_branch_bytes_month / GIB,
          instantRestoreGbMonth: row.metrics.instant_restore_bytes_month / GIB,
          snapshotStorageGbMonth: row.metrics.snapshot_storage_bytes_month / GIB,
          publicTransferGb: row.metrics.public_network_transfer_bytes / GIB,
          privateTransferGb: row.metrics.private_network_transfer_bytes / GIB,
          extraBranchesMonth: row.metrics.extra_branches_month,
          currentBranchCount: null,
        };
        return {
          date: row.date,
          projectId: project.projectName ?? project.projectId,
          computeCuHours: totals.computeCuHours,
          publicTransferGb: totals.publicTransferGb,
          privateTransferGb: totals.privateTransferGb,
          extraBranchesMonth: totals.extraBranchesMonth,
          estimatedUsd: sumObjectValues(estimateNeonCosts({ ...totals, publicTransferGb: 0 }, { ...rates, includedPublicTransferGb: 0 })),
        };
      })
    )
    .sort((a, b) => `${b.date}:${b.projectId}`.localeCompare(`${a.date}:${a.projectId}`))
    .slice(0, 31);
}

function readNeonRates(env: EnvLike, plan: 'launch' | 'scale'): NeonInfraCostDetails['rates'] {
  return {
    computeCuHourUsd: readNumberEnv(env, ['NEON_COMPUTE_CU_HOUR_USD'], plan === 'scale' ? 0.222 : 0.106),
    storageGbMonthUsd: readNumberEnv(env, ['NEON_STORAGE_GB_MONTH_USD'], 0.35),
    instantRestoreGbMonthUsd: readNumberEnv(env, ['NEON_INSTANT_RESTORE_GB_MONTH_USD'], 0.2),
    snapshotStorageGbMonthUsd: readNumberEnv(env, ['NEON_SNAPSHOT_STORAGE_GB_MONTH_USD'], 0.35),
    extraBranchMonthUsd: readNumberEnv(env, ['NEON_EXTRA_BRANCH_MONTH_USD'], 1.5),
    publicTransferGbUsd: readNumberEnv(env, ['NEON_PUBLIC_TRANSFER_GB_USD'], 0.1),
    privateTransferGbUsd: readNumberEnv(env, ['NEON_PRIVATE_TRANSFER_GB_USD'], 0.01),
    includedPublicTransferGb: readNumberEnv(env, ['NEON_PUBLIC_TRANSFER_INCLUDED_GB'], 500),
  };
}

function addNeonMetricMaps(left: NeonMetricMap, right: NeonMetricMap): NeonMetricMap {
  const next = { ...left };
  for (const metric of NEON_METRICS) {
    next[metric] += right[metric];
  }
  return next;
}

function isNeonMetricName(value: string | null | undefined): value is NeonMetricName {
  return Boolean(value && (NEON_METRICS as readonly string[]).includes(value));
}

function buildUnconfiguredProvider<TDetails>(
  id: 'neon',
  label: string,
  setup: string[]
): InfraCostProviderReport<TDetails> {
  return {
    id,
    label,
    configured: false,
    status: 'warning',
    money: { currentUsd: 0, projectedMonthUsd: 0, currency: 'USD', source: 'unconfigured' },
    error: null,
    setup,
    details: null,
  };
}

function buildErroredProvider<TDetails>(
  id: 'neon',
  label: string,
  error: unknown
): InfraCostProviderReport<TDetails> {
  return {
    id,
    label,
    configured: true,
    status: 'warning',
    money: { currentUsd: 0, projectedMonthUsd: 0, currency: 'USD', source: 'partial' },
    error: error instanceof Error ? error.message : String(error),
    setup: [],
    details: null,
  };
}

function pushCostAlert(
  alerts: InfraCostAlert[],
  provider: InfraCostAlert['provider'],
  projectedMonthUsd: number,
  warningUsd: number,
  criticalUsd: number
) {
  if (projectedMonthUsd >= criticalUsd) {
    alerts.push({
      provider,
      level: 'critical',
      kind: 'cost',
      title: 'Projected monthly cost above critical threshold',
      detail: `$${projectedMonthUsd.toFixed(2)} projected against $${criticalUsd.toFixed(2)} critical threshold.`,
      projectedMonthUsd,
      thresholdUsd: criticalUsd,
    });
  } else if (projectedMonthUsd >= warningUsd) {
    alerts.push({
      provider,
      level: 'warning',
      kind: 'cost',
      title: 'Projected monthly cost above warning threshold',
      detail: `$${projectedMonthUsd.toFixed(2)} projected against $${warningUsd.toFixed(2)} warning threshold.`,
      projectedMonthUsd,
      thresholdUsd: warningUsd,
    });
  }
}
