import { getAiStrategistModel } from '../model-catalog';
import { resolveModelId } from './model-knowledge';
import { MAXVIDEOAI_ECOSYSTEM_SURFACES } from './ecosystem-knowledge';
import type { StrategistKnowledgeSource, StrategistKnowledgeToolResult } from './types';

type SiteRoute = {
  label: string;
  href: string;
  intents: readonly string[];
  guidance: string;
};

const AI_STRATEGIST_SITE_ROUTES: readonly SiteRoute[] = [
  {
    label: 'Generate Video',
    href: '/app',
    intents: ['generate', 'generator', 'create', 'upload image', 'image-to-video', 'video generator', 'generate video', 'create video'],
    guidance: 'Use the video generator to choose workflow such as image-to-video, enter the prompt, review price, then launch manually.',
  },
  {
    label: 'Generate Image',
    href: '/app/image',
    intents: ['generate image', 'image generator', 'text-to-image', 'text to image', 'image edit', 'edit image', 'create image', 'starting image'],
    guidance: 'Use Generate Image to create or edit still images, including starting frames that can later be animated in video workflows.',
  },
  {
    label: 'Generate Audio',
    href: '/app/audio',
    intents: ['generate audio', 'audio generator', 'music', 'sound design', 'voice asset', 'audio asset'],
    guidance: 'Use Generate Audio to prepare sound, ambience, music, or audio assets for campaigns.',
  },
  {
    label: 'Library',
    href: '/app/library',
    intents: ['library', 'saved assets', 'recent renders', 'history', 'render history', 'my renders', 'download', 'reuse asset'],
    guidance: 'Use Library to review saved assets, recent renders, reusable media, downloads, and source settings where available.',
  },
  {
    label: 'Tools',
    href: '/app/tools',
    intents: ['tools', 'upscale', 'angle', 'character builder', 'asset tool'],
    guidance: 'Use Tools for helper workflows such as upscale, angle exploration, or character-building utilities where available.',
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
    label: 'Video models',
    href: '/models/video',
    intents: ['video models', 'video engines'],
    guidance: 'Use Video models to inspect AI video engines and their examples, settings, strengths, and prompt guidance.',
  },
  {
    label: 'Image models',
    href: '/models/image',
    intents: ['image models', 'image engines'],
    guidance: 'Use Image models to inspect AI image engines and decide what to use before a still-image or starting-frame workflow.',
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

  const selectedRoutes = routes.length ? uniqueRoutes(routes) : fallbackRoutes(input.rawUserMessage);

  return {
    toolName: 'navigation_help',
    answer: [
      'Use these MaxVideoAI destinations:',
      ...selectedRoutes.map((route) => `${route.label}: ${route.href} - ${route.guidance}`),
      'I will not navigate automatically.',
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

  if (containsAny(text, ['library', 'history', 'recent render', 'recent renders', 'my renders', 'saved assets', 'download'])) {
    return uniqueRoutes([
      ...selected,
      AI_STRATEGIST_SITE_ROUTES.find((route) => route.href === '/app/library'),
    ].filter((route): route is SiteRoute => Boolean(route)));
  }

  if (containsAny(text, ['generate image', 'image generator', 'text to image', 'edit image'])) {
    return uniqueRoutes([
      ...selected,
      AI_STRATEGIST_SITE_ROUTES.find((route) => route.href === '/app/image'),
      AI_STRATEGIST_SITE_ROUTES.find((route) => route.href === '/models/image'),
    ].filter((route): route is SiteRoute => Boolean(route)));
  }

  if (containsAny(text, ['generate audio', 'audio generator', 'sound design', 'music'])) {
    return uniqueRoutes([
      ...selected,
      AI_STRATEGIST_SITE_ROUTES.find((route) => route.href === '/app/audio'),
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

function fallbackRoutes(rawUserMessage: string): SiteRoute[] {
  const selected = selectEcosystemSurfacesForNavigation(rawUserMessage);
  return selected.map((surface) => ({
    label: surface.label,
    href: surface.href,
    intents: surface.bestFor,
    guidance: surface.purpose,
  }));
}

function selectEcosystemSurfacesForNavigation(rawUserMessage: string) {
  const text = normalizeSearchText(rawUserMessage);
  const exact = MAXVIDEOAI_ECOSYSTEM_SURFACES.filter((surface) => {
    const haystack = normalizeSearchText([surface.label, surface.href, ...surface.bestFor].join(' '));
    return haystack.split(' ').some((token) => token.length > 3 && text.includes(token));
  });
  return exact.length ? exact.slice(0, 4) : MAXVIDEOAI_ECOSYSTEM_SURFACES.slice(0, 4);
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

function containsAny(value: string, needles: readonly string[]): boolean {
  return needles.some((needle) => value.includes(normalizeSearchText(needle)));
}
