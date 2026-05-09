import {
  getExampleFamilyDescriptor,
  getExampleFamilyModelSlugs,
  resolveExampleFamilyId,
} from '@/lib/model-families';
import { getIndexablePlaylistSlugs } from '@/server/indexing';
import type {
  PlaylistKind,
  PlaylistRecord,
  PlaylistSurfaceRole,
  PlaylistSurfaceStatus,
} from './types';
import {
  getExamplesHubPlaylistSlug,
  getFamilyPlaylistSlug,
  getModelPlaylistSlug,
  getStarterPlaylistSlug,
} from './slugs';

function compareDatesDescending(a?: string | null, b?: string | null) {
  const aTime = a ? Date.parse(a) : Number.NaN;
  const bTime = b ? Date.parse(b) : Number.NaN;
  const safeA = Number.isFinite(aTime) ? aTime : 0;
  const safeB = Number.isFinite(bTime) ? bTime : 0;
  return safeB - safeA;
}

export function getPlaylistUsageTargets(slug: string): string[] {
  const targets: string[] = [];
  const starterSlug = getStarterPlaylistSlug().toLowerCase();
  const normalizedSlug = slug.trim().toLowerCase();
  const indexableSlugs = new Set(getIndexablePlaylistSlugs().map((entry) => entry.trim().toLowerCase()));
  const examplesHubSlug = getExamplesHubPlaylistSlug().toLowerCase();

  if (normalizedSlug === starterSlug) {
    targets.push('starter-tab');
  }
  if (normalizedSlug === examplesHubSlug || indexableSlugs.has(normalizedSlug)) {
    targets.push('examples-hub');
  }
  if (normalizedSlug.startsWith('family-')) {
    const familyId = normalizedSlug.slice('family-'.length);
    if (familyId) {
      targets.push(`family-page:${familyId}`);
    }
  }
  if (normalizedSlug.startsWith('examples-')) {
    const modelSlug = normalizedSlug.slice('examples-'.length);
    if (modelSlug) {
      targets.push(`model-page:${modelSlug}`);
      const familyId = resolveExampleFamilyId(modelSlug);
      if (familyId) {
        targets.push(`family-fallback:${familyId}`);
      }
    }
  }

  return targets;
}

export function isLockedPlaylistSlug(slug: string): boolean {
  const normalizedSlug = slug.trim().toLowerCase();
  if (!normalizedSlug) return false;
  if (normalizedSlug === getStarterPlaylistSlug().toLowerCase()) {
    return true;
  }
  if (getIndexablePlaylistSlugs().some((entry) => entry.trim().toLowerCase() === normalizedSlug)) {
    return true;
  }
  if (normalizedSlug === getExamplesHubPlaylistSlug().toLowerCase()) {
    return true;
  }
  return normalizedSlug.startsWith('examples-') || normalizedSlug.startsWith('family-');
}

