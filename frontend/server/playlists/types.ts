export type PlaylistKind = 'core' | 'model' | 'draft';
export type PlaylistSurfaceRole = 'starter' | 'examplesHub' | 'family' | 'model' | 'draft' | 'other';
export type PlaylistSurfaceStatus = 'ready' | 'missing' | 'empty' | 'other';

export type PlaylistRecord = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
  siteVisibleCount: number;
  withVideoAssetCount: number;
  lastAddedAt: string | null;
  kind: PlaylistKind;
  isLocked: boolean;
  usageTargets: string[];
  surfaceRole: PlaylistSurfaceRole;
  surfaceStatus: PlaylistSurfaceStatus;
  familyId: string | null;
  modelSlug: string | null;
  helperText: string | null;
  drivesRoute: string | null;
  fallbackModelSlugs: string[];
};

export type PlaylistItemRecord = {
  playlistId: string;
  videoId: string;
  orderIndex: number;
  pinned: boolean;
  createdAt: string;
  thumbUrl?: string | null;
  videoUrl?: string | null;
  engineLabel?: string | null;
  aspectRatio?: string | null;
  prompt?: string | null;
  durationSec?: number | null;
  visibility: 'public' | 'private';
  indexable: boolean;
  isPublishedOnSite: boolean;
};

export type PlaylistCandidateRecord = {
  id: string;
  engineId: string | null;
  engineLabel: string | null;
  prompt: string;
  createdAt: string;
  thumbUrl: string | null;
  videoUrl: string | null;
  aspectRatio: string | null;
};

export type MutablePlaylistFields = Partial<{
  slug: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  userId: string | null;
}>;

export type PlaylistDestination = {
  id: string;
  kind: 'examples' | 'starter' | 'family' | 'model' | 'image' | 'audio' | 'maintenance';
  slug: string;
  playlistId: string | null;
  label: string;
  path: string | null;
  familyId: string | null;
  modelSlug: string | null;
  itemCount: number;
  publicCount: number;
  sourceSlugs: string[];
  status: 'connected' | 'missing' | 'historical' | 'unconnected';
  editable: boolean;
  warning: string | null;
};
