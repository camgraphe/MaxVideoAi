/** @type {import('next-sitemap').IConfig} */
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const modelRoster = require('./config/model-roster.json');
const localizedSlugConfig = require('./config/localized-slugs.json');

const { Client } = require('pg');

const SITE_URL = 'https://maxvideoai.com';
const LOCALES = ['en', 'fr', 'es'];
const LOCALE_PREFIXES = { en: '', fr: 'fr', es: 'es' };
const MARKETING_CORE_PATHS = [
  '/',
  '/models',
  '/examples',
  '/sitemap-video.xml',
  '/workflows',
  '/pricing',
  '/docs',
  '/blog',
  '/about',
  '/contact',
  '/legal',
  '/legal/privacy',
  '/legal/terms',
  '/changelog',
  '/status',
];

const CONTENT_ROOT = path.join(__dirname, '..', 'content');

function resolveDatabaseUrl() {
  return (
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL ||
    null
  );
}

async function fetchSlugsFromDb(tableName, basePath) {
  const connectionString = resolveDatabaseUrl();
  if (!connectionString) {
    return [];
  }

  const client = new Client({ connectionString });
  try {
    await client.connect();
    const { rows } = await client.query(
      `SELECT slug, updated_at FROM ${tableName} WHERE slug IS NOT NULL`
    );
    return rows
      .filter((row) => typeof row.slug === 'string' && row.slug.trim().length > 0)
      .map((row) => ({
        path: `${basePath}/${row.slug.trim()}`.replace(/\/{2,}/g, '/'),
        lastmod: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
      }));
  } catch (error) {
    console.warn(`[next-sitemap] skipped ${tableName} slugs`, error.message || error);
    return [];
  } finally {
    try {
      await client.end();
    } catch {}
  }
}

function collectContentSlugs(section) {
  const directory = path.join(CONTENT_ROOT, section);
  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(md|mdx)$/i.test(entry.name))
    .map((entry) => `/${section}/${entry.name.replace(/\.(md|mdx)$/i, '')}`);
}

function buildBlogSlugMap() {
  const map = new Map();
  for (const locale of LOCALES) {
    const dir = path.join(CONTENT_ROOT, locale, 'blog');
    if (!fs.existsSync(dir)) continue;
    const entries = fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.(md|mdx)$/i.test(entry.name));
    for (const entry of entries) {
      const filePath = path.join(dir, entry.name);
      const raw = fs.readFileSync(filePath, 'utf8');
      const { data } = matter(raw);
      const slug = data.slug || entry.name.replace(/\.(md|mdx)$/i, '');
      const canonicalSlug = data.canonicalSlug || (locale === 'en' ? slug : undefined) || slug;
      if (!map.has(canonicalSlug)) {
        map.set(canonicalSlug, {});
      }
      map.get(canonicalSlug)[locale] = slug;
    }
  }
  return map;
}

const BLOG_SLUG_MAP = buildBlogSlugMap();
const BLOG_SLUG_LOOKUP = (() => {
  const lookup = new Map();
  for (const [canonicalSlug, localeMap] of BLOG_SLUG_MAP.entries()) {
    lookup.set(canonicalSlug, localeMap);
    Object.entries(localeMap).forEach(([locale, slug]) => {
      lookup.set(`${locale}:${slug}`, canonicalSlug);
    });
  }
  return lookup;
})();

function collectLocalizedBlogPaths() {
  const paths = [];
  for (const locale of LOCALES) {
    const dir = path.join(CONTENT_ROOT, locale, 'blog');
    if (!fs.existsSync(dir)) continue;
    const entries = fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.(md|mdx)$/i.test(entry.name));
    for (const entry of entries) {
      const slug = entry.name.replace(/\.(md|mdx)$/i, '');
      const prefix = LOCALE_PREFIXES[locale] ? `/${LOCALE_PREFIXES[locale]}` : '';
      const pathName = `${prefix}/blog/${slug}`.replace(/\/{2,}/g, '/');
      paths.push(pathName === '' ? '/' : pathName);
    }
  }
  return paths;
}

async function collectDynamicDbPaths() {
  const [models, examples, workflows] = await Promise.all([
    fetchSlugsFromDb('models', '/models'),
    fetchSlugsFromDb('examples', '/examples'),
    fetchSlugsFromDb('workflows', '/workflows'),
  ]);
  return [...models, ...examples, ...workflows];
}

function normalizePathSegments(...segments) {
  const filtered = segments.filter(Boolean).flatMap((segment) => segment.split('/'));
  const cleaned = filtered.filter(Boolean).map((segment) => segment.replace(/^\/+|\/+$/g, ''));
  if (!cleaned.length) {
    return '/';
  }
  return `/${cleaned.join('/')}`;
}

