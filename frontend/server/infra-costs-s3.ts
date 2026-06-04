import { signAwsJsonRequest } from '@/server/infra-costs-aws-sigv4';
import type {
  EnvLike,
  FetchLike,
  InfraCostAlert,
  InfraCostPeriod,
  InfraCostProviderReport,
  InfraCostThresholds,
  S3DailyCostRow,
  S3InfraCostDetails,
  S3UsageCostRow,
} from '@/server/infra-costs-types';
import {
  limitedResponseText,
  readArray,
  readCsvEnv,
  readEnv,
  readNumber,
  readString,
  toRecord,
} from '@/server/infra-costs-utils';

const AWS_COST_EXPLORER_TARGET = 'AWSInsightsIndexService.GetCostAndUsage';
const AWS_COST_EXPLORER_CONTENT_TYPE = 'application/x-amz-json-1.1';
const DEFAULT_AWS_COST_EXPLORER_REGION = 'us-east-1';
const DEFAULT_AWS_COST_EXPLORER_BASE_URL = 'https://ce.us-east-1.amazonaws.com';
const DEFAULT_S3_SERVICE_NAME = 'Amazon Simple Storage Service';

type AwsCostExplorerPayload = {
  TimePeriod: {
    Start: string;
    End: string;
  };
  Granularity: 'DAILY';
  Metrics: ['UnblendedCost'];
  Filter: AwsCostExpression;
  GroupBy: Array<{
    Type: 'DIMENSION';
    Key: 'USAGE_TYPE';
  }>;
  NextPageToken?: string;
};

type AwsCostExpression =
  | {
      Dimensions: {
        Key: 'SERVICE' | 'LINKED_ACCOUNT';
        Values: string[];
      };
    }
  | {
      Tags: {
        Key: string;
        Values: string[];
      };
    }
  | {
      And: AwsCostExpression[];
    };

type AwsCostExplorerQuery = {
  apiBaseUrl: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string | undefined;
  billingRegion: string;
  serviceName: string;
  linkedAccountIds: string[];
  tagFilter: S3InfraCostDetails['tagFilter'];
  period: InfraCostPeriod;
  fetchFn: FetchLike;
};

type ParsedAwsCostRows = {
  currentUsd: number;
  resultsCount: number;
  estimated: boolean;
  usageRows: S3UsageCostRow[];
  dailyRows: S3DailyCostRow[];
};

