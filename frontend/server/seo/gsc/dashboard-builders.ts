import {
  classifyGscModelFamily,
  findGscOpportunities,
  parseGscRows,
  summarizeGscPerformance,
  type GscDateWindows,
  type GscPerformanceRow,
  type GscRangeKey,
} from '@/lib/seo/gsc-analysis';
import type { GscDashboardData, GscFamilySummary, GscSearchAnalyticsResponse } from './types';

export function buildGscDashboardData(args: {
  range: GscRangeKey;
  windows: GscDateWindows;
  siteUrl: string;
  currentTotalResponse: GscSearchAnalyticsResponse;
  previousTotalResponse: GscSearchAnalyticsResponse;
  currentDetailResponse: GscSearchAnalyticsResponse;
  currentTrendResponse: GscSearchAnalyticsResponse;
  previousDetailResponse: GscSearchAnalyticsResponse;
}): GscDashboardData {
  const totalRows = parseGscRows(args.currentTotalResponse.rows, [], 'web');
  const previousTotalRows = parseGscRows(args.previousTotalResponse.rows, [], 'web');
  const rows = parseGscRows(args.currentDetailResponse.rows, ['query', 'page', 'country', 'device'], 'web');
  const previousRows = parseGscRows(args.previousDetailResponse.rows, ['query', 'page', 'country', 'device'], 'web');
  const trendRows = parseGscRows(args.currentTrendResponse.rows, ['date'], 'web');
  const trend = trendRows.map((row) => ({
    date: row.date ?? '',
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr,
    position: row.position,
  }));
  const detailSummary = summarizeGscPerformance(rows);
  const currentSummary = summarizeGscPerformance(totalRows.length ? totalRows : trendRows.length ? trendRows : rows);
  const previousSummary = summarizeGscPerformance(previousTotalRows.length ? previousTotalRows : previousRows);

  return {
    ok: true,
    configured: true,
    range: args.range,
    siteUrl: args.siteUrl,
    fetchedAt: new Date().toISOString(),
    cacheAgeSeconds: 0,
    error: null,
    windows: args.windows,
    summary: {
      ...currentSummary,
      previous: previousSummary,
      clicksDelta: currentSummary.clicks - previousSummary.clicks,
      impressionsDelta: currentSummary.impressions - previousSummary.impressions,
      ctrDelta: currentSummary.ctr - previousSummary.ctr,
      positionDelta: currentSummary.position - previousSummary.position,
    },
    detailSummary,
    trend,
    topQueries: aggregateRows(rows, 'query').slice(0, 25),
    topPages: aggregateRows(rows, 'page').slice(0, 25),
    rows: rows.slice(0, 500),
    previousRows: previousRows.slice(0, 500),
    opportunities: findGscOpportunities(rows).slice(0, 60),
    familySummaries: buildFamilySummaries(rows),
    metadata: {
      firstIncompleteDate:
        args.currentDetailResponse.metadata?.first_incomplete_date ??
        args.currentTrendResponse.metadata?.first_incomplete_date ??
        null,
      firstIncompleteHour:
        args.currentDetailResponse.metadata?.first_incomplete_hour ??
        args.currentTrendResponse.metadata?.first_incomplete_hour ??
        null,
    },
  };
}

export function aggregateRows(rows: GscPerformanceRow[], dimension: 'query' | 'page'): GscPerformanceRow[] {
  const groups = new Map<string, GscPerformanceRow[]>();
  for (const row of rows) {
    const key = row[dimension];
    if (!key) continue;
    const existing = groups.get(key) ?? [];
    existing.push(row);
    groups.set(key, existing);
  }

  return Array.from(groups.entries())
    .map(([key, groupRows]) => {
      const summary = summarizeGscPerformance(groupRows);
      return {
        query: dimension === 'query' ? key : null,
        page: dimension === 'page' ? key : null,
        country: null,
        device: null,
        searchAppearance: null,
        date: null,
        searchType: 'web' as const,
        ...summary,
      };
    })
    .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions);
}

export function buildFamilySummaries(rows: GscPerformanceRow[]): GscFamilySummary[] {
  const groups = new Map<string, GscPerformanceRow[]>();
  for (const row of rows) {
    const family = classifyGscModelFamily(row.query, row.page);
    const existing = groups.get(family) ?? [];
    existing.push(row);
    groups.set(family, existing);
  }

  return Array.from(groups.entries())
    .map(([family, groupRows]) => ({
      family,
      ...summarizeGscPerformance(groupRows),
      rows: groupRows.length,
    }))
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 16);
}

export function buildEmptyDashboard(args: {
  range: GscRangeKey;
  windows: GscDateWindows;
  configured: boolean;
  siteUrl?: string | null;
  error: string | null;
}): GscDashboardData {
  const emptySummary = summarizeGscPerformance([]);
  return {
    ok: false,
    configured: args.configured,
    range: args.range,
    siteUrl: args.siteUrl ?? null,
    fetchedAt: null,
    cacheAgeSeconds: null,
    error: args.error,
    windows: args.windows,
    summary: {
      ...emptySummary,
      previous: emptySummary,
      clicksDelta: 0,
      impressionsDelta: 0,
      ctrDelta: 0,
      positionDelta: 0,
    },
    detailSummary: emptySummary,
    trend: [],
    topQueries: [],
    topPages: [],
    rows: [],
    previousRows: [],
    opportunities: [],
    familySummaries: [],
    metadata: {
      firstIncompleteDate: null,
      firstIncompleteHour: null,
    },
  };
}
