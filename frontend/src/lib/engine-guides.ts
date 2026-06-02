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
      'Sora 2 Pro unlocks 1080p renders, synced dialogue, and image-to-video control for top-tier productions.',
    badges: ['1080p', 'Audio native', 'Lip-sync'],
  },
  'veo-3-1': {
    description:
      'Veo 3.1 now handles prompts, single-image animation, multi-reference guidance, first/last bridging, and clip extension in one engine.',
    badges: ['Text prompts', 'Reference mode', 'Audio native'],
  },
  'veo-3-1-fast': {
    description:
      'Veo 3.1 Fast now handles quick prompts, image-to-video, 8s reference mode with 1-4 stills, first/last transitions, and extend runs with optional audio.',
    badges: ['Text prompts', 'Reference mode', 'Audio option'],
  },
  'veo-3-1-lite': {
    description:
      'Veo 3.1 Lite keeps the same unified Veo flow for prompts, start-image animation, and first/last transitions at a lower cost with audio always on.',
    badges: ['Text prompts', 'First/Last', 'Audio always on'],
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
  'kling-3-pro': {
    description:
      'Kling 3 Pro adds multi-prompt sequencing, start-frame animation, Kling Elements, and native audio for long-form cinematic shots.',
    badges: ['Multi-prompt', 'Start frame', 'Audio native'],
  },
  'kling-3-standard': {
    description:
      'Kling 3 Standard brings multi-prompt sequencing and start-frame image-to-video at a lower per-second rate.',
    badges: ['Multi-prompt', 'Start frame', 'Audio native'],
  },
  'kling-o3-standard': {
    description:
      'Kling 3.0 Omni Standard uses reference images, storyboard inputs, and source-video V2V without forcing the first upload to become the opening frame.',
    badges: ['Reference mode', 'V2V', 'Audio native'],
  },
  'kling-o3-pro': {
    description:
      'Kling 3.0 Omni Pro is the reference-guided Kling route for storyboard, source-video V2V, style, character, and object inputs.',
    badges: ['Reference mode', 'Source video', 'V2V'],
  },
  'kling-o3-4k': {
    description:
      'Kling 3.0 Omni 4K brings reference-guided Kling generation to native 4K delivery renders, without source-video V2V in the current route.',
    badges: ['Reference mode', 'Native 4K', 'No V2V'],
  },
  'seedance-1-5-pro': {
    description:
      'Seedance 1.5 Pro delivers cinematic motion with camera lock, flexible aspect ratios, and native audio.',
    badges: ['Camera lock', 'Audio native', 'Aspect ratio control'],
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
