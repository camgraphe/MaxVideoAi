import type { AppLocale } from '@/i18n/locales';
import type {
  PayAsYouGoContent,
  PaygExampleCostId,
  PaygPriceLookupId,
  PaygSupportedModelId,
} from '../_content/types';
import {
  buildPricingHubData,
  type PresetQuote,
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
  { id: 'seedance-2-0', presetId: '5s-720p' },
  { id: 'kling-3-pro', presetId: '8s-1080p' },
  { id: 'veo-3-1', presetId: '8s-1080p' },
  { id: 'happy-horse-1-1', presetId: '5s-720p' },
  { id: 'seedance-2-0-mini', presetId: '5s-720p' },
  { id: 'ltx-2-3-fast', presetId: '8s-1080p' },
] as const satisfies readonly { id: PaygPriceLookupId; presetId: VideoPricePresetId }[];
const PREFERRED_EXAMPLES = [
  { id: 'seedance-2-0', presetId: '5s-720p' },
  { id: 'kling-3-pro', presetId: '8s-1080p' },
  { id: 'veo-3-1-fast', presetId: '8s-1080p' },
  { id: 'happy-horse-1-1', presetId: '5s-720p' },
  { id: 'seedance-2-0-mini', presetId: '5s-720p' },
  { id: 'ltx-2-3-fast', presetId: '8s-1080p' },
] as const satisfies readonly { id: PaygExampleCostId; presetId: VideoPricePresetId }[];
const SUPPORTED_MODEL_CONFIGS = [
  { id: 'seedance-2-0', fallbackHref: '/models/seedance-2-0', fallbackLabel: 'Seedance 2.0' },
  { id: 'kling-3-pro', fallbackHref: '/models/kling-3-pro', fallbackLabel: 'Kling' },
  { id: 'veo-3-1', fallbackHref: '/models/veo-3-1', fallbackLabel: 'Google Veo' },
  { id: 'happy-horse-1-1', fallbackHref: '/models/happy-horse-1-1', fallbackLabel: 'Happy Horse 1.1' },
  { id: 'seedance-2-0-mini', fallbackHref: '/models/dreamina-seedance-2-0-mini', fallbackLabel: 'Seedance 2.0 Mini' },
  { id: 'ltx-2-3-fast', fallbackHref: '/models/ltx-2-3-fast', fallbackLabel: 'LTX' },
  { id: 'wan-2-6', fallbackHref: '/models/wan-2-6', fallbackLabel: 'Wan' },
] as const satisfies readonly {
  id: PaygSupportedModelId;
  fallbackHref: string;
  fallbackLabel: string;
}[];

export type BuildPayAsYouGoPageDataInput = {
  locale: AppLocale;
  content: PayAsYouGoContent;
  pricingHub?: PricingHubData;
};

export type PayAsYouGoEngineIcon = {
  id: string;
  label: string;
  brandId?: string;
};

export type PayAsYouGoPriceCell = {
  presetId: VideoPricePresetId;
  label: string;
  value: string;
  displayValue: string;
  renderReady: boolean;
  note?: string;
};

export type PayAsYouGoModelRow = {
  id: string;
  engineIcon: PayAsYouGoEngineIcon;
  engineName: string;
  family: string;
  bestFor: string;
  modelHref?: string;
  compareHref?: string;
  priceCells: PayAsYouGoPriceCell[];
};

export type PayAsYouGoPriceLookup = {
  id: PaygPriceLookupId;
  query: string;
  title: string;
  body: string;
  engineIcon: PayAsYouGoEngineIcon;
  price: string;
  href: string;
  modelHref?: string;
};

export type PayAsYouGoSupportedModel = {
  id: PaygSupportedModelId;
  family: string;
  title: string;
  body: string;
  href: string;
  engineIcon: PayAsYouGoEngineIcon;
};

export type PayAsYouGoExampleCost = {
  id: PaygExampleCostId;
  label: string;
  engine: string;
  price: string;
  context: string;
  href: string;
};

