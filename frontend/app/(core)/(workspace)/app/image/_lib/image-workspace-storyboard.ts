export const IMAGE_STORYBOARD_PRESET = {
  tool: 'storyboard',
  engineId: 'gpt-image-2',
  mode: 't2i',
  librarySource: 'storyboard',
  prompt:
    'Create a clean 6-panel storyboard reference image for an image-to-video workflow. Use simple cinematic framing, clear shot progression, consistent visual style, and readable composition notes inside each panel. This storyboard should work as a reference image for Seedance 2 or Kling. For Seedance 2, use no real people and focus on film scenes without identifiable actors, product shots, cooking sequences, animation, objects, places, or stylized characters. If the final video needs real people, prepare the board for Kling instead. Include wide, medium, close-up, motion, detail, and final hero frame panels.',
} as const;

export type ImageStoryboardLibrarySource = typeof IMAGE_STORYBOARD_PRESET.librarySource;
