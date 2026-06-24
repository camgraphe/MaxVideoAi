import { getCompareShowdowns } from '@/config/compare-showdowns';
import type { AppLocale } from '@/i18n/locales';
import { isDatabaseConfigured } from '@/lib/db';
import { getLatestPublicVideoByPromptAndEngine, getPublicVideosByIds, type GalleryVideo } from '@/server/videos';
import { SHOWDOWN_OVERRIDES, SHOWDOWNS } from './compare-page-config';
import {
  formatEngineName,
  hydrateShowdowns,
  LOCALIZED_SHOWDOWN_TESTS,
  LOCALIZED_SHOWDOWN_TITLES,
  localizeMappedValue,
  reverseCompareSlug,
} from './compare-page-helpers';
import type {
  CompareShowdownSlot,
  EngineCatalogEntry,
  ShowdownEntry,
  ShowdownSide,
} from './compare-page-types';

function normalizePrompt(value?: string | null) {
  return (value ?? '').trim().toLowerCase();
}

function hasMedia(side?: ShowdownSide | null) {
  return Boolean(side?.videoUrl || side?.posterUrl);
}

function isKlingOmni(entry: EngineCatalogEntry) {
  return entry.modelSlug.startsWith('kling-o3-') || entry.engineId.startsWith('kling-o3-');
}

function requiresCuratedShowdowns(entry: EngineCatalogEntry) {
  return (
    isKlingOmni(entry) ||
    entry.modelSlug.startsWith('happy-horse-') ||
    entry.engineId.startsWith('happy-horse-')
  );
}

function hasCuratedShowdowns(slug: string | null | undefined) {
  if (!slug) return false;
  return Boolean(SHOWDOWNS[slug]?.some((entry) => Boolean(entry)));
}

function logShowdownMediaLookupError(operation: string, error: unknown) {
  console.warn(`[compare-page] Skipping optional showdown media lookup after ${operation} failed.`, error);
}

