import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import modelRoster from '@/config/model-roster.json';
import { SITEMAP_MANUAL_TIMESTAMPS } from '@/config/sitemap-timestamps';
import { listEligibleSeoWatchVideos } from '@/server/video-seo';
import { MODEL_CONTENT_ROOT } from './model-locales';

const MANUAL_ROUTE_DATES = new Map<string, string>(Object.entries(SITEMAP_MANUAL_TIMESTAMPS.routes ?? {}));
const MANUAL_SITEMAP_DATES = new Map<string, string>(Object.entries(SITEMAP_MANUAL_TIMESTAMPS.sitemaps ?? {}));
const GIT_LASTMOD_CACHE = new Map<string, string | null>();
const USE_MTIME_FALLBACK =
  process.env.SITEMAP_USE_MTIME_FALLBACK === 'true' ||
  (process.env.SITEMAP_USE_MTIME_FALLBACK !== 'false' && process.env.NODE_ENV !== 'production');
const FALLBACK_LASTMOD = formatLastModified(process.env.SITEMAP_FALLBACK_LASTMOD);

export function formatLastModified(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  const isoDate = date.toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  return isoDate > today ? today : isoDate;
}

export function getSitemapFileName(pathname: string): string {
  const trimmed = pathname.replace(/^\/+/, '');
  return trimmed || 'sitemap.xml';
}

export function getManualRouteLastModified(englishPath: string): string | undefined {
  return formatLastModified(MANUAL_ROUTE_DATES.get(englishPath));
}

export function getManualSitemapLastModified(name: string): string | undefined {
  return formatLastModified(MANUAL_SITEMAP_DATES.get(name));
}

export function getGitLastModified(sourceFile?: string): string | undefined {
  if (!sourceFile || !fs.existsSync(sourceFile)) {
    return undefined;
  }
  const cached = GIT_LASTMOD_CACHE.get(sourceFile);
  if (cached !== undefined) {
    return cached ?? undefined;
  }
  const relative = path.relative(process.cwd(), sourceFile);
  const result = spawnSync('git', ['log', '-1', '--pretty=format:%cs', '--', relative], {
    encoding: 'utf8',
  });
  if (!result.error && result.status === 0) {
    const formatted = formatLastModified(result.stdout.trim());
    GIT_LASTMOD_CACHE.set(sourceFile, formatted ?? null);
    return formatted;
  }
  if (FALLBACK_LASTMOD) {
    GIT_LASTMOD_CACHE.set(sourceFile, FALLBACK_LASTMOD);
    return FALLBACK_LASTMOD;
  }
  if (!USE_MTIME_FALLBACK) {
    GIT_LASTMOD_CACHE.set(sourceFile, null);
    return undefined;
  }
  try {
    const stats = fs.statSync(sourceFile);
    const formatted = formatLastModified(stats.mtime.toISOString());
    GIT_LASTMOD_CACHE.set(sourceFile, formatted ?? null);
    return formatted;
  } catch {
    GIT_LASTMOD_CACHE.set(sourceFile, null);
    return undefined;
  }
}

export function getRouteLastModified(englishPath: string, sourceFile?: string): string | undefined {
  return getManualRouteLastModified(englishPath) ?? getGitLastModified(sourceFile);
}

export function getModelLastModified(slug: string): string | undefined {
  if (!slug) {
    return undefined;
  }
  const englishPath = `/models/${slug}`;
  const manual = getManualRouteLastModified(englishPath);
  if (manual) {
    return manual;
  }
  const candidate = path.join(MODEL_CONTENT_ROOT, 'en', `${slug}.json`);
  return getGitLastModified(candidate);
}

export function getLatestEntryDate(entries: { lastModified?: string }[]): string | undefined {
  let latest: string | undefined;
  entries.forEach((entry) => {
    if (!entry.lastModified) {
      return;
    }
    if (!latest || entry.lastModified > latest) {
      latest = entry.lastModified;
    }
  });
  return latest;
}

export async function getVideoSitemapLastModified(): Promise<string | undefined> {
  const manual = getManualSitemapLastModified(getSitemapFileName('/sitemap-video.xml'));
  if (manual) {
    return manual;
  }

  const watchVideos = await listEligibleSeoWatchVideos();
  return getLatestEntryDate(
    watchVideos.map(({ entry, video }) => ({
      lastModified: formatLastModified(entry.publishedAt || video.createdAt),
    }))
  );
}

export function getModelsSitemapLastModified(): string | undefined {
  let latest: string | undefined;
  modelRoster.forEach((model) => {
    if (!model?.modelSlug || model?.surfaces?.modelPage?.includeInSitemap === false) {
      return;
    }
    const lastModified = getModelLastModified(model.modelSlug);
    if (!lastModified) {
      return;
    }
    if (!latest || lastModified > latest) {
      latest = lastModified;
    }
  });
  return latest;
}