export async function fetchS3InfraCostReport({
  env,
  fetchFn,
  period,
}: {
  env: EnvLike;
  fetchFn: FetchLike;
  period: InfraCostPeriod;
}): Promise<InfraCostProviderReport<S3InfraCostDetails>> {
  const accessKeyId = readEnv(env, 'AWS_COST_EXPLORER_ACCESS_KEY_ID', 'AWS_BILLING_ACCESS_KEY_ID', 'AWS_ACCESS_KEY_ID', 'S3_ACCESS_KEY_ID');
  const secretAccessKey = readEnv(env, 'AWS_COST_EXPLORER_SECRET_ACCESS_KEY', 'AWS_BILLING_SECRET_ACCESS_KEY', 'AWS_SECRET_ACCESS_KEY', 'S3_SECRET_ACCESS_KEY');
  const sessionToken = readEnv(env, 'AWS_COST_EXPLORER_SESSION_TOKEN', 'AWS_BILLING_SESSION_TOKEN', 'AWS_SESSION_TOKEN');
  const billingRegion = readEnv(env, 'AWS_COST_EXPLORER_REGION', 'AWS_BILLING_REGION') ?? DEFAULT_AWS_COST_EXPLORER_REGION;
  const apiBaseUrl = readEnv(env, 'AWS_COST_EXPLORER_API_BASE_URL') ?? DEFAULT_AWS_COST_EXPLORER_BASE_URL;
  const serviceName = readEnv(env, 'AWS_S3_COST_SERVICE_NAME') ?? DEFAULT_S3_SERVICE_NAME;
  const linkedAccountIds = readCsvEnv(env, 'AWS_S3_COST_LINKED_ACCOUNT_IDS', 'AWS_COST_EXPLORER_LINKED_ACCOUNT_IDS');
  const tagKey = readEnv(env, 'AWS_S3_COST_TAG_KEY');
  const tagValues = readCsvEnv(env, 'AWS_S3_COST_TAG_VALUES');
  const tagFilter = tagKey && tagValues.length ? { key: tagKey, values: tagValues } : null;
  const bucketName = readEnv(env, 'S3_BUCKET', 'AWS_S3_BUCKET') ?? null;
  const bucketRegion = readEnv(env, 'S3_REGION', 'AWS_S3_REGION') ?? null;

  if (!accessKeyId || !secretAccessKey) {
    return buildUnconfiguredProvider('s3', 'AWS S3', [
      'Set AWS_COST_EXPLORER_ACCESS_KEY_ID and AWS_COST_EXPLORER_SECRET_ACCESS_KEY in Vercel, or grant Cost Explorer access to the configured S3 credentials.',
      'The IAM user or role needs ce:GetCostAndUsage access for AWS Cost Explorer.',
    ]);
  }

  try {
    const dateInterval = buildCostExplorerDateInterval(period);
    const projectionFactor = buildBillingProjectionFactor(dateInterval, period);
    const rows = await fetchAwsS3CostRows({
      apiBaseUrl,
      accessKeyId,
      secretAccessKey,
      sessionToken,
      billingRegion,
      serviceName,
      linkedAccountIds,
      tagFilter,
      period,
      fetchFn,
    });
    const details: S3InfraCostDetails = {
      serviceName,
      billingRegion,
      bucketName,
      bucketRegion,
      linkedAccountIds,
      tagFilter,
      dataStartDate: dateInterval.startDate,
      dataEndDateExclusive: dateInterval.endDateExclusive,
      projectionFactor,
      resultsCount: rows.resultsCount,
      estimated: rows.estimated,
      usageRows: rows.usageRows.map((row) => ({
        ...row,
        projectedMonthUsd: row.currentUsd * projectionFactor,
      })),
      dailyRows: rows.dailyRows,
    };
    const currentUsd = rows.currentUsd;

    return {
      id: 's3',
      label: 'AWS S3',
      configured: true,
      status: 'ok',
      money: {
        currentUsd,
        projectedMonthUsd: currentUsd * projectionFactor,
        currency: 'USD',
        source: 'actual',
      },
      error: null,
      setup: [],
      details,
    };
  } catch (error) {
    return buildErroredProvider('s3', 'AWS S3', error);
  }
}

export function buildS3Alerts(
  provider: InfraCostProviderReport<S3InfraCostDetails>,
  thresholds: InfraCostThresholds
): InfraCostAlert[] {
  if (!provider.configured) {
    return [
      {
        provider: 's3',
        level: 'warning',
        kind: 'configuration',
        title: 'AWS S3 billing is not configured',
        detail: provider.setup[0] ?? 'Missing AWS Cost Explorer credentials.',
      },
    ];
  }

  if (provider.error || !provider.details) {
    return [
      {
        provider: 's3',
        level: 'warning',
        kind: 'configuration',
        title: 'AWS S3 billing fetch failed',
        detail: provider.error ?? 'No AWS S3 billing details were returned.',
      },
    ];
  }

  const alerts: InfraCostAlert[] = [];
  pushCostAlert(alerts, provider.money.projectedMonthUsd, thresholds.s3MonthlyWarningUsd, thresholds.s3MonthlyCriticalUsd);
  return alerts;
}

async function fetchAwsS3CostRows(query: AwsCostExplorerQuery): Promise<ParsedAwsCostRows> {
  const parsedRows: ParsedAwsCostRows = {
    currentUsd: 0,
    resultsCount: 0,
    estimated: false,
    usageRows: [],
    dailyRows: [],
  };
  const usageRows = new Map<string, S3UsageCostRow>();
  let nextPageToken: string | undefined;

  do {
    const payload = buildCostExplorerPayload(query, nextPageToken);
    const response = await fetchSignedAwsJson({
      apiBaseUrl: query.apiBaseUrl,
      accessKeyId: query.accessKeyId,
      secretAccessKey: query.secretAccessKey,
      sessionToken: query.sessionToken,
      billingRegion: query.billingRegion,
      payload,
      fetchFn: query.fetchFn,
    });

    const pageRows = parseCostExplorerResponse(response, usageRows);
    parsedRows.currentUsd += pageRows.currentUsd;
    parsedRows.resultsCount += pageRows.resultsCount;
    parsedRows.estimated = parsedRows.estimated || pageRows.estimated;
    parsedRows.dailyRows.push(...pageRows.dailyRows);
    nextPageToken = pageRows.nextPageToken;
  } while (nextPageToken);

  parsedRows.usageRows = Array.from(usageRows.values())
    .sort((left, right) => right.currentUsd - left.currentUsd)
    .slice(0, 12);
  parsedRows.dailyRows = mergeDailyRows(parsedRows.dailyRows);
  return parsedRows;
}

