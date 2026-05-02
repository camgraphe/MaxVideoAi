import fs from 'node:fs/promises';
import path from 'node:path';
import { createSign } from 'node:crypto';
import {
  buildGscDateWindows,
  classifyGscModelFamily,
  findGscOpportunities,
  normalizeGscRange,
  parseGscRows,
  summarizeGscPerformance,
  type GscDateWindows,
  type GscDimension,
  type GscOpportunity,
  type GscPerformanceRow,
  type GscPerformanceSummary,
  type GscRangeKey,
  type GscSearchType,
} from '@/lib/seo/gsc-analysis';
import { isDatabaseConfigured, query } from '@/lib/db';

const SEARCH_CONSOLE_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const SEARCH_ANALYTICS_ROW_LIMIT = 25_000;
const DEFAULT_CACHE_TTL_MS = 30 * 60 * 1000;
const DASHBOARD_CACHE_VERSION = 2;
const DASHBOARD_DB_CACHE_PREFIX = 'seo.gsc.dashboard';

type GscAccessToken = {
  token: string;
  expiresAt: number;
  cacheKey: string;
};

type GscSearchAnalyticsResponse = {
  rows?: Array<{
    keys?: string[];
    clicks?: number;
    impressions?: number;
    ctr?: number;
    position?: number;
  }>;
  metadata?: {
    first_incomplete_date?: string;
    first_incomplete_hour?: string;
  };
};

export type GscUrlInspectionApiResult = {
  inspectionResultLink?: string;
  indexStatusResult?: {
    sitemap?: string[];
    referringUrls?: string[];
    verdict?: string;
    coverageState?: string;
    robotsTxtState?: string;
    indexingState?: string;
    lastCrawlTime?: string;
    pageFetchState?: string;
    googleCanonical?: string;
    userCanonical?: string;
    crawledAs?: string;
  };
  ampResult?: unknown;
  mobileUsabilityResult?: {
    verdict?: string;
    issues?: unknown[];
  };
  richResultsResult?: {
    verdict?: string;
    detectedItems?: Array<{ richResultType?: string; items?: unknown[] }>;
    issues?: unknown[];
  };
};

type GscClientConfig = {
  siteUrl: string;
} & (
  | {
      authType: 'service-account';
      clientEmail: string;
      privateKey: string;
    }
  | {
      authType: 'oauth-refresh-token';
      clientId: string;
      clientSecret: string;
      refreshToken: string;
    }
);

export type GscFamilySummary = {
  family: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  rows: number;
};

export type GscTrendPoint = {
  date: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type GscComparisonSummary = GscPerformanceSummary & {
  previous: GscPerformanceSummary;
  clicksDelta: number;
  impressionsDelta: number;
  ctrDelta: number;
  positionDelta: number;
};

export type GscDashboardData = {
  ok: boolean;
  configured: boolean;
  range: GscRangeKey;
  siteUrl: string | null;
  fetchedAt: string | null;
  cacheAgeSeconds: number | null;
  error: string | null;
  windows: GscDateWindows;
  summary: GscComparisonSummary;
  detailSummary: GscPerformanceSummary;
  trend: GscTrendPoint[];
  topQueries: GscPerformanceRow[];
  topPages: GscPerformanceRow[];
  rows: GscPerformanceRow[];
  previousRows: GscPerformanceRow[];
  opportunities: GscOpportunity[];
  familySummaries: GscFamilySummary[];
  metadata: {
    firstIncompleteDate: string | null;
    firstIncompleteHour: string | null;
  };
};

type CacheEntry = {
  version?: number;
  createdAt: number;
  data: GscDashboardData;
};

let tokenCache: GscAccessToken | null = null;
let tokenRequest: { cacheKey: string; promise: Promise<GscAccessToken> } | null = null;
let dashboardCache: CacheEntry | null = null;

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
  }

  try {
    const [currentTotalResponse, previousTotalResponse, currentDetailResponse, currentTrendResponse, previousDetailResponse] = await Promise.all([
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

    const totalRows = parseGscRows(currentTotalResponse.rows, [], 'web');
    const previousTotalRows = parseGscRows(previousTotalResponse.rows, [], 'web');
    const rows = parseGscRows(currentDetailResponse.rows, ['query', 'page', 'country', 'device'], 'web');
    const previousRows = parseGscRows(previousDetailResponse.rows, ['query', 'page', 'country', 'device'], 'web');
    const trendRows = parseGscRows(currentTrendResponse.rows, ['date'], 'web');
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
    const data: GscDashboardData = {
      ok: true,
      configured: true,
      range,
      siteUrl: config.siteUrl,
      fetchedAt: new Date().toISOString(),
      cacheAgeSeconds: 0,
      error: null,
      windows,
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
          currentDetailResponse.metadata?.first_incomplete_date ??
          currentTrendResponse.metadata?.first_incomplete_date ??
          null,
        firstIncompleteHour:
          currentDetailResponse.metadata?.first_incomplete_hour ??
          currentTrendResponse.metadata?.first_incomplete_hour ??
          null,
      },
    };

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

async function querySearchAnalytics(
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

async function getAccessToken(config: GscClientConfig): Promise<string> {
  const cacheKey = buildTokenCacheKey(config);
  if (tokenCache && tokenCache.cacheKey === cacheKey && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.token;
  }
  if (tokenRequest?.cacheKey === cacheKey) {
    return (await tokenRequest.promise).token;
  }

  const promise = (async () => {
    const payload =
      config.authType === 'service-account'
        ? await requestServiceAccountAccessToken(config)
        : await requestOAuthRefreshAccessToken(config);

    if (!payload.access_token) {
      throw new Error('Google OAuth token response did not include an access token.');
    }

    return {
      token: payload.access_token,
      expiresAt: Date.now() + Math.max(60, payload.expires_in ?? 3600) * 1000,
      cacheKey,
    };
  })();

  tokenRequest = { cacheKey, promise };
  try {
    tokenCache = await promise;
    return tokenCache.token;
  } finally {
    if (tokenRequest?.promise === promise) {
      tokenRequest = null;
    }
  }
}

async function requestServiceAccountAccessToken(
  config: Extract<GscClientConfig, { authType: 'service-account' }>
): Promise<{ access_token?: string; expires_in?: number }> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claimSet = base64Url(
    JSON.stringify({
      iss: config.clientEmail,
      scope: SEARCH_CONSOLE_SCOPE,
      aud: TOKEN_ENDPOINT,
      exp: now + 3600,
      iat: now,
    })
  );
  const unsignedJwt = `${header}.${claimSet}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsignedJwt);
  signer.end();
  const signature = signer.sign(config.privateKey);
  const assertion = `${unsignedJwt}.${base64Url(signature)}`;

  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Google OAuth token request failed (${response.status}): ${detail || response.statusText}`);
  }

  return (await response.json()) as { access_token?: string; expires_in?: number };
}

