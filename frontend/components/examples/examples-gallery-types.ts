import type { Mode } from '@/types/engines';

export type ExampleGalleryVideo = {
  id: string;
  href: string;
  engineLabel: string;
  engineIconId: string;
  engineBrandId?: string;
  priceLabel: string | null;
  prompt: string;
  sourcePromptExcerpt?: string | null;
  promptFull?: string | null;
  aspectRatio: string | null;
  outputWidth?: number | null;
  outputHeight?: number | null;
  durationSec: number;
  generationMode?: Mode | null;
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
