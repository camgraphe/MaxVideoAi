import {
  buildGscDateWindows,
  normalizeGscRange,
} from '@/lib/seo/gsc-analysis';
import { buildEmptyDashboard, buildGscDashboardData } from './gsc/dashboard-builders';
import { readDashboardCache, withCacheAge, writeDashboardCache } from './gsc/dashboard-cache';
import { inspectGscUrlWithConfig, querySearchAnalytics } from './gsc/client';
import { resolveGscConfig } from './gsc/config';
import type { GscDashboardData, GscUrlInspectionApiResult } from './gsc/types';

export type {
  GscComparisonSummary,
  GscDashboardData,
  GscFamilySummary,
  GscTrendPoint,
  GscUrlInspectionApiResult,
} from './gsc/types';

export async function fetchGscDashboardData(options?: {
  range?: string | null;
  forceRefresh?: boolean;
}): Promise<GscDashboardData> {
  const range = normalizeGscRange(options?.range);
  const windows = buildGscDateWindows(new Date(), range);
  const config = resolveGscConfig();

  if (!config) {
    return buildEmptyDashboard({
      range,
      windows,
      configured: false,
      error:
        'Google Search Console is not configured. Add GSC_SITE_URL plus either service account credentials or GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, and GOOGLE_OAUTH_REFRESH_TOKEN.',
    });
  }

  const cached = await readDashboardCache(range, { siteUrl: config.siteUrl });
  if (!options?.forceRefresh) {
    if (cached) {
      return withCacheAge(cached.data, cached.createdAt);
    }
    return buildEmptyDashboard({
      range,
      windows,
      configured: true,
      siteUrl: config.siteUrl,
      error: 'No cached GSC snapshot is available. Use force refresh to fetch fresh Search Console data.',
    });
  }

  try {
    const [
      currentTotalResponse,
      previousTotalResponse,
      currentDetailResponse,
      currentTrendResponse,
      previousDetailResponse,
    ] = await Promise.all([
      querySearchAnalytics(config, {
        window: windows.current,
        dimensions: [],
        searchType: 'web',
      }),
      querySearchAnalytics(config, {
        window: windows.previous,
        dimensions: [],
        searchType: 'web',
      }),
      querySearchAnalytics(config, {
        window: windows.current,
        dimensions: ['query', 'page', 'country', 'device'],
        searchType: 'web',
      }),
      querySearchAnalytics(config, {
        window: windows.current,
        dimensions: ['date'],
        searchType: 'web',
      }),
      querySearchAnalytics(config, {
        window: windows.previous,
        dimensions: ['query', 'page', 'country', 'device'],
        searchType: 'web',
      }),
    ]);

    const data = buildGscDashboardData({
      range,
      windows,
      siteUrl: config.siteUrl,
      currentTotalResponse,
      previousTotalResponse,
      currentDetailResponse,
      currentTrendResponse,
      previousDetailResponse,
    });

    await writeDashboardCache(data);
    return data;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch Google Search Console data.';
    const stale = await readDashboardCache(range, { ignoreTtl: true, siteUrl: config.siteUrl });
    if (stale) {
      return withCacheAge({ ...stale.data, ok: false, error: message }, stale.createdAt);
    }
    return buildEmptyDashboard({ range, windows, configured: true, siteUrl: config.siteUrl, error: message });
  }
}

export async function inspectGscUrl(inspectionUrl: string): Promise<GscUrlInspectionApiResult> {
  const config = resolveGscConfig();
  if (!config) {
    throw new Error('Google Search Console is not configured for URL Inspection.');
  }

  return inspectGscUrlWithConfig(config, inspectionUrl);
}
