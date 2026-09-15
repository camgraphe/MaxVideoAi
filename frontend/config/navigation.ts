import { getMcpPublicIntegrationIds, getMcpIntegration } from '@/lib/mcp-integration-registry';
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
  brandId?: string;
  emphasized?: boolean;
  badge?: 'new';
  description?: string;
  logo?: string;
  icon?: 'cinema' | 'image' | 'speed' | 'ads' | 'guides' | 'character' | 'angle' | 'upscale' | 'cutout' | 'audio' | 'connect' | 'docs';
  comparisonBrands?: Array<{ id: string; brandId?: string }>;
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
  intro?: string;
  heading?: string;
};

export type MarketingTopNavKey = 'models' | 'examples' | 'tools' | 'compare' | 'pricing' | 'blog' | 'connect';

export type MarketingTopNavLink = {
  key: MarketingTopNavKey;
  href: string;
};

export const MARKETING_TOP_NAV_LINKS = [
  { key: 'models', href: '/models' },
  { key: 'examples', href: '/examples' },
  { key: 'compare', href: '/ai-video-engines' },
  { key: 'tools', href: '/tools' },
  { key: 'pricing', href: '/pricing' },
  { key: 'blog', href: '/blog' },
] as const satisfies readonly MarketingTopNavLink[];

export const MARKETING_SITE_NAV_LINKS: readonly MarketingTopNavLink[] = [
  ...MARKETING_TOP_NAV_LINKS.filter((item) => item.key !== 'blog' && item.key !== 'pricing'),
  { key: 'connect', href: '/mcp' },
  { key: 'pricing', href: '/pricing' },
];

type LabeledSlug = {
  slug: string;
  label: string;
  brandId?: string;
  badge?: MarketingNavItem['badge'];
};

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

// D85 editorial promotion. Publication and canonical identity remain registry-owned.
const MODEL_MENU_CANDIDATES: readonly LabeledSlug[] = [
  { slug: 'minimax-h3', label: 'MiniMax H3', badge: 'new' },
  { slug: 'minimax-h3-max', label: 'MiniMax H3 Max', badge: 'new' },
  { slug: 'seedance-2-5', label: 'Seedance 2.5', badge: 'new' },
  { slug: 'kling-3-pro', label: 'Kling 3 Pro' },
  { slug: 'kling-3-turbo-pro', label: 'Kling 3 Turbo Pro' },
  { slug: 'veo-3-1', label: 'Veo 3.1' },
  { slug: 'ltx-2-5-pro', label: 'LTX 2.5 Pro' },
  { slug: 'ltx-2-5-fast', label: 'LTX 2.5 Fast' },
  { slug: 'wan-3', label: 'Wan 3', badge: 'new' },
  { slug: 'wan-3-prime', label: 'Wan 3 Prime', badge: 'new' },
  { slug: 'happy-horse-1-1', label: 'Happy Horse 1.1' },
];

export function buildMarketingModelMenu(models: readonly RuntimeModelEntry[]): LabeledSlug[] {
  const bySlug = new Map(models.map((model) => [model.slug, model]));
  const byId = new Map(models.map((model) => [model.id, model]));
  return MODEL_MENU_CANDIDATES
    .filter(({ slug }) => {
      const model = bySlug.get(slug);
      if (!model?.publication.model.published || model.lifecycle === 'retired') return false;
      if (model.lifecycle !== 'legacy' || !model.successorId) return true;
      return byId.get(model.successorId)?.publication.model.published !== true;
    })
    .slice(0, 11)
    .map((item) => {
      const model = bySlug.get(item.slug);
      return {
        ...item,
        brandId: model?.family ? getModelFamilyDefinition(model.family)?.brandId : undefined,
      };
    });
}

const MODEL_MENU = buildMarketingModelMenu(listRuntimeModels());

const AVAILABLE_EXAMPLE_FAMILY_IDS = getExampleNavFamilyIds();

const EXAMPLES_MENU: LabeledSlug[] = orderExamplesHubFamilyIds(AVAILABLE_EXAMPLE_FAMILY_IDS)
  .map((familyId) => getModelFamilyDefinition(familyId))
  .filter((family): family is NonNullable<typeof family> => Boolean(family))
  .map((family) => ({
    slug: family.id,
    label: family.label,
    brandId: family.brandId,
  }));

const PRIORITY_EXAMPLE_FAMILIES = ['ltx', 'kling', 'seedance', 'wan', 'veo', 'hailuo', 'happy-horse'];
const PRIORITY_EXAMPLES = PRIORITY_EXAMPLE_FAMILIES.flatMap(id => EXAMPLES_MENU.filter(item => item.slug === id));
const OTHER_EXAMPLES = EXAMPLES_MENU.filter(item => !PRIORITY_EXAMPLE_FAMILIES.includes(item.slug));
const FOOTER_EXAMPLES_MENU: LabeledSlug[] = [...PRIORITY_EXAMPLES, ...OTHER_EXAMPLES];

