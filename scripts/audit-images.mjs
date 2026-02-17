#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const SITE_ORIGIN = process.env.AUDIT_SITE_ORIGIN || 'https://maxvideoai.com';
const START_SITEMAP = process.env.AUDIT_SITEMAP_URL || `${SITE_ORIGIN}/sitemap.xml`;
const OUTPUT_CSV = path.resolve(process.cwd(), process.env.AUDIT_OUTPUT_CSV || 'image-audit.csv');
const OUTPUT_SUMMARY = path.resolve(process.cwd(), process.env.AUDIT_OUTPUT_SUMMARY || 'image-audit-summary.md');
const EXCLUDE_METADATA_FROM_ISSUES = process.env.AUDIT_EXCLUDE_METADATA_ISSUES !== 'false';
const FORCE_AUDIT_ORIGIN = process.env.AUDIT_FORCE_ORIGIN !== 'false';

const ENGINE_ONLY_ALTS = new Set([
  'sora',
  'sora 2',
  'veo',
  'veo 3',
  'veo 3.1',
  'kling',
  'wan',
  'pika',
  'seedance',
  'ltx',
  'luma',
  'minimax',
  'hailuo',
  'runway',
  'nano banana',
]);

function decodeHtml(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    })
    .replace(/&#([0-9]+);/g, (_, dec) => {
      const code = Number.parseInt(dec, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    });
}

