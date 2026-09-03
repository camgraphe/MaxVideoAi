import type { LocalizedLinkHref } from '@/i18n/navigation';
import mcpPublication from '@/config/mcp-publication.json';
import { getModelFamilyDefinition } from '@/config/model-families';
import { listRuntimeModels, type RuntimeModelEntry } from '@/config/model-runtime';
import { orderExamplesHubFamilyIds } from '@/lib/examples/familyOrder';
import { buildPublishedComparisonSlugsFromModels } from '@/lib/compare-hub/data';
import { getExampleNavFamilyIds } from '@/lib/model-families';
import { getMcpPublicationState } from '@/lib/mcp-publication';

export type MarketingNavItem = {
  key: string;
  label: string;
  href: LocalizedLinkHref;
  emphasized?: boolean;
  badge?: 'new';
};

export type MarketingNavSection = {
  key: string;
  titleKey?: string;
  titleFallback?: string;
  hideTitle?: boolean;
  items: MarketingNavItem[];
};

export type MarketingNavDropdown = {
  items: MarketingNavItem[];
  sections?: MarketingNavSection[];
  desktopColumns?: 1 | 2;
  allHref: LocalizedLinkHref;
  allLabelKey: string;
  allLabelFallback: string;
};

export type MarketingTopNavKey = 'models' | 'examples' | 'tools' | 'compare' | 'pricing' | 'blog';

export type MarketingTopNavLink = {
  key: MarketingTopNavKey;
  href: string;
};

export const MARKETING_TOP_NAV_LINKS: readonly MarketingTopNavLink[] = [
  { key: 'models', href: '/models' },
  { key: 'examples', href: '/examples' },
  { key: 'compare', href: '/ai-video-engines' },
  { key: 'tools', href: '/tools' },
  { key: 'pricing', href: '/pricing' },
  { key: 'blog', href: '/blog' },
] as const;

type LabeledSlug = { slug: string; label: string; badge?: MarketingNavItem['badge'] };

const modelLink = (slug: string): LocalizedLinkHref => ({
  pathname: '/models/[slug]',
  params: { slug },
});

const exampleLink = (slug: string): LocalizedLinkHref => ({
  pathname: '/examples/[model]',
  params: { model: slug },
});

const compareLink = (slug: string): LocalizedLinkHref => ({
  pathname: '/ai-video-engines/[slug]',
  params: { slug },
});

const bestForLink = (usecase?: string): LocalizedLinkHref =>
  usecase
    ? {
        pathname: '/ai-video-engines/best-for/[usecase]',
        params: { usecase },
      }
    : {
        pathname: '/ai-video-engines/best-for',
      };

const toolLink = (slug: 'character-builder' | 'angle' | 'upscale' | 'background-removal'): LocalizedLinkHref => ({
  pathname: `/tools/${slug}`,
});

const blogLink = (slug: string): LocalizedLinkHref => ({
  pathname: '/blog/[slug]',
  params: { slug },
});

const docLink = (slug: string): LocalizedLinkHref => ({
  pathname: '/docs/[slug]',
  params: { slug },
});

const BASE_MODEL_MENU_CANDIDATES: readonly LabeledSlug[] = [
  { slug: 'seedance-2-5', label: 'Seedance 2.5', badge: 'new' },
  { slug: 'minimax-h3', label: 'MiniMax H3', badge: 'new' },
  { slug: 'ltx-2-5-pro', label: 'LTX 2.5 Pro' },
  { slug: 'wan-3', label: 'Wan 3', badge: 'new' },
  { slug: 'wan-3-prime', label: 'Wan 3 Prime', badge: 'new' },
  { slug: 'grok-imagine-video-1-5', label: 'Grok Imagine Video 1.5' },
  { slug: 'flux-3', label: 'FLUX 3' },
  { slug: 'seedance-2-0', label: 'Seedance 2.0' },
  { slug: 'veo-3-1', label: 'Veo 3.1' },
  { slug: 'gemini-omni-flash', label: 'Gemini Omni Flash 1.1' },
  { slug: 'kling-o3-pro', label: 'Kling 3.0 Omni Pro' },
  { slug: 'kling-o3-4k', label: 'Kling 3.0 Omni 4K' },
  { slug: 'seedance-2-0-fast', label: 'Seedance 2.0 Fast' },
  { slug: 'ltx-2-3-fast', label: 'LTX 2.3 Fast' },
  { slug: 'veo-3-1-lite', label: 'Veo 3.1 Lite' },
] as const;

