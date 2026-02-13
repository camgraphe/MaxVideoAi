import fs from 'node:fs/promises';
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

function toAbsoluteUrl(siteUrl: string, value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `${siteUrl}${trimmed.startsWith('/') ? trimmed : `/${trimmed}`}`;
}

function buildDefaultSitemapUrls(siteUrl: string): string[] {
  const normalized = siteUrl.replace(/\/+$/, '');
  return [`${normalized}/sitemap.xml`, `${normalized}/sitemap-video.xml`];
}

type CliOptions = {
  urls: string[];
  file?: string;
  includeSitemaps: boolean;
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { urls: [], includeSitemaps: false };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (current === '--url') {
      const next = argv[index + 1];
      if (next) {
        options.urls.push(next);
        index += 1;
      }
      continue;
    }
    if (current === '--file') {
      const next = argv[index + 1];
      if (next) {
        options.file = next;
        index += 1;
      }
      continue;
    }
    if (current === '--sitemaps') {
      options.includeSitemaps = true;
      continue;
    }
  }

  return options;
}

async function readUrlsFromFile(filePath: string): Promise<string[]> {
  const raw = await fs.readFile(filePath, 'utf8');
  return raw
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
}

async function submitToSiteIndexNow(siteUrl: string, targetUrl: string): Promise<void> {
  const endpoint = `${siteUrl.replace(/\/+$/, '')}/api/indexnow`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: targetUrl }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => null);
    throw new Error(detail ?? `HTTP ${response.status} ${response.statusText}`);
  }
}

async function submitWithRetry(siteUrl: string, targetUrl: string): Promise<boolean> {
  const maxAttempts = 4;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await submitToSiteIndexNow(siteUrl, targetUrl);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isRateLimited = message.includes('TooManyRequests') || message.includes('429');
      if (!isRateLimited || attempt === maxAttempts) {
        console.error(`[indexnow] failed ${targetUrl}`, message);
        return false;
      }
      const waitMs = 600 * attempt;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
  return false;
}

async function main() {
  const siteUrl = normalizeSiteUrl(
    process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? process.env.VERCEL_URL
  );

  const { urls: cliUrls, file, includeSitemaps } = parseArgs(process.argv.slice(2));
  const envUrls = (process.env.INDEXNOW_URLS ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  const fileUrls = file ? await readUrlsFromFile(file) : [];

  const targets = new Set<string>();
  [...cliUrls, ...envUrls, ...fileUrls].forEach((entry) => {
    const absolute = toAbsoluteUrl(siteUrl, entry);
    if (absolute) targets.add(absolute);
  });

  if (includeSitemaps || targets.size === 0) {
    buildDefaultSitemapUrls(siteUrl).forEach((url) => targets.add(url));
  }

  const urls = Array.from(targets);
  if (!urls.length) {
    console.log('[indexnow] no urls to submit');
    return;
  }

  let ok = 0;
  let fail = 0;

  for (const url of urls) {
    const success = await submitWithRetry(siteUrl, url);
    if (success) {
      ok += 1;
      console.log(`[indexnow] submitted ${url}`);
    } else {
      fail += 1;
    }
  }

  console.log(`[indexnow] done ok=${ok} fail=${fail}`);
  if (fail > 0) {
    process.exitCode = 1;
  }
}

void main();
