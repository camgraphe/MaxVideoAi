import {
  getExampleFamilyDescriptor,
  getExampleFamilyIds,
  getExampleFamilyModelSlugs,
} from '@/lib/model-families';
import {
  createPlaylist,
  getFamilyPlaylistSlug,
  getPlaylistBySlug,
  reorderPlaylistItems,
  type PlaylistRecord,
} from '@/server/playlists';
import { listExampleFamilyAutoFeed } from '@/server/videos';

export type FamilyPlaylistHelper = {
  familyId: string;
  label: string;
  slug: string;
  drivesRoute: string;
  fallbackModelSlugs: string[];
  helperText: string;
  playlistId: string | null;
  itemCount: number;
  status: 'ready' | 'missing' | 'empty';
};

type SeedFamilyPlaylistResult = {
  familyId: string;
  playlist: PlaylistRecord;
  itemCount: number;
};

function buildFamilyPlaylistName(familyId: string): string {
  const descriptor = getExampleFamilyDescriptor(familyId);
  return descriptor ? `Family · ${descriptor.label}` : `Family · ${familyId}`;
}

function buildFamilyPlaylistDescription(familyId: string): string {
  const modelPlaylistSlugs = getExampleFamilyModelSlugs(familyId).map((modelSlug) => `examples-${modelSlug}`);
  const route = `/examples/${familyId}`;
  const fallbackSummary = modelPlaylistSlugs.length
    ? `${modelPlaylistSlugs.join(', ')} then examples`
    : 'examples';
  return `Drives ${route}. Fills automatically from ${fallbackSummary}.`;
}

async function ensureFamilyPlaylist(familyId: string, userId?: string | null): Promise<PlaylistRecord> {
  const slug = getFamilyPlaylistSlug(familyId);
  const existing = await getPlaylistBySlug(slug);
  if (existing) {
    return existing;
  }

  return createPlaylist({
    slug,
    name: buildFamilyPlaylistName(familyId),
    description: buildFamilyPlaylistDescription(familyId),
    isPublic: true,
    userId: userId ?? null,
  });
}

export async function createMissingFamilyPlaylists(userId?: string | null): Promise<PlaylistRecord[]> {
  const results: PlaylistRecord[] = [];
  for (const familyId of getExampleFamilyIds()) {
    const playlist = await ensureFamilyPlaylist(familyId, userId);
    results.push(playlist);
  }
  return results;
}

export async function seedFamilyPlaylistFromAutoOrder(
  familyId: string,
  userId?: string | null
): Promise<SeedFamilyPlaylistResult> {
  const playlist = await ensureFamilyPlaylist(familyId, userId);
  const videos = await listExampleFamilyAutoFeed(familyId);
  await reorderPlaylistItems(
    playlist.id,
    [...videos].reverse().map((video) => ({
      videoId: video.id,
      pinned: false,
    }))
  );

  const updated = (await getPlaylistBySlug(playlist.slug)) ?? playlist;
  return {
    familyId,
    playlist: updated,
    itemCount: videos.length,
  };
}

export async function seedAllFamilyPlaylistsFromAutoOrder(userId?: string | null): Promise<SeedFamilyPlaylistResult[]> {
  const results: SeedFamilyPlaylistResult[] = [];
  for (const familyId of getExampleFamilyIds()) {
    results.push(await seedFamilyPlaylistFromAutoOrder(familyId, userId));
  }
  return results;
}

export function buildFamilyPlaylistHelpers(playlists: PlaylistRecord[]): FamilyPlaylistHelper[] {
  const playlistByFamilyId = new Map<string, PlaylistRecord>();
  playlists.forEach((playlist) => {
    if (playlist.surfaceRole === 'family' && playlist.familyId) {
      playlistByFamilyId.set(playlist.familyId, playlist);
    }
  });

  return getExampleFamilyIds().map((familyId) => {
    const descriptor = getExampleFamilyDescriptor(familyId);
    const playlist = playlistByFamilyId.get(familyId) ?? null;
    const fallbackModelSlugs = getExampleFamilyModelSlugs(familyId);
    return {
      familyId,
      label: descriptor?.label ?? familyId,
      slug: getFamilyPlaylistSlug(familyId),
      drivesRoute: `/examples/${familyId}`,
      fallbackModelSlugs,
      helperText: `Feeds /examples/${familyId}. Auto-fills from ${
        fallbackModelSlugs.length
          ? `${fallbackModelSlugs.map((modelSlug) => `examples-${modelSlug}`).join(', ')} then examples`
          : 'examples'
      }.`,
      playlistId: playlist?.id ?? null,
      itemCount: playlist?.itemCount ?? 0,
      status: playlist ? (playlist.itemCount > 0 ? 'ready' : 'empty') : 'missing',
    };
  });
}
