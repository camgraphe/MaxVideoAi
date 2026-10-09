import { EXAMPLES_HERO_SELECTION_LIMIT, pickFirstPlayableVideo } from '@/lib/examples/heroVideo';
import { listExampleFamilyPage, type GalleryVideo } from '@/server/videos';

export async function selectFamilyMetadataVideo(
  familyId: string,
  readFamilyPage: typeof listExampleFamilyPage = listExampleFamilyPage,
): Promise<GalleryVideo | null> {
  const first = await readFamilyPage(familyId, { sort: 'playlist', limit: 1, offset: 0 });
  const playable = pickFirstPlayableVideo(first.items);
  if (playable || !first.items.length) return playable;

  // SQL eligibility and local snapshots can retain sources that normalize to empty.
  const fallback = await readFamilyPage(familyId, {
    sort: 'playlist', limit: EXAMPLES_HERO_SELECTION_LIMIT, offset: 0,
  });
  return pickFirstPlayableVideo(fallback.items);
}
