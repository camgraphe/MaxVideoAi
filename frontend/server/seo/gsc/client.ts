import type { GscDimension, GscSearchType } from '@/lib/seo/gsc-analysis';
import { SEARCH_ANALYTICS_ROW_LIMIT } from './constants';
import { getAccessToken } from './auth';
import type { GscClientConfig, GscSearchAnalyticsResponse, GscUrlInspectionApiResult } from './types';

export async function inspectGscUrlWithConfig(
  config: GscClientConfig,
  inspectionUrl: string
): Promise<GscUrlInspectionApiResult> {
  const token = await getAccessToken(config);
  const response = await fetch('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inspectionUrl,
      siteUrl: config.siteUrl,
      languageCode: 'en-US',
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`GSC URL Inspection failed (${response.status}): ${detail || response.statusText}`);
  }

  const payload = (await response.json()) as { inspectionResult?: GscUrlInspectionApiResult };
  return payload.inspectionResult ?? {};
}

export async function querySearchAnalytics(
  config: GscClientConfig,
  params: {
    window: { startDate: string; endDate: string };
    dimensions: GscDimension[];
    searchType: GscSearchType;
  }
): Promise<GscSearchAnalyticsResponse> {
  const token = await getAccessToken(config);
  const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(config.siteUrl)}/searchAnalytics/query`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      startDate: params.window.startDate,
      endDate: params.window.endDate,
      dimensions: params.dimensions,
      type: params.searchType,
      dataState: 'all',
      rowLimit: SEARCH_ANALYTICS_ROW_LIMIT,
      startRow: 0,
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`GSC Search Analytics failed (${response.status}): ${detail || response.statusText}`);
  }

  return (await response.json()) as GscSearchAnalyticsResponse;
}
