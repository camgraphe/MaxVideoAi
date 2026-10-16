#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';

const { buildRobotsText } = createRequire(import.meta.url)('../../frontend/lib/seo/robots-text.ts');

const ORIGIN = 'https://maxvideoai.com';
const PAGE_LIMIT = 2500;
const SITEMAP_LIMIT = 20;

export function matchesPublicRobotsPolicy(text) {
  const normalize = value => value.split('\n').map(line => line.split('#')[0].trim()).filter(Boolean).join('\n');
  return normalize(text) === normalize(buildRobotsText('public'));
}

// Network destinations always come from the public origin, never arbitrary hrefs.
export function publicUrl(value, origin = ORIGIN) {
  const url = new URL(value, origin);
  if (url.origin !== origin || url.username || url.password || url.hash) {
    throw new Error(`Non-public audit destination: ${value}`);
  }
  return url.href;
}

export function parseSitemap(xml, origin = ORIGIN) {
  const dom = new JSDOM(xml, {contentType:'application/xml'});
  try {
    const root = dom.window.document.documentElement;
    if (!['sitemapindex', 'urlset'].includes(root.localName)) throw new Error('Invalid sitemap document');
    const urls = [...root.children].flatMap(entry => [...entry.children]
      .filter(child => child.localName === 'loc')
      .map(child => publicUrl(child.textContent.trim(), origin)));
    if (!urls.length) throw new Error('Empty sitemap');
    return {kind:root.localName, urls};
  } finally { dom.window.close(); }
}

export function inspectPublicPage({url, status, headers, html}) {
  const dom = new JSDOM(html, {url});
  try {
    const document = dom.window.document;
    const errors = [];
    if (status !== 200) errors.push(`http-${status}`);
    const canonicals = [...document.querySelectorAll('link[rel~="canonical"]')].map(node => node.href);
    if (canonicals.length !== 1) errors.push('canonical-count');
    if (canonicals[0] !== url) errors.push('canonical-mismatch');
    const robots = [...document.querySelectorAll('meta[name]')]
      .filter(node => ['robots','googlebot'].includes(node.name.toLowerCase()))
      .map(node => node.content).concat(headers.get('x-robots-tag') || '');
    if (robots.some(value => /\b(noindex|none)\b/i.test(value))) errors.push('indexing-excluded');
    if (!document.title.trim()) errors.push('missing-title');
    if (document.querySelectorAll('h1').length !== 1) errors.push('h1-count');
    const languages = {};
    for (const node of document.querySelectorAll('link[hreflang]')) {
      if (Object.hasOwn(languages,node.hreflang)) errors.push('duplicate-hreflang');
      languages[node.hreflang] = node.href;
    }
    for (const node of document.querySelectorAll('script[type="application/ld+json"]')) {
      try { JSON.parse(node.textContent); } catch { errors.push('invalid-jsonld'); }
    }
    const links = [...new Set([...document.querySelectorAll('a[href]')].flatMap(node => {
      try { const target = new URL(node.href); target.hash = ''; return target.origin === new URL(url).origin ? [target.href] : []; }
      catch { return []; }
    }))];
    // Only default gallery pagination is eligible here. Sort/filter URLs retain
    // their deliberate noindex policy and are covered by offline route tests.
    const pagination = links.filter(href => {
      const target = new URL(href);
      return /^\/(examples|fr\/galerie|es\/galeria)(\/[^/]+)?$/.test(target.pathname)
        && [...target.searchParams.keys()].length === 1
        && /^[2-9]\d*$|^1\d+$/.test(target.searchParams.get('page') || '');
    });
    return {url,status,canonical:canonicals[0],robots,languages,title:document.title,links,pagination,errors};
  } finally { dom.window.close(); }
}

export function checkHreflang(pages) {
  const byUrl = new Map(pages.map(page => [page.url,page]));
  const errors = [];
  for (const page of pages) for (const [language,url] of Object.entries(page.languages || {})) {
    const target = byUrl.get(url);
    if (!target || target.canonical !== url
      || !Object.values(target.languages || {}).includes(page.url)
      || Object.entries(page.languages).some(([key,value]) => target.languages?.[key] !== value)) {
      errors.push({url:page.url,error:'nonreciprocal-hreflang',language,target:url});
    }
  }
  return errors;
}

