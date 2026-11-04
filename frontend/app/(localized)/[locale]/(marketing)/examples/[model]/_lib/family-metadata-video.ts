import { EXAMPLES_HERO_SELECTION_LIMIT, pickFirstPlayableVideo } from '@/lib/examples/heroVideo';
import { listExampleFamilyPage, type GalleryVideo } from '@/server/videos';

const readPreviewOnly = (familyId: string) => listExampleFamilyPage(familyId, { sort: 'playlist', limit: 1, offset: 0 });

export async function selectFamilyMetadataVideo(
  familyId: string,
  readFirstPage = readPreviewOnly,
): Promise<GalleryVideo | null> {
  const first = await readFirstPage(familyId);
  const playable = pickFirstPlayableVideo(first.items);
  if (playable || !first.items.length) return playable;

  // SQL eligibility and local snapshots can retain sources that normalize to empty.
  const fallback = await listExampleFamilyPage(familyId, {
    sort: 'playlist', limit: EXAMPLES_HERO_SELECTION_LIMIT, offset: 0,
  });
  return pickFirstPlayableVideo(fallback.items);
}
