import fs from 'node:fs/promises';
import path from 'node:path';
import { summarizeGscPerformance, type GscRangeKey } from '@/lib/seo/gsc-analysis';
import { isDatabaseConfigured, query } from '@/lib/db';
import { DASHBOARD_CACHE_VERSION, DASHBOARD_DB_CACHE_PREFIX, DEFAULT_CACHE_TTL_MS } from './constants';
import type { GscDashboardCacheEntry, GscDashboardData } from './types';

let dashboardCache: GscDashboardCacheEntry | null = null;

export async function readDashboardCache(
  range: GscRangeKey,
  options?: { ignoreTtl?: boolean; siteUrl?: string | null }
): Promise<GscDashboardCacheEntry | null> {
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
    const entry = JSON.parse(raw) as GscDashboardCacheEntry;
    if (!cacheEntryMatches(entry, range, options?.siteUrl)) return null;
    if (!options?.ignoreTtl && !isCacheFresh(entry.createdAt)) return null;
    dashboardCache = entry;
    return entry;
  } catch {
    return null;
  }
}

export async function writeDashboardCache(data: GscDashboardData): Promise<void> {
  const entry: GscDashboardCacheEntry = { version: DASHBOARD_CACHE_VERSION, createdAt: Date.now(), data };
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

export function withCacheAge(data: GscDashboardData, createdAt: number): GscDashboardData {
  return {
    ...data,
    detailSummary: data.detailSummary ?? summarizeGscPerformance(data.rows ?? []),
    cacheAgeSeconds: Math.max(0, Math.round((Date.now() - createdAt) / 1000)),
  };
}

function cacheEntryMatches(entry: GscDashboardCacheEntry, range: GscRangeKey, siteUrl?: string | null): boolean {
  return entry?.version === DASHBOARD_CACHE_VERSION && entry?.data?.range === range && (!siteUrl || entry.data.siteUrl === siteUrl);
}

async function readDashboardDbCache(
  range: GscRangeKey,
  options?: { ignoreTtl?: boolean; siteUrl?: string | null }
): Promise<GscDashboardCacheEntry | null> {
  if (!isDatabaseConfigured() || !options?.siteUrl) return null;
  try {
    const rows = await query<{ value: GscDashboardCacheEntry }>('select value from app_settings where key = $1 limit 1', [
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

async function writeDashboardDbCache(entry: GscDashboardCacheEntry): Promise<void> {
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
