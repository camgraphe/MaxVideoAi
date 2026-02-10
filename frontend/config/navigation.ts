import type { LocalizedLinkHref } from '@/i18n/navigation';

export type MarketingNavItem = {
  key: string;
  label: string;
  href: LocalizedLinkHref;
};

export type MarketingNavDropdown = {
  items: MarketingNavItem[];
  allHref: LocalizedLinkHref;
  allLabelKey: string;
  allLabelFallback: string;
};

type LabeledSlug = { slug: string; label: string };

const modelLink = (slug: string): LocalizedLinkHref => ({
  pathname: '/models/[slug]',
  params: { slug },
});

const exampleLink = (slug: string): LocalizedLinkHref => ({
  pathname: '/examples/[model]',
  params: { model: slug },
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
  { slug: 'sora-2-pro', label: 'Sora 2 Pro' },
  { slug: 'kling-3-pro', label: 'Kling 3 Pro' },
  { slug: 'veo-3-1', label: 'Veo 3.1' },
  { slug: 'wan-2-6', label: 'Wan 2.6' },
  { slug: 'seedance-1-5-pro', label: 'Seedance 1.5 Pro' },
  { slug: 'ltx-2', label: 'LTX-2' },
  { slug: 'pika-text-to-video', label: 'Pika 2.2' },
  { slug: 'minimax-hailuo-02-text', label: 'MiniMax Hailuo 02' },
];

const EXAMPLES_MENU: LabeledSlug[] = [
  { slug: 'sora-2-pro', label: 'Sora 2 Pro' },
  { slug: 'kling-3-pro', label: 'Kling 3 Pro' },
  { slug: 'veo-3-1', label: 'Veo 3.1' },
  { slug: 'wan-2-6', label: 'Wan 2.6' },
  { slug: 'seedance-1-5-pro', label: 'Seedance 1.5 Pro' },
  { slug: 'ltx-2', label: 'LTX-2' },
  { slug: 'pika-text-to-video', label: 'Pika 2.2' },
  { slug: 'minimax-hailuo-02-text', label: 'MiniMax Hailuo 02' },
];

export const MARKETING_MODEL_SLUGS = MODEL_MENU.map((item) => item.slug);
export const MARKETING_EXAMPLE_SLUGS = [...EXAMPLES_MENU.map((item) => item.slug), 'kling-3-standard'];

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
};