function stripTags(value) {
  return decodeHtml(value.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function extractAttr(tag, name) {
  const re = new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');
  const match = tag.match(re);
  if (!match) return null;
  return decodeHtml(match[1] ?? match[2] ?? match[3] ?? '').trim();
}

function toAbsoluteUrl(value, pageUrl) {
  if (!value) return null;
  try {
    return new URL(value, pageUrl).toString();
  } catch {
    return null;
  }
}

function toFilename(value) {
  if (!value) return '';
  try {
    const u = new URL(value);
    const parts = u.pathname.split('/').filter(Boolean);
    return parts[parts.length - 1] ?? '';
  } catch {
    const parts = value.split(/[?#]/)[0].split('/').filter(Boolean);
    return parts[parts.length - 1] ?? '';
  }
}

function localeFromUrl(pageUrl) {
  try {
    const u = new URL(pageUrl);
    if (u.pathname === '/fr' || u.pathname.startsWith('/fr/')) return 'fr';
    if (u.pathname === '/es' || u.pathname.startsWith('/es/')) return 'es';
  } catch {
    // ignore
  }
  return 'en';
}

function isScopedMarketingPath(pageUrl) {
  try {
    const u = new URL(pageUrl);
    const pathname = u.pathname.replace(/\/+$/, '') || '/';
    const noLocale = pathname.replace(/^\/(fr|es)(?=\/|$)/, '') || '/';
    if (pathname === '/' || pathname === '/fr' || pathname === '/es') return true;

    const prefixes = [
      '/models',
      '/examples',
      '/compare',
      '/ai-video-engines',
      '/pricing',
      '/workflows',
      '/blog',
      '/about',
      '/contact',
      '/changelog',
      '/status',
      '/docs',
    ];
    return prefixes.some((prefix) => noLocale === prefix || noLocale.startsWith(`${prefix}/`));
  } catch {
    return false;
  }
}

function normalizeToAuditOrigin(value) {
  if (!FORCE_AUDIT_ORIGIN) return value;
  try {
    const targetOrigin = new URL(SITE_ORIGIN).origin;
    const parsed = new URL(value, targetOrigin);
    return new URL(`${parsed.pathname}${parsed.search}${parsed.hash}`, targetOrigin).toString();
  } catch {
    return value;
  }
}

function isSiteAsset(imageUrl) {
  if (!imageUrl) return false;
  try {
    const u = new URL(imageUrl);
    const host = u.hostname === 'maxvideoai.com' || u.hostname.endsWith('.maxvideoai.com');
    if (!host) return false;
    return u.pathname.startsWith('/_next/static') || u.pathname.startsWith('/assets') || u.pathname.startsWith('/hero');
  } catch {
    return imageUrl.startsWith('/_next/static') || imageUrl.startsWith('/assets') || imageUrl.startsWith('/hero');
  }
}

function getContextHint(html, index) {
  const headingRe = /<(h1|h2)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let heading = '';
  let match;
  while ((match = headingRe.exec(html)) !== null) {
    if ((match.index ?? 0) > index) break;
    heading = stripTags(match[2] ?? '');
  }

  const around = html.slice(Math.max(0, index - 350), Math.min(html.length, index + 500));
  const cap = around.match(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i);
  const caption = cap ? stripTags(cap[1] ?? '') : '';
  if (heading && caption) return `${heading} | ${caption}`;
  return heading || caption || '';
}

function isGenericAlt(alt) {
  const normalized = alt.trim().toLowerCase();
  if (!normalized) return true;
  if (normalized.includes('undefined')) return true;
  if (['image', 'img', 'photo', 'picture', 'thumbnail', 'preview'].includes(normalized)) return true;
  return ENGINE_ONLY_ALTS.has(normalized);
}

function hasLogoOrIconHint(filename, alt) {
  const normalized = `${filename} ${alt}`.toLowerCase();
  return (
    normalized.includes('logo') ||
    normalized.includes('icon') ||
    normalized.includes('wordmark') ||
    normalized.includes('badge') ||
    normalized.includes('favicon')
  );
}

function canHaveAltIssue(record) {
  if (!EXCLUDE_METADATA_FROM_ISSUES) return true;
  return record.element_type !== 'og:image' && record.element_type !== 'jsonld-thumbnail';
}

function collectFlags(record) {
  const flags = [];
  if (!canHaveAltIssue(record)) return flags;

  const alt = (record.alt_text ?? '').trim();
  if (record.is_missing_alt) flags.push('missing');
  if (isGenericAlt(alt)) flags.push('generic');
  if (alt.toLowerCase().includes('undefined')) flags.push('contains-undefined');

  if (!hasLogoOrIconHint(record.filename, alt)) {
    if (alt.length > 0 && alt.length < 6) flags.push('too-short');
    if (alt.length > 140) flags.push('too-long');
  }
  return flags;
}

function markDuplicateFlags(records) {
  const freq = new Map();
  for (const record of records) {
    if (!canHaveAltIssue(record)) continue;
    if (record.is_missing_alt || record.is_empty_alt) continue;
    const normalized = (record.alt_text ?? '').trim().toLowerCase();
    if (!normalized) continue;
    freq.set(normalized, (freq.get(normalized) ?? 0) + 1);
  }
  for (const record of records) {
    if (!canHaveAltIssue(record)) continue;
    if (record.is_missing_alt || record.is_empty_alt) continue;
    const normalized = (record.alt_text ?? '').trim().toLowerCase();
    if (!normalized) continue;
    if ((freq.get(normalized) ?? 0) > 1 && !record.alt_quality_flags.includes('duplicated')) {
      record.alt_quality_flags.push('duplicated');
    }
  }
  return freq;
}

async function fetchText(url) {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; MaxVideoAIImageAudit/1.0)',
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return await res.text();
}

async function collectSitemapUrls(startUrl) {
  const seenXml = new Set();
  const xmlQueue = [startUrl];
  const pages = new Set();

  while (xmlQueue.length) {
    const current = xmlQueue.shift();
    if (!current || seenXml.has(current)) continue;
    seenXml.add(current);
    let xml = '';
    try {
      xml = await fetchText(current);
    } catch (error) {
      console.warn(`[audit] sitemap fetch failed: ${current} -> ${String(error)}`);
      continue;
    }
    const locs = [...xml.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)].map((m) => normalizeToAuditOrigin(decodeHtml((m[1] ?? '').trim())));
    for (const loc of locs) {
      if (!loc) continue;
      if (loc.includes('/sitemap') && loc.endsWith('.xml')) {
        if (!seenXml.has(loc)) xmlQueue.push(loc);
      } else {
        pages.add(loc);
      }
    }
  }

  return [...pages].filter((url) => isScopedMarketingPath(url)).sort();
}

function extractOgImages(html) {
  const out = [];
  const metaRe = /<meta\b[^>]*>/gi;
  let match;
  while ((match = metaRe.exec(html)) !== null) {
    const tag = match[0] ?? '';
    const prop = (extractAttr(tag, 'property') ?? extractAttr(tag, 'name') ?? '').toLowerCase();
    if (prop !== 'og:image') continue;
    const content = extractAttr(tag, 'content') ?? '';
    if (!content) continue;
    out.push({
      element_type: 'og:image',
      image_url: content,
      alt_text: '',
      is_empty_alt: false,
      is_missing_alt: false,
      source_index: match.index ?? 0,
    });
  }
  return out;
}

function extractJsonLdThumbnails(html) {
  const out = [];
  const scriptRe = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  const pushThumb = (value, index) => {
    if (!value || typeof value !== 'string') return;
    out.push({
      element_type: 'jsonld-thumbnail',
      image_url: value,
      alt_text: '',
      is_empty_alt: false,
      is_missing_alt: false,
      source_index: index,
    });
  };

  const walk = (value, index) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach((entry) => walk(entry, index));
      return;
    }
    if (typeof value === 'object') {
      if (typeof value.thumbnailUrl === 'string') pushThumb(value.thumbnailUrl, index);
      if (Array.isArray(value.thumbnailUrl)) value.thumbnailUrl.forEach((entry) => pushThumb(entry, index));
      Object.values(value).forEach((entry) => walk(entry, index));
    }
  };

  while ((match = scriptRe.exec(html)) !== null) {
    const raw = (match[1] ?? '').trim();
    if (!raw) continue;
    try {
      walk(JSON.parse(raw), match.index ?? 0);
    } catch {
      // ignore invalid JSON-LD blocks
    }
  }
  return out;
}

