export type EngineGuideEntry = {
  description: string;
  badges: string[];
};

export const DEFAULT_ENGINE_GUIDE: Record<string, EngineGuideEntry> = {
  'pika-text-to-video': {
    description:
      'Pika 2.2 handles stylized prompts or uploaded stills in one card — perfect for quick loops and product explainers.',
    badges: ['Text prompts', 'Image input', 'Fast queue'],
  },
  'sora-2': {
    description: 'OpenAI Sora 2 handles cinematic narratives with lip-sync and audio - ideal for hero renders.',
    badges: ['Audio native', 'Cinematic', 'Remix'],
  },
  'sora-2-pro': {
    description:
      'Sora 2 Pro unlocks higher resolutions, synced dialogue, and image-to-video control for top-tier productions.',
    badges: ['1080p', 'Audio native', 'Lip-sync'],
  },
  'veo-3-1': {
    description:
      'Veo 3.1 now handles direct prompts or reference stills. Swap between text-to-video and image-to-video without leaving the queue.',
    badges: ['Text prompts', 'Multi reference', 'Audio native'],
  },
  'veo-3-1-fast': {
    description:
      'Veo 3.1 Fast now handles quick text prompts or single-image animations with optional audio.',
    badges: ['Text prompts', 'Image-to-video', 'Audio option'],
  },
  'veo-3-1-first-last': {
    description:
      'Upload first and last frames, describe the bridge, and toggle between Veo 3.1 and Veo 3.1 Fast for the transition.',
    badges: ['Two frames', 'Audio option', 'Standard & Fast'],
  },
  'minimax-hailuo-02-text': {
    description:
      'Hailuo 02 Standard handles stylized text prompts or animated reference stills with prompt optimiser support.',
    badges: ['Prompt optimiser', 'Image input', '6–10s silent'],
  },
  'kling-2-5-turbo': {
    description:
      'Kling 2.5 Turbo lives in one card with Pro text, Pro image, and Standard image-to-video modes for cinematic shots or budget loops.',
    badges: ['Text prompts', 'Image-to-video', 'Standard tier'],
  },
  'wan-2-5': {
    description:
      'Wan 2.5 handles 5 or 10 second clips with optional background audio plus prompt expansion when you need extra detail.',
    badges: ['Audio option', '5s or 10s', '480p–1080p'],
  },
  'wan-2-6': {
    description:
      'Wan 2.6 merges text, image, and reference-to-video in one card with multi-shot prompting and 720p/1080p tiers.',
    badges: ['Text prompts', 'Image input', 'Reference video'],
  },
};
