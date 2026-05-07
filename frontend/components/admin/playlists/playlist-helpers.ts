import { getExampleFamilyDescriptor, getExampleFamilyIds, getExampleFamilyModelSlugs } from '@/lib/model-families';
import type {
  EditablePlaylist,
  FamilyPlaylistHelperCard,
  PlaylistGroup,
  PlaylistItemRecord,
  PlaylistSummary,
  PlaylistSurfaceRole,
  PlaylistSurfaceStatus,
} from './playlist-types';

const PLACEHOLDER_MAP: Record<string, string> = {
  '9:16': '/assets/frames/thumb-9x16.svg',
  '16:9': '/assets/frames/thumb-16x9.svg',
  '1:1': '/assets/frames/thumb-1x1.svg',
};

export const GROUP_LABELS: Record<PlaylistGroup, string> = {
  runtime: 'Runtime surfaces',
  family: 'Family playlists',
  model: 'Model playlists',
  draft: 'Draft / misc',
};

export function getPlaceholderThumb(aspectRatio?: string | null): string {
  const key = (aspectRatio ?? '').trim();
  return PLACEHOLDER_MAP[key] ?? '/assets/frames/thumb-16x9.svg';
}

export function formatDate(value?: string | null): string {
  if (!value) return 'Never';
  try {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function compareDatesDescending(a?: string | null, b?: string | null) {
  const aTime = a ? Date.parse(a) : Number.NaN;
  const bTime = b ? Date.parse(b) : Number.NaN;
  const safeA = Number.isFinite(aTime) ? aTime : 0;
  const safeB = Number.isFinite(bTime) ? bTime : 0;
  return safeB - safeA;
}

function getPlaylistPriority(playlist: Pick<EditablePlaylist, 'surfaceRole'>) {
  if (playlist.surfaceRole === 'starter') return 0;
  if (playlist.surfaceRole === 'examplesHub') return 1;
  if (playlist.surfaceRole === 'family') return 2;
  if (playlist.surfaceRole === 'model') return 3;
  if (playlist.surfaceRole === 'other') return 4;
  return 5;
}

function comparePlaylists(a: EditablePlaylist, b: EditablePlaylist) {
  const priorityDelta = getPlaylistPriority(a) - getPlaylistPriority(b);
  if (priorityDelta !== 0) return priorityDelta;
  if (a.itemCount !== b.itemCount) return b.itemCount - a.itemCount;
  const lastAddedDelta = compareDatesDescending(a.lastAddedAt, b.lastAddedAt);
  if (lastAddedDelta !== 0) return lastAddedDelta;
  return a.name.localeCompare(b.name) || a.slug.localeCompare(b.slug);
}

export function sortPlaylists(playlists: EditablePlaylist[]): EditablePlaylist[] {
  return [...playlists].sort(comparePlaylists);
}

export function getUsageLabel(target: string): string {
  if (target === 'starter-tab') return 'Starter tab';
  if (target === 'examples-hub') return 'Examples hub';
  if (target.startsWith('family-page:')) {
    return `Family page · ${target.slice('family-page:'.length)}`;
  }
  if (target.startsWith('family-fallback:')) {
    return `Family fallback · ${target.slice('family-fallback:'.length)}`;
  }
  if (target.startsWith('model-page:')) {
    return `Model page · ${target.slice('model-page:'.length)}`;
  }
  return target;
}

export function summarizePlaylist(playlist: PlaylistSummary): string {
  if (!playlist.itemCount) return 'Empty collection';
  return `${playlist.itemCount} items · ${playlist.siteVisibleCount} live · ${playlist.withVideoAssetCount} with video`;
}

export function buildPlaylistUpdateFromItems(playlist: EditablePlaylist, items: PlaylistItemRecord[]): EditablePlaylist {
  const lastAddedAt = items.reduce<string | null>((latest, item) => {
    if (!latest) return item.createdAt;
    return compareDatesDescending(item.createdAt, latest) < 0 ? item.createdAt : latest;
  }, null);

  return {
    ...playlist,
    itemCount: items.length,
    siteVisibleCount: items.filter((item) => item.isPublishedOnSite).length,
    withVideoAssetCount: items.filter((item) => Boolean(item.videoUrl)).length,
    lastAddedAt,
  };
}

export function getPlaylistGroup(playlist: Pick<PlaylistSummary, 'surfaceRole'>): PlaylistGroup {
  if (playlist.surfaceRole === 'starter' || playlist.surfaceRole === 'examplesHub') {
    return 'runtime';
  }
  if (playlist.surfaceRole === 'family') {
    return 'family';
  }
  if (playlist.surfaceRole === 'model') {
    return 'model';
  }
  return 'draft';
}

export function buildFamilyHelpers(playlists: PlaylistSummary[]): FamilyPlaylistHelperCard[] {
  const byFamilyId = new Map<string, PlaylistSummary>();
  playlists.forEach((playlist) => {
    if (playlist.surfaceRole === 'family' && playlist.familyId) {
      byFamilyId.set(playlist.familyId, playlist);
    }
  });

  return getExampleFamilyIds().map((familyId) => {
    const descriptor = getExampleFamilyDescriptor(familyId);
    const playlist = byFamilyId.get(familyId) ?? null;
    const fallbackModelSlugs = getExampleFamilyModelSlugs(familyId);
    return {
      familyId,
      label: descriptor?.label ?? familyId,
      slug: `family-${familyId}`,
      route: `/examples/${familyId}`,
      fallbackModelSlugs,
      helperText: `Feeds /examples/${familyId}. Auto-fills from ${
        fallbackModelSlugs.length
          ? `${fallbackModelSlugs.map((modelSlug) => `examples-${modelSlug}`).join(', ')} then examples`
          : 'examples'
      }.`,
      status: playlist ? (playlist.itemCount > 0 ? 'ready' : 'empty') : 'missing',
      playlistId: playlist?.id ?? null,
    };
  });
}

export function sortItemsForDisplay(items: PlaylistItemRecord[]): PlaylistItemRecord[] {
  return [...items].sort((a, b) => {
    if (a.orderIndex !== b.orderIndex) {
      return b.orderIndex - a.orderIndex;
    }
    return compareDatesDescending(a.createdAt, b.createdAt);
  });
}

export function getSurfaceRoleLabel(role: PlaylistSurfaceRole): string {
  switch (role) {
    case 'starter':
      return 'Starter surface';
    case 'examplesHub':
      return 'Examples hub';
    case 'family':
      return 'Family playlist';
    case 'model':
      return 'Model playlist';
    case 'draft':
      return 'Draft';
    case 'other':
    default:
      return 'Misc collection';
  }
}

export function getSurfaceRoleTone(role: PlaylistSurfaceRole): 'neutral' | 'ok' | 'warn' {
  if (role === 'starter' || role === 'examplesHub') return 'ok';
  if (role === 'family' || role === 'model') return 'neutral';
  return 'warn';
}

export function getSurfaceStatusTone(status: PlaylistSurfaceStatus | FamilyPlaylistHelperCard['status']): 'neutral' | 'ok' | 'warn' {
  if (status === 'ready') return 'ok';
  if (status === 'missing' || status === 'empty') return 'warn';
  return 'neutral';
}

export function getSurfaceStatusLabel(status: PlaylistSurfaceStatus | FamilyPlaylistHelperCard['status']): string {
  if (status === 'ready') return 'Ready';
  if (status === 'missing') return 'Missing';
  if (status === 'empty') return 'Empty';
  return 'General';
}

export function buildHelperFallbackLabel(modelSlug: string): string {
  return `examples-${modelSlug}`;
}