const COMPARE_MENU: LabeledSlug[] = [
  { slug: 'minimax-h3-vs-seedance-2-5', label: 'MiniMax H3 vs Seedance 2.5' },
  { slug: 'minimax-h3-vs-minimax-h3-max', label: 'MiniMax H3 vs H3 Max' },
  { slug: 'kling-3-pro-vs-seedance-2-5', label: 'Kling 3 Pro vs Seedance 2.5' },
  { slug: 'seedance-2-5-vs-wan-3', label: 'Seedance 2.5 vs Wan 3' },
  { slug: 'ltx-2-5-fast-vs-ltx-2-5-pro', label: 'LTX 2.5 Fast vs Pro' },
  { slug: 'wan-3-vs-wan-3-prime', label: 'Wan 3 vs Wan 3 Prime' },
  { slug: 'gemini-omni-flash-vs-veo-3-1', label: 'Gemini Omni Flash 1.1 vs Veo 3.1' },
  // Established search demand: retain this route even as newer models are promoted.
  { slug: 'seedance-2-0-vs-seedance-2-0-fast', label: 'Seedance 2.0 vs Fast' },
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
  brandId: item.brandId,
  badge: item.badge,
}));

export const MARKETING_NAV_EXAMPLES: MarketingNavItem[] = PRIORITY_EXAMPLES.map((item) => ({
  key: item.slug,
  label: item.label,
  href: exampleLink(item.slug),
  brandId: ['sora', 'flux'].includes(item.slug) ? undefined : item.brandId,
  ...(['sora', 'flux'].includes(item.slug) ? { icon: 'cinema' as const } : {}),
}));

export const MARKETING_FOOTER_EXAMPLES: MarketingNavItem[] = FOOTER_EXAMPLES_MENU.map((item) => ({
  key: item.slug,
  label: item.label,
  href: exampleLink(item.slug),
  brandId: ['sora', 'flux'].includes(item.slug) ? undefined : item.brandId,
  ...(['sora', 'flux'].includes(item.slug) ? { icon: 'cinema' as const } : {}),
}));

export function buildMarketingCompareMenu(models: readonly RuntimeModelEntry[]): LabeledSlug[] {
  const publishedSlugs = new Set(buildPublishedComparisonSlugsFromModels(models, () => true));
  return COMPARE_MENU
    .filter(({ slug }) => publishedSlugs.has(slug))
    .slice(0, 10);
}

export const MARKETING_NAV_COMPARE: MarketingNavItem[] = buildMarketingCompareMenu(listRuntimeModels()).map((item) => ({
  key: item.slug,
  label: item.label,
  href: compareLink(item.slug),
  comparisonBrands: item.slug.split('-vs-').map(slug => {
    const model = listRuntimeModels().find(model => model.slug === slug);
    return { id: slug, brandId: model?.family ? getModelFamilyDefinition(model.family)?.brandId : undefined };
  }),
  badge: item.badge,
}));

export const MARKETING_NAV_BEST_FOR_USE_CASES: MarketingNavItem[] = BEST_FOR_USE_CASES.map((item) => ({
  key: item.key,
  label: item.label,
  href: bestForLink(item.slug),
  icon: ({ 'cinematic-realism': 'cinema', 'image-to-video': 'image', 'fast-drafts': 'speed', ads: 'ads' } as const)[item.key as 'cinematic-realism' | 'image-to-video' | 'fast-drafts' | 'ads'],
}));

export const MARKETING_NAV_BEST_FOR_HUB: MarketingNavItem = {
  key: 'best-for',
  label: 'Best models by use case',
  href: bestForLink(),
  icon: 'guides',
};

const MARKETING_MODELS_USE_CASE_SECTION: MarketingNavSection = {
  key: 'useCaseGuides',
  titleKey: 'nav.dropdown.guideTitle',
  titleFallback: 'Find your model',
  items: [
    {
      key: 'all-use-case-guides',
      label: 'All use-case guides',
      href: bestForLink(),
  icon: 'guides',
      emphasized: true,
    },
    ...MARKETING_NAV_BEST_FOR_USE_CASES,
  ],
};

const MARKETING_COMPARE_DECISION_GUIDES_SECTION: MarketingNavSection = {
  key: 'useCaseGuides',
  titleKey: 'nav.dropdown.useCaseTitle',
  titleFallback: 'Choose by use case',
  items: [{ ...MARKETING_NAV_BEST_FOR_HUB, emphasized: true }, ...MARKETING_NAV_BEST_FOR_USE_CASES],
};

