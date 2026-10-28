export type VideoBackgroundClip = {
  src: string;
  poster: string;
  width: number;
  height: number;
  durationSec: number;
};

export type VideoBackgroundMedia = { source: VideoBackgroundClip; result: VideoBackgroundClip };

// Activate only after permission and byte/HTTP verification of the exact site copies.
export const PUBLISHED_VIDEO_BACKGROUND_MEDIA: VideoBackgroundMedia | null = null;
