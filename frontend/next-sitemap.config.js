/** @type {import('next-sitemap').IConfig} */
const fs = require('fs');
const path = require('path');
const modelRoster = require('./config/model-roster.json');

const MARKETING_CORE_PATHS = [
  '/',
  '/models',
  '/examples',
  '/workflows',
  '/pricing',
  '/calculator',
  '/docs',
  '/blog',
  '/about',
  '/contact',
  '/privacy',
  '/terms',
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

module.exports = {
  siteUrl: 'https://maxvideoai.com',
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

    for (const slug of collectContentSlugs('blog')) {
      marketingPaths.add(slug);
    }

    const transformed = await Promise.all(
      Array.from(marketingPaths).map((loc) => config.transform(config, loc))
    );

    return transformed.filter(Boolean);
  },
};
