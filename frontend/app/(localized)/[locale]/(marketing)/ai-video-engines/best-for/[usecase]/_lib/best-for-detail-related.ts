import type { AppLocale } from '@/i18n/locales';
import { defaultLocale } from '@/i18n/locales';
import { canonicalizePublishedCompareSlug, isPublishedComparisonSlug } from '@/lib/compare-hub/data';
import { isComparisonIndexable } from '@/lib/compare-hub/indexation';
import { getContentEntries } from '@/lib/content/markdown';
import {
  BEST_FOR_PAGES,
  ENGINE_BY_SLUG,
  type BestForEntry,
  type EngineCatalogEntry,
  type RankedPick,
  type RelatedGuideEntry,
} from './best-for-detail-config';
import { getEntry } from './best-for-detail-content';

export function buildComparisonLabel(slug: string) {
  const [leftSlug, rightSlug] = slug.split('-vs-');
  const left = leftSlug ? ENGINE_BY_SLUG.get(leftSlug)?.marketingName ?? leftSlug : slug;
  const right = rightSlug ? ENGINE_BY_SLUG.get(rightSlug)?.marketingName ?? rightSlug : '';
  return right ? `${left} vs ${right}` : slug;
}

export function getPublishedRelatedComparisons(entry: BestForEntry, locale: AppLocale): string[] {
  return Array.from(
    new Set(
      (entry.relatedComparisons ?? [])
        .map((slug) => ({ slug, canonicalSlug: canonicalizePublishedCompareSlug(slug) }))
        .filter(
          ({ slug, canonicalSlug }) =>
            isPublishedComparisonSlug(slug) && isComparisonIndexable(locale, canonicalSlug)
        )
        .map(({ canonicalSlug }) => canonicalSlug)
    )
  );
}

export function pickComparisonSlug(
  picks: RankedPick[],
  relatedComparisons: string[],
  locale: AppLocale
): string | null {
  const explicit = relatedComparisons.find((slug) => {
    const canonicalSlug = canonicalizePublishedCompareSlug(slug);
    return isPublishedComparisonSlug(slug) && isComparisonIndexable(locale, canonicalSlug);
  });
  if (explicit) return canonicalizePublishedCompareSlug(explicit);
  for (let index = 0; index < picks.length; index += 1) {
    for (let nextIndex = index + 1; nextIndex < picks.length; nextIndex += 1) {
      const candidate = `${picks[index].slug}-vs-${picks[nextIndex].slug}`;
      const canonicalSlug = canonicalizePublishedCompareSlug(candidate);
      if (isPublishedComparisonSlug(candidate) && isComparisonIndexable(locale, canonicalSlug)) {
        return canonicalSlug;
      }
    }
  }
  return null;
}

export function findComparisonForPick(slug: string, relatedComparisons: string[]) {
  return relatedComparisons.find((comparison) => comparison.split('-vs-').includes(slug)) ?? null;
}

export async function resolveRelatedBestForGuides(locale: AppLocale, slug: string): Promise<RelatedGuideEntry[]> {
  const guides = getRelatedBestForGuides(slug);
  const localizedRoot = locale === defaultLocale ? 'content/en/best-for' : `content/${locale}/best-for`;
  const [localizedEntries, englishEntries] = await Promise.all([
    getContentEntries(localizedRoot),
    locale === defaultLocale ? Promise.resolve([]) : getContentEntries('content/en/best-for'),
  ]);
  const localizedBySlug = new Map(localizedEntries.map((entry) => [entry.slug, entry]));
  const englishBySlug = new Map(englishEntries.map((entry) => [entry.slug, entry]));

  return guides.map((guide) => {
    const content = localizedBySlug.get(guide.slug) ?? englishBySlug.get(guide.slug);
    return {
      ...guide,
      displayTitle: content?.title ?? guide.title,
    };
  });
}

export function getAlsoAvailableModels(slug: string, topPicks: string[]) {
  const preferred: Record<string, string[]> = {
    'cinematic-realism': ['ltx-2-3-fast', 'wan-2-6', 'pika-text-to-video', 'happy-horse-1-1'],
    'image-to-video': ['sora-2-pro', 'veo-3-1-fast', 'pika-text-to-video', 'happy-horse-1-1'],
    'character-reference': ['seedance-2-0', 'sora-2-pro', 'veo-3-1', 'happy-horse-1-1'],
    'reference-to-video': ['sora-2-pro', 'veo-3-1-fast', 'wan-2-6', 'happy-horse-1-1'],
    'multi-shot-video': ['ltx-2-3-pro', 'wan-2-6', 'pika-text-to-video', 'happy-horse-1-1'],
    '4k-video': ['ltx-2-3-pro', 'ltx-2-3-fast', 'kling-3-pro', 'sora-2-pro'],
    ads: ['veo-3-1-fast', 'sora-2-pro', 'pika-text-to-video', 'happy-horse-1-1'],
    'ugc-ads': ['ltx-2-3-pro', 'veo-3-1-fast', 'pika-text-to-video', 'happy-horse-1-1'],
    'product-videos': ['kling-3-4k', 'veo-3-1-fast', 'pika-text-to-video', 'happy-horse-1-1'],
    'lipsync-dialogue': ['ltx-2-3-pro', 'sora-2', 'pika-text-to-video', 'happy-horse-1-1'],
    'fast-drafts': ['pika-text-to-video', 'minimax-hailuo-02-text', 'wan-2-6'],
    'stylized-anime': ['seedance-2-0', 'wan-2-6', 'ltx-2-3-fast'],
  };
  return (preferred[slug] ?? [])
    .filter((modelSlug) => !topPicks.includes(modelSlug))
    .map((modelSlug) => ENGINE_BY_SLUG.get(modelSlug))
    .filter((engine): engine is EngineCatalogEntry => Boolean(engine))
    .slice(0, 3);
}

function getRelatedBestForGuides(slug: string) {
  const relatedBySlug: Record<string, string[]> = {
    'cinematic-realism': ['fast-drafts', 'multi-shot-video', 'product-videos', 'character-reference', '4k-video'],
    'image-to-video': ['reference-to-video', 'product-videos', 'character-reference', 'ads'],
    'character-reference': ['reference-to-video', 'ugc-ads', 'multi-shot-video', 'product-videos'],
    'reference-to-video': ['image-to-video', 'character-reference', 'product-videos', 'ads'],
    'multi-shot-video': ['cinematic-realism', 'character-reference', 'ads', 'fast-drafts'],
    '4k-video': ['cinematic-realism', 'product-videos', 'ads', 'fast-drafts'],
    ads: ['ugc-ads', 'product-videos', 'cinematic-realism', 'reference-to-video'],
    'ugc-ads': ['ads', 'lipsync-dialogue', 'character-reference', 'fast-drafts'],
    'product-videos': ['ads', 'image-to-video', 'reference-to-video', '4k-video'],
    'lipsync-dialogue': ['ugc-ads', 'character-reference', 'cinematic-realism', 'fast-drafts'],
    'fast-drafts': ['cinematic-realism', 'ads', 'multi-shot-video', '4k-video'],
    'stylized-anime': ['fast-drafts', 'image-to-video', 'multi-shot-video', 'character-reference'],
  };
  const targets = relatedBySlug[slug] ?? BEST_FOR_PAGES.filter((entry) => entry.slug !== slug).slice(0, 4).map((entry) => entry.slug);
  return targets.map((target) => getEntry(target)).filter((entry): entry is BestForEntry => Boolean(entry)).slice(0, 5);
}
