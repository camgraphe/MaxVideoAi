export type ExampleGalleryVideo = {
  id: string;
  href: string;
  engineLabel: string;
  engineIconId: string;
  engineBrandId?: string;
  priceLabel: string | null;
  prompt: string;
  promptFull?: string | null;
  aspectRatio: string | null;
  durationSec: number;
  hasAudio: boolean;
  heroPosterUrl?: string | null;
  optimizedPosterUrl?: string | null;
  rawPosterUrl?: string | null;
  videoUrl?: string | null;
  previewVideoUrl?: string | null;
  recreateHref?: string | null;
  modelHref?: string | null;
  sourceIndex?: number;
};

export type ExampleSort = 'playlist' | 'date-desc' | 'date-asc' | 'duration-asc' | 'duration-desc' | 'engine-asc';