async function fetchDocument(url, deadline) {
  publicUrl(url);
  for (let attempt = 0; attempt < 3; attempt++) {
    if (Date.now() >= deadline) throw new Error('audit-deadline-exceeded');
    const response = await fetch(url, {
      redirect:'manual', signal:AbortSignal.timeout(Math.max(1,Math.min(30_000,deadline-Date.now()))),
      headers:{'user-agent':'MaxVideoAI-Public-SEO-Audit/1.0','accept':'text/html,application/xml'},
    });
    if ((response.status === 429 || response.status >= 500) && attempt < 2) {
      await response.body?.cancel();
      await new Promise(done => setTimeout(done, 1000 * (attempt + 1)));
      continue;
    }
    let size = 0;
    const chunks = [];
    for await (const chunk of response.body || []) {
      size += chunk.byteLength;
      if (size > 5_000_000) throw new Error('Document exceeds 5 MB audit limit');
      chunks.push(chunk);
    }
    return {status:response.status,headers:response.headers,html:Buffer.concat(chunks).toString('utf8')};
  }
}

export async function auditPublicPages({readDocument, timeLimitMs = 18 * 60_000} = {}) {
  const deadline = Date.now() + timeLimitMs;
  const checkDeadline = () => { if (Date.now() >= deadline) throw new Error('audit-deadline-exceeded'); };
  const read = async url => { checkDeadline(); return readDocument ? readDocument(url) : fetchDocument(url,deadline); };
  const report = {capturedAt:new Date().toISOString(),origin:ORIGIN,sitemaps:[],pages:[],errors:[]};
  const sitemapQueue = [`${ORIGIN}/sitemap.xml`];
  const pageQueue = new Set();
  try {
    const robots = await read(`${ORIGIN}/robots.txt`);
    report.robots = {status:robots.status,matchesSourcePolicy:matchesPublicRobotsPolicy(robots.html)};
    if (robots.status !== 200 || !report.robots.matchesSourcePolicy) {
      report.errors.push({url:`${ORIGIN}/robots.txt`,error:'public-robots-policy-drift'});
    }
    for (const url of sitemapQueue) {
      if (sitemapQueue.length > SITEMAP_LIMIT) throw new Error('Sitemap audit limit exceeded');
      const response = await read(url);
      if (response.status !== 200) throw new Error(`Sitemap ${url}: HTTP ${response.status}`);
      const sitemap = parseSitemap(response.html);
      report.sitemaps.push({url,count:sitemap.urls.length});
      for (const entry of sitemap.urls) {
        if (sitemap.kind === 'sitemapindex') { if (!sitemapQueue.includes(entry)) sitemapQueue.push(entry); }
        else pageQueue.add(entry);
      }
    }
    for (const path of ['/', '/examples', '/models', '/ai-video-engines']) {
      if (!pageQueue.has(ORIGIN + path)) throw new Error(`Missing primary sitemap route: ${path}`);
    }
    const pending = [...pageQueue];
    for (let offset = 0; offset < pending.length;) {
      checkDeadline();
      if (pending.length > PAGE_LIMIT) throw new Error('Public page audit limit exceeded');
      const batch = await Promise.all(pending.slice(offset,offset + 3).map(async url => {
        try { return inspectPublicPage({url,...await read(url)}); }
        catch (error) { return {url,errors:[String(error)]}; }
      }));
      for (const page of batch) {
        report.pages.push(page);
        report.errors.push(...page.errors.map(error => ({url:page.url,error})));
        // Follow only eligible native pagination and declared alternate documents.
        for (const target of [...(page.pagination || []),...Object.values(page.languages || {})]) {
          publicUrl(target);
          if (!pageQueue.has(target)) { pageQueue.add(target); pending.push(target); }
        }
      }
      if (offset % 60 === 0) console.log(`Public SEO: ${report.pages.length}/${pending.length}`);
      offset += batch.length;
    }
    report.errors.push(...checkHreflang(report.pages));
  } catch (error) { report.errors.push({error:String(error)}); }
  report.completedAt = new Date().toISOString();
  return report;
}

async function main() {
  const output = resolve('.reports/public-seo/report.json');
  const report = await auditPublicPages();
  await mkdir(dirname(output),{recursive:true});
  await writeFile(output,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({pages:report.pages.length,errors:report.errors.length,report:output}));
  for (const error of report.errors.slice(0,30)) console.error(JSON.stringify(error));
  if (report.errors.length) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error); process.exitCode = 1; });
}
