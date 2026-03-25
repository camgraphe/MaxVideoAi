export const EXAMPLES_HERO_SELECTION_LIMIT = 60;

export function pickFirstPlayableVideo<T extends { videoUrl?: string | null }>(videos: T[]): T | null {
  return videos.find((video) => Boolean(video.videoUrl)) ?? null;
}