function extractImagesAndPosters(html) {
  const out = [];
  const imgRe = /<img\b[^>]*>/gi;
  let match;
  while ((match = imgRe.exec(html)) !== null) {
    const tag = match[0] ?? '';
    const src = extractAttr(tag, 'src') ?? extractAttr(tag, 'data-src') ?? '';
    const altAttr = extractAttr(tag, 'alt');
    const hasAlt = /\balt\s*=/.test(tag);
    const isNext = /\bdata-nimg\b/.test(tag);
    const isSvg = src.toLowerCase().split('?')[0].endsWith('.svg');
    out.push({
      element_type: isSvg ? 'svg' : isNext ? 'next-image' : 'img',
      image_url: src,
      alt_text: altAttr ?? '',
      is_empty_alt: hasAlt && (altAttr ?? '').trim() === '',
      is_missing_alt: !hasAlt,
      source_index: match.index ?? 0,
    });
  }

  const videoRe = /<video\b[^>]*>/gi;
  while ((match = videoRe.exec(html)) !== null) {
    const tag = match[0] ?? '';
    const poster = extractAttr(tag, 'poster') ?? '';
    if (!poster) continue;
    const ariaLabel = extractAttr(tag, 'aria-label') ?? '';
    const ariaHidden = (extractAttr(tag, 'aria-hidden') ?? '').toLowerCase() === 'true';
    out.push({
      element_type: 'video-poster',
      image_url: poster,
      alt_text: ariaLabel,
      is_empty_alt: !ariaHidden && ariaLabel.trim() === '',
      is_missing_alt: !ariaHidden && ariaLabel.trim() === '',
      source_index: match.index ?? 0,
    });
  }

  return out;
}

