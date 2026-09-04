import compareConfig from '@/config/compare-config.json';
import engineCatalog from '@/config/engine-catalog.json';
import type { LocalizedLinkHref } from '@/i18n/navigation';
import type { Mode } from '@/types/engines';
import type { BestForPageConfig, EngineCatalogEntry, HomepageExampleFamily } from './types';

export const EXAMPLE_ENGINE_PRIORITY = [
  'ltx-2-5-pro',
  'wan-3-prime',
  'grok-imagine-video-1-5',
  'flux-3',
  'seedance-2-0',
  'kling-3-pro',
  'veo-3-1',
  'veo-3-1-lite',
  'happy-horse-1-1',
  'ltx-2-3-pro',
  'pika-text-to-video',
  'sora-2',
  'ltx-2-3-fast',
  'wan-2-6',
  'kling-3-standard',
] as const;

// Preserve the two established homepage consumers: the examples rail receives
// six ranked cards, while the hero projects the first five of that same list.
export const HOMEPAGE_EXAMPLE_CARD_LIMIT = 6;
export const HOMEPAGE_HERO_PREVIEW_LIMIT = 5;

export const BEST_FOR_MAIN_SLUGS = [
  'cinematic-realism',
  'image-to-video',
  'fast-drafts',
  'ads',
] as const;

export const BEST_FOR_PAGES = compareConfig.bestForPages as BestForPageConfig[];
export const BEST_FOR_BY_SLUG = new Map(BEST_FOR_PAGES.map((entry) => [entry.slug, entry]));
export const ENGINE_CATALOG = engineCatalog as EngineCatalogEntry[];
export const ENGINE_BY_MODEL_SLUG = new Map(ENGINE_CATALOG.map((entry) => [entry.modelSlug, entry]));

export const HOME_ROUTE_MAP = {
  app: '/app',
  imageApp: '/app/image',
  models: { pathname: '/models' },
  examples: { pathname: '/examples' },
  compare: { pathname: '/ai-video-engines' },
  pricing: { pathname: '/pricing' },
  tools: { pathname: '/tools' },
  characterBuilder: { pathname: '/tools/character-builder' },
  angleTool: { pathname: '/tools/angle' },
  upscaleTool: { pathname: '/tools/upscale' },
} satisfies Record<string, LocalizedLinkHref>;

export const SUCCESSFUL_GENERATION_PROOF_MINIMUM = 10_000;

export const PROVIDER_MODEL_LINKS: Partial<Record<string, LocalizedLinkHref>> = {
  Pika: { pathname: '/models/[slug]', params: { slug: 'pika-text-to-video' } },
  Alibaba: { pathname: '/examples/[model]', params: { model: 'happy-horse' } },
};

export type HeroEngineId = 'minimax-h3-max' | 'seedance-2-5' | 'wan-3' | 'kling-3-pro' | 'ltx-2-5-pro';

export const HERO_VIDEO_CHIPS: Record<string, string[]> = {
  'minimax-h3-max': ['Fast', 'Product motion'],
  'seedance-2-5': ['Cinematic', 'Multishot'],
  'wan-3': ['Camera control', 'Realism'],
  'kling-3-pro': ['Cinematic', 'Camera move'],
  'ltx-2-5-pro': ['Fast', 'Image control'],
};

export const HERO_ENGINE_TARGETS: Record<
  HeroEngineId,
  {
    name: string;
    exampleFamily?: HomepageExampleFamily;
    modelSlug: string;
    mode: Mode;
  }
> = {
  'minimax-h3-max': { name: 'MiniMax H3 Max', exampleFamily: 'hailuo', modelSlug: 'minimax-h3-max', mode: 't2v' },
  'seedance-2-5': { name: 'Seedance 2.5', exampleFamily: 'seedance', modelSlug: 'seedance-2-5', mode: 'ref2v' },
  'wan-3': { name: 'Wan 3', exampleFamily: 'wan', modelSlug: 'wan-3', mode: 'i2v' },
  'kling-3-pro': { name: 'Kling 3 Pro', exampleFamily: 'kling', modelSlug: 'kling-3-pro', mode: 't2v' },
  'ltx-2-5-pro': { name: 'LTX 2.5 Pro', exampleFamily: 'ltx', modelSlug: 'ltx-2-5-pro', mode: 'i2v' },
};

export const DEFAULT_MODEL_BY_EXAMPLE_FAMILY: Record<HomepageExampleFamily, string> = {
  seedance: 'seedance-2-0',
  kling: 'kling-3-pro',
  ltx: 'ltx-2-5-pro',
  veo: 'veo-3-1',
  hailuo: 'minimax-h3',
  'happy-horse': 'happy-horse-1-1',
  wan: 'wan-3-prime',
  grok: 'grok-imagine-video-1-5',
  flux: 'flux-3',
};

export const HOMEPAGE_EXAMPLE_VIDEO_OVERRIDES: Partial<Record<string, { videoId?: string; imageSrc?: string }>> = {
  'veo-3-1': {
    videoId: 'job_c36e082d-cd1d-4a25-9f17-02246a878eb9',
  },
  'wan-2-6': {
    videoId: 'job_110f0282-bf5e-4d58-ab34-8b117c94d4e4',
  },
  'happy-horse-1-1': {
    imageSrc:
      'https://media.maxvideoai.com/rendersthumbs/301cc489-d689-477f-94c4-0b051deda0bc/1212fdd0-0299-4e07-8546-c8fc0925432d.webp',
  },
};

export const ALLOWED_TOOL_CARD_IDS = new Set([
  'text-to-video',
  'image-to-video',
  'video-to-video',
  'generate-image',
  'character-builder',
  'angle-tool',
  'upscale',
  'compare-engines',
]);

export const FALLBACK_MODE_BY_ENGINE: Record<string, Mode> = {
  'minimax-h3-max': 't2v',
  'wan-3': 't2v',
  'wan-3-prime': 't2v',
  'ltx-2-5-fast': 't2v',
  'ltx-2-5-pro': 't2v',
  'grok-imagine-video-1-5': 't2v',
  'flux-3': 't2v',
  'flux-3-draft': 't2v',
  'sora-2': 't2v',
  'veo-3-1': 'i2v',
  'veo-3-1-lite': 'i2v',
  'kling-3-pro': 'i2v',
  'kling-3-standard': 't2v',
  'seedance-2-0': 'ref2v',
  'ltx-2-3-fast': 't2v',
  'ltx-2-3-pro': 'a2v',
  'wan-2-6': 'r2v',
  'pika-text-to-video': 't2v',
  'happy-horse-1-1': 'ref2v',
};
