export type PlaylistOption = {
  id: string;
  name: string;
  slug: string;
  usageTargets?: string[];
};

export type PlaylistTag = {
  id: string;
  name: string;
};

export type PublicationState = 'published' | 'private' | 'legacy-mismatch';
export type ModerationBucket = 'not-published' | 'published' | 'all';
export type ModerationSurface = 'video' | 'image' | 'audio' | 'character' | 'angle';
export type ModerationViewMode = 'wall' | 'table';

export type ModerationVideo = {
  id: string;
  userId: string | null;
  status?: string | null;
  message?: string;
  updatedAt?: string;
  engineId: string;
  engineLabel: string;
  durationSec: number;
  prompt: string;
  thumbUrl?: string;
  videoUrl?: string;
  aspectRatio?: string;
  createdAt: string;
  visibility: 'public' | 'private';
  indexable: boolean;
  featured?: boolean;
  assignedPlaylists?: PlaylistTag[];
  seoWatch: boolean;
  publicationState: PublicationState;
  isPublishedOnSite: boolean;
  hasLegacyMismatch: boolean;
};