function buildCostExplorerPayload(query: AwsCostExplorerQuery, nextPageToken: string | undefined): AwsCostExplorerPayload {
  const dateInterval = buildCostExplorerDateInterval(query.period);
  const filterParts: AwsCostExpression[] = [
    {
      Dimensions: {
        Key: 'SERVICE',
        Values: [query.serviceName],
      },
    },
  ];

  if (query.linkedAccountIds.length) {
    filterParts.push({
      Dimensions: {
        Key: 'LINKED_ACCOUNT',
        Values: query.linkedAccountIds,
      },
    });
  }

  if (query.tagFilter) {
    filterParts.push({
      Tags: {
        Key: query.tagFilter.key,
        Values: query.tagFilter.values,
      },
    });
  }

  return {
    TimePeriod: {
      Start: dateInterval.startDate,
      End: dateInterval.endDateExclusive,
    },
    Granularity: 'DAILY',
    Metrics: ['UnblendedCost'],
    Filter: filterParts.length === 1 ? filterParts[0] : { And: filterParts },
    GroupBy: [
      {
        Type: 'DIMENSION',
        Key: 'USAGE_TYPE',
      },
    ],
    ...(nextPageToken ? { NextPageToken: nextPageToken } : {}),
  };
}

async function fetchSignedAwsJson({
  apiBaseUrl,
  accessKeyId,
  secretAccessKey,
  sessionToken,
  billingRegion,
  payload,
  fetchFn,
}: {
  apiBaseUrl: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string | undefined;
  billingRegion: string;
  payload: AwsCostExplorerPayload;
  fetchFn: FetchLike;
}): Promise<unknown> {
  const url = new URL('/', normalizeAwsApiBaseUrl(apiBaseUrl));
  const body = JSON.stringify(payload);
  const signedHeaders = signAwsJsonRequest({
    url,
    body,
    accessKeyId,
    secretAccessKey,
    sessionToken,
    region: billingRegion,
    service: 'ce',
    target: AWS_COST_EXPLORER_TARGET,
    contentType: AWS_COST_EXPLORER_CONTENT_TYPE,
  });

  const response = await fetchFn(url, {
    method: 'POST',
    headers: signedHeaders,
    body,
  });

  if (!response.ok) {
    throw new Error(`AWS Cost Explorer ${url.hostname} failed with ${response.status}: ${await limitedResponseText(response)}`);
  }

  return response.json();
}

function parseCostExplorerResponse(payload: unknown, usageRows: Map<string, S3UsageCostRow>) {
  const root = toRecord(payload);
  const results = readArray(root.ResultsByTime) ?? [];
  let currentUsd = 0;
  let resultsCount = 0;
  let estimated = false;
  const dailyRows: S3DailyCostRow[] = [];

  for (const result of results) {
    const resultRecord = toRecord(result);
    const timePeriod = toRecord(resultRecord.TimePeriod);
    const date = readString(timePeriod.Start) ?? 'unknown';
    const groups = readArray(resultRecord.Groups) ?? [];
    const totalFromGroups = groups.reduce<number>((sum, group) => {
      const groupRecord = toRecord(group);
      const keys = readArray(groupRecord.Keys) ?? [];
      const label = readString(keys[0]) ?? 'S3 total';
      const amount = readUnblendedCost(groupRecord.Metrics);
      const row = usageRows.get(label) ?? {
        key: label,
        label,
        currentUsd: 0,
        projectedMonthUsd: 0,
        days: 0,
      };
      row.currentUsd += amount;
      row.days += amount > 0 ? 1 : 0;
      usageRows.set(label, row);
      return sum + amount;
    }, 0);
    const dailyUsd = groups.length ? totalFromGroups : readUnblendedCost(resultRecord.Total);

    if (!groups.length && dailyUsd > 0) {
      const row = usageRows.get('S3 total') ?? {
        key: 'S3 total',
        label: 'S3 total',
        currentUsd: 0,
        projectedMonthUsd: 0,
        days: 0,
      };
      row.currentUsd += dailyUsd;
      row.days += 1;
      usageRows.set(row.key, row);
    }

    currentUsd += dailyUsd;
    resultsCount += 1;
    estimated = estimated || resultRecord.Estimated === true;
    dailyRows.push({ date, billedUsd: dailyUsd, estimated: resultRecord.Estimated === true });
  }

  return {
    currentUsd,
    resultsCount,
    estimated,
    dailyRows,
    nextPageToken: readString(root.NextPageToken) ?? undefined,
  };
}

