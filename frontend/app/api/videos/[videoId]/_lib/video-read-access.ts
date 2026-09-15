type VideoVisibility = { visibility: string; userId: string | null };

/** Indexability is a search preference; it does not make a public share private. */
export function canReadVideo(video: VideoVisibility, viewerId: string | null): boolean {
  return video.visibility === 'public' || Boolean(viewerId && video.userId === viewerId);
}
