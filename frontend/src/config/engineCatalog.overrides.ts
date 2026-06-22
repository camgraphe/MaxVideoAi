export type EngineCatalogFeature = {
  value?: boolean;
  note?: string;
};

export type EngineCatalogOverride = {
  marketingName?: string;
  versionLabel?: string;
  bestFor?: string;
  features?: Record<string, EngineCatalogFeature>;
  notes?: Record<string, string>;
};

export function getEngineCatalogOverrides(): Record<string, EngineCatalogOverride> {
  return {
    'sora-2': {
      bestFor: 'Cinematic shots',
    },
    'sora-2-pro': {
      bestFor: 'Studio-grade Sora renders',
    },
    'veo-3-1': {
      bestFor: 'Ads and B-roll',
      features: {
        lipsync: { value: true },
      },
    },
    'veo-3-1-fast': {
      bestFor: 'Fast iterations',
      features: {
        lipsync: { value: true },
      },
    },
    'veo-3-1-lite': {
      bestFor: 'Budget Veo drafts',
      features: {
        lipsync: { value: true },
      },
    },
    lumaRay2: {
      bestFor: 'Legacy Luma Generate, Modify and Reframe coverage',
    },
    lumaRay2_flash: {
      bestFor: 'Legacy fast Luma drafts with Modify and Reframe',
    },
    'kling-2-6-pro': {
      bestFor: 'Cinematic dialogue',
    },
    'kling-3-pro': {
      bestFor: 'Multi-shot cinematic control',
    },
    'kling-3-standard': {
      bestFor: 'Start-frame testing at lower cost',
    },
    'kling-o3-pro': {
      bestFor: 'Reference-guided storyboard video',
    },
    'kling-o3-standard': {
      bestFor: 'Lower-cost reference-guided drafts',
    },
    'kling-o3-4k': {
      bestFor: '4K reference-guided delivery',
    },
    'seedance-1-5-pro': {
      bestFor: 'Cinematic motion with camera lock',
    },
    'seedance-2-0': {
      bestFor: 'Flagship multi-shot video with native audio and references',
    },
    'seedance-2-0-fast': {
      bestFor: 'Fast Seedance drafts, reference tests, and shot planning',
    },
    'happy-horse-1-1': {
      bestFor: 'Alibaba native-audio text, image and reference video',
    },
    'happy-horse-1-0': {
      bestFor: 'Legacy Alibaba video edit route',
    },
    'wan-2-6': {
      bestFor: 'General purpose video',
    },
    'ltx-2': {
      bestFor: 'Premium product stories',
    },
    'ltx-2-fast': {
      bestFor: 'Rapid social clips',
    },
    'pika-text-to-video': {
      bestFor: 'Prompts or image loops',
    },
    'minimax-hailuo-02-text': {
      bestFor: 'Stylised text or image motion',
    },
    'nano-banana-2': {
      bestFor: 'Grounded stills and wide-format image edits',
    },
  };
}
