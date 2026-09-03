import type { AppLocale } from '@/i18n/locales';
import { isPublishedComparisonSlug } from '@/lib/compare-hub/data';
import { getMcpInternalLink } from '@/lib/mcp-internal-links';
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
import {
  DEFAULT_PAYG_DISCOVERY_CONFIGS,
  type PaygDiscoveryConfigs,
} from './payg-discovery-config';

export const PAYG_PAGE_PATH = '/pay-as-you-go-ai-video-generator';

const MODEL_FAMILIES = ['ltx', 'wan', 'grok', 'flux', 'seedance', 'kling', 'veo', 'gemini', 'hailuo', 'happy-horse', 'seedance-mini'] as const;
const PRIMARY_PRICE_PRESETS: readonly VideoPricePresetId[] = ['5s-720p', '8s-1080p', '10s-1080p'];
const MODEL_FAMILY_PREFERRED_IDS: Record<(typeof MODEL_FAMILIES)[number], readonly string[]> = {
  seedance: ['seedance-2-0', 'seedance-2-0-fast', 'seedance-2-0-mini'],
  'happy-horse': ['happy-horse-1-1', 'happy-horse-1-0'],
  'seedance-mini': ['seedance-2-0-mini'],
  kling: ['kling-3-turbo-pro', 'kling-3-turbo-standard', 'kling-3-pro', 'kling-3-standard', 'kling-2-5-turbo'],
  veo: ['veo-3-1', 'veo-3-1-fast', 'veo-3-1-lite'],
  gemini: ['gemini-omni-flash'],
  hailuo: ['minimax-h3', 'minimax-h3-max', 'minimax-hailuo-02-text'],
  ltx: ['ltx-2-5-pro', 'ltx-2-5-fast', 'ltx-2-3', 'ltx-2-3-fast'],
  wan: ['wan-3-prime', 'wan-3', 'wan-2-6'],
  grok: ['grok-imagine-video-1-5'],
  flux: ['flux-3', 'flux-3-draft'],
};
const PAYG_COMPARE_ALLOWED_MODEL_IDS = new Set([
  ...Object.values(MODEL_FAMILY_PREFERRED_IDS).flat(),
  'ltx-2-3-pro',
]);
const PAYG_COMPARE_CANONICAL_HREFS: Record<string, string> = {
  '/ai-video-engines/veo-3-1-vs-kling-3-pro': '/ai-video-engines/kling-3-pro-vs-veo-3-1',
};
export type BuildPayAsYouGoPageDataInput = {
  locale: AppLocale;
  content: PayAsYouGoContent;
  pricingHub?: PricingHubData;
  discoveryConfigs?: PaygDiscoveryConfigs;
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
  mcpPlanning: PayAsYouGoContent['mcpPlanning'] & { href: string; label: string } | null;
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
  if (lower.includes('gemini')) return 'gemini';
  if (lower.includes('hailuo') || lower.includes('minimax')) return 'hailuo';
  if (lower.includes('veo')) return 'veo';
  if (lower.includes('ltx')) return 'ltx';
  if (lower.includes('wan')) return 'wan';
  if (lower.includes('grok')) return 'grok';
  if (lower.includes('flux')) return 'flux';
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
  return compareIds.length === 2
    && compareIds.every((id) => PAYG_COMPARE_ALLOWED_MODEL_IDS.has(id))
    && isPublishedComparisonSlug(compareIds.join('-vs-'));
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

function formatExamplePrice(value: string, renderReady: boolean, common: PayAsYouGoContent['common']) {
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
  configs: PaygDiscoveryConfigs['priceLookups'],
  rows: VideoPricingRow[],
  lookupCopyById: PayAsYouGoContent['priceLookups']['items'],
  liveQuote: string,
): PayAsYouGoPriceLookup[] {
  return configs.flatMap((config) => {
    const row = rows.find((candidate) => candidate.id === config.id);
    if (!row) return [];
    const copy = lookupCopyById[config.id];
    return [{
      id: config.id,
      ...copy,
      engineIcon: row?.engineIcon ?? { id: config.id, label: copy.title },
      price: row?.quotes[config.presetId]?.display ?? liveQuote,
      href: `/pricing#${row.anchorId}`,
      modelHref: row?.modelHref,
    }];
  });
}

function buildExampleCosts(
  configs: PaygDiscoveryConfigs['examples'],
  pricingHub: PricingHubData,
  exampleLabels: PayAsYouGoContent['exampleCosts']['labels'],
  settingsLabel: string,
  liveQuote: string,
): PayAsYouGoExampleCost[] {
  const rowsById = new Map(pricingHub.video.rows.map((row) => [row.id, row]));
  const examples = configs.flatMap((example) => {
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
  return examples.slice(0, 6);
}

function buildSupportedModels(
  configs: PaygDiscoveryConfigs['supportedModels'],
  rows: VideoPricingRow[],
  modelCopyById: PayAsYouGoContent['modelTesting']['models'],
): PayAsYouGoSupportedModel[] {
  return configs.flatMap((config) => {
    const row = rows.find((candidate) => candidate.id === config.id);
    const href = row?.modelHref ?? config.fallbackHref;
    if (!href) return [];
    return [{
      id: config.id,
      ...modelCopyById[config.id],
      href,
      engineIcon: row?.engineIcon ?? { id: config.id, label: config.fallbackLabel },
    }];
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
  discoveryConfigs = DEFAULT_PAYG_DISCOVERY_CONFIGS,
}: BuildPayAsYouGoPageDataInput): PayAsYouGoPageData {
  const pricingHub = inputPricingHub ?? buildPricingHubData(locale);
  const { models: modelCopyById, ...modelTestingCopy } = content.modelTesting;
  const { bestFor: bestForCopy, ...pricingCopy } = content.pricing;
  const { labels: exampleLabels, settingsLabel, header: exampleCostsHeader } = content.exampleCosts;
  const rows = buildModelRows(pricingHub, bestForCopy, content.common);
  const exampleCosts = buildExampleCosts(
    discoveryConfigs.examples,
    pricingHub,
    exampleLabels,
    settingsLabel,
    content.common.liveQuote,
  );
  const sampleCost = exampleCosts[0];
  const sampleModel = findModelForExampleCost(rows, sampleCost);
  const mcpLink = getMcpInternalLink(locale, 'payg');

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
    modelTesting: {
      ...modelTestingCopy,
      items: buildSupportedModels(discoveryConfigs.supportedModels, pricingHub.video.rows, modelCopyById),
    },
    meaning: content.meaning,
    noSubscription: content.noSubscription,
    audienceFit: content.audienceFit,
    subscriptionComparison: content.subscriptionComparison,
    workflow: content.workflow,
    mcpPlanning: mcpLink ? { ...content.mcpPlanning, ...mcpLink } : null,
    quoteFactors: content.quoteFactors,
    pricing: { ...pricingCopy, rows, fullMatrixHref: '/pricing#video-pricing' },
    priceLookups: {
      ...content.priceLookups,
      items: buildPriceLookups(
        discoveryConfigs.priceLookups,
        pricingHub.video.rows,
        content.priceLookups.items,
        content.common.liveQuote,
      ),
    },
    exampleCosts: { header: exampleCostsHeader, items: exampleCosts },
    refundPolicy: content.refundPolicy,
    faq: content.faq,
  };
}
