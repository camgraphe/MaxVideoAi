/** @type {import('next-sitemap').IConfig} */
const fs = require('fs');
const path = require('path');
const modelRoster = require('./config/model-roster.json');

const SITE_URL = 'https://maxvideoai.com';
const LOCALES = ['en', 'fr', 'es'];
const LOCALE_PATHS = { en: 'en', fr: 'fr', es: 'es' };
const MARKETING_CORE_PATHS = [
  '/',
  '/models',
  '/examples',
  '/workflows',
  '/pricing',
  '/pricing-calculator',
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
      paths.push(`/${LOCALE_PATHS[locale]}/blog/${slug}`);
    }
  }
  return paths;
}

function stripLocalePrefix(pathname) {
  const cleaned = pathname.replace(/^\/(en|fr|es)(?=\/|$)/, '');
  return cleaned || '/';
}

function buildLocaleHref(locale, cleanPath) {
  const suffix = cleanPath === '/' ? '' : cleanPath;
  return `${SITE_URL}/${locale}${suffix}`;
}

module.exports = {
  siteUrl: SITE_URL,
  generateRobotsTxt: true,
  sitemapSize: 7000,
  exclude: ['/api/*', '/_next/*'],
  changefreq: 'weekly',
  priority: 0.8,
  robotsTxtOptions: {
    policies: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/_next/', '/api/'],
      },
    ],
  },
  transform: async (config, path) => {
    const cleanPath = stripLocalePrefix(path);
    const alternateRefs = [
      { href: buildLocaleHref('en', cleanPath), hreflang: 'en' },
      { href: buildLocaleHref('fr', cleanPath), hreflang: 'fr' },
      { href: buildLocaleHref('es', cleanPath), hreflang: 'es' },
      { href: buildLocaleHref('en', cleanPath), hreflang: 'x-default' },
    ];

    return {
      loc: buildLocaleHref('en', cleanPath),
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

    const transformed = await Promise.all(
      Array.from(marketingPaths).map((loc) => config.transform(config, loc))
    );

    return transformed.filter(Boolean);
  },
};
