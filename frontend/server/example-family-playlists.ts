import {
  getExampleFamilyDescriptor,
  getExampleFamilyIds,
  getExampleFamilyModelSlugs,
  resolveExampleFamilyId,
} from '@/lib/model-families';
import { listFalEngines } from '@/config/falEngines';
import {
  createPlaylist,
  getFamilyPlaylistSlug,
  getModelPlaylistSlug,
  getPlaylistBySlug,
  reorderPlaylistItems,
  type PlaylistRecord,
} from '@/server/playlists';
import { listExampleFamilyCurrentPublicOrder, listExampleModelCurrentPublicOrder } from '@/server/videos';

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

export type ModelPlaylistHelper = {
  modelSlug: string;
  label: string;
  slug: string;
  drivesRoute: string;
  familyId: string | null;
  familyLabel: string | null;
  helperText: string;
  playlistId: string | null;
  itemCount: number;
  status: 'ready' | 'missing' | 'empty';
};

type SeedModelPlaylistResult = {
  modelSlug: string;
  playlist: PlaylistRecord;
  itemCount: number;
};

const MODEL_LABEL_BY_SLUG = new Map(listFalEngines().map((entry) => [entry.modelSlug, entry.marketingName]));

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

function buildModelPlaylistName(modelSlug: string): string {
  return `Model · ${MODEL_LABEL_BY_SLUG.get(modelSlug) ?? modelSlug}`;
}

function buildModelPlaylistDescription(modelSlug: string): string {
  const familyId = resolveExampleFamilyId(modelSlug);
  const familySuffix = familyId ? ` and contributes to /examples/${familyId} fallback` : '';
  return `Drives /models/${modelSlug}${familySuffix}.`;
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

async function ensureModelPlaylist(modelSlug: string, userId?: string | null): Promise<PlaylistRecord> {
  const slug = getModelPlaylistSlug(modelSlug);
  const existing = await getPlaylistBySlug(slug);
  if (existing) {
    return existing;
  }

  return createPlaylist({
    slug,
    name: buildModelPlaylistName(modelSlug),
    description: buildModelPlaylistDescription(modelSlug),
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

export function getPublishedExampleModelPlaylistSlugs(): string[] {
  const modelSlugs: string[] = [];
  for (const familyId of getExampleFamilyIds()) {
    for (const modelSlug of getExampleFamilyModelSlugs(familyId)) {
      if (!modelSlugs.includes(modelSlug)) {
        modelSlugs.push(modelSlug);
      }
    }
  }
  return modelSlugs;
}

export async function createMissingModelPlaylists(userId?: string | null): Promise<PlaylistRecord[]> {
  const results: PlaylistRecord[] = [];
  for (const modelSlug of getPublishedExampleModelPlaylistSlugs()) {
    const playlist = await ensureModelPlaylist(modelSlug, userId);
    results.push(playlist);
  }
  return results;
}

export async function seedFamilyPlaylistFromCurrentOrder(
  familyId: string,
  userId?: string | null
): Promise<SeedFamilyPlaylistResult> {
  const playlist = await ensureFamilyPlaylist(familyId, userId);
  const videos = await listExampleFamilyCurrentPublicOrder(familyId);
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

export async function seedModelPlaylistFromCurrentOrder(
  modelSlug: string,
  userId?: string | null
): Promise<SeedModelPlaylistResult> {
  const normalizedModelSlug = modelSlug.trim().toLowerCase();
  const playlist = await ensureModelPlaylist(normalizedModelSlug, userId);
  const videos = await listExampleModelCurrentPublicOrder(normalizedModelSlug);
  await reorderPlaylistItems(
    playlist.id,
    [...videos].reverse().map((video) => ({
      videoId: video.id,
      pinned: false,
    }))
  );

  const updated = (await getPlaylistBySlug(playlist.slug)) ?? playlist;
  return {
    modelSlug: normalizedModelSlug,
    playlist: updated,
    itemCount: videos.length,
  };
}

export async function seedAllFamilyPlaylistsFromCurrentOrder(userId?: string | null): Promise<SeedFamilyPlaylistResult[]> {
  const results: SeedFamilyPlaylistResult[] = [];
  for (const familyId of getExampleFamilyIds()) {
    results.push(await seedFamilyPlaylistFromCurrentOrder(familyId, userId));
  }
  return results;
}

export async function seedAllModelPlaylistsFromCurrentOrder(userId?: string | null): Promise<SeedModelPlaylistResult[]> {
  const results: SeedModelPlaylistResult[] = [];
  for (const modelSlug of getPublishedExampleModelPlaylistSlugs()) {
    results.push(await seedModelPlaylistFromCurrentOrder(modelSlug, userId));
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

export function buildModelPlaylistHelpers(playlists: PlaylistRecord[]): ModelPlaylistHelper[] {
  const playlistByModelSlug = new Map<string, PlaylistRecord>();
  playlists.forEach((playlist) => {
    if (playlist.surfaceRole === 'model' && playlist.modelSlug) {
      playlistByModelSlug.set(playlist.modelSlug, playlist);
    }
  });

  return getPublishedExampleModelPlaylistSlugs().map((modelSlug) => {
    const familyId = resolveExampleFamilyId(modelSlug);
    const descriptor = familyId ? getExampleFamilyDescriptor(familyId) : null;
    const playlist = playlistByModelSlug.get(modelSlug) ?? null;
    return {
      modelSlug,
      label: MODEL_LABEL_BY_SLUG.get(modelSlug) ?? modelSlug,
      slug: getModelPlaylistSlug(modelSlug),
      drivesRoute: `/models/${modelSlug}`,
      familyId,
      familyLabel: descriptor?.label ?? familyId ?? null,
      helperText: `Feeds /models/${modelSlug}${
        familyId ? ` and /examples/${familyId} fallback` : ''
      } from ${getModelPlaylistSlug(modelSlug)}.`,
      playlistId: playlist?.id ?? null,
      itemCount: playlist?.itemCount ?? 0,
      status: playlist ? (playlist.itemCount > 0 ? 'ready' : 'empty') : 'missing',
    };
  });
}
