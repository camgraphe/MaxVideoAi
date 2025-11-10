import process from 'node:process';

function normalizeSiteUrl(value?: string | null): string {
  if (!value) {
    return 'https://maxvideoai.com';
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return 'https://maxvideoai.com';
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed.replace(/\/+$/, '');
  }
  return `https://${trimmed.replace(/\/+$/, '')}`;
}

function buildSitemapUrls(baseUrl: string): string[] {
  const normalized = baseUrl.replace(/\/+$/, '');
  return [`${normalized}/sitemap.xml`, `${normalized}/sitemap-video.xml`];
}

const siteUrl = normalizeSiteUrl(
  process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? process.env.VERCEL_URL
);
const sitemapUrls = buildSitemapUrls(siteUrl);

const searchEngines = [
  {
    name: 'Google',
    buildUrl: (sitemap: string) => `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemap)}`,
  },
  {
    name: 'Bing',
    buildUrl: (sitemap: string) => `https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemap)}`,
  },
];

async function pingEndpoints() {
  let hadError = false;
  for (const sitemap of sitemapUrls) {
    for (const engine of searchEngines) {
      const target = engine.buildUrl(sitemap);
      try {
        const response = await fetch(target);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }
        console.log(`[sitemap:ping] ${engine.name} acknowledged ${sitemap}`);
      } catch (error) {
        hadError = true;
        console.error(`[sitemap:ping] ${engine.name} failed for ${sitemap}`, error);
      }
    }
  }
  if (hadError) {
    process.exitCode = 1;
  }
}

void pingEndpoints();