export function derivePlaylistRuntimeMeta(slug: string, itemCount: number) {
  const normalizedSlug = slug.trim().toLowerCase();
  const starterSlug = getStarterPlaylistSlug().toLowerCase();
  const examplesHubSlug = getExamplesHubPlaylistSlug().toLowerCase();

  if (normalizedSlug === starterSlug) {
    return {
      kind: 'core' as PlaylistKind,
      surfaceRole: 'starter' as PlaylistSurfaceRole,
      surfaceStatus: itemCount > 0 ? ('ready' as PlaylistSurfaceStatus) : ('empty' as PlaylistSurfaceStatus),
      familyId: null,
      modelSlug: null,
      helperText: 'Feeds guest starter mode in the workspace.',
      drivesRoute: '/app?tab=starter',
      fallbackModelSlugs: [] as string[],
    };
  }

  if (normalizedSlug === examplesHubSlug) {
    return {
      kind: 'core' as PlaylistKind,
      surfaceRole: 'examplesHub' as PlaylistSurfaceRole,
      surfaceStatus: itemCount > 0 ? ('ready' as PlaylistSurfaceStatus) : ('empty' as PlaylistSurfaceStatus),
      familyId: null,
      modelSlug: null,
      helperText: 'Feeds the main examples page.',
      drivesRoute: '/examples',
      fallbackModelSlugs: [] as string[],
    };
  }

  if (normalizedSlug.startsWith('family-')) {
    const familyId = normalizedSlug.slice('family-'.length);
    const descriptor = getExampleFamilyDescriptor(familyId);
    const fallbackModelSlugs = getExampleFamilyModelSlugs(familyId);
    const fallbackSources = fallbackModelSlugs.map(getModelPlaylistSlug);
    const fallbackSummary = fallbackSources.length
      ? `${fallbackSources.join(', ')} then ${examplesHubSlug}`
      : examplesHubSlug;
    return {
      kind: 'model' as PlaylistKind,
      surfaceRole: 'family' as PlaylistSurfaceRole,
      surfaceStatus: itemCount > 0 ? ('ready' as PlaylistSurfaceStatus) : ('empty' as PlaylistSurfaceStatus),
      familyId: descriptor?.id ?? familyId ?? null,
      modelSlug: null,
      helperText: descriptor
        ? `Drives /examples/${descriptor.id}. Falls back to ${fallbackSummary}.`
        : `Drives /examples/${familyId}. Falls back to ${fallbackSummary}.`,
      drivesRoute: familyId ? `/examples/${familyId}` : null,
      fallbackModelSlugs,
    };
  }

  if (normalizedSlug.startsWith('examples-')) {
    const modelSlug = normalizedSlug.slice('examples-'.length);
    const familyId = resolveExampleFamilyId(modelSlug);
    return {
      kind: itemCount > 0 ? ('model' as PlaylistKind) : ('draft' as PlaylistKind),
      surfaceRole: 'model' as PlaylistSurfaceRole,
      surfaceStatus: itemCount > 0 ? ('ready' as PlaylistSurfaceStatus) : ('empty' as PlaylistSurfaceStatus),
      familyId,
      modelSlug,
      helperText: familyId
        ? `Feeds /models/${modelSlug} and contributes to /examples/${familyId} fallback.`
        : `Feeds /models/${modelSlug}.`,
      drivesRoute: modelSlug ? `/models/${modelSlug}` : null,
      fallbackModelSlugs: [],
    };
  }

  if (!itemCount) {
    return {
      kind: 'draft' as PlaylistKind,
      surfaceRole: 'draft' as PlaylistSurfaceRole,
      surfaceStatus: 'empty' as PlaylistSurfaceStatus,
      familyId: null,
      modelSlug: null,
      helperText: 'Draft or empty collection.',
      drivesRoute: null,
      fallbackModelSlugs: [] as string[],
    };
  }

  return {
    kind: 'model' as PlaylistKind,
    surfaceRole: 'other' as PlaylistSurfaceRole,
    surfaceStatus: 'other' as PlaylistSurfaceStatus,
    familyId: null,
    modelSlug: null,
    helperText: 'General-purpose collection.',
    drivesRoute: null,
    fallbackModelSlugs: [] as string[],
  };
}

export function getPlaylistPriority(playlist: Pick<PlaylistRecord, 'surfaceRole' | 'usageTargets'>): number {
  if (playlist.surfaceRole === 'starter') {
    return 0;
  }
  if (playlist.surfaceRole === 'examplesHub') {
    return 1;
  }
  if (playlist.surfaceRole === 'family') {
    return 2;
  }
  if (playlist.surfaceRole === 'model') {
    return 3;
  }
  if (playlist.surfaceRole === 'other') {
    return 4;
  }
  return 5;
}

export function comparePlaylists(a: PlaylistRecord, b: PlaylistRecord) {
  const kindWeight: Record<PlaylistKind, number> = { core: 0, model: 1, draft: 2 };
  if (kindWeight[a.kind] !== kindWeight[b.kind]) {
    return kindWeight[a.kind] - kindWeight[b.kind];
  }
  const priorityDelta = getPlaylistPriority(a) - getPlaylistPriority(b);
  if (priorityDelta !== 0) {
    return priorityDelta;
  }
  if (a.itemCount !== b.itemCount) {
    return b.itemCount - a.itemCount;
  }
  const lastAddedDelta = compareDatesDescending(a.lastAddedAt, b.lastAddedAt);
  if (lastAddedDelta !== 0) {
    return lastAddedDelta;
  }
  return a.name.localeCompare(b.name) || a.slug.localeCompare(b.slug);
}