const P1_MODEL_MENU_CANDIDATES: readonly LabeledSlug[] = [
  { slug: 'seedance-2-5', label: 'Seedance 2.5', badge: 'new' },
  { slug: 'minimax-h3', label: 'MiniMax H3', badge: 'new' },
  { slug: 'minimax-h3-max', label: 'MiniMax H3 Max', badge: 'new' },
  { slug: 'kling-3-turbo-pro', label: 'Kling 3.0 Turbo Pro' },
  { slug: 'kling-3-turbo-standard', label: 'Kling 3.0 Turbo Standard' },
  { slug: 'veo-3-1', label: 'Veo 3.1' },
  { slug: 'gemini-omni-flash', label: 'Gemini Omni Flash 1.1' },
  { slug: 'ltx-2-5-pro', label: 'LTX 2.5 Pro' },
  { slug: 'wan-3', label: 'Wan 3', badge: 'new' },
  { slug: 'wan-3-prime', label: 'Wan 3 Prime', badge: 'new' },
  { slug: 'grok-imagine-video-1-5', label: 'Grok Imagine Video 1.5' },
  { slug: 'flux-3', label: 'FLUX 3' },
  { slug: 'seedance-2-0', label: 'Seedance 2.0' },
  { slug: 'kling-o3-pro', label: 'Kling 3.0 Omni Pro' },
] as const;

const P1_NEW_MODEL_SLUGS = [
  'minimax-h3-max',
  'kling-3-turbo-pro',
  'kling-3-turbo-standard',
] as const;

export function buildMarketingModelMenu(models: readonly RuntimeModelEntry[]): LabeledSlug[] {
  const bySlug = new Map(models.map((model) => [model.slug, model]));
  const byId = new Map(models.map((model) => [model.id, model]));
  const p1Published = P1_NEW_MODEL_SLUGS.every(
    (slug) => bySlug.get(slug)?.publication.model.published === true,
  );
  const candidates = p1Published ? P1_MODEL_MENU_CANDIDATES : BASE_MODEL_MENU_CANDIDATES;

  return candidates.filter(({ slug }) => {
    const model = bySlug.get(slug);
    if (!model?.publication.model.published || model.lifecycle === 'retired') return false;
    if (model.lifecycle !== 'legacy' || !model.successorId) return true;
    return byId.get(model.successorId)?.publication.model.published !== true;
  }).slice(0, 11);
}

const MODEL_MENU = buildMarketingModelMenu(listRuntimeModels());

const AVAILABLE_EXAMPLE_FAMILY_IDS = getExampleNavFamilyIds();

const EXAMPLES_MENU: LabeledSlug[] = orderExamplesHubFamilyIds(AVAILABLE_EXAMPLE_FAMILY_IDS)
  .map((familyId) => getModelFamilyDefinition(familyId))
  .filter((family): family is NonNullable<typeof family> => Boolean(family))
  .map((family) => ({
    slug: family.id,
    label: family.label,
  }));

const FOOTER_EXAMPLES_MENU: LabeledSlug[] = [...EXAMPLES_MENU];

