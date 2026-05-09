import fs from 'node:fs';
import path from 'node:path';
import type { AppLocale } from '@/i18n/locales';
import modelRoster from '@/config/model-roster.json';
import { INDEXED_MARKETING_EXAMPLE_CANONICAL_SLUGS } from '@/config/model-families';
import { BLOG_ENTRIES } from '@/lib/i18n/paths';
import { getContentEntries } from '@/lib/content/markdown';
import compareConfig from '@/config/compare-config.json';
import { getHubComparisonSlugsForSitemap } from '@/lib/compare-hub/data';
import { listEligibleSeoWatchVideos } from '@/server/video-seo';
import { canonicalizeCompareSlug, comparePaths, normalizeCompareEnglishPath } from './compare-paths';
import { formatLastModified, getGitLastModified, getModelLastModified, getRouteLastModified } from './lastmod';
import { hasBlogLocale, hasModelLocale } from './model-locales';
import {
  BASE_EXTRA_CANONICAL_PATHS,
  LOCALES,
  type CanonicalPathEntry,
  type DynamicRouteGenerator,
  type RouteTemplate,
} from './types';

const APP_PATHS_MANIFEST_PATH = findAppPathsManifestPath();
const SOURCE_APP_ROOT = resolveSourceAppRoot();
const LOCALIZED_SOURCE_APP_ROOT = SOURCE_APP_ROOT ? path.join(SOURCE_APP_ROOT, '(localized)', '[locale]') : null;
const PAGE_FILE_PATTERN = /^page\.(?:mdx|tsx?|ts|jsx?|js)$/i;
const IGNORED_ROUTE_TEMPLATES = new Set(['/404', '/video/[videoId]', '/v/[videoId]', '/legal/cookies']);
let cachedAppPathsManifest: Record<string, string> | null = null;

const parsedTolerance = Number(process.env.SITEMAP_LOCALE_TOLERANCE ?? '3');
const LOCALE_MISMATCH_TOLERANCE = Number.isFinite(parsedTolerance) && parsedTolerance >= 0 ? parsedTolerance : 3;
const FAIL_ON_LOCALE_MISMATCH = process.env.SITEMAP_LOCALE_FAIL_ON_MISMATCH === 'true';

export async function getCanonicalPathEntries(): Promise<CanonicalPathEntry[]> {
  return resolveCanonicalPathEntries();
}

async function resolveCanonicalPathEntries(): Promise<CanonicalPathEntry[]> {
  const templates = discoverLocalizedRouteTemplates();
  const entries: CanonicalPathEntry[] = [];
  const seen = new Set<string>();
  const dynamicTemplates = new Set<string>();

  templates.forEach((template) => {
    if (template.template === '/ai-video-engines/best-for' && !(compareConfig.bestForPages ?? []).length) {
      return;
    }
    if (template.isDynamic) {
      dynamicTemplates.add(template.template);
      return;
    }
    const normalizedTemplate = normalizeCompareEnglishPath(template.template);
    if (seen.has(normalizedTemplate)) {
      return;
    }
    seen.add(normalizedTemplate);
    const lastModified = getRouteLastModified(normalizedTemplate, template.sourceFile);
    entries.push({ englishPath: normalizedTemplate, lastModified });
  });

  for (const template of Array.from(dynamicTemplates)) {
    const generator = DYNAMIC_ROUTE_GENERATORS[template];
    if (!generator) {
      console.warn(`[sitemap] No generator registered for dynamic route ${template}, skipping.`);
      continue;
    }
    let generated: CanonicalPathEntry[] = [];
    try {
      generated = await generator();
    } catch (error) {
      console.error(`[sitemap] Failed to build entries for ${template}`, error);
      continue;
    }
    generated.forEach((entry) => {
      if (!entry?.englishPath) {
        return;
      }
      const normalizedPath = normalizeCompareEnglishPath(entry.englishPath);
      if (seen.has(normalizedPath)) {
        return;
      }
      seen.add(normalizedPath);
      entries.push({ ...entry, englishPath: normalizedPath, ...(entry.locales ? { locales: entry.locales } : {}) });
    });
  }

  const extraCanonicalPaths: CanonicalPathEntry[] = [
    ...BASE_EXTRA_CANONICAL_PATHS,
    ...(await listEligibleSeoWatchVideos()).map(({ entry, video }) => ({
      englishPath: `/video/${entry.id}`,
      lastModified: formatLastModified(entry.publishedAt || video.createdAt),
      locales: ['en'] as AppLocale[],
      disableAlternates: true,
    })),
  ];

  extraCanonicalPaths.forEach((extra) => {
    if (!extra?.englishPath) {
      return;
    }
    const normalizedPath = normalizeCompareEnglishPath(extra.englishPath);
    if (seen.has(normalizedPath)) {
      return;
    }
    seen.add(normalizedPath);
    entries.push({
      ...extra,
      englishPath: normalizedPath,
      ...(extra.locales ? { locales: extra.locales } : {}),
      ...(typeof extra.disableAlternates === 'boolean' ? { disableAlternates: extra.disableAlternates } : {}),
      lastModified: extra.lastModified ?? getRouteLastModified(normalizedPath),
    });
  });

  entries.sort((a, b) => comparePaths(a.englishPath, b.englishPath));
  validateLocaleCounts(entries);
  return entries;
}

