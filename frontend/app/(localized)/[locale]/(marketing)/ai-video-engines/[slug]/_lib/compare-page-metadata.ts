import type { Metadata } from 'next';
import { isPublishedComparisonSlug } from '@/lib/compare-hub/data';
import {
  getIndexableComparisonLocales,
  isComparisonIndexable,
} from '@/lib/compare-hub/indexation';
import { resolveDictionary } from '@/lib/i18n/server';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import type { ComparePageCopy } from './compare-page-copy';
import { buildSpecValues } from './compare-page-helpers';
import {
  formatEngineMetaName,
  formatEngineName,
  formatTemplate,
  getCanonicalCompareSlug,
  isPending,
  loadEngineKeySpecs,
  replaceCriteriaCount,
  resolveEngines,
} from './compare-page-helpers';
import { getComparePageOverride } from './compare-page-overrides';
import type { Params } from './compare-page-types';

export async function buildComparePageMetadata(props: {
  params: Promise<Params>;
  searchParams?: Promise<{ order?: string }>;
}): Promise<Metadata> {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const locale = params.locale ?? 'en';
  const { dictionary } = await resolveDictionary({ locale });
  const compareCopy = (dictionary.comparePage ?? {}) as ComparePageCopy;
  const slug = params.slug;
  const canonicalInfo = getCanonicalCompareSlug(slug);
  const canonicalSlug = canonicalInfo?.canonicalSlug ?? slug;
  const pageOverride = getComparePageOverride(locale, canonicalSlug);
  const metaOverride = {
    ...(compareCopy.meta?.slugOverrides?.[canonicalSlug] ?? {}),
    ...(pageOverride?.meta ?? {}),
  };
  const resolved = canonicalInfo ? resolveEngines(canonicalInfo.canonicalSlug) : null;
  const pairHasNativeAudio = Boolean(resolved?.left.engine?.audio) || Boolean(resolved?.right.engine?.audio);
  const criteriaCount = pairHasNativeAudio ? 11 : 10;
  const titleTemplate =
    metaOverride.title ?? compareCopy.meta?.title ?? '{left} vs {right} — Side-by-Side Specs, Pricing & Prompt Test | MaxVideoAI';
  const titleFallback =
    compareCopy.meta?.titleFallback ??
    'Compare AI video engines — Side-by-Side Specs, Pricing & Prompt Test | MaxVideoAI';
  const descriptionTemplate = replaceCriteriaCount(
    metaOverride.description ??
      compareCopy.meta?.description ??
      `Compare {left} vs {right} on MaxVideoAI with identical prompts, key specs, and a scorecard across ${criteriaCount} criteria.`,
    criteriaCount
  );
  const descriptionFallback =
    compareCopy.meta?.descriptionFallback ?? 'Side-by-side comparison of AI video engines with MaxVideoAI metrics and guidance.';
  const title = resolved
    ? formatTemplate(titleTemplate, {
        left: formatEngineMetaName(resolved.left),
        right: formatEngineMetaName(resolved.right),
      })
    : titleFallback;
  const description = resolved
    ? formatTemplate(descriptionTemplate, {
        left: formatEngineName(resolved.left),
        right: formatEngineName(resolved.right),
      })
    : descriptionFallback;

  let robots: Metadata['robots'] | undefined;
  if (!isPublishedComparisonSlug(canonicalSlug)) {
    robots = { index: false, follow: true };
  }
  if (!isComparisonIndexable(locale, canonicalSlug)) {
    robots = { index: false, follow: true };
  }
  if (resolved) {
    const keySpecs = await loadEngineKeySpecs();
    const leftKeySpecs = keySpecs.get(resolved.left.modelSlug)?.keySpecs ?? undefined;
    const rightKeySpecs = keySpecs.get(resolved.right.modelSlug)?.keySpecs ?? undefined;
    const leftSpecs = buildSpecValues(resolved.left, leftKeySpecs);
    const rightSpecs = buildSpecValues(resolved.right, rightKeySpecs);
    const rows = [
      leftSpecs.textToVideo,
      rightSpecs.textToVideo,
      leftSpecs.imageToVideo,
      rightSpecs.imageToVideo,
      leftSpecs.videoToVideo,
      rightSpecs.videoToVideo,
      leftSpecs.firstLastFrame,
      rightSpecs.firstLastFrame,
      leftSpecs.referenceImageStyle,
      rightSpecs.referenceImageStyle,
      leftSpecs.referenceVideo,
      rightSpecs.referenceVideo,
      leftSpecs.maxResolution,
      rightSpecs.maxResolution,
      leftSpecs.maxDuration,
      rightSpecs.maxDuration,
      leftSpecs.aspectRatios,
      rightSpecs.aspectRatios,
      leftSpecs.fpsOptions,
      rightSpecs.fpsOptions,
      leftSpecs.outputFormats,
      rightSpecs.outputFormats,
    ];
    const pendingCount = rows.filter((value) => isPending(value)).length;
    const pendingRatio = rows.length ? pendingCount / rows.length : 0;
    if (pendingRatio >= 0.35) {
      robots = { index: false, follow: true };
    }
  }
  if (typeof searchParams?.order === 'string' && searchParams.order.trim()) {
    robots = { index: false, follow: true };
  }

  return buildSeoMetadata({
    locale,
    title,
    description,
    englishPath: `/ai-video-engines/${canonicalSlug}`,
    availableLocales: getIndexableComparisonLocales(canonicalSlug),
    titleBranding: metaOverride.titleBranding ?? 'auto',
    robots,
  });
}
