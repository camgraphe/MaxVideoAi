/* eslint-disable no-console */
import fs from 'node:fs';
import path from 'node:path';
import { XMLParser } from 'fast-xml-parser';

const PROD_SITEMAP = process.env.PROD_SITEMAP || 'https://maxvideoai.com/sitemap.xml';
const LOCAL_SITEMAP = process.env.LOCAL_SITEMAP || path.resolve(process.cwd(), 'public', 'sitemap.xml');
const HOST = process.env.PROD_HOST || 'https://maxvideoai.com';
const CANONICAL_HOST = process.env.CANONICAL_HOST || HOST;
const OPTIONAL_CANONICAL_PATHS = new Set(['/sitemap-video.xml']);

const isEN = (u: string) => !u.includes('/fr/') && !u.includes('/es/');
const strip = (u: string) => {
  try {
    const { pathname, search } = new URL(u, HOST);
    return pathname.replace(/\/+$/, '') + (search || '');
  } catch {
    return u;
  }
};
const xml = new XMLParser({ ignoreAttributes: false });

async function fetchText(u: string) {
  const r = await fetch(u, { redirect: 'manual' });
  if (!r.ok && ![301, 302].includes(r.status)) {
    throw new Error(`Fetch ${r.status} ${u}`);
  }
  return r.text();
}

function extractUrlEntries(doc: any) {
  const urls = doc.urlset?.url;
  if (!urls) return [];
  return (Array.isArray(urls) ? urls : [urls]).map((it: any) => String(it.loc));
}

function extractSitemapEntries(doc: any) {
  const entries = doc.sitemapindex?.sitemap;
  if (!entries) return [];
  return (Array.isArray(entries) ? entries : [entries]).map((it: any) => String(it.loc));
}

async function expandSitemap(xmlStr: string, resolver: (loc: string) => Promise<string | null>): Promise<string[]> {
  const doc = xml.parse(xmlStr);
  const urls = extractUrlEntries(doc);
  if (urls.length) {
    return urls;
  }
  const children = extractSitemapEntries(doc);
  let aggregated: string[] = [];
  for (const child of children) {
    const resolved = await resolver(child);
    if (!resolved) continue;
    const childUrls = await expandSitemap(resolved, resolver);
    aggregated = aggregated.concat(childUrls);
  }
  return aggregated;
}

async function loadRemoteSitemap(url: string) {
  const resolver = (loc: string) => fetchText(loc);
  const xmlStr = await fetchText(url);
  return expandSitemap(xmlStr, resolver);
}

async function loadLocalSitemap(filePath: string) {
  const resolver = async (loc: string) => {
    try {
      const parsed = new URL(loc);
      const file = path.resolve(process.cwd(), 'public', path.basename(parsed.pathname));
      if (fs.existsSync(file)) {
        return fs.readFileSync(file, 'utf8');
      }
    } catch {
      // ignore
    }
    return null;
  };
  const xmlStr = fs.readFileSync(filePath, 'utf8');
  return expandSitemap(xmlStr, resolver);
}

async function headOrGet(u: string) {
  let r = await fetch(u, { method: 'HEAD', redirect: 'manual' });
  if (r.status === 405) {
    r = await fetch(u, { method: 'GET', redirect: 'manual' });
  }
  return r;
}

async function getCanonical(u: string) {
  const r = await fetch(u);
  const h = await r.text();
  const m = h.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i);
  return m?.[1] || null;
}

async function main() {
  const [prodUrls, localUrls] = await Promise.all([loadRemoteSitemap(PROD_SITEMAP), loadLocalSitemap(LOCAL_SITEMAP)]);
  const prodEN = prodUrls.filter(isEN).map(strip);
  const localEN = localUrls.filter(isEN).map(strip);
  const prodSet = new Set(prodEN);
  const localSet = new Set(localEN);

  const missingLocally = [...prodSet].filter((p) => !localSet.has(p));
  const newLocally = [...localSet].filter((p) => !prodSet.has(p));

  console.log(`EN URLs — prod:${prodSet.size} local:${localSet.size}`);
  console.log(`Absent local (étaient en prod): ${missingLocally.length}`);
  console.log(`Nouveaux (absents prod): ${newLocally.length}`);

  const redirIssues: Array<{ url: string; status: number; loc?: string; follow?: number }> = [];
  for (const p of missingLocally) {
    const url = HOST + p;
    const r1 = await headOrGet(url);
    const loc = r1.headers.get('location') || '';
    if (![200, 301, 302].includes(r1.status)) {
      redirIssues.push({ url, status: r1.status, loc });
      continue;
    }
    if ([301, 302].includes(r1.status)) {
      const u2 = loc.startsWith('http') ? loc : HOST + loc;
      const r2 = await headOrGet(u2);
      if (r2.status !== 200) {
        redirIssues.push({ url, status: r1.status, follow: r2.status, loc });
      }
    }
  }

  const sample = [...localSet].filter((p) => !OPTIONAL_CANONICAL_PATHS.has(p)).slice(0, 20);
  const canonIssues: Array<{ url: string; canonical: string | null }> = [];
  for (const p of sample) {
    const url = CANONICAL_HOST + p;
    try {
      const can = await getCanonical(url);
      const self = url.replace(/\/+$/, '');
      if (!can || can.replace(/\/+$/, '') !== self) {
        canonIssues.push({ url, canonical: can });
      }
    } catch {
      canonIssues.push({ url, canonical: null });
    }
  }

  console.log('\n=== Résumé EN ===');
  console.log(missingLocally.length ? `⚠️ Absent local: ${missingLocally.slice(0, 10).join(', ')}` : '✅ Aucune URL EN perdue localement');
  console.log(redirIssues.length ? `⚠️ Redirects à corriger: ${JSON.stringify(redirIssues, null, 2)}` : '✅ Redirects/200 OK');
  console.log(canonIssues.length ? `⚠️ Canonicals non self: ${JSON.stringify(canonIssues, null, 2)}` : '✅ Canonicals EN auto-référents (échantillon)');
}

main().catch((error) => {
  console.error('compare-en failed', error);
  process.exit(1);
});