function readUnblendedCost(metrics: unknown): number {
  const metricRecord = toRecord(metrics);
  const unblended = toRecord(metricRecord.UnblendedCost);
  return readNumber(unblended.Amount) ?? 0;
}

function mergeDailyRows(rows: S3DailyCostRow[]): S3DailyCostRow[] {
  const byDate = new Map<string, S3DailyCostRow>();
  for (const row of rows) {
    const current = byDate.get(row.date) ?? { date: row.date, billedUsd: 0, estimated: false };
    current.billedUsd += row.billedUsd;
    current.estimated = current.estimated || row.estimated;
    byDate.set(row.date, current);
  }
  return Array.from(byDate.values()).sort((left, right) => right.date.localeCompare(left.date)).slice(0, 31);
}

function buildCostExplorerDateInterval(period: InfraCostPeriod) {
  const startDate = toAwsDate(period.startIso);
  const periodEndDate = toAwsDate(period.endIso);
  const endDateExclusive = periodEndDate > startDate ? periodEndDate : addUtcDays(startDate, 1);
  return { startDate, endDateExclusive };
}

function buildBillingProjectionFactor(
  dateInterval: ReturnType<typeof buildCostExplorerDateInterval>,
  period: InfraCostPeriod
): number {
  const elapsedDays = Math.max(1, daysBetweenUtcDates(dateInterval.startDate, dateInterval.endDateExclusive));
  const monthDays = Math.max(1, daysBetweenUtcDates(dateInterval.startDate, toAwsDate(period.monthEndIso)));
  return monthDays / elapsedDays;
}

function toAwsDate(value: string): string {
  return value.slice(0, 10);
}

function addUtcDays(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function daysBetweenUtcDates(startDate: string, endDate: string): number {
  return (Date.parse(`${endDate}T00:00:00.000Z`) - Date.parse(`${startDate}T00:00:00.000Z`)) / (1000 * 60 * 60 * 24);
}

function normalizeAwsApiBaseUrl(value: string): string {
  return value.trim().replace(/\/$/, '') || DEFAULT_AWS_COST_EXPLORER_BASE_URL;
}

function buildUnconfiguredProvider<TDetails>(
  id: 's3',
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
  id: 's3',
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
  projectedMonthUsd: number,
  warningUsd: number,
  criticalUsd: number
) {
  if (projectedMonthUsd >= criticalUsd) {
    alerts.push({
      provider: 's3',
      level: 'critical',
      kind: 'cost',
      title: 'AWS S3 monthly cost above critical threshold',
      detail: `$${projectedMonthUsd.toFixed(2)} projected against $${criticalUsd.toFixed(2)} critical threshold.`,
      projectedMonthUsd,
      thresholdUsd: criticalUsd,
    });
  } else if (projectedMonthUsd >= warningUsd) {
    alerts.push({
      provider: 's3',
      level: 'warning',
      kind: 'cost',
      title: 'AWS S3 monthly cost above warning threshold',
      detail: `$${projectedMonthUsd.toFixed(2)} projected against $${warningUsd.toFixed(2)} warning threshold.`,
      projectedMonthUsd,
      thresholdUsd: warningUsd,
    });
  }
}
