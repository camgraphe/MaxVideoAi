import { normalizeEngineId } from '@/lib/engine-alias';
import { resolveExampleCanonicalSlug } from '@/lib/examples-links';
import { getExampleModelEngineAliases } from '@/lib/model-families';
import { getIndexablePlaylistSlugs } from '@/server/indexing';
import { mergeUniqueGalleryVideos, resolveExampleGroupId } from './videos-examples';
import type { GalleryVideo } from './videos-normalization';

type ListPlaylistVideos = (slug: string) => Promise<GalleryVideo[]>;
type ListLatestVideos = (limit: number) => Promise<GalleryVideo[]>;

function matchesEngineAlias(video: GalleryVideo, aliases: Set<string>): boolean {
  const raw = video.engineId?.trim().toLowerCase();
  const normalized = video.engineId ? normalizeEngineId(video.engineId)?.trim().toLowerCase() : null;
  return Boolean((raw && aliases.has(raw)) || (normalized && aliases.has(normalized)));
}

async function listCurrentPublicOrder(
  listAllPlaylistVideos: ListPlaylistVideos,
  filter: (video: GalleryVideo) => boolean
): Promise<GalleryVideo[]> {
  const slugs = getIndexablePlaylistSlugs();
  if (!slugs.length) return [];
  const playlistResults = await Promise.all(slugs.map((slug) => listAllPlaylistVideos(slug).catch(() => [] as GalleryVideo[])));
  return mergeUniqueGalleryVideos(...playlistResults).filter(filter);
}

async function listLatestPublicModelVideos(
  engineAliases: string[],
  listLatestVideos: ListLatestVideos,
  limit = 24
): Promise<GalleryVideo[]> {
  const aliases = new Set(engineAliases.map((value) => value.trim().toLowerCase()).filter(Boolean));
  if (!aliases.size) return [];
  const latest = await listLatestVideos(Math.max(limit * 10, 120));
  return latest.filter((video) => matchesEngineAlias(video, aliases)).slice(0, limit);
}

export async function listExampleFamilyCurrentPublicOrderFromSources({
  familyId,
  listAllPlaylistVideos,
}: {
  familyId: string;
  listAllPlaylistVideos: ListPlaylistVideos;
}): Promise<GalleryVideo[]> {
  const normalizedFamilyId = resolveExampleCanonicalSlug(familyId) ?? familyId.trim().toLowerCase();
  if (!normalizedFamilyId) return [];
  return listCurrentPublicOrder(listAllPlaylistVideos, (video) => resolveExampleGroupId(video.engineId) === normalizedFamilyId);
}

export async function listExampleModelCurrentPublicOrderFromSources({
  listAllPlaylistVideos,
  listLatestVideos,
  modelSlug,
}: {
  listAllPlaylistVideos: ListPlaylistVideos;
  listLatestVideos: ListLatestVideos;
  modelSlug: string;
}): Promise<GalleryVideo[]> {
  const engineAliases = getExampleModelEngineAliases(modelSlug).map((alias) => alias.trim().toLowerCase()).filter(Boolean);
  const aliases = new Set(engineAliases);
  if (!aliases.size) return [];

  const currentPublicOrder = await listCurrentPublicOrder(listAllPlaylistVideos, (video) => matchesEngineAlias(video, aliases));
  if (currentPublicOrder.length) return currentPublicOrder;
  return listLatestPublicModelVideos(engineAliases, listLatestVideos);
}
