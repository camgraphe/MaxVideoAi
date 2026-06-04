import { buildNeonAlerts, fetchNeonInfraCostReport } from '@/server/infra-costs-neon';
import { buildS3Alerts, fetchS3InfraCostReport } from '@/server/infra-costs-s3';
import type {
  EnvLike,
  FetchLike,
  InfraCostAlert,
  InfraCostAlertLevel,
  InfraCostMoneySummary,
  InfraCostPeriod,
  InfraCostsReport,
  InfraCostThresholds,
} from '@/server/infra-costs-types';
import { readEnv, readNumberEnv, roundMoney, roundUsage } from '@/server/infra-costs-utils';
import { buildVercelAlerts, fetchVercelInfraCostReport } from '@/server/infra-costs-vercel';

export type {
  InfraCostAlert,
  InfraCostAlertLevel,
  InfraCostProviderId,
  InfraCostPeriod,
  InfraCostMoneySummary,
  InfraCostsReport,
  NeonBranchSummary,
  NeonDailyUsageRow,
  NeonInfraCostDetails,
  NeonUsageCostBreakdown,
  NeonUsageTotals,
  S3DailyCostRow,
  S3InfraCostDetails,
  S3UsageCostRow,
  VercelAggregateRow,
  VercelChargeRow,
  VercelDailyCostRow,
  VercelInfraCostDetails,
} from '@/server/infra-costs-types';

export const INFRA_COST_ALERT_ACTION = 'INFRA_COST_ALERT';

type FetchInfraCostsReportOptions = {
  now?: Date;
  env?: EnvLike;
  fetchFn?: FetchLike;
};

export async function fetchInfraCostsReport(options: FetchInfraCostsReportOptions = {}): Promise<InfraCostsReport> {
  const now = options.now ?? new Date();
  const env = options.env ?? process.env;
  const fetchFn = options.fetchFn ?? fetch;
  const period = buildCurrentUtcMonthPeriod(now);

  const [neon, vercel, s3] = await Promise.all([
    fetchNeonInfraCostReport({ env, fetchFn, period }),
    fetchVercelInfraCostReport({ env, fetchFn, period }),
    fetchS3InfraCostReport({ env, fetchFn, period }),
  ]);

  const thresholds = readThresholds(env);
  const providerAlerts = [
    ...buildNeonAlerts(neon, thresholds),
    ...buildVercelAlerts(vercel, thresholds),
    ...buildS3Alerts(s3, thresholds),
  ];
  const money: InfraCostMoneySummary = {
    currentUsd: neon.money.currentUsd + vercel.money.currentUsd + s3.money.currentUsd,
    projectedMonthUsd: neon.money.projectedMonthUsd + vercel.money.projectedMonthUsd + s3.money.projectedMonthUsd,
    currency: 'USD',
    source: resolveCombinedMoneySource([neon.money.source, vercel.money.source, s3.money.source]),
  };
  const alerts = [...providerAlerts, ...buildTotalCostAlerts(money, thresholds)];

  return {
    generatedAtIso: now.toISOString(),
    period,
    money,
    alertLevel: maxAlertLevel(alerts),
    notificationLevel: maxAlertLevel(alerts.filter((alert) => alert.kind !== 'configuration')),
    alerts,
    thresholds,
    providers: { neon, vercel, s3 },
    notifications: {
      emailConfigured: Boolean(readEnv(env, 'INFRA_COST_ALERT_EMAIL_TO')),
      slackConfigured: Boolean(readEnv(env, 'SLACK_WEBHOOK_URL')),
    },
  };
}

