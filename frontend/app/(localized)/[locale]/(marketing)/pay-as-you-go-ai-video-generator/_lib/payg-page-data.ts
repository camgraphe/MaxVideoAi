import type { AppLocale } from '@/i18n/locales';
import {
  buildPricingHubData,
  type PricingHubData,
  type VideoPricePresetId,
  type VideoPricingRow,
} from '../../pricing/_lib/pricingHubData';

export const PAYG_PAGE_PATH = '/pay-as-you-go-ai-video-generator';

const MODEL_FAMILIES = ['seedance', 'kling', 'veo', 'happy-horse', 'seedance-mini', 'ltx', 'wan'] as const;
const PRIMARY_PRICE_PRESETS: readonly VideoPricePresetId[] = ['5s-720p', '8s-1080p', '10s-1080p'];
const MODEL_FAMILY_PREFERRED_IDS: Record<(typeof MODEL_FAMILIES)[number], readonly string[]> = {
  seedance: ['seedance-2-0', 'seedance-2-0-fast', 'seedance-2-0-mini'],
  'happy-horse': ['happy-horse-1-1', 'happy-horse-1-0'],
  'seedance-mini': ['seedance-2-0-mini'],
  kling: ['kling-3-pro', 'kling-3-standard', 'kling-2-5-turbo'],
  veo: ['veo-3-1', 'veo-3-1-fast', 'veo-3-1-lite'],
  ltx: ['ltx-2-3-fast', 'ltx-2-3', 'ltx-2-fast'],
  wan: ['wan-2-6', 'wan-2-5'],
};
const PAYG_COMPARE_ALLOWED_MODEL_IDS = new Set([
  ...Object.values(MODEL_FAMILY_PREFERRED_IDS).flat(),
  'ltx-2-3-pro',
]);
const PAYG_COMPARE_CANONICAL_HREFS: Record<string, string> = {
  '/ai-video-engines/veo-3-1-vs-kling-3-pro': '/ai-video-engines/kling-3-pro-vs-veo-3-1',
};

const PRICE_LOOKUP_CONFIGS = [
  {
    id: 'seedance-2-0',
    query: 'seedance 2 price',
    title: 'Seedance 2.0 price lookup',
    body: 'Start here for the current all-around model: strong text-to-video, image references, native audio options, and a quote before rendering.',
    presetId: '5s-720p' satisfies VideoPricePresetId,
  },
  {
    id: 'kling-3-pro',
    query: 'kling 3 pro price',
    title: 'Kling 3 Pro price lookup',
    body: 'A solid route for controlled motion, camera moves, product shots, and image-to-video tests without a monthly plan.',
    presetId: '8s-1080p' satisfies VideoPricePresetId,
  },
  {
    id: 'veo-3-1',
    query: 'veo 3.1 price',
    title: 'Veo 3.1 price lookup',
    body: 'Use Google Veo when cinematic prompt interpretation, Google video quality, or premium visual polish matters more than draft cost.',
    presetId: '8s-1080p' satisfies VideoPricePresetId,
  },
  {
    id: 'happy-horse-1-1',
    query: 'happy horse 1.1 price',
    title: 'Happy Horse 1.1 price lookup',
    body: 'Check Happy Horse 1.1 when Alibaba video output, references, or a different visual feel may beat the defaults.',
    presetId: '5s-720p' satisfies VideoPricePresetId,
  },
  {
    id: 'seedance-2-0-mini',
    query: 'seedance 2 mini price',
    title: 'Seedance 2.0 Mini price lookup',
    body: 'Use Seedance 2 Mini for lighter multimodal tests, shorter iterations, and lower-friction checks before moving to the main Seedance 2 route.',
    presetId: '5s-720p' satisfies VideoPricePresetId,
  },
  {
    id: 'ltx-2-3-fast',
    query: 'ltx 2.3 pricing',
    title: 'LTX 2.3 Fast price lookup',
    body: 'Use LTX 2.3 Fast as a strong, efficient option for drafts, prompt iteration, and budget-aware production planning.',
    presetId: '8s-1080p' satisfies VideoPricePresetId,
  },
] as const;

