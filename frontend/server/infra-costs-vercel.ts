import type {
  EnvLike,
  FetchLike,
  InfraCostAlert,
  InfraCostPeriod,
  InfraCostProviderReport,
  InfraCostThresholds,
  VercelAggregateRow,
  VercelChargeRow,
  VercelDailyCostRow,
  VercelInfraCostDetails,
} from '@/server/infra-costs-types';
import {
  limitedResponseText,
  normalizeApiBaseUrl,
  normalizeDateKey,
  readEnv,
  readNumber,
  readString,
  toRecord,
} from '@/server/infra-costs-utils';

const DEFAULT_VERCEL_API_BASE_URL = 'https://api.vercel.com';

export async function fetchVercelInfraCostReport({
  env,
  fetchFn,
  period,
}: {
  env: EnvLike;
  fetchFn: FetchLike;
  period: InfraCostPeriod;
}): Promise<InfraCostProviderReport<VercelInfraCostDetails>> {
  const token = readEnv(env, 'VERCEL_TOKEN', 'VERCEL_API_TOKEN');
  const teamId = readEnv(env, 'VERCEL_TEAM_ID', 'VERCEL_USAGE_TEAM_ID');
  const teamSlug = readEnv(env, 'VERCEL_TEAM_SLUG', 'VERCEL_USAGE_TEAM_SLUG');
  const apiBaseUrl = readEnv(env, 'VERCEL_API_BASE_URL') ?? DEFAULT_VERCEL_API_BASE_URL;

  if (!token) {
    return buildUnconfiguredProvider('vercel', 'Vercel', [
      'Set VERCEL_TOKEN or VERCEL_API_TOKEN in Vercel.',
      'Set VERCEL_TEAM_ID or VERCEL_TEAM_SLUG if billing belongs to a team account.',
    ]);
  }

  try {
    const charges = await fetchVercelCharges({ apiBaseUrl, token, teamId, teamSlug, period, fetchFn });
    const currentUsd = charges.reduce((sum, charge) => sum + charge.billedUsd, 0);
    const details: VercelInfraCostDetails = {
      teamId: teamId ?? null,
      teamSlug: teamSlug ?? null,
      chargesCount: charges.length,
      effectiveCurrentUsd: charges.reduce((sum, charge) => sum + charge.effectiveUsd, 0),
      serviceRows: buildVercelAggregateRows(charges, 'service', period.projectionFactor),
      projectRows: buildVercelAggregateRows(charges, 'project', period.projectionFactor),
      dailyRows: buildVercelDailyRows(charges),
    };

    return {
      id: 'vercel',
      label: 'Vercel',
      configured: true,
      status: 'ok',
      money: {
        currentUsd,
        projectedMonthUsd: currentUsd * period.projectionFactor,
        currency: 'USD',
        source: 'actual',
      },
      error: null,
      setup: [],
      details,
    };
  } catch (error) {
    return buildErroredProvider('vercel', 'Vercel', error);
  }
}

export function buildVercelAlerts(
  provider: InfraCostProviderReport<VercelInfraCostDetails>,
  thresholds: InfraCostThresholds
): InfraCostAlert[] {
  if (!provider.configured) {
    return [
      {
        provider: 'vercel',
        level: 'warning',
        kind: 'configuration',
        title: 'Vercel billing is not configured',
        detail: provider.setup[0] ?? 'Missing Vercel API credentials.',
      },
    ];
  }

  if (provider.error || !provider.details) {
    return [
      {
        provider: 'vercel',
        level: 'warning',
        kind: 'configuration',
        title: 'Vercel billing fetch failed',
        detail: provider.error ?? 'No Vercel billing details were returned.',
      },
    ];
  }

  const alerts: InfraCostAlert[] = [];
  pushCostAlert(alerts, 'vercel', provider.money.projectedMonthUsd, thresholds.vercelMonthlyWarningUsd, thresholds.vercelMonthlyCriticalUsd);
  return alerts;
}

async function fetchVercelCharges({
  apiBaseUrl,
  token,
  teamId,
  teamSlug,
  period,
  fetchFn,
}: {
  apiBaseUrl: string;
  token: string;
  teamId: string | undefined;
  teamSlug: string | undefined;
  period: InfraCostPeriod;
  fetchFn: FetchLike;
}): Promise<VercelChargeRow[]> {
  const url = new URL('/v1/billing/charges', normalizeApiBaseUrl(apiBaseUrl, DEFAULT_VERCEL_API_BASE_URL));
  url.searchParams.set('from', period.startIso);
  url.searchParams.set('to', period.endIso);
  if (teamId) url.searchParams.set('teamId', teamId);
  if (teamSlug) url.searchParams.set('slug', teamSlug);

  const response = await fetchFn(url, {
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/jsonl',
    },
  });

  if (!response.ok) {
    throw new Error(`Vercel API ${url.pathname} failed with ${response.status}: ${await limitedResponseText(response)}`);
  }

  const text = await response.text();
  return parseVercelChargesJsonl(text);
}

function parseVercelChargesJsonl(text: string): VercelChargeRow[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as unknown)
    .map((raw) => {
      const row = toRecord(raw);
      const tags = toRecord(row.Tags);
      return {
        serviceName: readString(row.ServiceName) ?? 'Unknown service',
        serviceCategory: readString(row.ServiceCategory),
        projectId: readString(tags.ProjectId) ?? readString(tags.projectId) ?? readString(tags.project_id),
        projectName: readString(tags.ProjectName) ?? readString(tags.projectName) ?? readString(tags.project_name),
        chargeCategory: readString(row.ChargeCategory) ?? 'Usage',
        billedUsd: readNumber(row.BilledCost) ?? 0,
        effectiveUsd: readNumber(row.EffectiveCost) ?? 0,
        consumedQuantity: readNumber(row.ConsumedQuantity) ?? 0,
        consumedUnit: readString(row.ConsumedUnit) ?? '',
        periodStart: readString(row.ChargePeriodStart) ?? '',
        periodEnd: readString(row.ChargePeriodEnd) ?? '',
      };
    });
}

function buildVercelAggregateRows(charges: VercelChargeRow[], mode: 'service' | 'project', projectionFactor: number): VercelAggregateRow[] {
  const rows = new Map<string, VercelAggregateRow>();
  for (const charge of charges) {
    const key = mode === 'service' ? charge.serviceName : charge.projectId ?? charge.projectName ?? 'unassigned';
    const label = mode === 'service' ? charge.serviceName : charge.projectName ?? charge.projectId ?? 'Unassigned';
    const current = rows.get(key) ?? {
      key,
      label,
      currentUsd: 0,
      projectedMonthUsd: 0,
      chargeCount: 0,
    };
    current.currentUsd += charge.billedUsd;
    current.projectedMonthUsd = current.currentUsd * projectionFactor;
    current.chargeCount += 1;
    rows.set(key, current);
  }

  return Array.from(rows.values())
    .sort((a, b) => b.currentUsd - a.currentUsd)
    .slice(0, 12);
}

function buildVercelDailyRows(charges: VercelChargeRow[]): VercelDailyCostRow[] {
  const rows = new Map<string, VercelDailyCostRow>();
  for (const charge of charges) {
    const date = normalizeDateKey(charge.periodStart);
    const current = rows.get(date) ?? { date, billedUsd: 0, effectiveUsd: 0 };
    current.billedUsd += charge.billedUsd;
    current.effectiveUsd += charge.effectiveUsd;
    rows.set(date, current);
  }
  return Array.from(rows.values()).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 31);
}

function buildUnconfiguredProvider<TDetails>(
  id: 'vercel',
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
  id: 'vercel',
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
