import { listExamples } from '@/server/videos';
import { listFalEngines, type FalEngineEntry } from '@/config/falEngines';
import { getExampleDemos } from '@/server/engine-demos';
import type { EngineDemo } from '@/server/engine-demos';

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

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function resolveDuration(entry: FalEngineEntry): number | null {
  if (typeof entry.engine?.maxDurationSec === 'number' && entry.engine.maxDurationSec > 0) {
    return Math.round(entry.engine.maxDurationSec);
  }

  for (const mode of entry.modes ?? []) {
    const caps = mode.ui?.duration;
    if (!caps) continue;
    if ('options' in caps && Array.isArray(caps.options) && caps.options.length) {
      const numericValues = caps.options
        .map((option) => (typeof option === 'string' ? Number(option) : option))
        .filter((option) => Number.isFinite(option));
      if (numericValues.length) {
        return Math.max(...numericValues);
      }
      if (caps.default !== undefined) {
        const defaultValue = typeof caps.default === 'string' ? Number(caps.default) : caps.default;
        if (Number.isFinite(defaultValue)) {
          return defaultValue;
        }
      }
    }

    if ('default' in caps) {
      const fallback = typeof caps.default === 'string' ? Number(caps.default) : caps.default;
      if (Number.isFinite(fallback)) {
        return Math.round(fallback as number);
      }
    }
    if ('min' in caps) {
      const minimum = typeof caps.min === 'string' ? Number(caps.min) : caps.min;
      if (Number.isFinite(minimum)) {
        return Math.round(minimum as number);
      }
    }
  }

  return null;
}

function buildEngineEntry(engine: FalEngineEntry, demos: Map<string, EngineDemo>): string | null {
  const slug = engine.modelSlug;
  if (!slug) return null;

  const demo = demos.get(engine.id);
  const videoUrl = toAbsoluteUrl(demo?.videoUrl ?? engine.media?.videoUrl ?? engine.demoUrl ?? undefined);
  const thumbnailUrl = toAbsoluteUrl(demo?.posterUrl ?? engine.media?.imagePath ?? undefined);
  if (!videoUrl || !thumbnailUrl) {
    return null;
  }

  const loc = `${CANONICAL_BASE_URL}/models/${slug}`;
  const rawTitle = engine.cardTitle ?? engine.marketingName ?? engine.engine?.label ?? 'MaxVideoAI Demo';
  const rawDescription =
    engine.seoText ??
    engine.seo?.description ??
    `Demo video generated with ${rawTitle} on MaxVideoAI.`;
  const publicationCandidate = engine.engine?.updatedAt ? new Date(engine.engine.updatedAt) : new Date();
  const publicationDate = Number.isFinite(publicationCandidate.getTime())
    ? publicationCandidate.toISOString()
    : new Date().toISOString();
  const duration = resolveDuration(engine);
  const title = truncate(normalizeWhitespace(`${rawTitle} Demo`), 97);
  const description = truncate(normalizeWhitespace(rawDescription), 197);
  const tag = engine.engine?.label ?? engine.marketingName ?? null;

  const fragments = [
    '  <url>',
    `    <loc>${escapeXml(loc)}</loc>`,
    `    <lastmod>${escapeXml(publicationDate)}</lastmod>`,
    '    <video:video>',
    `      <video:thumbnail_loc>${escapeXml(thumbnailUrl)}</video:thumbnail_loc>`,
    `      <video:title>${escapeXml(title)}</video:title>`,
    `      <video:description>${escapeXml(description)}</video:description>`,
    `      <video:content_loc>${escapeXml(videoUrl)}</video:content_loc>`,
    duration ? `      <video:duration>${duration}</video:duration>` : null,
    `      <video:publication_date>${escapeXml(publicationDate)}</video:publication_date>`,
    `      <video:family_friendly>yes</video:family_friendly>`,
    `      <video:requires_subscription>no</video:requires_subscription>`,
    `      <video:live>no</video:live>`,
    tag ? `      <video:tag>${escapeXml(tag)}</video:tag>` : null,
    '    </video:video>',
    '  </url>',
  ].filter(Boolean);

  return fragments.join('\n');
}

export async function GET(): Promise<Response> {
  try {
    const [videos, demos] = await Promise.all([listExamples('date-desc', 200), getExampleDemos()]);
    const engineEntries = listFalEngines()
      .map((engine) => buildEngineEntry(engine, demos))
      .filter((entry): entry is string => Boolean(entry));

    const eligible = videos.filter(
      (video) =>
        video.visibility === 'public' &&
        video.indexable &&
        Boolean(video.videoUrl) &&
        Boolean(video.thumbUrl)
    );

    const body = eligible
      .map((video) => {
        const pageUrl = `${CANONICAL_BASE_URL}/video/${encodeURIComponent(video.id)}`;
        const contentUrl = toAbsoluteUrl(video.videoUrl);
        const thumbnailUrl = toAbsoluteUrl(video.thumbUrl);
        if (!contentUrl || !thumbnailUrl) {
          return null;
        }
        const title = truncate(normalizeWhitespace(video.engineLabel || 'MaxVideoAI Render'), 97);
        const description = truncate(
          normalizeWhitespace(video.promptExcerpt || 'AI-generated video created with MaxVideoAI.'),
          197
        );
        const publicationDate = new Date(video.createdAt).toISOString();
        const duration = Number.isFinite(video.durationSec) ? Math.max(0, Math.round(video.durationSec)) : null;

        const fragments = [
          '  <url>',
          `    <loc>${escapeXml(pageUrl)}</loc>`,
          `    <lastmod>${escapeXml(publicationDate)}</lastmod>`,
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

    const xmlFragments = [XML_HEADER, URLSET_OPEN, ...engineEntries, body, URLSET_CLOSE].filter(Boolean);
    const xml = xmlFragments.join('\n');
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