export type PayAsYouGoQuestion = {
  question: string;
  answer: string;
};

export type PayAsYouGoEngineIcon = {
  id: string;
  label: string;
  brandId?: string;
};

export type PayAsYouGoModelRow = {
  id: string;
  engineIcon: PayAsYouGoEngineIcon;
  engineName: string;
  family: string;
  bestFor: string;
  modelHref?: string;
  compareHref?: string;
  priceCells: Array<{
    label: string;
    value: string;
    note?: string;
  }>;
};

export type PayAsYouGoPageData = {
  hero: {
    title: string;
    intro: string;
    primaryCta: string;
    secondaryCta: string;
    trustItems: string[];
  };
  naturalQuestions: PayAsYouGoQuestion[];
  meaning: {
    title: string;
    body: string;
    bullets: string[];
  };
  noSubscription: {
    title: string;
    body: string;
    cards: Array<{ title: string; body: string }>;
  };
  pricing: {
    title: string;
    intro: string;
    rows: PayAsYouGoModelRow[];
    fullMatrixHref: string;
  };
  priceLookups: Array<{
    id: string;
    query: string;
    title: string;
    body: string;
    engineIcon: PayAsYouGoEngineIcon;
    price: string;
    href: string;
    modelHref?: string;
  }>;
  supportedModels: Array<{
    family: string;
    title: string;
    body: string;
    href: string;
    engineIcon: PayAsYouGoEngineIcon;
  }>;
  exampleCosts: Array<{ label: string; engine: string; price: string; context: string; href: string }>;
  refundPolicy: {
    title: string;
    body: string;
    bullets: string[];
  };
  faq: PayAsYouGoQuestion[];
};

function rowIncludesFamily(row: VideoPricingRow, family: string) {
  const haystack = `${row.family} ${row.engineName} ${row.id}`.toLowerCase();
  return haystack.includes(family);
}

function pickRowsByFamily(rows: VideoPricingRow[]) {
  const selected = new Map<string, VideoPricingRow>();
  MODEL_FAMILIES.forEach((family) => {
    const preferredIds = MODEL_FAMILY_PREFERRED_IDS[family];
    const preferred = preferredIds.map((id) => rows.find((row) => row.id === id)).find(Boolean);
    const match =
      preferred ??
      rows.find((row) => row.pricingGroup === 'recommended' && rowIncludesFamily(row, family));
    if (match) selected.set(family, match);
  });
  return [...selected.values()];
}

function modelBestFor(row: VideoPricingRow) {
  const lower = `${row.family} ${row.engineName}`.toLowerCase();
  if (lower.includes('seedance') && lower.includes('mini')) return 'lighter Seedance 2 tests, multimodal references, and fast iteration';
  if (lower.includes('seedance')) return 'current all-around video generation, references, and native audio tests';
  if (lower.includes('happy-horse')) return 'alternate Alibaba video output and newer model comparison';
  if (lower.includes('kling')) return 'motion control, image-to-video, and creator workflows';
  if (lower.includes('veo')) return 'cinematic quality, prompt-following, and Google Veo variants';
  if (lower.includes('ltx')) return 'efficient drafts, prompt iteration, and strong budget-aware output';
  if (lower.includes('wan')) return 'budget-friendly text and image-to-video exploration';
  return 'testing model quality before committing credits';
}

function canonicalCompareHref(href: string) {
  return PAYG_COMPARE_CANONICAL_HREFS[href] ?? href;
}

function compareIdsFromHref(href: string) {
  const slug = href.split('/').pop()?.split('?')[0]?.split('#')[0];
  return slug?.split('-vs-') ?? [];
}

