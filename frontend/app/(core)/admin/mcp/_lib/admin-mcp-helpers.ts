import type { AdminMetricItem } from '@/components/admin-system/surfaces/AdminMetricGrid';
import type { AdminMcpMetrics, AdminMcpRange } from '@/server/admin-mcp-metrics';
import { resolveMcpTrialToWalletWindowSeconds } from '@/server/agent-api/mcp-funnel';

export type AdminMcpRangeLabel = '24h' | '7d' | '30d' | '90d';

export const ADMIN_MCP_RANGE_OPTIONS: Array<{ value: AdminMcpRangeLabel; label: string }> = [
  { value: '24h', label: '24 hours' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
];

const RANGE_MILLISECONDS: Record<AdminMcpRangeLabel, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
  '90d': 90 * 24 * 60 * 60 * 1000,
};

const numberFormatter = new Intl.NumberFormat('en-US');
const moneyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const percentFormatter = new Intl.NumberFormat('en-US', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function normalizeRange(candidate?: string | string[] | null): AdminMcpRangeLabel {
  const value = Array.isArray(candidate) ? candidate[0] : candidate;
  return ADMIN_MCP_RANGE_OPTIONS.some((option) => option.value === value) ? value as AdminMcpRangeLabel : '30d';
}

export function resolveAdminMcpRange(
  candidate?: string | string[] | null,
  now = new Date(),
): { label: AdminMcpRangeLabel; query: AdminMcpRange } {
  const label = normalizeRange(candidate);
  return {
    label,
    query: {
      from: new Date(now.getTime() - RANGE_MILLISECONDS[label]),
      to: now,
      timeZone: 'UTC',
      conversionWindowSeconds: resolveMcpTrialToWalletWindowSeconds(),
    },
  };
}

export function buildAdminMcpHref(range: AdminMcpRangeLabel): string {
  return `/admin/mcp?range=${range}`;
}

export function formatMcpNumber(value: number | null): string {
  return value === null ? 'Unavailable' : numberFormatter.format(value);
}

export function formatMcpMoney(valueCents: number | null): string {
  return valueCents === null ? 'Unavailable' : moneyFormatter.format(valueCents / 100);
}

export function formatMcpPercent(value: number | null): string {
  return value === null ? 'Unavailable' : percentFormatter.format(value);
}

export function buildMcpOverviewCards(metrics: AdminMcpMetrics): AdminMetricItem[] {
  return [
    {
      label: 'OAuth connections',
      value: formatMcpNumber(metrics.funnel?.oauth_connected ?? null),
      helper: 'Distinct connected users in the selected UTC window',
      tone: metrics.funnel === null ? 'warning' : 'info',
    },
    {
      label: 'Completed trials',
      value: formatMcpNumber(metrics.funnel?.trial_completed ?? null),
      helper: 'Distinct users with an authoritative completed trial event',
      tone: metrics.funnel === null ? 'warning' : 'default',
    },
    {
      label: 'Trial to wallet',
      value: formatMcpPercent(metrics.trialToWalletRate),
      helper: 'Wallet funded after trial completion inside the conversion window',
      tone: metrics.trialToWalletRate === null ? 'warning' : 'success',
    },
    {
      label: 'First paid users',
      value: formatMcpNumber(metrics.firstPaidUsers),
      helper: 'Distinct users reaching their first paid MCP generation',
      tone: metrics.firstPaidUsers === null ? 'warning' : 'default',
    },
    {
      label: 'MCP revenue',
      value: formatMcpMoney(metrics.revenueCents),
      helper: 'Authoritative charge receipts linked to MCP jobs',
      tone: metrics.revenueCents === null ? 'warning' : 'success',
    },
    {
      label: 'Provider cost',
      value: formatMcpMoney(metrics.providerCostCents),
      helper: 'Recorded provider-attempt cost, including trial cost',
      tone: metrics.providerCostCents === null ? 'warning' : 'default',
    },
  ];
}

export function describeAvailability(metrics: AdminMcpMetrics): string[] {
  return Object.entries(metrics.availability)
    .filter((entry): entry is [string, { status: 'unavailable'; reason: string }] => entry[1].status === 'unavailable')
    .map(([section, state]) => `${section}: ${state.reason}`);
}