const P1_COMPARE_MENU: LabeledSlug[] = [
  {
    slug: 'minimax-h3-vs-minimax-h3-max',
    label: 'MiniMax H3 vs H3 Max',
  },
  {
    slug: 'kling-3-turbo-pro-vs-kling-3-turbo-standard',
    label: 'Kling 3 Turbo Pro vs Standard',
  },
  {
    slug: 'kling-3-pro-vs-kling-3-turbo-pro',
    label: 'Kling 3 Pro vs Turbo Pro',
  },
  {
    slug: 'gemini-omni-flash-vs-kling-3-turbo-pro',
    label: 'Gemini Omni Flash 1.1 vs Kling 3 Turbo Pro',
  },
  {
    slug: 'gemini-omni-flash-vs-veo-3-1',
    label: 'Gemini Omni Flash 1.1 vs Veo 3.1',
  },
];

const COMPARE_MENU: LabeledSlug[] = [
  {
    slug: 'minimax-h3-vs-seedance-2-5',
    label: 'MiniMax H3 vs Seedance 2.5',
  },
  {
    slug: 'ltx-2-3-pro-vs-ltx-2-5-pro',
    label: 'LTX 2.3 Pro vs LTX 2.5 Pro',
  },
  { slug: 'wan-2-6-vs-wan-3', label: 'Wan 2.6 vs Wan 3' },
  { slug: 'flux-3-vs-grok-imagine-video-1-5', label: 'FLUX 3 vs Grok Imagine Video 1.5' },
  { slug: 'grok-imagine-video-1-5-vs-sora-2', label: 'Grok Imagine Video 1.5 vs Sora 2' },
  { slug: 'kling-o3-pro-vs-minimax-h3', label: 'Kling 3.0 Omni Pro vs MiniMax H3' },
  { slug: 'gemini-omni-flash-vs-veo-3-1', label: 'Gemini Omni Flash 1.1 vs Veo 3.1' },
  { slug: 'kling-3-pro-vs-kling-o3-pro', label: 'Kling 3 Pro vs Kling 3.0 Omni Pro' },
  { slug: 'ltx-2-3-pro-vs-veo-3-1', label: 'LTX 2.3 Pro vs Veo 3.1' },
  { slug: 'minimax-h3-vs-veo-3-1', label: 'MiniMax H3 vs Veo 3.1' },
];

const BEST_FOR_USE_CASES: Array<LabeledSlug & { key: string }> = [
  { key: 'cinematic-realism', slug: 'cinematic-realism', label: 'Cinematic realism' },
  { key: 'image-to-video', slug: 'image-to-video', label: 'Image-to-video' },
  { key: 'fast-drafts', slug: 'fast-drafts', label: 'Fast drafts' },
  { key: 'ads', slug: 'ads', label: 'Product ads' },
];

export const MARKETING_MODEL_SLUGS = MODEL_MENU.map((item) => item.slug);

export const MARKETING_NAV_MODELS: MarketingNavItem[] = MODEL_MENU.map((item) => ({
  key: item.slug,
  label: item.label,
  href: modelLink(item.slug),
  badge: item.badge,
}));

export const MARKETING_NAV_EXAMPLES: MarketingNavItem[] = EXAMPLES_MENU.map((item) => ({
  key: item.slug,
  label: item.label,
  href: exampleLink(item.slug),
}));

export const MARKETING_FOOTER_EXAMPLES: MarketingNavItem[] = FOOTER_EXAMPLES_MENU.map((item) => ({
  key: item.slug,
  label: item.label,
  href: exampleLink(item.slug),
}));

export function buildMarketingCompareMenu(models: readonly RuntimeModelEntry[]): LabeledSlug[] {
  const publishedSlugs = new Set(buildPublishedComparisonSlugsFromModels(models, () => true));
  return [...P1_COMPARE_MENU, ...COMPARE_MENU]
    .filter(({ slug }) => publishedSlugs.has(slug))
    .slice(0, 10);
}

export const MARKETING_NAV_COMPARE: MarketingNavItem[] = buildMarketingCompareMenu(listRuntimeModels()).map((item) => ({
  key: item.slug,
  label: item.label,
  href: compareLink(item.slug),
  badge: item.badge,
}));

export const MARKETING_NAV_BEST_FOR_USE_CASES: MarketingNavItem[] = BEST_FOR_USE_CASES.map((item) => ({
  key: item.key,
  label: item.label,
  href: bestForLink(item.slug),
}));

