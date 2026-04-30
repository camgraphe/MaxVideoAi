import fs from 'node:fs/promises';
import path from 'node:path';
import {
  buildCuratedUrlInspectionTargets,
  createPendingUrlInspectionItem,
  normalizeUrlInspectionItem,
  shouldSkipRecentUrlInspection,
} from '@/lib/seo/url-inspection';
import type {
  UrlInspectionGroup,
  UrlInspectionItem,
  UrlInspectionTarget,
} from '@/lib/seo/internal-seo-types';
import { isDatabaseConfigured, query } from '@/lib/db';
import { fetchSeoCockpitData } from '@/server/seo/cockpit';
import { inspectGscUrl } from '@/server/seo/gsc';

type UrlInspectionCacheEntry = {
  updatedAt: string;
  items: UrlInspectionItem[];
};

const URL_INSPECTION_DB_CACHE_KEY = 'seo.gsc.url-inspection';

export type UrlInspectionDashboardData = {
  configured: boolean;
  siteUrl: string | null;
  range: string;
  targets: UrlInspectionTarget[];
  items: UrlInspectionItem[];
  updatedAt: string | null;
  error: string | null;
};

export async function fetchUrlInspectionDashboardData(options?: {
  range?: string | null;
}): Promise<UrlInspectionDashboardData> {
  const cockpit = await fetchSeoCockpitData({ range: options?.range });
  const targets = buildCuratedUrlInspectionTargets({
    opportunities: cockpit.opportunities,
    ctrDoctorItems: cockpit.ctrDoctorItems,
    missingContentItems: cockpit.missingContentItems,
    internalLinkSuggestions: cockpit.internalLinkSuggestions,
    momentumItems: cockpit.momentumItems,
  });
  const cache = await readUrlInspectionCache();
  const cachedByPath = new Map((cache?.items ?? []).map((item) => [item.path, item]));
  const items = targets.map((target) => createPendingUrlInspectionItem(target, cachedByPath.get(target.path)));

  return {
    configured: cockpit.gsc.configured,
    siteUrl: cockpit.gsc.siteUrl,
    range: cockpit.gsc.range,
    targets,
    items,
    updatedAt: cache?.updatedAt ?? null,
    error: cockpit.gsc.configured ? null : cockpit.gsc.error,
  };
}

export async function inspectCuratedUrls(options: {
  range?: string | null;
  urls?: string[];
  group?: UrlInspectionGroup | 'all' | null;
  force?: boolean;
}): Promise<{
  inspected: UrlInspectionItem[];
  skipped: UrlInspectionItem[];
  items: UrlInspectionItem[];
}> {
  const dashboard = await fetchUrlInspectionDashboardData({ range: options.range });
  if (!dashboard.configured) {
    throw new Error('Google Search Console is not configured.');
  }

  const requested = selectTargets(dashboard.targets, options.urls, options.group);
  const existingByPath = new Map(dashboard.items.map((item) => [item.path, item]));
  const inspected: UrlInspectionItem[] = [];
  const skipped: UrlInspectionItem[] = [];
  const finalByPath = new Map(dashboard.items.map((item) => [item.path, item]));
  const now = new Date();

  for (const target of requested) {
    const existing = existingByPath.get(target.path) ?? null;
    if (!options.force && shouldSkipRecentUrlInspection(existing?.lastInspectedAt, now)) {
      if (existing) skipped.push(existing);
      continue;
    }

    const raw = await inspectGscUrl(target.url);
    const item = normalizeUrlInspectionItem({
      target,
      inspectedAt: now.toISOString(),
      raw,
    });
    finalByPath.set(item.path, item);
    inspected.push(item);
  }

  const items = dashboard.targets.map((target) =>
    createPendingUrlInspectionItem(target, finalByPath.get(target.path))
  );
  await writeUrlInspectionCache({ updatedAt: new Date().toISOString(), items });
  return { inspected, skipped, items };
}

function selectTargets(
  targets: UrlInspectionTarget[],
  urls?: string[],
  group?: UrlInspectionGroup | 'all' | null
) {
  const normalizedUrls = new Set((urls ?? []).map(normalizePath).filter((value): value is string => Boolean(value)));
  if (normalizedUrls.size) return targets.filter((target) => normalizedUrls.has(target.path));
  if (group && group !== 'all') return targets.filter((target) => target.group === group);
  return targets;
}

async function readUrlInspectionCache(): Promise<UrlInspectionCacheEntry | null> {
  const dbEntry = await readUrlInspectionDbCache();
  if (dbEntry) return dbEntry;

  const cacheFile = resolveUrlInspectionCacheFile();
  if (!cacheFile) return null;
  try {
    return JSON.parse(await fs.readFile(cacheFile, 'utf8')) as UrlInspectionCacheEntry;
  } catch {
    return null;
  }
}

async function writeUrlInspectionCache(entry: UrlInspectionCacheEntry) {
  await writeUrlInspectionDbCache(entry);

  const cacheFile = resolveUrlInspectionCacheFile();
  if (!cacheFile) return;
  try {
    await fs.mkdir(path.dirname(cacheFile), { recursive: true });
    await fs.writeFile(cacheFile, JSON.stringify(entry, null, 2));
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[gsc-url-inspection] failed to write cache file', error);
    }
  }
}

async function readUrlInspectionDbCache(): Promise<UrlInspectionCacheEntry | null> {
  if (!isDatabaseConfigured()) return null;
  try {
    const rows = await query<{ value: UrlInspectionCacheEntry }>('select value from app_settings where key = $1 limit 1', [
      URL_INSPECTION_DB_CACHE_KEY,
    ]);
    return rows[0]?.value ?? null;
  } catch {
    return null;
  }
}

async function writeUrlInspectionDbCache(entry: UrlInspectionCacheEntry) {
  if (!isDatabaseConfigured()) return;
  try {
    await query(
      `
        insert into app_settings (key, value, updated_at)
        values ($1, $2::jsonb, now())
        on conflict (key) do update
          set value = excluded.value,
              updated_at = now()
      `,
      [URL_INSPECTION_DB_CACHE_KEY, JSON.stringify(entry)]
    );
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[gsc-url-inspection] failed to write database cache', error);
    }
  }
}

function resolveUrlInspectionCacheFile(): string | null {
  if ((process.env.GSC_DISABLE_FILE_CACHE ?? '').trim() === '1') return null;
  return (
    process.env.GSC_URL_INSPECTION_CACHE_FILE?.trim() ||
    path.join(process.cwd(), '.cache', 'seo', 'gsc-url-inspection.json')
  );
}

function normalizePath(value: string | null | undefined) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.pathname.replace(/\/$/, '') || '/';
  } catch {
    return value.startsWith('/') ? value.replace(/\/$/, '') || '/' : null;
  }
}
