import { EXAMPLES_HERO_SELECTION_LIMIT, pickFirstPlayableVideo } from '@/lib/examples/heroVideo';
import { listExampleFamilyPage } from '@/server/videos';
import type {
  ExamplePreviewPick,
  RankedPick,
} from './best-for-detail-config';

export async function resolveExamplePreviewPicks(picks: RankedPick[]): Promise<ExamplePreviewPick[]> {
  const examplesSlugs = Array.from(new Set(picks.map((pick) => getExamplesSlug(pick))));
  const heroThumbEntries = await Promise.all(
    examplesSlugs.map(async (examplesSlug) => {
      try {
        const result = await listExampleFamilyPage(examplesSlug, {
          sort: 'playlist',
          limit: EXAMPLES_HERO_SELECTION_LIMIT,
          offset: 0,
        });
        const heroVideo = pickFirstPlayableVideo(result.items);
        return [examplesSlug, heroVideo?.thumbUrl ?? null] as const;
      } catch {
        return [examplesSlug, null] as const;
      }
    })
  );
  const heroThumbBySlug = new Map(heroThumbEntries);

  return picks.map((pick) => {
    const examplesSlug = getExamplesSlug(pick);
    return {
      ...pick,
      examplesSlug,
      heroThumbUrl: heroThumbBySlug.get(examplesSlug) ?? null,
    };
  });
}

export function getExamplesSlug(pick: RankedPick) {
  return pick.engine?.family ?? pick.slug;
}