export function buildInfraCostAlertDigest(report: InfraCostsReport) {
  const actionableAlerts = report.alerts.filter((alert) => alert.kind !== 'configuration');
  const topAlerts = actionableAlerts.slice(0, 6);
  const summary =
    `Infra costs ${report.notificationLevel.toUpperCase()}: ` +
    `$${report.money.currentUsd.toFixed(2)} current, ` +
    `$${report.money.projectedMonthUsd.toFixed(2)} projected this month`;

  return {
    level: report.notificationLevel,
    summary,
    text: [
      summary,
      `Period: ${report.period.startIso} -> ${report.period.endIso}`,
      ...topAlerts.map((alert) => `- ${alert.provider}: ${alert.title} (${alert.detail})`),
    ].join('\n'),
    metadata: {
      currentUsd: roundMoney(report.money.currentUsd),
      projectedMonthUsd: roundMoney(report.money.projectedMonthUsd),
      alertLevel: report.notificationLevel,
      generatedAt: report.generatedAtIso,
      periodStart: report.period.startIso,
      periodEnd: report.period.endIso,
      neon: {
        configured: report.providers.neon.configured,
        currentUsd: roundMoney(report.providers.neon.money.currentUsd),
        projectedMonthUsd: roundMoney(report.providers.neon.money.projectedMonthUsd),
        branchCount: report.providers.neon.details?.totals.currentBranchCount ?? null,
        publicTransferGb: roundUsage(report.providers.neon.details?.totals.publicTransferGb ?? 0),
      },
      vercel: {
        configured: report.providers.vercel.configured,
        currentUsd: roundMoney(report.providers.vercel.money.currentUsd),
        projectedMonthUsd: roundMoney(report.providers.vercel.money.projectedMonthUsd),
        chargesCount: report.providers.vercel.details?.chargesCount ?? 0,
      },
      s3: {
        configured: report.providers.s3.configured,
        currentUsd: roundMoney(report.providers.s3.money.currentUsd),
        projectedMonthUsd: roundMoney(report.providers.s3.money.projectedMonthUsd),
        resultsCount: report.providers.s3.details?.resultsCount ?? 0,
        bucketName: report.providers.s3.details?.bucketName ?? null,
      },
      alerts: topAlerts.map((alert) => ({
        provider: alert.provider,
        level: alert.level,
        kind: alert.kind,
        title: alert.title,
        detail: alert.detail,
        currentUsd: alert.currentUsd === undefined ? undefined : roundMoney(alert.currentUsd),
        projectedMonthUsd: alert.projectedMonthUsd === undefined ? undefined : roundMoney(alert.projectedMonthUsd),
        thresholdUsd: alert.thresholdUsd === undefined ? undefined : roundMoney(alert.thresholdUsd),
      })),
    },
  };
}

export function buildCurrentUtcMonthPeriod(now: Date): InfraCostPeriod {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
  const end = new Date(Math.min(now.getTime(), monthEnd.getTime()));
  const elapsedMs = Math.max(1, end.getTime() - start.getTime());
  const monthMs = Math.max(1, monthEnd.getTime() - start.getTime());
  const elapsedRatio = Math.min(1, Math.max(0, elapsedMs / monthMs));
  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    monthEndIso: monthEnd.toISOString(),
    elapsedRatio,
    projectionFactor: elapsedRatio > 0 ? 1 / elapsedRatio : 1,
  };
}

function readThresholds(env: EnvLike): InfraCostThresholds {
  return {
    monthlyWarningUsd: readNumberEnv(env, ['INFRA_COST_MONTHLY_WARNING_USD'], 180),
    monthlyCriticalUsd: readNumberEnv(env, ['INFRA_COST_MONTHLY_CRITICAL_USD'], 300),
    neonMonthlyWarningUsd: readNumberEnv(env, ['NEON_USAGE_MONTHLY_WARNING_USD'], 80),
    neonMonthlyCriticalUsd: readNumberEnv(env, ['NEON_USAGE_MONTHLY_CRITICAL_USD'], 150),
    vercelMonthlyWarningUsd: readNumberEnv(env, ['VERCEL_USAGE_MONTHLY_WARNING_USD'], 120),
    vercelMonthlyCriticalUsd: readNumberEnv(env, ['VERCEL_USAGE_MONTHLY_CRITICAL_USD'], 250),
    s3MonthlyWarningUsd: readNumberEnv(env, ['S3_USAGE_MONTHLY_WARNING_USD', 'AWS_S3_USAGE_MONTHLY_WARNING_USD'], 40),
    s3MonthlyCriticalUsd: readNumberEnv(env, ['S3_USAGE_MONTHLY_CRITICAL_USD', 'AWS_S3_USAGE_MONTHLY_CRITICAL_USD'], 80),
  };
}

function buildTotalCostAlerts(money: InfraCostMoneySummary, thresholds: InfraCostThresholds): InfraCostAlert[] {
  const alerts: InfraCostAlert[] = [];
  pushCostAlert(alerts, 'total', money.projectedMonthUsd, thresholds.monthlyWarningUsd, thresholds.monthlyCriticalUsd);
  return alerts;
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

function resolveCombinedMoneySource(sources: InfraCostMoneySummary['source'][]): InfraCostMoneySummary['source'] {
  if (sources.every((source) => source === 'unconfigured')) return 'unconfigured';
  if (sources.some((source) => source === 'partial')) return 'partial';
  if (sources.every((source) => source === sources[0])) return sources[0];
  return 'partial';
}

function maxAlertLevel(alerts: Array<Pick<InfraCostAlert, 'level'>>): InfraCostAlertLevel {
  if (alerts.some((alert) => alert.level === 'critical')) return 'critical';
  if (alerts.some((alert) => alert.level === 'warning')) return 'warning';
  return 'ok';
}
