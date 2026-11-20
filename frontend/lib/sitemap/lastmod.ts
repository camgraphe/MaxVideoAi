import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import modelDateBaseline from '@/config/model-content-date-baseline.json';
import { SITEMAP_MANUAL_TIMESTAMPS } from '@/config/sitemap-timestamps';
import { listEligibleSeoWatchVideos } from '@/server/video-seo';
import { resolveVideoSitemapDates } from '@/server/sitemaps/video-dates';

const MODEL_CONTENT_DATES: Record<string, string> = process.env.SITEMAP_MODEL_CONTENT_DATES
  ? JSON.parse(process.env.SITEMAP_MODEL_CONTENT_DATES)
  : modelDateBaseline;

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
  const cwd = path.dirname(sourceFile);
  const result = spawnSync('git', ['log', '-1', '--format=%cs %H %P', '--', path.basename(sourceFile)], {
    cwd, encoding: 'utf8',
  });
  if (!result.error && result.status === 0) {
    const [day, commit, parent] = result.stdout.trim().split(' ');
    let formatted = formatLastModified(day);
    // At a shallow boundary, Git presents every inherited file as newly added.
    // A genuine root commit can still establish a file's publication date.
    if (formatted && !parent) {
      const location = spawnSync('git', ['rev-parse', '--git-path', 'shallow'], { cwd, encoding: 'utf8' });
      if (location.status === 0) {
        const shallowFile = path.resolve(cwd, location.stdout.trim());
        if (fs.existsSync(shallowFile) && fs.readFileSync(shallowFile, 'utf8').split('\n').includes(commit)) {
          formatted = undefined;
        }
      }
    }
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
  return getLatestEntryDate([
    { lastModified: getManualRouteLastModified(`/models/${slug}`) },
    { lastModified: formatLastModified(MODEL_CONTENT_DATES[slug]) },
  ]);
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
  return getVideoWatchSitemapLastModified('/sitemap-video.xml');
}

export async function getVideoPagesSitemapLastModified(): Promise<string | undefined> {
  return getVideoWatchSitemapLastModified('/sitemap-video-pages.xml');
}

async function getVideoWatchSitemapLastModified(sitemapPath: string): Promise<string | undefined> {
  const manual = getManualSitemapLastModified(getSitemapFileName(sitemapPath));
  if (manual) {
    return manual;
  }

  const watchVideos = await listEligibleSeoWatchVideos();
  return getLatestEntryDate(
    watchVideos.map(({ entry, video }) => ({
      lastModified: resolveVideoSitemapDates(entry, video).lastModified ?? undefined,
    }))
  );
}