function isPaygCompareHref(href: string) {
  if (!/\/(ai-video-engines|comparatif|comparativa)\//.test(href)) return false;
  const compareIds = compareIdsFromHref(canonicalCompareHref(href));
  return compareIds.length === 2 && compareIds.every((id) => PAYG_COMPARE_ALLOWED_MODEL_IDS.has(id));
}

function pickPaygCompareHref(links: VideoPricingRow['links']) {
  const link = links.find((candidate) => isPaygCompareHref(candidate.href));
  return link ? canonicalCompareHref(link.href) : undefined;
}

function buildModelRows(pricingHub: PricingHubData): PayAsYouGoModelRow[] {
  const presets = pricingHub.video.presets.filter((preset) => PRIMARY_PRICE_PRESETS.includes(preset.id));
  return pickRowsByFamily(pricingHub.video.rows).map((row) => ({
    id: row.id,
    engineIcon: row.engineIcon,
    engineName: row.engineName,
    family: row.family,
    bestFor: modelBestFor(row),
    modelHref: row.modelHref,
    compareHref: pickPaygCompareHref(row.links),
    priceCells: presets.map((preset) => {
      const quote = row.quotes[preset.id];
      return {
        label: preset.label,
        value: quote.display ?? 'Live quote',
        note: quote.note?.replace(/\baudio incl\.?\b/gi, 'Audio included'),
      };
    }),
  }));
}

function buildPriceLookups(rows: VideoPricingRow[]) {
  return PRICE_LOOKUP_CONFIGS.map((config) => {
    const row = rows.find((candidate) => candidate.id === config.id);
    const quote = row?.quotes[config.presetId];
    return {
      id: config.id,
      query: config.query,
      title: config.title,
      body: config.body,
      engineIcon: row?.engineIcon ?? { id: config.id, label: config.title },
      price: quote?.display ?? 'Live quote',
      href: row ? `/pricing#${row.anchorId}` : '/pricing#video-pricing',
      modelHref: row?.modelHref,
    };
  });
}

function buildExampleCosts(pricingHub: PricingHubData) {
  const preferredExamples: Array<{
    id: string;
    presetId: VideoPricePresetId;
    label: string;
  }> = [
    { id: 'seedance-2-0', presetId: '5s-720p', label: 'Seedance 2 starter render' },
    { id: 'kling-3-pro', presetId: '8s-1080p', label: 'Kling 3 Pro motion test' },
    { id: 'veo-3-1-fast', presetId: '8s-1080p', label: 'Google Veo 3.1 Fast cinematic test' },
    { id: 'happy-horse-1-1', presetId: '5s-720p', label: 'Happy Horse 1.1 alternate route test' },
    { id: 'seedance-2-0-mini', presetId: '5s-720p', label: 'Seedance 2 Mini quick test' },
    { id: 'ltx-2-3-fast', presetId: '8s-1080p', label: 'LTX 2.3 Fast draft test' },
  ];

  const rowsById = new Map(pricingHub.video.rows.map((row) => [row.id, row]));
  const examples = preferredExamples.flatMap((example) => {
    const row = rowsById.get(example.id);
    if (!row) return [];
    return [
      {
        label: example.label,
        engine: row.engineName,
        price: row.quotes[example.presetId]?.display ?? 'Live quote',
        context: pricingHub.video.presets.find((preset) => preset.id === example.presetId)?.label ?? 'Example settings',
        href: `/pricing#${row.anchorId}`,
      },
    ];
  });

  if (examples.length >= 6) return examples.slice(0, 6);

  return pricingHub.popularChecks.slice(0, 4).map((check) => ({
    label: check.priceCheck,
    engine: check.engine,
    price: check.price,
    context: 'Example settings',
    href: check.link.href,
  }));
}

function buildSupportedModels(rows: VideoPricingRow[]) {
  const rowById = (id: string) => rows.find((row) => row.id === id);
  return [
    {
      family: 'Seedance 2',
      title: 'Seedance 2.0 as the first model to test',
      body: 'Put Seedance 2 first when you need a current all-around route for text-to-video, image-to-video, references, native audio options, and production-quality tests.',
      href: rowById('seedance-2-0')?.modelHref ?? '/models/seedance-2-0',
      engineIcon: rowById('seedance-2-0')?.engineIcon ?? { id: 'seedance-2-0', label: 'Seedance 2.0' },
    },
    {
      family: 'Kling',
      title: 'Kling as the solid motion-control choice',
      body: 'Use Kling when you want dependable camera motion, product shots, elements, and image-guided video generation without buying a subscription first.',
      href: rowById('kling-3-pro')?.modelHref ?? '/models/kling-3-pro',
      engineIcon: rowById('kling-3-pro')?.engineIcon ?? { id: 'kling-3-pro', label: 'Kling' },
    },
    {
      family: 'Google Veo',
      title: 'Google Veo as the cinematic-quality choice',
      body: 'Compare Veo variants when prompt interpretation, cinematic polish, audio options, or Google video routes matter more than the lowest draft price.',
      href: rowById('veo-3-1')?.modelHref ?? '/models/veo-3-1',
      engineIcon: rowById('veo-3-1')?.engineIcon ?? { id: 'veo-3-1', label: 'Google Veo' },
    },
    {
      family: 'Happy Horse 1.1',
      title: 'Happy Horse 1.1 for alternate visual output',
      body: 'Use Happy Horse 1.1 when you want to compare a newer Alibaba video route against Seedance, Kling, Google Veo, and LTX.',
      href: rowById('happy-horse-1-1')?.modelHref ?? '/models/happy-horse-1-1',
      engineIcon: rowById('happy-horse-1-1')?.engineIcon ?? { id: 'happy-horse-1-1', label: 'Happy Horse 1.1' },
    },
    {
      family: 'Seedance 2 Mini',
      title: 'Seedance 2.0 Mini for lighter multimodal tests',
      body: 'Use Seedance 2 Mini when you want a lighter Seedance-family route for references, quick checks, and budget-aware iteration before scaling a prompt.',
      href: rowById('seedance-2-0-mini')?.modelHref ?? '/models/dreamina-seedance-2-0-mini',
      engineIcon: rowById('seedance-2-0-mini')?.engineIcon ?? { id: 'seedance-2-0-mini', label: 'Seedance 2.0 Mini' },
    },
    {
      family: 'LTX',
      title: 'LTX 2.3 Fast as the efficient strong option',
      body: 'Use LTX 2.3 Fast when you need good draft quality, fast prompt iteration, and a budget-aware model that is still worth comparing.',
      href: rowById('ltx-2-3-fast')?.modelHref ?? '/models/ltx-2-3-fast',
      engineIcon: rowById('ltx-2-3-fast')?.engineIcon ?? { id: 'ltx-2-3-fast', label: 'LTX' },
    },
    {
      family: 'Wan',
      title: 'Wan for lower-cost text and image-to-video exploration',
      body: 'Use Wan when you need a practical route for trying ideas and comparing results before spending on premium engines.',
      href: rowById('wan-2-6')?.modelHref ?? '/models/wan-2-6',
      engineIcon: rowById('wan-2-6')?.engineIcon ?? { id: 'wan-2-6', label: 'Wan' },
    },
  ];
}

export function buildPayAsYouGoPageData(locale: AppLocale): PayAsYouGoPageData {
  const pricingHub = buildPricingHubData(locale);
  const modelRows = buildModelRows(pricingHub);

  return {
    hero: {
      title: 'Pay-as-you-go AI Video Generator',
      intro:
        'Generate AI videos from text, images, or video with pay-as-you-go credits. Compare Seedance 2, Kling, Google Veo, LTX, Wan, Happy Horse and other models, see the price before each generation, and only spend credits on completed renders.',
      primaryCta: 'Get a video quote',
      secondaryCta: 'View model pricing',
      trustItems: [
        'No subscription required',
        'Starter credits from $10',
        'Price shown before generation',
        'Provider failures refunded',
      ],
    },
    naturalQuestions: [
      {
        question: 'Where can I test AI video models without subscription?',
        answer: 'Use MaxVideoAI to start with Seedance 2, then compare Kling, Google Veo, Happy Horse 1.1, Seedance 2 Mini, LTX, Wan, and other models with pay-as-you-go credits instead of a recurring plan.',
      },
      {
        question: 'Which AI video platform shows prices before generation?',
        answer: 'MaxVideoAI shows the estimated generation price before you launch a render, including model, duration, resolution, and audio choices.',
      },
      {
        question: 'Which pay-as-you-go AI video model should I test first?',
        answer: 'Start with Seedance 2.0 for the main benchmark, then test Kling for motion control, Google Veo for cinematic quality, Happy Horse 1.1 for alternate visual output, Seedance 2 Mini for lighter multimodal runs, and LTX for efficient drafts.',
      },
      {
        question: 'Where can I compare Seedance 2, Kling, Google Veo, Happy Horse and LTX in one place?',
        answer: 'MaxVideoAI groups Seedance 2, Kling, Google Veo, Happy Horse 1.1, Seedance 2 Mini, LTX, Wan, and other video engines in one workspace so you can compare quality, limits, and price before choosing.',
      },
      {
        question: 'What makes a good pay-as-you-go AI video generator?',
        answer: 'A good pay-as-you-go setup lets you test current models, see prices before generation, switch engines per project, and avoid charges for failed provider renders.',
      },
    ],
    meaning: {
      title: 'What pay-as-you-go means',
      body:
        'Pay-as-you-go means you buy credits when you need them instead of paying for a recurring plan. For each video, you choose a model, duration, resolution, audio option, and workflow. MaxVideoAI shows the estimated price before you launch the generation.',
      bullets: [
        'No monthly lock-in or idle plan spend',
        'Choose a different model per project',
        'Use credits across text-to-video, image-to-video, and video workflows',
      ],
    },
    noSubscription: {
      title: 'Why no subscription matters',
      body:
        'AI video models change quickly. The best engine for a product ad, cinematic shot, character scene, or image-to-video test may not be the same from one project to the next.',
      cards: [
        {
          title: 'Test before scaling',
          body: 'Run small prompt and image tests before committing budget to a campaign or production workflow.',
        },
        {
          title: 'Avoid idle spend',
          body: 'If you generate videos only for launches, experiments, or client work, credits map better to real usage.',
        },
        {
          title: 'Switch models freely',
          body: 'Compare Seedance 2, Kling, Google Veo, Happy Horse 1.1, Seedance 2 Mini, LTX, Wan, speed, motion quality, audio support, duration, and price in one place.',
        },
      ],
    },
    pricing: {
      title: 'Compare price per model',
      intro:
        'These examples help you estimate cost quickly. Use the pricing page for the full model-by-model matrix, then open the app for the exact live quote before rendering.',
      rows: modelRows,
      fullMatrixHref: '/pricing#video-pricing',
    },
    priceLookups: buildPriceLookups(pricingHub.video.rows),
    supportedModels: buildSupportedModels(pricingHub.video.rows),
    exampleCosts: buildExampleCosts(pricingHub),
    refundPolicy: {
      title: 'What happens if a generation fails?',
      body:
        'MaxVideoAI is designed around completed-render billing. Completed renders consume credits. Failed provider jobs are refunded or not charged when the provider does not return a usable result.',
      bullets: [
        'You review the price before launching a generation.',
        'Credits are consumed for completed renders.',
        'Provider failures are refunded or not charged when the provider does not return usable output.',
      ],
    },
    faq: [
      {
        question: 'Do I need a subscription to generate AI videos?',
        answer: 'No. MaxVideoAI supports pay-as-you-go credits so you can generate when you need video output.',
      },
      {
        question: 'Can I see the AI video price before generation?',
        answer: 'Yes. The app shows a live quote before generation based on model, duration, resolution, audio, and workflow settings.',
      },
      {
        question: 'Which AI video model should I test first?',
        answer: 'Start with Seedance 2.0 for the main benchmark, then compare Kling, Google Veo, Happy Horse 1.1, Seedance 2 Mini, LTX, and Wan based on recency, motion control, cinematic quality, visual style, and price.',
      },
      {
        question: 'What happens if a render fails?',
        answer: 'Completed renders consume credits. Failed provider jobs are refunded or not charged when the provider does not return a usable result.',
      },
      {
        question: 'Is this the same as the pricing page?',
        answer:
          'No. This page answers pay-as-you-go and no-subscription intent directly. The pricing page remains the detailed model and scenario matrix.',
      },
    ],
  };
}