async function requestOAuthRefreshAccessToken(
  config: Extract<GscClientConfig, { authType: 'oauth-refresh-token' }>
): Promise<{ access_token?: string; expires_in?: number }> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Google OAuth refresh token request failed (${response.status}): ${detail || response.statusText}`);
  }

  return (await response.json()) as { access_token?: string; expires_in?: number };
}

function resolveGscConfig(): GscClientConfig | null {
  const siteUrl = process.env.GSC_SITE_URL?.trim() || process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL?.trim() || '';
  if (!siteUrl) return null;

  const serviceAccountJson = process.env.GSC_SERVICE_ACCOUNT_JSON?.trim() || process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (serviceAccountJson) {
    try {
      const parsed = JSON.parse(serviceAccountJson) as { client_email?: string; private_key?: string };
      const clientEmail = parsed.client_email?.trim() ?? '';
      const privateKey = normalizePrivateKey(parsed.private_key ?? '');
      if (clientEmail && privateKey) {
        return { siteUrl, authType: 'service-account', clientEmail, privateKey };
      }
    } catch {
      return null;
    }
  }

  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() || process.env.GSC_CLIENT_EMAIL?.trim() || '';
  const privateKey = normalizePrivateKey(
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? process.env.GSC_PRIVATE_KEY ?? ''
  );
  if (clientEmail && privateKey) {
    return { siteUrl, authType: 'service-account', clientEmail, privateKey };
  }

  const oauthClientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() ?? '';
  const oauthClientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim() ?? '';
  const oauthRefreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN?.trim() ?? '';
  if (oauthClientId && oauthClientSecret && oauthRefreshToken) {
    return {
      siteUrl,
      authType: 'oauth-refresh-token',
      clientId: oauthClientId,
      clientSecret: oauthClientSecret,
      refreshToken: oauthRefreshToken,
    };
  }

  return null;
}

function buildTokenCacheKey(config: GscClientConfig): string {
  if (config.authType === 'service-account') {
    return `${config.siteUrl}:service-account:${config.clientEmail}`;
  }
  return `${config.siteUrl}:oauth-refresh-token:${config.clientId}`;
}

function normalizePrivateKey(value: string): string {
  return value.trim().replace(/\\n/g, '\n');
}

function aggregateRows(rows: GscPerformanceRow[], dimension: 'query' | 'page'): GscPerformanceRow[] {
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

function buildFamilySummaries(rows: GscPerformanceRow[]): GscFamilySummary[] {
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

function buildEmptyDashboard(args: {
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

async function readDashboardCache(
  range: GscRangeKey,
  options?: { ignoreTtl?: boolean; siteUrl?: string | null }
): Promise<CacheEntry | null> {
  if (
    dashboardCache &&
    cacheEntryMatches(dashboardCache, range, options?.siteUrl) &&
    (options?.ignoreTtl || isCacheFresh(dashboardCache.createdAt))
  ) {
    return dashboardCache;
  }

  const cacheFile = resolveCacheFile();
  const dbEntry = await readDashboardDbCache(range, {
    ignoreTtl: options?.ignoreTtl,
    siteUrl: options?.siteUrl,
  });
  if (dbEntry) {
    dashboardCache = dbEntry;
    return dbEntry;
  }

  if (!cacheFile) return null;
  try {
    const raw = await fs.readFile(cacheFile, 'utf8');
    const entry = JSON.parse(raw) as CacheEntry;
    if (!cacheEntryMatches(entry, range, options?.siteUrl)) return null;
    if (!options?.ignoreTtl && !isCacheFresh(entry.createdAt)) return null;
    dashboardCache = entry;
    return entry;
  } catch {
    return null;
  }
}

function cacheEntryMatches(entry: CacheEntry, range: GscRangeKey, siteUrl?: string | null): boolean {
  return entry?.version === DASHBOARD_CACHE_VERSION && entry?.data?.range === range && (!siteUrl || entry.data.siteUrl === siteUrl);
}

async function writeDashboardCache(data: GscDashboardData): Promise<void> {
  const entry: CacheEntry = { version: DASHBOARD_CACHE_VERSION, createdAt: Date.now(), data };
  dashboardCache = entry;
  await writeDashboardDbCache(entry);
  const cacheFile = resolveCacheFile();
  if (!cacheFile) return;
  try {
    await fs.mkdir(path.dirname(cacheFile), { recursive: true });
    await fs.writeFile(cacheFile, JSON.stringify(entry, null, 2));
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[gsc] failed to write cache file', error);
    }
  }
}

async function readDashboardDbCache(
  range: GscRangeKey,
  options?: { ignoreTtl?: boolean; siteUrl?: string | null }
): Promise<CacheEntry | null> {
  if (!isDatabaseConfigured() || !options?.siteUrl) return null;
  try {
    const rows = await query<{ value: CacheEntry }>('select value from app_settings where key = $1 limit 1', [
      buildDashboardDbCacheKey(range, options.siteUrl),
    ]);
    const entry = rows[0]?.value ?? null;
    if (!entry || !cacheEntryMatches(entry, range, options.siteUrl)) return null;
    if (!options.ignoreTtl && !isCacheFresh(entry.createdAt)) return null;
    return entry;
  } catch {
    return null;
  }
}

async function writeDashboardDbCache(entry: CacheEntry): Promise<void> {
  if (!isDatabaseConfigured() || !entry.data.siteUrl) return;
  try {
    await query(
      `
        insert into app_settings (key, value, updated_at)
        values ($1, $2::jsonb, now())
        on conflict (key) do update
          set value = excluded.value,
              updated_at = now()
      `,
      [buildDashboardDbCacheKey(entry.data.range, entry.data.siteUrl), JSON.stringify(entry)]
    );
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[gsc] failed to write database cache', error);
    }
  }
}

function buildDashboardDbCacheKey(range: GscRangeKey, siteUrl: string): string {
  return `${DASHBOARD_DB_CACHE_PREFIX}:${siteUrl}:${range}`;
}

function withCacheAge(data: GscDashboardData, createdAt: number): GscDashboardData {
  return {
    ...data,
    detailSummary: data.detailSummary ?? summarizeGscPerformance(data.rows ?? []),
    cacheAgeSeconds: Math.max(0, Math.round((Date.now() - createdAt) / 1000)),
  };
}

function isCacheFresh(createdAt: number): boolean {
  return Date.now() - createdAt < resolveCacheTtlMs();
}

function resolveCacheTtlMs(): number {
  const raw = Number.parseInt(process.env.GSC_CACHE_TTL_SECONDS ?? '', 10);
  if (Number.isFinite(raw) && raw > 0) {
    return raw * 1000;
  }
  return DEFAULT_CACHE_TTL_MS;
}

function resolveCacheFile(): string | null {
  if ((process.env.GSC_DISABLE_FILE_CACHE ?? '').trim() === '1') {
    return null;
  }
  return (
    process.env.GSC_CACHE_FILE?.trim() ||
    path.join(process.cwd(), '.cache', 'seo', 'gsc-search-analytics.json')
  );
}

function base64Url(input: string | Buffer): string {
  const buffer = typeof input === 'string' ? Buffer.from(input) : input;
  return buffer.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
