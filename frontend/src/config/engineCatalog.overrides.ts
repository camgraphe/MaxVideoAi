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
    },
    'veo-3-1-fast': {
      bestFor: 'Fast iterations',
    },
    'kling-2-6-pro': {
      bestFor: 'Cinematic dialogue',
    },
    'kling-3-pro': {
      bestFor: 'Multi-shot cinematic control',
    },
    'kling-3-standard': {
      bestFor: 'Multi-shot testing at lower cost',
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
  };
}
