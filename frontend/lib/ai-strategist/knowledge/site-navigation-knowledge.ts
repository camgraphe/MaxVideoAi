import { getAiStrategistModel } from '../model-catalog';
import { resolveModelId } from './model-knowledge';
import type { StrategistKnowledgeSource, StrategistKnowledgeToolResult } from './types';

type SiteRoute = {
  label: string;
  href: string;
  intents: readonly string[];
  guidance: string;
};

const AI_STRATEGIST_SITE_ROUTES: readonly SiteRoute[] = [
  {
    label: 'Generate',
    href: '/app',
    intents: ['generate', 'generator', 'create', 'upload image', 'image-to-video'],
    guidance: 'Use the video generator to choose workflow such as image-to-video, enter the prompt, review price, then launch manually.',
  },
  {
    label: 'Pricing',
    href: '/pricing',
    intents: ['pricing', 'credits', 'cost', 'price'],
    guidance: 'Use pricing to compare plans, credits, and cost expectations before rendering.',
  },
  {
    label: 'Models catalog',
    href: '/models',
    intents: ['models', 'engines', 'model pages'],
    guidance: 'Use the model catalog to inspect model strengths, specs, examples, and prompt guidance.',
  },
  {
    label: 'Examples',
    href: '/examples',
    intents: ['examples', 'gallery', 'samples'],
    guidance: 'Use examples to inspect real outputs, reusable prompts, settings, and model behavior.',
  },
  {
    label: 'Compare',
    href: '/compare',
    intents: ['compare', 'versus', 'side by side'],
    guidance: 'Use Compare to review engines side by side before picking a model.',
  },
  {
    label: 'Workflows',
    href: '/workflows',
    intents: ['workflow', 'text-to-video', 'image-to-video', 'video-to-video'],
    guidance: 'Use workflows to understand which creation path fits the asset and goal.',
  },
];

export function answerSiteNavigationQuestion(input: { rawUserMessage: string }): StrategistKnowledgeToolResult {
  const text = normalizeSearchText(input.rawUserMessage);
  const modelId = resolveModelId(input.rawUserMessage);
  const model = modelId ? getAiStrategistModel(modelId) : null;
  const matchedRoutes = selectRoutes(text);
  const routes = modelId
    ? [
        {
          label: `${model?.label ?? modelId} model page`,
          href: `/models/${modelId}`,
          intents: ['model page'],
          guidance: 'Open the model page to inspect examples, settings, prompt guidance, and workflow fit.',
        },
        ...matchedRoutes,
      ]
    : matchedRoutes;

  const selectedRoutes = routes.length ? uniqueRoutes(routes) : [AI_STRATEGIST_SITE_ROUTES[0], AI_STRATEGIST_SITE_ROUTES[2], AI_STRATEGIST_SITE_ROUTES[3]].filter(Boolean);

  return {
    toolName: 'navigation_help',
    answer: [
      'Use these MaxVideoAI destinations:',
      ...selectedRoutes.map((route) => `${route.label}: ${route.href} - ${route.guidance}`),
      'I will not navigate automatically, run generation, or spend credits.',
    ].join('\n'),
    sources: [siteNavigationSource()],
    confidence: selectedRoutes.length ? 0.86 : 0.62,
    limitations: ['Routes are stable public/internal app destinations; this playground only previews suggestions.'],
    warnings: [],
    uiActions: [],
  };
}

function selectRoutes(text: string): SiteRoute[] {
  const selected = AI_STRATEGIST_SITE_ROUTES.filter((route) =>
    route.intents.some((intent) => text.includes(normalizeSearchText(intent)))
  );

  if (text.includes('compare') && (text.includes('generat') || text.includes('create'))) {
    return uniqueRoutes([
      ...selected,
      AI_STRATEGIST_SITE_ROUTES.find((route) => route.href === '/compare'),
      AI_STRATEGIST_SITE_ROUTES.find((route) => route.href === '/app'),
    ].filter((route): route is SiteRoute => Boolean(route)));
  }

  if (text.includes('upload') || text.includes('reference image') || text.includes('image upload')) {
    return uniqueRoutes([
      ...selected,
      AI_STRATEGIST_SITE_ROUTES.find((route) => route.href === '/app'),
      AI_STRATEGIST_SITE_ROUTES.find((route) => route.href === '/workflows'),
    ].filter((route): route is SiteRoute => Boolean(route)));
  }

  return selected;
}

function uniqueRoutes(routes: readonly SiteRoute[]): SiteRoute[] {
  const seen = new Set<string>();
  return routes.filter((route) => {
    if (seen.has(route.href)) return false;
    seen.add(route.href);
    return true;
  });
}

function siteNavigationSource(): StrategistKnowledgeSource {
  return {
    id: 'site_navigation_map',
    label: 'AI Strategist site navigation map',
    path: 'frontend/lib/ai-strategist/knowledge/site-navigation-knowledge.ts',
  };
}

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9:.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
