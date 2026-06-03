export type StoryboardFrameCount = 4 | 6 | 8;
export type StoryboardLengthPresetId = 'short' | 'medium' | 'long';
export type StoryboardOrientation = 'landscape' | 'portrait';
export type StoryboardTier = 'hd' | '4k' | 'ultra';

export type StoryboardLengthPreset = {
  id: StoryboardLengthPresetId;
  label: string;
  durationSec: 6 | 10 | 15;
  frameCount: StoryboardFrameCount;
  helper: string;
  templatePath: string;
};

export type StoryboardImageSize = {
  width: number;
  height: number;
};

export type StoryboardOutputConfig = {
  resolution: string;
  customImageSize: StoryboardImageSize | null;
  quality: 'medium' | 'high';
};

export const STORYBOARD_ORIENTATION_OPTIONS: StoryboardOrientation[] = ['landscape', 'portrait'];
export const STORYBOARD_TIER_OPTIONS: StoryboardTier[] = ['hd', '4k', 'ultra'];
export const STORYBOARD_PANEL_METADATA_FIELDS = ['Shot type', 'Camera', 'Action', 'Dialogue'] as const;
export const STORYBOARD_THUMBNAIL_ASPECT_LABELS: Record<StoryboardOrientation, string> = {
  landscape: '16:9',
  portrait: '9:16',
} as const;

export const STORYBOARD_TEMPLATE_SIZES: Record<StoryboardOrientation, StoryboardImageSize> = {
  landscape: {
    width: 1600,
    height: 1000,
  },
  portrait: {
    width: 1000,
    height: 1600,
  },
} as const;

export const STORYBOARD_OUTPUT_CONFIG: Record<StoryboardTier, Record<StoryboardOrientation, StoryboardOutputConfig>> = {
  hd: {
    landscape: {
      resolution: '1920x1080',
      customImageSize: null,
      quality: 'medium',
    },
    portrait: {
      resolution: 'custom',
      customImageSize: { width: 1152, height: 2048 },
      quality: 'medium',
    },
  },
  '4k': {
    landscape: {
      resolution: '3840x2160',
      customImageSize: null,
      quality: 'medium',
    },
    portrait: {
      resolution: 'custom',
      customImageSize: { width: 2160, height: 3840 },
      quality: 'medium',
    },
  },
  ultra: {
    landscape: {
      resolution: '3840x2160',
      customImageSize: null,
      quality: 'high',
    },
    portrait: {
      resolution: 'custom',
      customImageSize: { width: 2160, height: 3840 },
      quality: 'high',
    },
  },
} as const;

export const STORYBOARD_EDIT_OUTPUT_CONFIG: StoryboardOutputConfig = {
  resolution: 'auto',
  customImageSize: null,
  quality: 'medium',
} as const;

export const STORYBOARD_LENGTH_PRESETS: StoryboardLengthPreset[] = [
  {
    id: 'short',
    label: 'Short',
    durationSec: 6,
    frameCount: 4,
    helper: '6s · 4 shots',
    templatePath: '/storyboard/templates/storyboard-template-4.png',
  },
  {
    id: 'medium',
    label: 'Medium',
    durationSec: 10,
    frameCount: 6,
    helper: '10s · 6 shots',
    templatePath: '/storyboard/templates/storyboard-template-6.png',
  },
  {
    id: 'long',
    label: 'Long',
    durationSec: 15,
    frameCount: 8,
    helper: '15s · 8 shots',
    templatePath: '/storyboard/templates/storyboard-template-8.png',
  },
];

export function normalizeStoryboardFrameCount(frameCount: number): StoryboardFrameCount {
  if (frameCount === 4 || frameCount === 6 || frameCount === 8) return frameCount;
  if (frameCount < 6) return 4;
  if (frameCount > 6) return 8;
  return 6;
}

export function getStoryboardLengthPreset(presetId: StoryboardLengthPresetId): StoryboardLengthPreset {
  return STORYBOARD_LENGTH_PRESETS.find((preset) => preset.id === presetId) ?? STORYBOARD_LENGTH_PRESETS[1];
}

export function getStoryboardOutputConfig(
  tier: StoryboardTier,
  orientation: StoryboardOrientation
): StoryboardOutputConfig {
  return STORYBOARD_OUTPUT_CONFIG[tier]?.[orientation] ?? STORYBOARD_OUTPUT_CONFIG.hd.landscape;
}

export function getStoryboardEditOutputConfig(): StoryboardOutputConfig {
  return STORYBOARD_EDIT_OUTPUT_CONFIG;
}

export function getStoryboardTemplatePath(frameCount: number, orientation: StoryboardOrientation = 'landscape'): string {
  const normalizedFrameCount = normalizeStoryboardFrameCount(frameCount);
  const orientationSegment = orientation === 'portrait' ? '-portrait' : '';

  return `/storyboard/templates/storyboard-template${orientationSegment}-${normalizedFrameCount}.png`;
}

export function getAbsoluteStoryboardTemplateUrl(
  frameCount: number,
  orientation: StoryboardOrientation,
  origin: string
): string {
  return new URL(getStoryboardTemplatePath(frameCount, orientation), origin).toString();
}
