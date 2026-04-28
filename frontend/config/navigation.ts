import type { LocalizedLinkHref } from '@/i18n/navigation';
import { getModelFamilyDefinition } from '@/config/model-families';
import { getExampleNavFamilyIds } from '@/lib/model-families';

export type MarketingNavItem = {
  key: string;
  label: string;
  href: LocalizedLinkHref;
};

export type MarketingNavSection = {
  key: string;
  titleKey: string;
  titleFallback: string;
  items: MarketingNavItem[];
};

export type MarketingNavDropdown = {
  items: MarketingNavItem[];
  sections?: MarketingNavSection[];
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

type LabeledSlug = { slug: string; label: string };

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

const toolLink = (slug: 'character-builder' | 'angle' | 'upscale'): LocalizedLinkHref => ({
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

const MODEL_MENU: LabeledSlug[] = [
  { slug: 'seedance-2-0', label: 'Seedance 2.0' },
  { slug: 'ltx-2-3-fast', label: 'LTX 2.3 Fast' },
  { slug: 'veo-3-1', label: 'Veo 3.1' },
  { slug: 'veo-3-1-lite', label: 'Veo 3.1 Lite' },
  { slug: 'wan-2-6', label: 'Wan 2.6' },
  { slug: 'kling-3-pro', label: 'Kling 3 Pro' },
  { slug: 'kling-3-4k', label: 'Kling 3 4K' },
];

const HEADER_EXAMPLE_FAMILY_PRIORITY = ['veo', 'seedance', 'ltx', 'kling', 'wan'] as const;
const FOOTER_EXAMPLE_FAMILIES = ['veo', 'seedance', 'ltx', 'kling', 'wan'] as const;
const AVAILABLE_EXAMPLE_FAMILY_IDS = getExampleNavFamilyIds();

const EXAMPLES_MENU: LabeledSlug[] = HEADER_EXAMPLE_FAMILY_PRIORITY
  .filter((familyId) => AVAILABLE_EXAMPLE_FAMILY_IDS.includes(familyId))
  .map((familyId) => getModelFamilyDefinition(familyId))
  .filter((family): family is NonNullable<typeof family> => Boolean(family))
  .map((family) => ({
    slug: family.id,
    label: family.label,
  }));

const FOOTER_EXAMPLES_MENU: LabeledSlug[] = FOOTER_EXAMPLE_FAMILIES
  .map((familyId) => getModelFamilyDefinition(familyId))
  .filter((family): family is NonNullable<typeof family> => Boolean(family))
  .map((family) => ({
    slug: family.id,
    label: family.label,
  }));

const COMPARE_MENU: LabeledSlug[] = [
  { slug: 'seedance-1-5-pro-vs-seedance-2-0', label: 'Seedance 1.5 vs 2.0' },
  { slug: 'ltx-2-vs-ltx-2-3-fast', label: 'LTX 2 vs 2.3 Fast' },
  { slug: 'ltx-2-3-fast-vs-seedance-2-0', label: 'LTX 2.3 Fast vs Seedance 2.0' },
  { slug: 'ltx-2-3-fast-vs-veo-3-1', label: 'LTX 2.3 Fast vs Veo 3.1' },
  { slug: 'kling-3-pro-vs-ltx-2-3-pro', label: 'Kling 3 Pro vs LTX 2.3 Pro' },
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

export const MARKETING_NAV_COMPARE: MarketingNavItem[] = COMPARE_MENU.map((item) => ({
  key: item.slug,
  label: item.label,
  href: compareLink(item.slug),
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
  key: 'chooseByUseCase',
  titleKey: 'nav.dropdown.models.sections.chooseByUseCase.title',
  titleFallback: 'Choose by use case',
  items: [
    ...MARKETING_NAV_BEST_FOR_USE_CASES,
    {
      key: 'all-use-case-guides',
      label: 'All use-case guides',
      href: bestForLink(),
    },
  ],
};

const MARKETING_COMPARE_DECISION_GUIDES_SECTION: MarketingNavSection = {
  key: 'decisionGuides',
  titleKey: 'nav.dropdown.compare.sections.decisionGuides.title',
  titleFallback: 'Decision guides',
  items: [MARKETING_NAV_BEST_FOR_HUB, ...MARKETING_NAV_BEST_FOR_USE_CASES],
};

export const MARKETING_NAV_TOOLS: MarketingNavItem[] = [
  { key: 'character-builder', label: 'Consistent Character AI', href: toolLink('character-builder') },
  { key: 'angle', label: 'Change Camera Angle', href: toolLink('angle') },
  { key: 'upscale', label: 'AI Upscale', href: toolLink('upscale') },
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
