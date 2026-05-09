import compareConfig from '@/config/compare-config.json';
import engineCatalog from '@/config/engine-catalog.json';
import type { LocalizedLinkHref } from '@/i18n/navigation';
import type { Mode } from '@/types/engines';
import type { BestForPageConfig, EngineCatalogEntry, HomepageExampleFamily } from './types';

export const EXAMPLE_ENGINE_PRIORITY = [
  'seedance-2-0',
  'kling-3-pro',
  'veo-3-1',
  'veo-3-1-lite',
  'ltx-2-3-pro',
  'happy-horse-1-0',
  'pika-text-to-video',
  'sora-2',
  'ltx-2-3-fast',
  'wan-2-6',
  'kling-3-standard',
] as const;

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

export type HeroEngineId = 'seedance-2-0' | 'kling-3-pro' | 'veo-3-1-lite' | 'ltx-2-3-pro' | 'happy-horse-1-0';

export const HERO_VIDEO_CHIPS: Record<string, string[]> = {
  'kling-3-pro': ['Cinematic', 'Camera move'],
  'seedance-2-0': ['Cinematic', 'Realism'],
  'veo-3-1-lite': ['Realistic', 'Premium'],
  'ltx-2-3-pro': ['Audio', 'Retake'],
  'happy-horse-1-0': ['Lip-sync', 'Unified'],
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
  'kling-3-pro': { name: 'Kling 3 Pro', exampleFamily: 'kling', modelSlug: 'kling-3-pro', mode: 'i2v' },
  'seedance-2-0': { name: 'Seedance 2.0', exampleFamily: 'seedance', modelSlug: 'seedance-2-0', mode: 'i2v' },
  'veo-3-1-lite': { name: 'Veo 3.1 Lite', exampleFamily: 'veo', modelSlug: 'veo-3-1-lite', mode: 'i2v' },
  'ltx-2-3-pro': { name: 'LTX 2.3 Pro', exampleFamily: 'ltx', modelSlug: 'ltx-2-3-pro', mode: 'a2v' },
  'happy-horse-1-0': { name: 'Happy Horse 1.0', exampleFamily: 'happy-horse', modelSlug: 'happy-horse-1-0', mode: 'ref2v' },
};

export const DEFAULT_MODEL_BY_EXAMPLE_FAMILY: Record<HomepageExampleFamily, string> = {
  seedance: 'seedance-2-0',
  kling: 'kling-3-pro',
  ltx: 'ltx-2-3-pro',
  veo: 'veo-3-1',
  wan: 'wan-2-6',
  'happy-horse': 'happy-horse-1-0',
};

export const HOMEPAGE_EXAMPLE_VIDEO_OVERRIDES: Partial<Record<string, { videoId?: string; imageSrc?: string }>> = {
  'veo-3-1': {
    videoId: 'job_c36e082d-cd1d-4a25-9f17-02246a878eb9',
  },
  'wan-2-6': {
    videoId: 'job_110f0282-bf5e-4d58-ab34-8b117c94d4e4',
  },
  'happy-horse-1-0': {
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
  'happy-horse-1-0': 'ref2v',
};
