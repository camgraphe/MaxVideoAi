import { getExampleFamilyModelSlugs } from '@/lib/model-families';
import { getIndexablePlaylistSlugs } from '@/server/indexing';

function parseSlugList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const values = raw
    .split(/[,\s]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  return Array.from(new Set(values.map((value) => value.toLowerCase()))).map((normalized) => {
    const original = values.find((value) => value.toLowerCase() === normalized);
    return original ?? normalized;
  });
}

export function getStarterPlaylistSlug(): string {
  const slug = process.env.STARTER_PLAYLIST_SLUG?.trim();
  return slug?.length ? slug : 'starter';
}

export function getExamplesHubPlaylistSlug(): string {
  const explicit = parseSlugList(process.env.EXAMPLES_PLAYLIST_SLUG);
  if (explicit.length) {
    return explicit[0]!;
  }
  const indexable = getIndexablePlaylistSlugs();
  if (indexable.length) {
    return indexable[0]!;
  }
  return 'examples';
}

export function getFamilyPlaylistSlug(familyId: string): string {
  return `family-${familyId.trim().toLowerCase()}`;
}

export function getModelPlaylistSlug(modelSlug: string): string {
  return `examples-${modelSlug.trim().toLowerCase()}`;
}

export function getFamilyFeedSourceSlugs(familyId: string): string[] {
  const normalizedFamilyId = familyId.trim().toLowerCase();
  if (!normalizedFamilyId) return [];
  return Array.from(
    new Set([
      getFamilyPlaylistSlug(normalizedFamilyId),
      ...getExampleFamilyModelSlugs(normalizedFamilyId).map((modelSlug) => getModelPlaylistSlug(modelSlug)),
      getExamplesHubPlaylistSlug(),
    ])
  );
}