function csvEscape(value) {
  const raw = value == null ? '' : String(value);
  if (/[,\"\n]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
  return raw;
}

function isNonDescriptiveFilename(filename) {
  if (!filename) return true;
  const base = filename.toLowerCase().replace(/\.[a-z0-9]+$/i, '');
  if (/^(img|image|thumb|thumbnail|photo|sample|poster|logo|icon|file)([-_]?\d+)?$/.test(base)) return true;
  if (/^[a-f0-9]{8,}$/.test(base)) return true;
  if (/^\d{5,}$/.test(base)) return true;
  return base.length < 5;
}

async function run() {
  console.log(`[audit] collecting sitemap URLs from ${START_SITEMAP}`);
  const pages = await collectSitemapUrls(START_SITEMAP);
  console.log(`[audit] scoped pages: ${pages.length}`);

  const records = [];
  const failures = [];
  const concurrency = 8;
  let cursor = 0;

  async function worker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= pages.length) return;
      const pageUrl = pages[index];
      try {
        const html = await fetchText(pageUrl);
        const locale = localeFromUrl(pageUrl);
        const items = [...extractImagesAndPosters(html), ...extractOgImages(html), ...extractJsonLdThumbnails(html)];

        for (const item of items) {
          const absolute = toAbsoluteUrl(item.image_url, pageUrl) ?? item.image_url;
          const record = {
            page_url: pageUrl,
            locale,
            element_type: item.element_type,
            image_url: absolute,
            filename: toFilename(absolute),
            alt_text: item.alt_text ?? '',
            is_empty_alt: Boolean(item.is_empty_alt),
            is_missing_alt: Boolean(item.is_missing_alt),
            alt_quality_flags: [],
            context_hint: getContextHint(html, item.source_index ?? 0),
            is_site_asset: isSiteAsset(absolute),
          };
          record.alt_quality_flags = collectFlags(record);
          records.push(record);
        }
      } catch (error) {
        failures.push(`${pageUrl} -> ${String(error)}`);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  const duplicateFreq = markDuplicateFlags(records);
  const headers = [
    'page_url',
    'locale',
    'element_type',
    'image_url',
    'filename',
    'alt_text',
    'is_empty_alt',
    'is_missing_alt',
    'alt_quality_flags',
    'context_hint',
    'is_site_asset',
  ];

  const csvLines = [headers.join(',')];
  for (const r of records) {
    csvLines.push(
      [
        r.page_url,
        r.locale,
        r.element_type,
        r.image_url,
        r.filename,
        r.alt_text,
        r.is_empty_alt ? 'true' : 'false',
        r.is_missing_alt ? 'true' : 'false',
        r.alt_quality_flags.join('|'),
        r.context_hint,
        r.is_site_asset ? 'true' : 'false',
      ]
        .map(csvEscape)
        .join(',')
    );
  }
  fs.writeFileSync(OUTPUT_CSV, `${csvLines.join('\n')}\n`, 'utf8');

  const issueCounts = new Map();
  const pageIssueCounts = new Map();
  const duplicated = [];
  const fileCounts = new Map();

  for (const [alt, count] of duplicateFreq.entries()) {
    if (count > 1) duplicated.push({ alt, count });
  }

  for (const r of records) {
    if (r.alt_quality_flags.length) {
      pageIssueCounts.set(r.page_url, (pageIssueCounts.get(r.page_url) ?? 0) + r.alt_quality_flags.length);
    }
    for (const flag of r.alt_quality_flags) {
      issueCounts.set(flag, (issueCounts.get(flag) ?? 0) + 1);
    }
    if (r.is_site_asset && isNonDescriptiveFilename(r.filename)) {
      const key = `${r.filename}||${r.image_url}`;
      fileCounts.set(key, (fileCounts.get(key) ?? 0) + 1);
    }
  }

  const topPages = [...pageIssueCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
  const topDupes = duplicated.sort((a, b) => b.count - a.count).slice(0, 20);
  const topFiles = [...fileCounts.entries()]
    .map(([key, count]) => {
      const [filename, imageUrl] = key.split('||');
      return { filename, imageUrl, count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  const lines = [];
  lines.push('# Image Audit Summary');
  lines.push('');
  lines.push(`- Site audited: ${SITE_ORIGIN}`);
  lines.push(`- Scoped pages crawled: ${pages.length}`);
  lines.push(`- Rows captured: ${records.length}`);
  lines.push(`- Fetch failures: ${failures.length}`);
  lines.push(`- Metadata rows excluded from issue scoring: ${EXCLUDE_METADATA_FROM_ISSUES ? 'yes' : 'no'}`);
  lines.push('');

  lines.push('## Counts By Issue Type');
  lines.push('');
  if (!issueCounts.size) {
    lines.push('- No alt quality issues found by current heuristics.');
  } else {
    for (const [flag, count] of [...issueCounts.entries()].sort((a, b) => b[1] - a[1])) {
      lines.push(`- ${flag}: ${count}`);
    }
  }
  lines.push('');

  lines.push('## Top 20 Pages With Most Issues');
  lines.push('');
  if (!topPages.length) {
    lines.push('- None');
  } else {
    topPages.forEach(([pageUrl, count]) => lines.push(`- ${count} issues: ${pageUrl}`));
  }
  lines.push('');

  lines.push('## Top Duplicated Alt Strings');
  lines.push('');
  if (!topDupes.length) {
    lines.push('- None');
  } else {
    topDupes.forEach((entry) => lines.push(`- ${entry.count}x: ${entry.alt}`));
  }
  lines.push('');

  lines.push('## Top Site Assets With Non-Descriptive Filenames');
  lines.push('');
  if (!topFiles.length) {
    lines.push('- None');
  } else {
    topFiles.forEach((entry) => lines.push(`- ${entry.count}x: ${entry.filename} (${entry.imageUrl})`));
  }
  lines.push('');

  if (failures.length) {
    lines.push('## Fetch Failures');
    lines.push('');
    failures.slice(0, 50).forEach((value) => lines.push(`- ${value}`));
    if (failures.length > 50) lines.push(`- ...and ${failures.length - 50} more`);
    lines.push('');
  }

  fs.writeFileSync(OUTPUT_SUMMARY, `${lines.join('\n')}\n`, 'utf8');
  console.log(`[audit] wrote ${OUTPUT_CSV}`);
  console.log(`[audit] wrote ${OUTPUT_SUMMARY}`);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
