import { NextResponse } from 'next/server';
import { isDatabaseConfigured } from '@/lib/db';
import { listEligibleSeoWatchVideos } from '@/server/video-seo';

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

function buildVideoLoc(id: string): string {
  return `${SITE}/video/${encodeURIComponent(id)}`;
}

export async function generateVideoSitemapResponse(): Promise<NextResponse> {
  if (!isDatabaseConfigured()) {
    return new NextResponse('Database unavailable', { status: 503 });
  }

  try {
    const watchVideos = await listEligibleSeoWatchVideos();

    const urls = watchVideos
      .map(({ entry, video, signals }) => {
        const loc = buildVideoLoc(entry.id);
        const escapedLoc = escapeXml(loc);
        const lastModified = formatSitemapDate(entry.publishedAt || video.createdAt);

        const parts = ['<url>', `<loc>${escapedLoc}</loc>`];
        if (lastModified) {
          parts.push(`<lastmod>${escapeXml(lastModified)}</lastmod>`);
        }

        const description = signals.metaDescription.replace(/\s+/g, ' ').trim();
        const duration = Math.max(0, Math.floor(signals.durationSec ?? video.durationSec ?? 0));
        const publicationDate = new Date(entry.publishedAt || video.createdAt).toISOString();
        const contentUrl = video.videoUrl ?? loc;
        const thumbUrl = video.thumbUrl ?? video.videoUrl ?? loc;
        const keywords = [
          signals.engineLabel,
          signals.exampleFamilyLabel ?? entry.engineFamily,
          ...(signals.capabilityTags ?? []),
          ...(signals.styleTags ?? []),
          signals.aspectRatio ?? video.aspectRatio ?? 'auto',
          'MaxVideoAI',
        ]
          .filter((keyword): keyword is string => Boolean(keyword && keyword.trim().length))
          .map((keyword) => `<video:tag>${escapeXml(keyword)}</video:tag>`)
          .join('');

        parts.push(
          [
            '<video:video>',
            `<video:thumbnail_loc>${escapeXml(thumbUrl)}</video:thumbnail_loc>`,
            `<video:title>${escapeXml(signals.title)}</video:title>`,
            `<video:description>${escapeXml(description)}</video:description>`,
            `<video:content_loc>${escapeXml(contentUrl)}</video:content_loc>`,
            `<video:publication_date>${escapeXml(publicationDate)}</video:publication_date>`,
            `<video:duration>${duration}</video:duration>`,
            keywords,
            '</video:video>',
          ].join(''),
          '</url>'
        );
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
