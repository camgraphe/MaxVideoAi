import { listExamples } from '@/server/videos';

const CANONICAL_BASE_URL = 'https://maxvideoai.com';

const XML_HEADER =
  '<?xml version="1.0" encoding="UTF-8"?>';
const URLSET_OPEN =
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">';
const URLSET_CLOSE = '</urlset>';

export const revalidate = 60 * 60; // 1 hour

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toAbsoluteUrl(value?: string): string | null {
  if (!value) return null;
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  if (value.startsWith('//')) return `https:${value}`;
  if (value.startsWith('/')) return `${CANONICAL_BASE_URL}${value}`;
  return `${CANONICAL_BASE_URL}/${value}`;
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
}

export async function GET(): Promise<Response> {
  try {
    const videos = await listExamples('date-desc', 200);
    const eligible = videos.filter(
      (video) =>
        video.visibility === 'public' &&
        video.indexable &&
        Boolean(video.videoUrl) &&
        Boolean(video.thumbUrl)
    );

    const body = eligible
      .map((video) => {
        const pageUrl = `${CANONICAL_BASE_URL}/v/${encodeURIComponent(video.id)}`;
        const contentUrl = toAbsoluteUrl(video.videoUrl);
        const thumbnailUrl = toAbsoluteUrl(video.thumbUrl);
        if (!contentUrl || !thumbnailUrl) {
          return null;
        }
        const title = truncate(video.engineLabel || 'MaxVideoAI Render', 97);
        const description = truncate(video.promptExcerpt || 'AI-generated video created with MaxVideoAI.', 197);
        const publicationDate = new Date(video.createdAt).toISOString();
        const duration = Number.isFinite(video.durationSec) ? Math.max(0, Math.round(video.durationSec)) : null;

        const fragments = [
          '  <url>',
          `    <loc>${escapeXml(pageUrl)}</loc>`,
          '    <video:video>',
          `      <video:thumbnail_loc>${escapeXml(thumbnailUrl)}</video:thumbnail_loc>`,
          `      <video:title>${escapeXml(title)}</video:title>`,
          `      <video:description>${escapeXml(description)}</video:description>`,
          `      <video:content_loc>${escapeXml(contentUrl)}</video:content_loc>`,
          duration ? `      <video:duration>${duration}</video:duration>` : null,
          `      <video:publication_date>${escapeXml(publicationDate)}</video:publication_date>`,
          `      <video:family_friendly>yes</video:family_friendly>`,
          `      <video:live>no</video:live>`,
          `      <video:requires_subscription>no</video:requires_subscription>`,
          video.engineLabel ? `      <video:tag>${escapeXml(video.engineLabel)}</video:tag>` : null,
          '    </video:video>',
          '  </url>',
        ].filter(Boolean);
        return fragments.join('\n');
      })
      .filter((entry): entry is string => Boolean(entry))
      .join('\n');

    const xml = [XML_HEADER, URLSET_OPEN, body, URLSET_CLOSE].join('\n');
    return new Response(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
      },
    });
  } catch (error) {
    console.error('[sitemap-video] failed to generate', error);
    const xml = [XML_HEADER, URLSET_OPEN, URLSET_CLOSE].join('\n');
    return new Response(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
      },
    });
  }
}
