interface PlaceholderMedia {
  videoUrl: string;
  posterUrl?: string;
  aspectRatio: '16:9' | '9:16' | '1:1' | string;
}

const PLACEHOLDER_VIDEOS: PlaceholderMedia[] = [
  { videoUrl: '/assets/gallery/adraga-beach.mp4', aspectRatio: '16:9' },
  { videoUrl: '/assets/gallery/aerial-road.mp4', aspectRatio: '16:9' },
  { videoUrl: '/assets/gallery/drone-snow.mp4', aspectRatio: '16:9' },
  { videoUrl: '/assets/gallery/robot-eyes.mp4', aspectRatio: '16:9' },
  { videoUrl: '/assets/gallery/robot-look.mp4', aspectRatio: '16:9' },
  { videoUrl: '/assets/gallery/swimmer.mp4', aspectRatio: '16:9' },
  { videoUrl: '/assets/gallery/parking-portrait.mp4', aspectRatio: '9:16' },
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

export function getPlaceholderMedia(seed?: string): PlaceholderMedia {
  if (PLACEHOLDER_VIDEOS.length === 0) {
    return {
      videoUrl: '',
      aspectRatio: '16:9',
    };
  }

  if (!seed) {
    return PLACEHOLDER_VIDEOS[0];
  }

  const index = Math.abs(hashString(seed)) % PLACEHOLDER_VIDEOS.length;
  return PLACEHOLDER_VIDEOS[index];
}

export function listPlaceholderMedia(): PlaceholderMedia[] {
  return PLACEHOLDER_VIDEOS.slice();
}
