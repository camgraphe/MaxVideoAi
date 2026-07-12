import { computePricingSnapshot as computeKernelSnapshot, type PricingSnapshot } from '@maxvideoai/pricing';
import {
  buildAudioAddonPayload,
  buildEngineOption,
  PER_IMAGE_ENGINE_IDS,
} from '@/components/marketing/price-estimator/price-estimator-options';
import { listFalEngines, type FalEngineEntry } from '@/config/falEngines';
import { normalizeEngineId } from '@/lib/engine-alias';
import { supportsImageGeneration } from '@/lib/models/catalog';
import { computePricingSnapshot as computeLegacyPricingSnapshot } from '@/lib/pricing';
import { buildPricingDefinition } from '@/lib/pricing-definition';
import { getPricingKernel } from '@/lib/pricing-kernel';
import { DEFAULT_MARKETING_SCENARIO } from '@/lib/pricing-scenarios';
import type { EngineCaps, Mode } from '@/types/engines';
import {
  buildPricingHubData,
  getImagePresetQuote,
} from '../app/(localized)/[locale]/(marketing)/pricing/_lib/pricingHubData';
import { resolveModelOfferAmountCents } from '../app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-schema';

type PublicProjectionSurface =
  | 'pricing-hub-video'
  | 'pricing-hub-image'
  | 'pricing-hub-audio'
  | 'pricing-hub-tool'
  | 'model-page'
  | 'estimator'
  | 'price-chip'
  | 'json-ld'
  | 'workspace-preflight'
  | 'image-estimate';

type PublicProjectionRow = {
  id: string;
  surface: PublicProjectionSurface;
  engineId: string;
  status: 'exact' | 'unavailable';
  currency?: string;
  vendorSubtotalCents?: number;
  marginCents?: number;
  discountCents?: number;
  customerTotalCents?: number;
  unit?: string;
  quantity?: number;
  displayedAmount?: string;
  structuredDataAmount?: string;
  compatibilityProfile?: string;
};

const MEMBER_TIERS = ['member', 'plus', 'pro'] as const;
const PROVIDER_REFERENCE_ENGINE_IDS = new Set([
  'luma-ray-3-2',
  'luma-uni-1',
  'luma-uni-1-max',
  'seedance-2-0',
  'seedance-2-0-fast',
  'seedance-2-0-mini',
]);
const DETERMINISTIC_ENV_KEYS = [
  'DATABASE_URL',
  'LUMARAY2_BASE_5S_540P_USD',
  'LUMARAY2_FLASH_BASE_5S_540P_USD',
  'LUMARAY2_MODIFY_PER_SECOND_USD',
  'LUMARAY2_FLASH_MODIFY_PER_SECOND_USD',
  'LUMARAY2_REFRAME_PER_SECOND_USD',
  'LUMARAY2_FLASH_REFRAME_PER_SECOND_USD',
] as const;

function normalizeCurrency(currency: string | null | undefined): string {
  return currency?.trim().toUpperCase() || 'USD';
}

function parseDurationValue(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return Math.round(raw);
  if (typeof raw !== 'string') return null;
  const parsed = Number(raw.replace(/[^0-9.]/g, ''));
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
}

function resolveDefaultDuration(entry: FalEngineEntry): number {
  if (entry.category === 'image') return 1;
  const field = [...(entry.engine.inputSchema?.required ?? []), ...(entry.engine.inputSchema?.optional ?? [])].find(
    (candidate) => candidate.id === 'duration_seconds' || candidate.id === 'duration'
  );
  const direct = parseDurationValue(field?.default) ?? parseDurationValue(field?.min);
  if (direct) return direct;
  const first = Array.isArray(field?.values) ? field.values.map(parseDurationValue).find(Boolean) : null;
  return first ?? Math.max(1, Math.round(entry.engine.pricingDetails?.maxDurationSec ?? entry.engine.maxDurationSec ?? 1));
}

function resolveDefaultResolution(engine: EngineCaps): string {
  const field = [...(engine.inputSchema?.required ?? []), ...(engine.inputSchema?.optional ?? [])].find(
    (candidate) => candidate.id === 'resolution'
  );
  const allowed = engine.resolutions.map(String).filter((value) => value && value !== 'auto');
  if (typeof field?.default === 'string' && field.default !== 'auto') {
    return field.default;
  }
  return allowed[0] ?? 'default';
}