export async function buildCompareShowdownSlots({
  activeLocale,
  canonicalSlug,
  left,
  pairHasKling3Native4k,
  pairHasNativeAudio,
  right,
  shouldSwapDisplayOrder,
}: {
  activeLocale: AppLocale;
  canonicalSlug: string;
  left: EngineCatalogEntry;
  pairHasKling3Native4k: boolean;
  pairHasNativeAudio: boolean;
  right: EngineCatalogEntry;
  shouldSwapDisplayOrder: boolean;
}): Promise<CompareShowdownSlot[]> {
  const reversedShowdownSlug = reverseCompareSlug(canonicalSlug);
  const hasCuratedPairShowdowns = hasCuratedShowdowns(canonicalSlug) || hasCuratedShowdowns(reversedShowdownSlug);
  if ((requiresCuratedShowdowns(left) || requiresCuratedShowdowns(right)) && !hasCuratedPairShowdowns) {
    return [];
  }
  const compareShowdowns = pairHasKling3Native4k ? [] : getCompareShowdowns({ pairHasNativeAudio });
  const showdownSourceSlug =
    SHOWDOWNS[canonicalSlug] != null
      ? canonicalSlug
      : reversedShowdownSlug && SHOWDOWNS[reversedShowdownSlug] != null
        ? reversedShowdownSlug
        : canonicalSlug;
  const showdowns = await hydrateShowdowns(SHOWDOWNS[showdownSourceSlug] ?? []);
  const normalizedShowdowns = showdowns.filter((entry): entry is ShowdownEntry => Boolean(entry));
  const showdownsByPrompt = new Map(normalizedShowdowns.map((entry) => [normalizePrompt(entry.prompt), entry]));
  const showdownsBySlotId = new Map(
    normalizedShowdowns
      .filter((entry) => Boolean(entry.slotId))
      .map((entry) => [entry.slotId as string, entry])
  );
  const orderedShowdowns = compareShowdowns.map((template) => {
    const bySlot = showdownsBySlotId.get(template.id);
    if (bySlot) return bySlot;
    const byPrompt = showdownsByPrompt.get(normalizePrompt(template.prompt));
    if (byPrompt) return byPrompt;
    return null;
  });
  const overrideJobs = new Set<string>();
  compareShowdowns.forEach((template) => {
    const leftOverride = SHOWDOWN_OVERRIDES[left.modelSlug]?.[template.id];
    if (leftOverride) overrideJobs.add(leftOverride);
    const rightOverride = SHOWDOWN_OVERRIDES[right.modelSlug]?.[template.id];
    if (rightOverride) overrideJobs.add(rightOverride);
  });
  let overrideVideos = new Map<string, GalleryVideo>();
  if (overrideJobs.size && isDatabaseConfigured()) {
    try {
      overrideVideos = await getPublicVideosByIds(Array.from(overrideJobs));
    } catch (error) {
      logShowdownMediaLookupError('override video lookup', error);
    }
  }
  const fallbackByTemplateId = new Map<string, { left?: GalleryVideo; right?: GalleryVideo }>();
  if (isDatabaseConfigured()) {
    const lookupTasks: Array<Promise<void>> = [];
    compareShowdowns.forEach((template, index) => {
      const entry = orderedShowdowns[index];
      const needsLeft = !hasMedia(entry?.left);
      const needsRight = !hasMedia(entry?.right);
      if (!needsLeft && !needsRight) return;
      if (needsLeft) {
        lookupTasks.push(
          getLatestPublicVideoByPromptAndEngine(template.prompt, left.engineId || left.modelSlug)
            .then((video) => {
              if (!video) return;
              const current = fallbackByTemplateId.get(template.id) ?? {};
              fallbackByTemplateId.set(template.id, { ...current, left: video });
            })
        );
      }
      if (needsRight) {
        lookupTasks.push(
          getLatestPublicVideoByPromptAndEngine(template.prompt, right.engineId || right.modelSlug)
            .then((video) => {
              if (!video) return;
              const current = fallbackByTemplateId.get(template.id) ?? {};
              fallbackByTemplateId.set(template.id, { ...current, right: video });
            })
        );
      }
    });
    if (lookupTasks.length) {
      const results = await Promise.allSettled(lookupTasks);
      const failure = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
      if (failure) {
        logShowdownMediaLookupError('fallback video lookup', failure.reason);
      }
    }
  }

  return compareShowdowns.map((template, index) => {
    const entry = orderedShowdowns[index];
    const shouldSwapShowdownSides =
      showdownSourceSlug === canonicalSlug ? shouldSwapDisplayOrder : !shouldSwapDisplayOrder;
    const entryLeft = shouldSwapShowdownSides ? entry?.right : entry?.left;
    const entryRight = shouldSwapShowdownSides ? entry?.left : entry?.right;
    const fallback = fallbackByTemplateId.get(template.id);
    const fallbackLeft = fallback?.left;
    const fallbackRight = fallback?.right;
    const leftOverrideId = SHOWDOWN_OVERRIDES[left.modelSlug]?.[template.id];
    const rightOverrideId = SHOWDOWN_OVERRIDES[right.modelSlug]?.[template.id];
    const leftOverrideVideo = leftOverrideId ? overrideVideos.get(leftOverrideId) : undefined;
    const rightOverrideVideo = rightOverrideId ? overrideVideos.get(rightOverrideId) : undefined;
    const leftSide: ShowdownSide = {
      ...(entryLeft ?? {}),
      label: formatEngineName(left),
      videoUrl: entryLeft?.videoUrl ?? leftOverrideVideo?.videoUrl ?? fallbackLeft?.videoUrl,
      posterUrl: entryLeft?.posterUrl ?? leftOverrideVideo?.thumbUrl ?? fallbackLeft?.thumbUrl,
      placeholder: false,
    };
    const rightSide: ShowdownSide = {
      ...(entryRight ?? {}),
      label: formatEngineName(right),
      videoUrl: entryRight?.videoUrl ?? rightOverrideVideo?.videoUrl ?? fallbackRight?.videoUrl,
      posterUrl: entryRight?.posterUrl ?? rightOverrideVideo?.thumbUrl ?? fallbackRight?.thumbUrl,
      placeholder: false,
    };
    leftSide.placeholder = !hasMedia(leftSide);
    rightSide.placeholder = !hasMedia(rightSide);

    return {
      ...template,
      title: localizeMappedValue(entry?.title ?? template.title, activeLocale, LOCALIZED_SHOWDOWN_TITLES),
      whatItTests: localizeMappedValue(template.whatItTests, activeLocale, LOCALIZED_SHOWDOWN_TESTS),
      prompt: entry?.prompt ?? template.prompt,
      left: leftSide,
      right: rightSide,
    };
  });
}
