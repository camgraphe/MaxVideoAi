import { escapeXml } from '@/lib/sitemap/xml';
import type { EligibleSeoWatchVideoRow } from '@/server/video-seo';
import { getVideoWatchSitemapEntries } from './video-watch-entries';

export function buildVideoSitemapXml(watchVideos: EligibleSeoWatchVideoRow[]): string {
  const urls = getVideoWatchSitemapEntries(watchVideos)
    .map(({ entry, video, signals, loc, lastModified, publicationDate }) => {
      const escapedLoc = escapeXml(loc);

      const parts = ['<url>', `<loc>${escapedLoc}</loc>`];
      if (lastModified) {
        parts.push(`<lastmod>${escapeXml(lastModified)}</lastmod>`);
      }

      const description = signals.metaDescription.replace(/\s+/g, ' ').trim();
      const duration = Math.max(0, Math.floor(signals.durationSec ?? video.durationSec ?? 0));
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

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n${urls}\n</urlset>`;
}

export function buildVideoPagesSitemapXml(watchVideos: EligibleSeoWatchVideoRow[]): string {
  const urls = getVideoWatchSitemapEntries(watchVideos)
    .map(({ loc, lastModified }) => {
      const parts = ['  <url>', `    <loc>${escapeXml(loc)}</loc>`];
      if (lastModified) {
        parts.push(`    <lastmod>${escapeXml(lastModified)}</lastmod>`);
      }
      parts.push('  </url>');
      return parts.join('\n');
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
}
