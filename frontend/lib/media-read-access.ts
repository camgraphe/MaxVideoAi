/** Response-only read grants. Canonical URL/ref identity must never use these fields. */
export type MediaReadAccess = {
  accessUrl?: string;
  thumbnailAccessUrl?: string;
  previewAccessUrl?: string;
  playbackAccessUrl?: string;
};