function discoverLocalizedRouteTemplates(): RouteTemplate[] {
  const manifestTemplates = discoverTemplatesFromManifest();
  if (manifestTemplates.length > 0) {
    return manifestTemplates;
  }
  return discoverTemplatesFromFilesystem();
}

function findAppPathsManifestPath(): string | null {
  let currentDir = __dirname;
  for (let depth = 0; depth < 10; depth += 1) {
    const manifestPath = path.join(currentDir, 'app-paths-manifest.json');
    if (fs.existsSync(manifestPath)) {
      return manifestPath;
    }
    const parent = path.dirname(currentDir);
    if (parent === currentDir) {
      break;
    }
    currentDir = parent;
  }

  const fallbacks = [
    path.join(process.cwd(), '.next', 'server', 'app-paths-manifest.json'),
    path.join(process.cwd(), 'frontend', '.next', 'server', 'app-paths-manifest.json'),
  ];

  for (const candidate of fallbacks) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function resolveSourceAppRoot(): string | null {
  const candidates = [
    path.join(process.cwd(), 'app'),
    path.join(process.cwd(), 'frontend', 'app'),
    path.join(process.cwd(), '..', 'app'),
    path.join(process.cwd(), '..', 'frontend', 'app'),
    path.resolve(__dirname, '..', '..', '..', '..', 'app'),
    path.resolve(__dirname, '..', '..', '..', '..', '..', 'app'),
  ];

  const visited = new Set<string>();
  for (const candidate of candidates) {
    if (!candidate || visited.has(candidate)) {
      continue;
    }
    visited.add(candidate);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function loadAppPathsManifest(): Record<string, string> {
  if (cachedAppPathsManifest) {
    return cachedAppPathsManifest;
  }
  const manifestPath = APP_PATHS_MANIFEST_PATH;
  if (!manifestPath) {
    cachedAppPathsManifest = {};
    return cachedAppPathsManifest;
  }
  try {
    const raw = fs.readFileSync(manifestPath, 'utf8');
    cachedAppPathsManifest = JSON.parse(raw) as Record<string, string>;
  } catch (error) {
    console.warn('[sitemap] Failed to load app-paths manifest', error);
    cachedAppPathsManifest = {};
  }
  return cachedAppPathsManifest;
}

function normalizeManifestRoute(route: string): string | null {
  const prefix = '/(localized)/[locale]';
  if (!route.startsWith(prefix)) {
    return null;
  }
  const segments = route
    .slice(prefix.length)
    .split('/')
    .filter((segment) => Boolean(segment));
  const filtered = segments.filter(
    (segment) =>
      segment !== 'page' &&
      segment !== 'route' &&
      segment !== 'default' &&
      !isRouteGroupSegment(segment) &&
      !isParallelRouteSegment(segment)
  );
  if (filtered.length === 0) {
    return '/';
  }
  return `/${filtered.join('/')}`;
}

function findSourceFileForManifestEntry(relativeEntry: string): string | undefined {
  if (!SOURCE_APP_ROOT) {
    return undefined;
  }
  const trimmed = relativeEntry.startsWith('app/') ? relativeEntry.slice(4) : relativeEntry;
  const directoryPath = path.dirname(trimmed);
  const baseName = path.basename(trimmed, path.extname(trimmed));
  const candidateBases = ['page', 'route', 'default', baseName];
  const extensions = ['.tsx', '.ts', '.jsx', '.js', '.mdx', '.md'];

  for (const base of candidateBases) {
    if (!base) continue;
    for (const ext of extensions) {
      const candidate = path.join(SOURCE_APP_ROOT, directoryPath, `${base}${ext}`);
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  }
  return undefined;
}

function discoverTemplatesFromManifest(): RouteTemplate[] {
  const manifest = loadAppPathsManifest();
  const entries = Object.entries(manifest);
  if (!entries.length) {
    return [];
  }

  const map = new Map<string, RouteTemplate>();

  entries.forEach(([appRoute, relativeFile]) => {
    const normalized = normalizeManifestRoute(appRoute);
    if (!normalized || IGNORED_ROUTE_TEMPLATES.has(normalized)) {
      return;
    }
    const sourceFile = findSourceFileForManifestEntry(relativeFile);
    const existing = map.get(normalized);
    if (existing) {
      if (!existing.sourceFile && sourceFile) {
        existing.sourceFile = sourceFile;
      }
      return;
    }
    map.set(normalized, { template: normalized, isDynamic: normalized.includes('['), sourceFile });
  });

  return Array.from(map.values()).sort((a, b) => comparePaths(a.template, b.template));
}

function discoverTemplatesFromFilesystem(): RouteTemplate[] {
  if (!LOCALIZED_SOURCE_APP_ROOT || !fs.existsSync(LOCALIZED_SOURCE_APP_ROOT)) {
    return [];
  }

  const stack = [LOCALIZED_SOURCE_APP_ROOT];
  const map = new Map<string, RouteTemplate>();

  while (stack.length > 0) {
    const current = stack.pop() as string;
    const dirents = safeReadDir(current);
    dirents.forEach((entry) => {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        return;
      }
      if (!entry.isFile() || !PAGE_FILE_PATTERN.test(entry.name)) {
        return;
      }
      const normalized = buildEnglishPathFromDir(path.dirname(fullPath));
      if (!normalized || IGNORED_ROUTE_TEMPLATES.has(normalized)) {
        return;
      }
      map.set(normalized, { template: normalized, isDynamic: normalized.includes('['), sourceFile: fullPath });
    });
  }

  return Array.from(map.values()).sort((a, b) => comparePaths(a.template, b.template));
}

function buildEnglishPathFromDir(directory: string): string | null {
  if (!LOCALIZED_SOURCE_APP_ROOT) {
    return null;
  }
  const relative = path.relative(LOCALIZED_SOURCE_APP_ROOT, directory);
  if (relative.startsWith('..')) {
    return null;
  }
  const rawSegments = relative.split(path.sep).filter(Boolean);
  const segments = rawSegments.filter((segment) => !isRouteGroupSegment(segment) && !isParallelRouteSegment(segment));
  if (!segments.length) {
    return '/';
  }
  return `/${segments.join('/')}`;
}

function isRouteGroupSegment(segment: string): boolean {
  return segment.startsWith('(') && segment.endsWith(')');
}

function isParallelRouteSegment(segment: string): boolean {
  return segment.startsWith('@');
}

function safeReadDir(directory: string): fs.Dirent[] {
  try {
    return fs.readdirSync(directory, { withFileTypes: true });
  } catch {
    return [];
  }
}

const DYNAMIC_ROUTE_GENERATORS: Record<string, DynamicRouteGenerator> = {
  '/blog/[slug]': async () =>
    BLOG_ENTRIES.map((entry) => ({
      englishPath: `/blog/${entry.canonicalSlug}`,
      lastModified: entry.lastModified,
      locales: LOCALES.filter((locale) => hasBlogLocale(entry.canonicalSlug, locale)),
    })),
  '/docs/[slug]': async () => {
    const docs = await getContentEntries('content/docs');
    return docs.map((doc) => ({
      englishPath: `/docs/${doc.slug}`,
      lastModified: formatLastModified(doc.updatedAt) ?? getGitLastModified(doc.sourcePath),
    }));
  },
  '/examples/[model]': async () =>
    INDEXED_MARKETING_EXAMPLE_CANONICAL_SLUGS.map((model) => ({
      englishPath: `/examples/${model}`,
    })),
  '/models/[slug]': async () =>
    modelRoster
      .filter((model) => Boolean(model?.modelSlug) && model?.surfaces?.modelPage?.includeInSitemap !== false)
      .map((model) => ({
        englishPath: `/models/${model.modelSlug}`,
        lastModified: getModelLastModified(model.modelSlug),
        locales: LOCALES.filter((locale) => hasModelLocale(model.modelSlug, locale)),
      })),
  '/ai-video-engines/[slug]': async () =>
    Array.from(new Set(getHubComparisonSlugsForSitemap().map((slug) => canonicalizeCompareSlug(slug)))).map((slug) => ({
      englishPath: `/ai-video-engines/${slug}`,
      locales: LOCALES,
    })),
  '/ai-video-engines/best-for/[usecase]': async () =>
    (compareConfig.bestForPages ?? []).map((entry: { slug: string }) => ({
      englishPath: `/ai-video-engines/best-for/${entry.slug}`,
      locales: LOCALES,
    })),
};

function validateLocaleCounts(entries: CanonicalPathEntry[]): void {
  const counts: Record<AppLocale, number> = { en: 0, fr: 0, es: 0 };
  entries.forEach((entry) => {
    if (entry.disableAlternates) {
      return;
    }
    const availableLocales = entry.locales ?? LOCALES;
    availableLocales.forEach((locale) => {
      counts[locale] = (counts[locale] ?? 0) + 1;
    });
  });

  const englishCount = counts.en ?? 0;
  LOCALES.forEach((locale) => {
    if (locale === 'en') {
      return;
    }
    const localeCount = counts[locale] ?? 0;
    const difference = Math.abs(englishCount - localeCount);
    if (difference > LOCALE_MISMATCH_TOLERANCE) {
      const warningMessage = `[sitemap] ${locale.toUpperCase()} sitemap has ${localeCount} URLs vs EN ${englishCount} (diff ${difference}).`;
      console.warn(warningMessage);
      if (FAIL_ON_LOCALE_MISMATCH) {
        throw new Error(warningMessage);
      }
    }
  });
}