export type PayAsYouGoPageData = {
  common: PayAsYouGoContent['common'];
  hero: Omit<PayAsYouGoContent['hero'], 'quote'> & {
    quote: PayAsYouGoContent['hero']['quote'] & {
      previewRows: Array<PayAsYouGoModelRow & { quoteLabel: string }>;
      sampleModelName: string;
      sampleCost?: PayAsYouGoExampleCost;
    };
  };
  naturalQuestions: PayAsYouGoContent['naturalQuestions'];
  modelTesting: Omit<PayAsYouGoContent['modelTesting'], 'models'> & { items: PayAsYouGoSupportedModel[] };
  meaning: PayAsYouGoContent['meaning'];
  noSubscription: PayAsYouGoContent['noSubscription'];
  audienceFit: PayAsYouGoContent['audienceFit'];
  subscriptionComparison: PayAsYouGoContent['subscriptionComparison'];
  workflow: PayAsYouGoContent['workflow'];
  quoteFactors: PayAsYouGoContent['quoteFactors'];
  pricing: Omit<PayAsYouGoContent['pricing'], 'bestFor'> & {
    rows: PayAsYouGoModelRow[];
    fullMatrixHref: string;
  };
  priceLookups: Omit<PayAsYouGoContent['priceLookups'], 'items'> & { items: PayAsYouGoPriceLookup[] };
  exampleCosts: Pick<PayAsYouGoContent['exampleCosts'], 'header'> & { items: PayAsYouGoExampleCost[] };
  refundPolicy: PayAsYouGoContent['refundPolicy'];
  faq: PayAsYouGoContent['faq'];
};

function rowIncludesFamily(row: VideoPricingRow, family: string) {
  const haystack = `${row.family} ${row.engineName} ${row.id}`.toLowerCase();
  return haystack.includes(family);
}

function pickRowsByFamily(rows: VideoPricingRow[]) {
  const selected = new Map<string, VideoPricingRow>();
  MODEL_FAMILIES.forEach((family) => {
    const preferred = MODEL_FAMILY_PREFERRED_IDS[family]
      .map((id) => rows.find((row) => row.id === id))
      .find(Boolean);
    const match = preferred ?? rows.find((row) => row.pricingGroup === 'recommended' && rowIncludesFamily(row, family));
    if (match) selected.set(family, match);
  });
  return [...selected.values()];
}

