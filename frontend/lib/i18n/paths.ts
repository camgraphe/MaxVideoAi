import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import localizedSlugConfig from '@/config/localized-slugs.json';

export type SupportedLocale = 'en' | 'fr' | 'es';

export const LOCALES: SupportedLocale[] = ['en', 'fr', 'es'];
export const LOCALE_PREFIXES: Record<SupportedLocale, string> = { en: '', fr: 'fr', es: 'es' };

export type BlogEntryMeta = {
  canonicalSlug: string;
  localizedSlugs: Record<SupportedLocale, string>;
  lastModified?: string;
};

type LocalizedSegmentConfig = Record<SupportedLocale, string> & { en: string };

const LOCALIZED_SEGMENT_MAP = new Map<string, Record<SupportedLocale, string>>(
  Object.values(localizedSlugConfig as Record<string, LocalizedSegmentConfig>).map((value) => [
    value.en,
    {
      en: value.en,
      fr: value.fr ?? value.en,
      es: value.es ?? value.en,
    },
  ])
);

const REVERSE_SEGMENT_MAP = new Map<SupportedLocale, Map<string, string>>();
LOCALES.forEach((locale) => {
  const reverse = new Map<string, string>();
  LOCALIZED_SEGMENT_MAP.forEach((localizedMap, englishSegment) => {
    reverse.set(localizedMap[locale], englishSegment);
  });
  REVERSE_SEGMENT_MAP.set(locale, reverse);
});

export const CONTENT_ROOT = path.join(process.cwd(), 'content');

type BlogSlugMap = Map<string, Record<SupportedLocale, string>>;

const BLOG_ENTRIES_INTERNAL = buildBlogEntries();
export const BLOG_ENTRIES: BlogEntryMeta[] = BLOG_ENTRIES_INTERNAL;
export const BLOG_SLUG_MAP: BlogSlugMap = new Map(
  BLOG_ENTRIES_INTERNAL.map((entry) => [entry.canonicalSlug, entry.localizedSlugs])
);
const BLOG_SLUG_REVERSE = new Map<SupportedLocale, Map<string, string>>();
LOCALES.forEach((locale) => {
  const reverse = new Map<string, string>();
  BLOG_SLUG_MAP.forEach((localeMap, canonicalSlug) => {
    const localized = localeMap[locale];
    if (localized) {
      reverse.set(localized, canonicalSlug);
    }
  });
  BLOG_SLUG_REVERSE.set(locale, reverse);
});

function buildBlogEntries(): BlogEntryMeta[] {
  const map = new Map<string, BlogEntryMeta>();
  LOCALES.forEach((locale) => {
    const dir = path.join(CONTENT_ROOT, locale, 'blog');
    if (!fs.existsSync(dir)) return;
    const entries = fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.(md|mdx)$/i.test(entry.name));
    entries.forEach((entry) => {
      const filePath = path.join(dir, entry.name);
      const raw = fs.readFileSync(filePath, 'utf8');
      const { data } = matter(raw);
      const slug = (data.slug || entry.name.replace(/\.(md|mdx)$/i, '')).trim();
      const canonicalSlug = (data.canonicalSlug || (locale === 'en' ? slug : undefined) || slug).trim();
      if (!map.has(canonicalSlug)) {
        map.set(canonicalSlug, {
          canonicalSlug,
          localizedSlugs: {} as Record<SupportedLocale, string>,
          lastModified: undefined,
        });
      }
      const bucket = map.get(canonicalSlug)!;
      bucket.localizedSlugs[locale] = slug;
      const frontMatterDate =
        resolveIsoDate(
          data.updatedAt ??
            data.updated_at ??
            data.updated ??
            data.modifiedAt ??
            data.modified_at ??
            data.modified ??
            data.date ??
            data.publishedAt ??
            data.published_at
        ) ?? resolveIsoDate(fs.statSync(filePath).mtime);
      if (frontMatterDate && (!bucket.lastModified || frontMatterDate > bucket.lastModified)) {
        bucket.lastModified = frontMatterDate;
      }
    });
  });
  return Array.from(map.values());
}

export function normalizePathSegments(...segments: Array<string | undefined | null>): string {
  const filtered = segments
    .flatMap((segment) => (segment ? String(segment).split('/') : []))
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (!filtered.length) {
    return '/';
  }
  return `/${filtered.join('/')}`;
}

export function localizePathFromEnglish(locale: SupportedLocale, englishPath: string): string {
  if (locale === 'en') {
    return englishPath;
  }
  const prefix = LOCALE_PREFIXES[locale];
  if (englishPath === '/') {
    return prefix ? `/${prefix}` : '/';
  }
  const segments = englishPath.split('/').filter(Boolean);
  if (!segments.length) {
    return prefix ? `/${prefix}` : '/';
  }
  const [firstSegment, ...rest] = segments;
  const localizedFirst = LOCALIZED_SEGMENT_MAP.get(firstSegment)?.[locale] ?? firstSegment;
  if (firstSegment === 'blog' && rest.length > 0) {
    const slug = rest[0];
    const localizedSlug = BLOG_SLUG_MAP.get(slug)?.[locale] ?? slug;
    return normalizePathSegments(prefix, 'blog', localizedSlug, ...rest.slice(1));
  }
  return normalizePathSegments(prefix, localizedFirst, ...rest);
}

export function englishPathFromLocale(locale: SupportedLocale, localizedPath: string): string {
  if (locale === 'en') {
    return localizedPath || '/';
  }
  let trimmed = localizedPath.split('?')[0];
  if (!trimmed.startsWith('/')) {
    trimmed = `/${trimmed}`;
  }
  const prefix = `/${LOCALE_PREFIXES[locale]}`;
  const withoutPrefix = trimmed.startsWith(prefix)
    ? trimmed.slice(prefix.length) || '/'
    : trimmed;
  if (withoutPrefix === '/') {
    return '/';
  }
  const segments = withoutPrefix.split('/').filter(Boolean);
  const [first, ...rest] = segments;
  const englishFirst = REVERSE_SEGMENT_MAP.get(locale)?.get(first) ?? first;
  if (englishFirst === 'blog' && rest.length > 0) {
    const localizedSlug = rest[0];
    const englishSlug = BLOG_SLUG_REVERSE.get(locale)?.get(localizedSlug) ?? localizedSlug;
    return normalizePathSegments('blog', englishSlug, ...rest.slice(1));
  }
  return normalizePathSegments(englishFirst, ...rest);
}

export function buildLanguageAlternates(
  englishPath: string,
  buildAbsoluteUrl: (path: string) => string
): Record<string, string> {
  const map: Record<string, string> = {};
  LOCALES.forEach((locale) => {
    const localized = localizePathFromEnglish(locale, englishPath);
    map[locale] = buildAbsoluteUrl(localized);
  });
  map['x-default'] = buildAbsoluteUrl(englishPath);
  return map;
}

function resolveIsoDate(value: unknown): string | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return date.toISOString();
}