function localizePathFromEnglish(locale, englishPath) {
  if (locale === 'en') {
    return englishPath;
  }
  if (englishPath === '/') {
    return normalizePathSegments(LOCALE_PREFIXES[locale]);
  }
  const segments = englishPath.split('/').filter(Boolean);
  if (!segments.length) {
    return normalizePathSegments(LOCALE_PREFIXES[locale]);
  }
  const [firstSegment, ...rest] = segments;
  let localizedFirst = firstSegment;
  for (const [key, mapping] of Object.entries(localizedSlugConfig)) {
    if (mapping.en === firstSegment) {
      localizedFirst = mapping[locale] ?? firstSegment;
      break;
    }
  }
  if (firstSegment === 'blog' && rest.length > 0) {
    const slug = rest[0];
    const localizedSlug = BLOG_SLUG_MAP.get(slug)?.[locale] ?? slug;
    return normalizePathSegments(LOCALE_PREFIXES[locale], 'blog', localizedSlug, ...rest.slice(1));
  }
  return normalizePathSegments(LOCALE_PREFIXES[locale], localizedFirst, ...rest);
}

function toEnglishPath(localizedPath) {
  const normalized = localizedPath.startsWith('/') ? localizedPath : `/${localizedPath}`;
  for (const locale of LOCALES) {
    const prefix = LOCALE_PREFIXES[locale];
    if (!prefix) {
      continue;
    }
    const prefixed = `/${prefix}`;
    if (normalized === prefixed) {
      return '/';
    }
    if (normalized.startsWith(`${prefixed}/`)) {
      const remainder = normalized.slice(prefixed.length) || '/';
      return convertLocalizedSegmentsToEnglish(locale, remainder);
    }
  }
  return normalized;
}

function convertLocalizedSegmentsToEnglish(locale, pathWithoutPrefix) {
  if (!pathWithoutPrefix || pathWithoutPrefix === '/') {
    return '/';
  }
  const segments = pathWithoutPrefix.split('/').filter(Boolean);
  if (!segments.length) {
    return '/';
  }
  const [firstSegment, ...rest] = segments;
  let englishFirst = firstSegment;
  for (const [key, mapping] of Object.entries(localizedSlugConfig)) {
    if (mapping[locale] === firstSegment) {
      englishFirst = mapping.en;
      break;
    }
  }
  if (firstSegment === 'blog' && rest.length > 0) {
    const slug = rest[0];
    const canonicalSlug = BLOG_SLUG_LOOKUP.get(`${locale}:${slug}`) ?? slug;
    return normalizePathSegments('', 'blog', canonicalSlug, ...rest.slice(1));
  }
  return normalizePathSegments('', englishFirst, ...rest);
}

function buildLocaleHref(locale, englishPath) {
  const localizedPath = localizePathFromEnglish(locale, englishPath);
  if (localizedPath === '/') {
    return `${SITE_URL}/`;
  }
  return `${SITE_URL}${localizedPath}`;
}

module.exports = {
  siteUrl: SITE_URL,
  // Keep generated XML under a namespaced folder so the runtime sitemap route owns /sitemap.xml.
  outDir: './public/generated-sitemaps',
  // We manage robots.txt manually in public/robots.txt to avoid accidental
  // overwrites and to allow fine-grained Allow rules for Next assets.
  generateRobotsTxt: false,
  sitemapSize: 7000,
  exclude: ['/api/*', '/_next/*'],
  changefreq: 'weekly',
  priority: 0.8,
  // robotsTxtOptions no longer used (manual robots.txt)
  transform: async (config, path) => {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const englishPath = toEnglishPath(normalizedPath);
    const loc = `${SITE_URL}${normalizedPath === '/' ? '/' : normalizedPath}`;
    const alternateRefs = [
      { href: buildLocaleHref('en', englishPath), hreflang: 'en' },
      { href: buildLocaleHref('fr', englishPath), hreflang: 'fr' },
      { href: buildLocaleHref('es', englishPath), hreflang: 'es' },
      { href: buildLocaleHref('en', englishPath), hreflang: 'x-default' },
    ];

    return {
      loc,
      changefreq: config.changefreq,
      priority: config.priority,
      lastmod: config.autoLastmod ? new Date().toISOString() : undefined,
      alternateRefs,
    };
  },
  additionalPaths: async (config) => {
    const marketingPaths = new Set(MARKETING_CORE_PATHS);

    for (const entry of modelRoster) {
      if (entry?.modelSlug) {
        marketingPaths.add(`/models/${entry.modelSlug}`);
      }
    }

    for (const slug of collectContentSlugs('docs')) {
      marketingPaths.add(slug);
    }

    collectLocalizedBlogPaths().forEach((slug) => marketingPaths.add(slug));

    const dynamicEntries = await collectDynamicDbPaths();
    const baseEntries = Array.from(marketingPaths).map((loc) => ({ path: loc }));
    const entries = baseEntries.concat(dynamicEntries);

    const transformed = await Promise.all(
      entries.map(async ({ path, lastmod }) => {
        const entry = await config.transform(config, path);
        if (entry && lastmod) {
          entry.lastmod = lastmod;
        }
        return entry;
      })
    );

    return transformed.filter(Boolean);
  },
};
