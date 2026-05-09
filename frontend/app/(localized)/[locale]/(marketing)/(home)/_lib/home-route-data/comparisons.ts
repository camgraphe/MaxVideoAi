import type { ComparisonCard, HomeExampleCard } from '@/components/marketing/home/HomeRedesignSections';
import { isPublishedComparisonSlug } from '@/lib/compare-hub/data';
import { resolveExampleCanonicalSlug } from '@/lib/examples-links';
import { listExampleFamilyPage, type GalleryVideo } from '@/server/videos';
import { ENGINE_BY_MODEL_SLUG } from './constants';
import {
  HOMEPAGE_EXAMPLE_FAMILIES,
  type ComparisonConfig,
  type ComparisonMediaItem,
  type HomepageExampleFamily,
  type RedesignContent,
} from './types';

function splitComparisonSlug(slug: string): [string, string] | null {
  const [left, right] = slug.split('-vs-');
  if (!left || !right) return null;
  return [left, right];
}

function resolveComparisonEngineLabel(slug: string): string {
  return ENGINE_BY_MODEL_SLUG.get(slug)?.marketingName ?? slug.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function compactComparisonLabel(label: string): string {
  return label
    .replace(/^Google\s+/i, '')
    .replace(/^LTX Video 2\.0 Pro$/i, 'LTX 2')
    .replace(/\s+Text to Video$/i, '')
    .trim();
}

async function loadComparisonExamplePools(
  cards: ComparisonConfig[],
  usedImageSrcs: Set<string>
): Promise<Map<HomepageExampleFamily, GalleryVideo[]>> {
  const families = new Set<HomepageExampleFamily>();

  cards.forEach((card) => {
    const pair = splitComparisonSlug(card.slug);
    if (!pair) return;
    pair.forEach((engineSlug) => {
      const family = resolveExampleCanonicalSlug(engineSlug);
      if (family && HOMEPAGE_EXAMPLE_FAMILIES.includes(family as HomepageExampleFamily)) {
        families.add(family as HomepageExampleFamily);
      }
    });
  });

  const entries = await Promise.all(
    Array.from(families).map(async (family) => {
      const result = await listExampleFamilyPage(family, { sort: 'playlist', limit: 14, offset: 0 }).catch((error) => {
        console.warn(`[home] failed to load comparison thumbnails for "${family}"`, error);
        return { items: [] as GalleryVideo[] };
      });
      const videos = result.items.filter((video) => video.thumbUrl && !usedImageSrcs.has(video.thumbUrl));
      return [family, videos] as const;
    })
  );

  return new Map(entries);
}

function takeComparisonMediaFromFamily(
  pool: GalleryVideo[],
  usedImageSrcs: Set<string>,
  label: string,
  title: string
): ComparisonMediaItem | null {
  const video = pool.find((candidate) => candidate.thumbUrl && !usedImageSrcs.has(candidate.thumbUrl));
  if (!video?.thumbUrl) return null;
  usedImageSrcs.add(video.thumbUrl);
  return {
    imageSrc: video.thumbUrl,
    imageAlt: `${label} example thumbnail used in the ${title} comparison card.`,
    label: compactComparisonLabel(label),
  };
}

export async function buildComparisonCardsWithExampleMedia(
  content: RedesignContent,
  homepageExamples: HomeExampleCard[]
): Promise<ComparisonCard[]> {
  const publishedCards = content.comparisons.cards.filter((card) => isPublishedComparisonSlug(card.slug));
  const usedImageSrcs = new Set(
    homepageExamples
      .map((example) => example.imageSrc)
      .filter((imageSrc): imageSrc is string => Boolean(imageSrc) && !imageSrc.startsWith('/assets/placeholders/'))
  );
  const pools = await loadComparisonExamplePools(publishedCards, usedImageSrcs);

  return content.comparisons.cards
    .filter((card) => isPublishedComparisonSlug(card.slug))
    .map((card) => {
      const pair = splitComparisonSlug(card.slug);
      const media = pair?.flatMap((engineSlug) => {
        const family = resolveExampleCanonicalSlug(engineSlug) as HomepageExampleFamily | null;
        if (!family || !HOMEPAGE_EXAMPLE_FAMILIES.includes(family)) return [];
        const label = resolveComparisonEngineLabel(engineSlug);
        const item = takeComparisonMediaFromFamily(pools.get(family) ?? [], usedImageSrcs, label, card.title);
        return item ? [item] : [];
      });

      return {
        id: card.id,
        title: card.title,
        body: card.body,
        badges: card.badges,
        cta: content.comparisons.cta,
        href: { pathname: '/ai-video-engines/[slug]', params: { slug: card.slug } },
        imageSrc: card.imageSrc,
        imageAlt: card.imageAlt,
        media: media && media.length >= 2 ? media : undefined,
      };
    });
}