export const MARKETING_NAV_TOOLS: MarketingNavItem[] = [
  { key: 'character-builder', icon: 'character', label: 'Consistent Character AI', href: toolLink('character-builder') },
  { key: 'angle', icon: 'angle', label: 'Change Camera Angle', href: toolLink('angle') },
  { key: 'upscale', icon: 'upscale', label: 'AI Upscale', href: toolLink('upscale') },
  { key: 'background-removal', icon: 'cutout', label: 'Video Background Remover', href: toolLink('background-removal') },
  { key: 'image', icon: 'image', label: 'Generate image', href: '/app/image' },
  { key: 'audio', icon: 'audio', label: 'Generate audio', href: '/app/audio' },
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

const ASSISTANT_LOGOS: Record<string,string> = {claude:'/brand/partners/anthropic/claude-mark-light.svg',chatgpt:'/brand/partners/openai/openai-mark-light.svg',codex:'/brand/partners/openai/openai-mark-light.svg',openclaw:'/brand/partners/mcp/openclaw-mark.svg',n8n:'/brand/partners/mcp/n8n-mark.svg'};
export const MARKETING_NAV_ASSISTANTS: MarketingNavItem[] = getMcpPublicationState(mcpPublication).indexable ? getMcpPublicIntegrationIds().map(id => ({key:id,label:getMcpIntegration(id).label,href:getMcpIntegration(id).englishPath as LocalizedLinkHref,logo:ASSISTANT_LOGOS[id]})) : [];

const MARKETING_RESOURCES_SECTION: MarketingNavSection = {
  key: 'resources', titleKey: 'nav.dropdown.resourcesTitle', titleFallback: 'Guides & resources',
  items: [
    {key:'blog', label:'Blog', href:'/blog', icon:'docs'},
    {key:'get-started', label:'Getting started', href:docLink('get-started'), icon:'guides'},
  ],
};

export const MARKETING_NAV_DROPDOWNS: Partial<Record<string, MarketingNavDropdown>> = {
  models: {
    items: MARKETING_NAV_MODELS,
    desktopColumns: 2,
    heading: 'Meet your next video model.',
    intro: 'Capabilities, examples and prices. Choose what your project needs.',
    sections: [MARKETING_MODELS_USE_CASE_SECTION, {
      key: 'moreModels', titleKey: 'nav.dropdown.moreModels', titleFallback: 'More creative possibilities',
      items: ['gpt-image-2', 'flux-3', 'gemini-omni-flash'].flatMap(slug => {
        const model = listRuntimeModels().find(item => item.slug === slug && item.publication.model.published && item.lifecycle !== 'retired');
        if (!model) return [];
        return [{key: slug, label: slug === 'gpt-image-2' ? 'GPT Image 2' : slug === 'flux-3' ? 'FLUX 3' : 'Gemini Omni Flash 1.1', href: modelLink(slug), icon: slug === 'gpt-image-2' ? 'image' as const : 'cinema' as const}];
      }),
    }],
    allHref: { pathname: '/models' },
    allLabelKey: 'nav.dropdown.allModels',
    allLabelFallback: 'All models',
  },
  examples: {
    items: MARKETING_NAV_EXAMPLES,
    heading: 'Watch before you choose.',
    intro: 'Real videos, prompts and model details.',
    sections: [{ key: 'moreExamples', titleKey: 'nav.dropdown.moreExamples', titleFallback: 'More to explore', items: OTHER_EXAMPLES.map(item => ({key:item.slug,label:item.label,href:exampleLink(item.slug),brandId:['sora', 'flux'].includes(item.slug) ? undefined : item.brandId,...(['sora', 'flux'].includes(item.slug) ? {icon:'cinema' as const} : {})})) }],
    desktopColumns: 2,
    allHref: { pathname: '/examples' },
    allLabelKey: 'nav.dropdown.allExamples',
    allLabelFallback: 'All examples',
  },
  compare: {
    items: MARKETING_NAV_COMPARE,
    heading: 'Two models. A clearer choice.',
    intro: 'Compare scores, video examples, capabilities and costs.',
    sections: [MARKETING_COMPARE_DECISION_GUIDES_SECTION],
    allHref: { pathname: '/ai-video-engines' },
    allLabelKey: 'nav.dropdown.allComparisons',
    allLabelFallback: 'All comparisons',
  },
  connect: {
    items: MARKETING_NAV_ASSISTANTS,
    desktopColumns: 2,
    heading: 'Your assistant. Your video studio.',
    intro: 'Choose a model, review the price and generate through MCP.',
    allHref: '/mcp',
    allLabelKey: 'nav.dropdown.allAssistants',
    allLabelFallback: 'Explore AI assistants & MCP',
    sections: [{ key:'connectGuides', titleKey:'nav.dropdown.connectGuides',titleFallback:'Connect and create',items:[
      {key:'mcp-guide',icon:'connect',label:'How MCP works',href:'/mcp'},
      {key:'mcp-docs',icon:'docs',label:'MCP documentation',href:docLink('mcp')},
    ]}],
  },
  tools: {
    items: MARKETING_NAV_TOOLS,
    desktopColumns: 2,
    heading: 'Shape the next part of your story.',
    intro: 'Create your references, change an angle and finish the details.',
    sections: [MARKETING_RESOURCES_SECTION],
    allHref: { pathname: '/tools' },
    allLabelKey: 'nav.dropdown.allTools',
    allLabelFallback: 'All tools',
  },
};
