import { normalizeEngineId } from '@/lib/engine-alias';
import { resolveExampleCanonicalSlug } from '@/lib/examples-links';
import type { GalleryVideo } from './videos-normalization';

export type ExampleSort = 'playlist' | 'date-desc' | 'date-asc' | 'duration-desc' | 'duration-asc' | 'engine-asc';

export type ListExamplesPageOptions = {
  sort: ExampleSort;
  limit?: number;
  offset?: number;
  engineGroup?: string | null;
};

export type ListExamplesPageResult = {
  items: GalleryVideo[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
};

export const ENGINE_GROUP_FETCH_MULTIPLIER = 4;
export const ENGINE_GROUP_FETCH_CAP = 400;

export function resolveExampleGroupId(engineId: string | null | undefined): string | null {
  if (!engineId) return null;
  const normalized = (normalizeEngineId(engineId) ?? engineId).trim().toLowerCase();
  if (!normalized) return null;
  return resolveExampleCanonicalSlug(normalized) ?? normalized;
}

export function sortVideosByPreference(videos: GalleryVideo[], sort: ExampleSort): GalleryVideo[] {
  if (sort === 'playlist') {
    return [...videos];
  }
  const copy = [...videos];
  switch (sort) {
    case 'date-asc':
      return copy.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
    case 'duration-asc':
      return copy.sort((a, b) => (a.durationSec ?? 0) - (b.durationSec ?? 0));
    case 'duration-desc':
      return copy.sort((a, b) => (b.durationSec ?? 0) - (a.durationSec ?? 0));
    case 'engine-asc':
      return copy.sort(
        (a, b) => (a.engineLabel ?? '').localeCompare(b.engineLabel ?? '') || Date.parse(b.createdAt) - Date.parse(a.createdAt),
      );
    case 'date-desc':
    default:
      return copy.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }
}

export function mergeUniqueGalleryVideos(...groups: GalleryVideo[][]): GalleryVideo[] {
  const seen = new Set<string>();
  const merged: GalleryVideo[] = [];
  groups.forEach((videos) => {
    videos.forEach((video) => {
      if (seen.has(video.id)) return;
      seen.add(video.id);
      merged.push(video);
    });
  });
  return merged;
}

export function paginateGalleryVideos(videos: GalleryVideo[], limit: number, offset: number): ListExamplesPageResult {
  const total = videos.length;
  const start = Math.max(0, offset);
  const items = videos.slice(start, start + limit);
  return {
    items,
    total,
    limit,
    offset: start,
    hasMore: start + items.length < total,
  };
}