function bestForId(row: VideoPricingRow): keyof PayAsYouGoContent['pricing']['bestFor'] {
  const lower = `${row.family} ${row.engineName}`.toLowerCase();
  if (lower.includes('seedance') && lower.includes('mini')) return 'seedanceMini';
  if (lower.includes('seedance')) return 'seedance';
  if (lower.includes('happy-horse')) return 'happyHorse';
  if (lower.includes('kling')) return 'kling';
  if (lower.includes('veo')) return 'veo';
  if (lower.includes('ltx')) return 'ltx';
  if (lower.includes('wan')) return 'wan';
  return 'fallback';
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

function isRenderReadyQuote(quote: PresetQuote | undefined) {
  const display = quote?.display?.trim();
  return Boolean(
    quote
    && (quote.status === 'exact' || quote.status === 'closest')
    && display
    && display !== '-'
    && display !== '—',
  );
}

function formatExamplePrice(
  value: string,
  renderReady: boolean,
  common: PayAsYouGoContent['common'],
) {
  return renderReady ? `${common.examplePrefix} : ${value}` : value;
}

function buildModelRows(
  pricingHub: PricingHubData,
  bestForCopy: PayAsYouGoContent['pricing']['bestFor'],
  common: PayAsYouGoContent['common'],
): PayAsYouGoModelRow[] {
  const presets = pricingHub.video.presets.filter((preset) => PRIMARY_PRICE_PRESETS.includes(preset.id));
  return pickRowsByFamily(pricingHub.video.rows).map((row) => ({
    id: row.id,
    engineIcon: row.engineIcon,
    engineName: row.engineName,
    family: row.family,
    bestFor: bestForCopy[bestForId(row)],
    modelHref: row.modelHref,
    compareHref: pickPaygCompareHref(row.links),
    priceCells: presets.map((preset) => {
      const quote = row.quotes[preset.id];
      const value = quote?.display ?? common.liveQuote;
      const renderReady = isRenderReadyQuote(quote);
      return {
        presetId: preset.id,
        label: preset.label,
        value,
        displayValue: formatExamplePrice(value, renderReady, common),
        renderReady,
        note: quote?.note?.replace(/\baudio incl\.?\b/gi, common.audioIncluded),
      };
    }),
  }));
}

function buildPriceLookups(
  rows: VideoPricingRow[],
  lookupCopyById: PayAsYouGoContent['priceLookups']['items'],
  liveQuote: string,
): PayAsYouGoPriceLookup[] {
  return PRICE_LOOKUP_CONFIGS.map((config) => {
    const row = rows.find((candidate) => candidate.id === config.id);
    const copy = lookupCopyById[config.id];
    return {
      id: config.id,
      ...copy,
      engineIcon: row?.engineIcon ?? { id: config.id, label: copy.title },
      price: row?.quotes[config.presetId]?.display ?? liveQuote,
      href: row ? `/pricing#${row.anchorId}` : '/pricing#video-pricing',
      modelHref: row?.modelHref,
    };
  });
}

function buildExampleCosts(
  pricingHub: PricingHubData,
  exampleLabels: PayAsYouGoContent['exampleCosts']['labels'],
  settingsLabel: string,
  liveQuote: string,
): PayAsYouGoExampleCost[] {
  const rowsById = new Map(pricingHub.video.rows.map((row) => [row.id, row]));
  const examples = PREFERRED_EXAMPLES.flatMap((example) => {
    const row = rowsById.get(example.id);
    if (!row) return [];
    return [{
      id: example.id,
      label: exampleLabels[example.id],
      engine: row.engineName,
      price: row.quotes[example.presetId]?.display ?? liveQuote,
      context: pricingHub.video.presets.find((preset) => preset.id === example.presetId)?.label ?? settingsLabel,
      href: `/pricing#${row.anchorId}`,
    }];
  });
  if (examples.length >= 6) return examples.slice(0, 6);
  return pricingHub.popularChecks.slice(0, 4).flatMap((check, index) => {
    const config = PREFERRED_EXAMPLES[index];
    return config ? [{ id: config.id, label: check.priceCheck, engine: check.engine, price: check.price, context: settingsLabel, href: check.link.href }] : [];
  });
}

function buildSupportedModels(
  rows: VideoPricingRow[],
  modelCopyById: PayAsYouGoContent['modelTesting']['models'],
): PayAsYouGoSupportedModel[] {
  return SUPPORTED_MODEL_CONFIGS.map((config) => {
    const row = rows.find((candidate) => candidate.id === config.id);
    return {
      id: config.id,
      ...modelCopyById[config.id],
      href: row?.modelHref ?? config.fallbackHref,
      engineIcon: row?.engineIcon ?? { id: config.id, label: config.fallbackLabel },
    };
  });
}

function findModelForExampleCost(rows: PayAsYouGoModelRow[], sampleCost: PayAsYouGoExampleCost | undefined) {
  if (!sampleCost) return rows[0];
  const costEngine = sampleCost.engine.toLowerCase();
  return rows.find((row) => {
    const rowName = row.engineName.toLowerCase();
    return costEngine.includes(rowName) || rowName.includes(costEngine);
  }) ?? rows.find((row) => row.priceCells.some((cell) => cell.value === sampleCost.price)) ?? rows[0];
}

export function buildPayAsYouGoPageData({
  locale,
  content,
  pricingHub: inputPricingHub,
}: BuildPayAsYouGoPageDataInput): PayAsYouGoPageData {
  const pricingHub = inputPricingHub ?? buildPricingHubData(locale);
  const { models: modelCopyById, ...modelTestingCopy } = content.modelTesting;
  const { bestFor: bestForCopy, ...pricingCopy } = content.pricing;
  const { labels: exampleLabels, settingsLabel, header: exampleCostsHeader } = content.exampleCosts;
  const rows = buildModelRows(pricingHub, bestForCopy, content.common);
  const exampleCosts = buildExampleCosts(
    pricingHub,
    exampleLabels,
    settingsLabel,
    content.common.liveQuote,
  );
  const sampleCost = exampleCosts[0];
  const sampleModel = findModelForExampleCost(rows, sampleCost);

  return {
    common: content.common,
    hero: {
      ...content.hero,
      quote: {
        ...content.hero.quote,
        previewRows: rows.slice(0, 4).map((row) => ({
          ...row,
          quoteLabel: row.priceCells.find((cell) => cell.renderReady)?.value
            ?? content.common.liveQuote,
        })),
        sampleModelName: sampleModel?.engineName ?? content.hero.quote.chooseModel,
        sampleCost,
      },
    },
    naturalQuestions: content.naturalQuestions,
    modelTesting: { ...modelTestingCopy, items: buildSupportedModels(pricingHub.video.rows, modelCopyById) },
    meaning: content.meaning,
    noSubscription: content.noSubscription,
    audienceFit: content.audienceFit,
    subscriptionComparison: content.subscriptionComparison,
    workflow: content.workflow,
    quoteFactors: content.quoteFactors,
    pricing: { ...pricingCopy, rows, fullMatrixHref: '/pricing#video-pricing' },
    priceLookups: {
      ...content.priceLookups,
      items: buildPriceLookups(pricingHub.video.rows, content.priceLookups.items, content.common.liveQuote),
    },
    exampleCosts: { header: exampleCostsHeader, items: exampleCosts },
    refundPolicy: content.refundPolicy,
    faq: content.faq,
  };
}
