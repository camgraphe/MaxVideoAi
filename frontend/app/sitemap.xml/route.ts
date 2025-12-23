import { NextResponse } from 'next/server';
import { buildSitemapIndexXml } from '@/lib/sitemapData';
import { listExamples } from '@/server/videos';

export const runtime = 'nodejs';
export const revalidate = 3600;

const VIDEO_SITEMAP_SUFFIX = '/sitemap-video.xml';

function formatLastModified(value?: string | number | Date | null): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function upsertVideoLastMod(xml: string, lastMod: string): string {
  const locRegex = new RegExp(`<loc>[^<]*${escapeRegex(VIDEO_SITEMAP_SUFFIX)}<\\/loc>`);
  const locMatch = xml.match(locRegex);
  if (!locMatch) {
    return xml;
  }
  const entryRegex = new RegExp(`${escapeRegex(locMatch[0])}[\\s\\S]*?<\\/sitemap>`);
  const entryMatch = xml.match(entryRegex);
  if (!entryMatch) {
    return xml;
  }

  const entry = entryMatch[0];
  let updated = entry;
  if (/<lastmod>/.test(entry)) {
    updated = entry.replace(/<lastmod>[^<]*<\\/lastmod>/, `<lastmod>${lastMod}</lastmod>`);
  } else {
    updated = entry.replace(
      /<\\/sitemap>/,
      `    <lastmod>${lastMod}</lastmod>\n  </sitemap>`
    );
  }

  return xml.replace(entry, updated);
}

export async function GET() {
  try {
    let xml = await buildSitemapIndexXml();
    try {
      const [latest] = await listExamples('date-desc', 1);
      const lastMod = formatLastModified(latest?.createdAt ?? null);
      if (lastMod) {
        xml = upsertVideoLastMod(xml, lastMod);
      }
    } catch (error) {
      console.warn('[sitemap-index] video lastmod fallback to static value', error);
    }
    const sitemapCount = (xml.match(/<sitemap>/g) ?? []).length;
    if (sitemapCount < 3) {
      return new NextResponse('Sitemap index returned too few sitemaps.', {
        status: 503,
        headers: {
          'Content-Type': 'text/plain; charset=UTF-8',
          'Cache-Control': 'no-store',
          'X-Sitemap-Index-Count': String(sitemapCount),
        },
      });
    }
    return new NextResponse(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=UTF-8',
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        'X-Sitemap-Index-Count': String(sitemapCount),
      },
    });
  } catch (error) {
    console.error('[sitemap-index] generation failed', error);
    return new NextResponse('Sitemap index generation failed.', {
      status: 503,
      headers: {
        'Content-Type': 'text/plain; charset=UTF-8',
        'Cache-Control': 'no-store',
      },
    });
  }
}
