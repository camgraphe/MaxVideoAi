import { NextResponse } from 'next/server';
import { isDatabaseConfigured } from '@/lib/db';
import { listEligibleSeoWatchVideos } from '@/server/video-seo';
import { resolveVideoSitemapDates } from './video-dates';

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://maxvideoai.com').replace(/\/$/, '');

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function generateVideoSitemapResponse(): Promise<NextResponse> {
  if (!isDatabaseConfigured()) {
    return new NextResponse('Database unavailable', { status: 503 });
  }

  try {
    const watchVideos = await listEligibleSeoWatchVideos();

    const urls = watchVideos
      .map(({ entry, video, signals }) => {
        const loc = signals.canonicalUrl || `${SITE}/video/${encodeURIComponent(entry.id)}`;
        const escapedLoc = escapeXml(loc);
        const dates = resolveVideoSitemapDates(entry, video);

        const parts = ['<url>', `<loc>${escapedLoc}</loc>`];
        if (dates.lastModified) {
          parts.push(`<lastmod>${escapeXml(dates.lastModified)}</lastmod>`);
        }

        const description = signals.metaDescription.replace(/\s+/g, ' ').trim();
        const duration = Math.max(0, Math.floor(signals.durationSec ?? video.durationSec ?? 0));
        const publicationDate = dates.publicationDate;
        if (!publicationDate) {
          return null;
        }
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
            `<video:title>${escapeXml(signals.videoObjectName)}</video:title>`,
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
      .filter((value): value is string => Boolean(value))
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
