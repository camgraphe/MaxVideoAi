import type { ExampleGalleryVideo } from '@/components/examples/examples-gallery-types';

export const BATCH_SIZE = 8;
export const DEFAULT_INITIAL_MOBILE_BATCH = 4;
export const DEFAULT_INITIAL_DESKTOP_BATCH = 8;
export const LANDSCAPE_SIZES = '(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 33vw';
export const PORTRAIT_SIZES = '(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 33vw';
export const DEFAULT_LANDSCAPE_RATIO = 16 / 9;
export const DEFAULT_LANDSCAPE_HEIGHT_PERCENT = 100 / DEFAULT_LANDSCAPE_RATIO;
export const TALL_CARD_MEDIA_PERCENT = Number((DEFAULT_LANDSCAPE_HEIGHT_PERCENT * 2).toFixed(3));

export function buildWatchAnchorText(locale: string, video: ExampleGalleryVideo): string {
  const ratio = video.aspectRatio ?? 'Auto';
  const duration = `${video.durationSec}s`;
  if (locale === 'fr') {
    return `Voir l'exemple video ${video.engineLabel} - ${video.prompt} - ${ratio} - ${duration}`;
  }
  if (locale === 'es') {
    return `Ver ejemplo de video ${video.engineLabel} - ${video.prompt} - ${ratio} - ${duration}`;
  }
  return `Watch ${video.engineLabel} video example - ${video.prompt} - ${ratio} - ${duration}`;
}

export function dedupeExamples(videos: ExampleGalleryVideo[]) {
  const seen = new Set<string>();
  const out: ExampleGalleryVideo[] = [];
  for (const video of videos) {
    if (seen.has(video.id)) continue;
    seen.add(video.id);
    out.push(video);
  }
  return out;
}

export function parseAspectRatio(aspect: string) {
  const [w, h] = aspect.split(':').map(Number);
  if (!Number.isFinite(w) || !Number.isFinite(h) || h === 0) return 16 / 9;
  return w / h;
}

export function estimateCardHeightWeight(aspectRatio: string | null) {
  const ratio = aspectRatio ? parseAspectRatio(aspectRatio) : DEFAULT_LANDSCAPE_RATIO;
  if (ratio < 0.9) return 1.8;
  if (ratio < 1.1) return 1;
  return 0.6;
}

export function splitIntoColumns(videos: ExampleGalleryVideo[], columnCount: number): ExampleGalleryVideo[][] {
  if (!videos.length) return [];
  const safeCount = Math.max(1, Math.floor(columnCount) || 1);
  const count = Math.min(safeCount, videos.length);
  const columns: ExampleGalleryVideo[][] = Array.from({ length: count }, () => []);
  const heights = Array.from({ length: count }, () => 0);

  for (const video of videos) {
    const targetHeight = Math.min(...heights);
    const targetIndex = heights.indexOf(targetHeight);
    columns[targetIndex].push(video);
    heights[targetIndex] += estimateCardHeightWeight(video.aspectRatio);
  }

  return columns;
}
