import { listPlaylistVideos } from '@/server/videos';
import type { EngineCatalogEntry } from './compare-page-types';
import { selectCompareGalleryVideos, type CompareGalleryVideo } from './compare-gallery-data';

export async function loadCompareGallery(entry: EngineCatalogEntry, isPrelaunch: boolean): Promise<CompareGalleryVideo[]> {
  if (isPrelaunch) return [];
  try {
    const videos = await listPlaylistVideos(`examples-${entry.modelSlug}`, 12);
    return selectCompareGalleryVideos(videos, entry.modelSlug, entry.engineId);
  } catch {
    // Optional public media must not make an otherwise valid comparison unavailable.
    return [];
  }
}