export const MARKETING_NAV_BEST_FOR_HUB: MarketingNavItem = {
  key: 'best-for',
  label: 'Best models by use case',
  href: bestForLink(),
};

const MARKETING_MODELS_USE_CASE_SECTION: MarketingNavSection = {
  key: 'useCaseGuides',
  hideTitle: true,
  items: [
    {
      key: 'all-use-case-guides',
      label: 'All use-case guides',
      href: bestForLink(),
      emphasized: true,
    },
    ...MARKETING_NAV_BEST_FOR_USE_CASES,
  ],
};

const MARKETING_COMPARE_DECISION_GUIDES_SECTION: MarketingNavSection = {
  key: 'useCaseGuides',
  hideTitle: true,
  items: [{ ...MARKETING_NAV_BEST_FOR_HUB, emphasized: true }, ...MARKETING_NAV_BEST_FOR_USE_CASES],
};

export const MARKETING_NAV_TOOLS: MarketingNavItem[] = [
  ...(getMcpPublicationState(mcpPublication).indexable
    ? [{ key: 'ai-video-assistant', label: 'Claude, ChatGPT & Codex video assistant', href: '/mcp' as const }]
    : []),
  { key: 'character-builder', label: 'Consistent Character AI', href: toolLink('character-builder') },
  { key: 'angle', label: 'Change Camera Angle', href: toolLink('angle') },
  { key: 'upscale', label: 'AI Upscale', href: toolLink('upscale') },
  { key: 'background-removal', label: 'Video Background Remover', href: toolLink('background-removal') },
  { key: 'image', label: 'Generate image', href: '/app/image' },
];

export const MARKETING_NAV_WORKFLOWS: MarketingNavItem[] = [
  { key: 'how', label: 'How it works', href: '/workflows#how-it-works' },
  { key: 'capabilities', label: 'What you can do', href: '/workflows#what-you-can-do' },
  { key: 'examples', label: 'Examples', href: '/workflows#examples' },
  { key: 'faq', label: 'FAQ', href: '/workflows#faq' },
];

export const MARKETING_NAV_DOCS: MarketingNavItem[] = [
  { key: 'get-started', label: 'Get started', href: docLink('get-started') },
  { key: 'brand-safety', label: 'Brand safety', href: docLink('brand-safety') },
];

export const MARKETING_NAV_BLOG: MarketingNavItem[] = [
  { key: 'compare-ai-video-engines', label: 'Compare AI video engines', href: blogLink('compare-ai-video-engines') },
  { key: 'sora-2-sequenced-prompts', label: 'Sora 2 sequenced prompts', href: blogLink('sora-2-sequenced-prompts') },
  { key: 'veo-3-updates', label: 'Veo 3 updates', href: blogLink('veo-3-updates') },
];

export const MARKETING_NAV_DROPDOWNS: Partial<Record<string, MarketingNavDropdown>> = {
  models: {
    items: MARKETING_NAV_MODELS,
    sections: [MARKETING_MODELS_USE_CASE_SECTION],
    allHref: { pathname: '/models' },
    allLabelKey: 'nav.dropdown.allModels',
    allLabelFallback: 'All models',
  },
  examples: {
    items: MARKETING_NAV_EXAMPLES,
    desktopColumns: 2,
    allHref: { pathname: '/examples' },
    allLabelKey: 'nav.dropdown.allExamples',
    allLabelFallback: 'All examples',
  },
  compare: {
    items: MARKETING_NAV_COMPARE,
    sections: [MARKETING_COMPARE_DECISION_GUIDES_SECTION],
    allHref: { pathname: '/ai-video-engines' },
    allLabelKey: 'nav.dropdown.allComparisons',
    allLabelFallback: 'All comparisons',
  },
  tools: {
    items: MARKETING_NAV_TOOLS,
    allHref: { pathname: '/tools' },
    allLabelKey: 'nav.dropdown.allTools',
    allLabelFallback: 'All tools',
  },
};
