import type { LibraryMediaReference } from './media-library-organization';
/** Response-only read grants. Canonical URL/ref identity must never use these fields. */
export type MediaReadAccess = {
  readAccessOwnerId?: string;
  readAccessRef?: LibraryMediaReference;
  readAccessRevision?: string;
  readAccessExpiresAt?: string;
  accessUrl?: string;
  thumbnailAccessUrl?: string;
  previewAccessUrl?: string;
  playbackAccessUrl?: string;
};
