export const QUICK_TOOL_ART = {
  'upscale-image': '/assets/tools/catalogue/upscale-image.webp',
  'upscale-video': '/assets/tools/catalogue/upscale-video.webp',
  'background-removal': '/assets/tools/catalogue/background-removal.webp',
  'restore-video': '/assets/tools/catalogue/restore-video.webp',
  denoise: '/assets/tools/catalogue/denoise.webp',
  'fix-blur': '/assets/tools/catalogue/fix-blur.webp',
  'smooth-motion': '/assets/tools/catalogue/smooth-motion.webp',
} as const;

export const WORKSHOP_ART = {
  'character-builder': '/assets/tools/catalogue/workshop-character-builder.webp',
  storyboard: '/assets/tools/catalogue/workshop-storyboard.webp',
  angle: '/assets/tools/catalogue/workshop-angle.webp',
} as const;

export type QuickToolArtId = keyof typeof QUICK_TOOL_ART;

export function isQuickToolArtId(value: string): value is QuickToolArtId {
  return value in QUICK_TOOL_ART;
}