function resolveDefaultMode(entry: FalEngineEntry): Mode {
  return (entry.modes[0]?.mode ?? (entry.category === 'image' ? 't2i' : 't2v')) as Mode;
}

function snapshotRow(params: {
  id: string;
  surface: PublicProjectionSurface;
  engineId: string;
  snapshot: PricingSnapshot;
  displayedAmount?: string;
}): PublicProjectionRow {
  const addonCents = params.snapshot.addons.reduce((sum, addon) => sum + addon.amountCents, 0);
  return {
    id: params.id,
    surface: params.surface,
    engineId: params.engineId,
    status: 'exact',
    currency: normalizeCurrency(params.snapshot.currency),
    vendorSubtotalCents: Math.max(0, Math.round(params.snapshot.base.amountCents + addonCents)),
    marginCents: Math.max(0, Math.round(params.snapshot.margin.amountCents)),
    discountCents: Math.max(0, Math.round(params.snapshot.discount?.amountCents ?? 0)),
    customerTotalCents: Math.max(0, Math.round(params.snapshot.totalCents)),
    unit: params.snapshot.base.unit ?? 'unit',
    quantity: Math.max(1, params.snapshot.base.seconds),
    ...(params.displayedAmount ? { displayedAmount: params.displayedAmount } : {}),
  };
}

function unavailableRow(
  id: string,
  surface: PublicProjectionSurface,
  engineId: string
): PublicProjectionRow {
  return { id, surface, engineId, status: 'unavailable' };
}

function parseDisplayedUsdCents(value: string): number | null {
  const match = value.match(/\$\s*([0-9]+(?:\.[0-9]+)?)/);
  if (!match) return null;
  const cents = Math.round(Number(match[1]) * 100);
  return Number.isFinite(cents) && cents >= 0 ? cents : null;
}

function displayedRow(params: {
  id: string;
  surface: PublicProjectionSurface;
  engineId: string;
  display: string;
  quantity?: number;
}): PublicProjectionRow {
  const cents = parseDisplayedUsdCents(params.display);
  if (cents == null) return unavailableRow(params.id, params.surface, params.engineId);
  return {
    id: params.id,
    surface: params.surface,
    engineId: params.engineId,
    status: 'exact',
    currency: 'USD',
    customerTotalCents: cents,
    unit: 'display',
    quantity: params.quantity ?? 1,
    displayedAmount: params.display,
  };
}

function resolveCompatibilityProfile(row: PublicProjectionRow): string {
  if (row.surface === 'json-ld') return 'schema-current';
  if (row.surface === 'pricing-hub-audio') return 'audio-current';
  if (row.surface === 'pricing-hub-tool') return 'fixed-product-current';
  return PROVIDER_REFERENCE_ENGINE_IDS.has(row.engineId) ? 'provider-reference-current' : 'standard';
}

