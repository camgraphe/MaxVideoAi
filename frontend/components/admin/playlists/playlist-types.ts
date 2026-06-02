export type PlaylistKind = 'core' | 'model' | 'draft';
export type PlaylistSurfaceRole = 'starter' | 'examplesHub' | 'family' | 'model' | 'draft' | 'other';
export type PlaylistSurfaceStatus = 'ready' | 'missing' | 'empty' | 'other';
export type PlaylistGroup = 'runtime' | 'family' | 'model' | 'draft';

export type PlaylistSummary = {
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

export type PlaylistsManagerProps = {
  initialPlaylists: PlaylistSummary[];
  initialPlaylistId: string | null;
  initialItems: PlaylistItemRecord[];
  embedded?: boolean;
  className?: string;
};

export type EditablePlaylist = PlaylistSummary & { dirty?: boolean; loading?: boolean };
export type DropPlacement = 'before' | 'after';

export type FamilyPlaylistHelperCard = {
  familyId: string;
  label: string;
  slug: string;
  route: string;
  fallbackModelSlugs: string[];
  helperText: string;
  status: 'ready' | 'missing' | 'empty';
  playlistId: string | null;
};

export type ModelPlaylistHelperCard = {
  modelSlug: string;
  label: string;
  slug: string;
  route: string;
  familyId: string | null;
  familyLabel: string | null;
  familyRoute: string | null;
  helperText: string;
  status: 'ready' | 'missing' | 'empty';
  playlistId: string | null;
};
