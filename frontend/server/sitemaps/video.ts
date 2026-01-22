import { NextResponse } from 'next/server';
import { isDatabaseConfigured } from '@/lib/db';
import { ensureBillingSchema } from '@/lib/schema';
import { listExamples } from '@/server/videos';
import { resolveExampleCanonicalSlug } from '@/lib/examples-links';

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://maxvideoai.com').replace(/\/$/, '');

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatSitemapDate(value?: string | number | Date | null): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

function buildExamplesLoc(engineId: string | null | undefined): string | null {
  const canonicalSlug = resolveExampleCanonicalSlug(engineId);
  if (!canonicalSlug) return null;
  return `${SITE}/examples/${canonicalSlug}`;
}

export async function generateVideoSitemapResponse(): Promise<NextResponse> {
  if (!isDatabaseConfigured()) {
    return new NextResponse('Database unavailable', { status: 503 });
  }

  try {
    await ensureBillingSchema();
    const videos = await listExamples('playlist', 5000);

    const grouped = new Map<string, typeof videos>();
    videos.forEach((video) => {
      if (!video.videoUrl) return;
      const loc = buildExamplesLoc(video.engineId);
      if (!loc) return;
      const entry = grouped.get(loc);
      if (entry) {
        entry.push(video);
      } else {
        grouped.set(loc, [video]);
      }
    });

    const urls = Array.from(grouped.entries())
      .map(([loc, entries]) => {
        const escapedLoc = escapeXml(loc);
        const lastModified = formatSitemapDate(
          entries.reduce((latest, video) => {
            const latestTime = latest ? Date.parse(latest) : 0;
            const nextTime = Date.parse(video.createdAt);
            return nextTime > latestTime ? video.createdAt : latest;
          }, '')
        );

        const parts = ['<url>', `<loc>${escapedLoc}</loc>`];
        if (lastModified) {
          parts.push(`<lastmod>${escapeXml(lastModified)}</lastmod>`);
        }

        const videosXml = entries
          .map((video) => {
            const summary = video.prompt.replace(/\s+/g, ' ').trim();
            const description = summary.length > 280 ? `${summary.slice(0, 279)}…` : summary;
            const duration = Math.max(0, Math.floor(video.durationSec ?? 0));
            const publicationDate = new Date(video.createdAt).toISOString();
            const thumbUrl = video.thumbUrl ?? video.videoUrl ?? loc;
            const keywords = [video.engineLabel, video.aspectRatio ?? 'auto', 'MaxVideoAI']
              .map((keyword) => `<video:tag>${escapeXml(keyword)}</video:tag>`)
              .join('');

            return [
              '<video:video>',
              `<video:thumbnail_loc>${escapeXml(thumbUrl)}</video:thumbnail_loc>`,
              `<video:title>${escapeXml(`${video.engineLabel} · ${duration}s`)}</video:title>`,
              `<video:description>${escapeXml(description)}</video:description>`,
              `<video:content_loc>${escapeXml(video.videoUrl ?? loc)}</video:content_loc>`,
              `<video:publication_date>${escapeXml(publicationDate)}</video:publication_date>`,
              `<video:duration>${duration}</video:duration>`,
              keywords,
              '</video:video>',
            ].join('');
          })
          .join('');

        parts.push(videosXml, '</url>');
        return parts.join('');
      })
      .join('');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n${urls}\n</urlset>`;

    return new NextResponse(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=UTF-8',
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    console.error('[sitemap-video] failed', error);
    return new NextResponse('Server error', { status: 500 });
  }
}