export async function collectPublicPricingProjectionRows(): Promise<PublicProjectionRow[]> {
  for (const key of DETERMINISTIC_ENV_KEYS) delete process.env[key];

  const entries = listFalEngines();
  const rows: PublicProjectionRow[] = [];
  const hub = buildPricingHubData('en');

  for (const row of hub.video.rows) {
    for (const [presetId, quote] of Object.entries(row.quotes)) {
      const id = `pricing-hub-video:${row.id}:${presetId}`;
      if (quote.status !== 'exact' || typeof quote.amountCents !== 'number') {
        rows.push(unavailableRow(id, 'pricing-hub-video', row.id));
        continue;
      }
      rows.push({
        id,
        surface: 'pricing-hub-video',
        engineId: row.id,
        status: 'exact',
        currency: 'USD',
        customerTotalCents: Math.max(0, Math.round(quote.amountCents)),
        unit: 'scenario',
        quantity: 1,
        displayedAmount: quote.display,
      });
    }
  }

  for (const entry of entries.filter((candidate) => supportsImageGeneration(candidate))) {
    const resolutions = entry.engine.resolutions.map(String).filter(Boolean);
    const standardResolution =
      entry.engine.id === 'gpt-image-2'
        ? '1024x768'
        : resolutions.includes('1k')
          ? '1k'
          : resolutions[0] ?? 'default';
    const highResolution =
      entry.engine.id === 'gpt-image-2'
        ? '3840x2160'
        : resolutions.includes('4k')
          ? '4k'
          : resolutions[resolutions.length - 1] ?? standardResolution;
    const scenarios = [
      { id: 'standard', resolution: standardResolution, quality: 'medium' as const, quantity: 1 },
      { id: 'high', resolution: highResolution, quality: 'high' as const, quantity: 1 },
      { id: 'quantity-4', resolution: standardResolution, quality: 'medium' as const, quantity: 4 },
    ];
    for (const scenario of scenarios) {
      const quote = getImagePresetQuote(entry, scenario, 'en');
      const id = `pricing-hub-image:${entry.id}:${scenario.id}`;
      if (quote.status !== 'exact' || typeof quote.amountCents !== 'number') {
        rows.push(unavailableRow(id, 'pricing-hub-image', entry.id));
        continue;
      }
      rows.push({
        id,
        surface: 'pricing-hub-image',
        engineId: entry.id,
        status: 'exact',
        currency: 'USD',
        customerTotalCents: Math.max(0, Math.round(quote.amountCents)),
        unit: 'image',
        quantity: scenario.quantity,
        displayedAmount: quote.display,
      });
    }
  }

  for (const row of hub.otherSurfaces.audioRows) {
    for (const [duration, display] of [
      [30, row.thirtySeconds],
      [60, row.sixtySeconds],
      [120, row.oneTwentySeconds],
    ] as const) {
      rows.push(
        displayedRow({
          id: `pricing-hub-audio:${row.id}:${duration}`,
          surface: 'pricing-hub-audio',
          engineId: 'audio-generation',
          display,
          quantity: duration,
        })
      );
    }
  }

  for (const row of hub.otherSurfaces.toolRows) {
    rows.push(
      displayedRow({
        id: `pricing-hub-tool:${row.id}:standard`,
        surface: 'pricing-hub-tool',
        engineId: row.id,
        display: row.standardOutput,
      }),
      displayedRow({
        id: `pricing-hub-tool:${row.id}:pro`,
        surface: 'pricing-hub-tool',
        engineId: row.id,
        display: row.proOutput,
      })
    );
  }

  async function collectSnapshot(params: {
    id: string;
    surface: PublicProjectionSurface;
    entry: FalEngineEntry;
    memberTier?: (typeof MEMBER_TIERS)[number];
    addons?: Record<string, boolean>;
    durationSec?: number;
    resolution?: string;
    mode?: Mode;
  }): Promise<void> {
    try {
      const snapshot = await computeLegacyPricingSnapshot({
        engine: params.entry.engine,
        durationSec: params.durationSec ?? resolveDefaultDuration(params.entry),
        resolution: params.resolution ?? resolveDefaultResolution(params.entry.engine),
        mode: params.mode ?? resolveDefaultMode(params.entry),
        membershipTier: params.memberTier ?? 'member',
        ...(params.addons ? { addons: params.addons } : {}),
      });
      rows.push(snapshotRow({ ...params, engineId: params.entry.id, snapshot }));
    } catch {
      rows.push(unavailableRow(params.id, params.surface, params.entry.id));
    }
  }

  for (const entry of entries.filter((candidate) => candidate.surfaces.modelPage.indexable)) {
    await collectSnapshot({ id: `model-page:${entry.id}:default`, surface: 'model-page', entry });
    const offerCents = resolveModelOfferAmountCents(entry, entry.engine);
    rows.push(
      offerCents == null
        ? unavailableRow(`json-ld:${entry.id}:offer`, 'json-ld', entry.id)
        : {
            id: `json-ld:${entry.id}:offer`,
            surface: 'json-ld',
            engineId: entry.id,
            status: 'exact',
            currency: normalizeCurrency(entry.pricingHint?.currency ?? entry.engine.pricingDetails?.currency),
            customerTotalCents: Math.max(0, Math.round(offerCents)),
            unit: 'offer',
            quantity: 1,
            structuredDataAmount: (offerCents / 100).toFixed(2),
          }
    );
  }

  for (const entry of entries.filter((candidate) => candidate.surfaces.pricing.includeInEstimator)) {
    const option = buildEngineOption(
      entry,
      entry.engine,
      entry.engine,
      getPricingKernel(),
      {},
      undefined,
      undefined
    );
    const activeResolution = option?.resolutions[0];
    if (!option || !activeResolution) {
      for (const memberTier of MEMBER_TIERS) {
        rows.push(unavailableRow(`estimator:${entry.id}:${memberTier}:default`, 'estimator', entry.id));
      }
      continue;
    }

    if (PER_IMAGE_ENGINE_IDS.has(option.id)) {
      for (const memberTier of MEMBER_TIERS) {
        rows.push({
          id: `estimator:${entry.id}:${memberTier}:default`,
          surface: 'estimator',
          engineId: entry.id,
          status: 'exact',
          currency: option.currency.toUpperCase(),
          customerTotalCents: Math.max(0, Math.round(activeResolution.rate * 100)),
          unit: 'image',
          quantity: 1,
        });
      }
      continue;
    }

    const definition =
      (option.pricingEngineCaps ? buildPricingDefinition(option.pricingEngineCaps) : null) ??
      getPricingKernel().getDefinition(option.pricingEngineId);
    if (!definition) {
      for (const memberTier of MEMBER_TIERS) {
        rows.push(unavailableRow(`estimator:${entry.id}:${memberTier}:default`, 'estimator', entry.id));
      }
      continue;
    }
    for (const memberTier of MEMBER_TIERS) {
      try {
        const { snapshot } = computeKernelSnapshot(definition, {
          engineId: option.pricingEngineId,
          durationSec: option.defaultDuration,
          resolution: activeResolution.value,
          memberTier,
        });
        rows.push(
          snapshotRow({
            id: `estimator:${entry.id}:${memberTier}:default`,
            surface: 'estimator',
            engineId: entry.id,
            snapshot,
          })
        );
      } catch {
        rows.push(unavailableRow(`estimator:${entry.id}:${memberTier}:default`, 'estimator', entry.id));
      }
    }
    if (option.audioAddonKey) {
      try {
        const { snapshot } = computeKernelSnapshot(definition, {
          engineId: option.pricingEngineId,
          durationSec: option.defaultDuration,
          resolution: activeResolution.value,
          memberTier: 'member',
          addons: buildAudioAddonPayload(option.audioAddonKey, false),
        });
        rows.push(
          snapshotRow({
            id: `estimator:${entry.id}:member:audio-off`,
            surface: 'estimator',
            engineId: entry.id,
            snapshot,
          })
        );
      } catch {
        rows.push(unavailableRow(`estimator:${entry.id}:member:audio-off`, 'estimator', entry.id));
      }
    }
  }

  const chipEngineId = normalizeEngineId(DEFAULT_MARKETING_SCENARIO.engineId) ?? DEFAULT_MARKETING_SCENARIO.engineId;
  const chipDefinition = getPricingKernel().getDefinition(chipEngineId);
  if (chipDefinition) {
    try {
      const { snapshot } = computeKernelSnapshot(chipDefinition, {
        engineId: chipEngineId,
        durationSec: DEFAULT_MARKETING_SCENARIO.durationSec,
        resolution: DEFAULT_MARKETING_SCENARIO.resolution,
        memberTier: 'member',
      });
      rows.push(
        snapshotRow({
          id: `price-chip:${chipEngineId}:default`,
          surface: 'price-chip',
          engineId: chipEngineId,
          snapshot,
        })
      );
    } catch {
      rows.push(unavailableRow(`price-chip:${chipEngineId}:default`, 'price-chip', chipEngineId));
    }
  }

  const workspaceEntries = entries
    .filter((entry) => entry.category !== 'image' && entry.surfaces.pricing.includeInEstimator)
    .slice(0, 8);
  for (const entry of workspaceEntries) {
    await collectSnapshot({
      id: `workspace-preflight:${entry.id}:default`,
      surface: 'workspace-preflight',
      entry,
    });
  }

  for (const entry of entries.filter((candidate) => candidate.category === 'image')) {
    await collectSnapshot({
      id: `image-estimate:${entry.id}:default`,
      surface: 'image-estimate',
      entry,
      durationSec: 1,
      mode: 't2i',
    });
  }

  return rows
    .map((row) =>
      row.status === 'exact'
        ? { ...row, compatibilityProfile: resolveCompatibilityProfile(row) }
        : row
    )
    .sort((left, right) => left.id.localeCompare(right.id));
}
