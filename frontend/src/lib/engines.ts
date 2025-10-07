import fs from 'fs';
import path from 'path';
import type { EngineCaps, EnginePricingDetails, EnginesResponse, ItemizationLine, PreflightRequest, PreflightResponse } from '@/types/engines';
import { computePricingSnapshot } from '@/lib/pricing';
import { ensureBillingSchema } from '@/lib/schema';
import { getFalCatalog, getDefaultModelMap } from '@/lib/fal-catalog';

function toPricingDetailsFromPricing(pricing: EngineCaps['pricing'] | undefined): EnginePricingDetails | undefined {
  if (!pricing) return undefined;
  const currency = pricing.currency ?? 'USD';
  const perSecondByResolution: Record<string, number> = {};
  if (pricing.byResolution) {
    for (const [resolution, rate] of Object.entries(pricing.byResolution)) {
      const cents = Math.round(Number(rate) * 100);
      perSecondByResolution[resolution] = cents;
    }
  }
  const baseRateCents = pricing.base != null ? Math.round(Number(pricing.base) * 100) : undefined;
  if (!baseRateCents && Object.keys(perSecondByResolution).length === 0) {
    return undefined;
  }
  return {
    currency,
    perSecondCents: {
      default: baseRateCents,
      byResolution: Object.keys(perSecondByResolution).length ? perSecondByResolution : undefined,
    },
  };
}

function loadFixtureEngines(): EngineCaps[] | null {
  try {
    const file = path.join(process.cwd(), '..', 'fixtures', 'engines.json');
    const raw = fs.readFileSync(file, 'utf-8');
    type RawEngine = Partial<EngineCaps> & Record<string, unknown>;
    const parsed = JSON.parse(raw) as { engines?: RawEngine[] };
    if (!parsed || !Array.isArray(parsed.engines)) return null;

    const mapped: EngineCaps[] = parsed.engines
      .filter((engine) => String(engine.id ?? '').trim() !== '' && String(engine.id) !== 'dev-sim')
      .map((engine) => {
        const pricingRaw = typeof engine.pricing === 'object' && engine.pricing ? (engine.pricing as EngineCaps['pricing']) : undefined;
        const pricing = pricingRaw
          ? {
              ...pricingRaw,
              currency: pricingRaw.currency ?? 'USD',
            }
          : undefined;
        const pricingDetails =
          engine.pricingDetails
            ? (engine.pricingDetails as EnginePricingDetails)
            : toPricingDetailsFromPricing(pricing);

        return {
          id: String(engine.id),
          label: String(engine.label ?? engine.id ?? 'unknown'),
          provider: String(engine.provider ?? 'unknown'),
          version: engine.version ? String(engine.version) : undefined,
          variant: engine.variant ? String(engine.variant) : undefined,
          isLab: Boolean(engine.isLab ?? false),
          status: (engine.status ?? 'live') as EngineCaps['status'],
          latencyTier: (engine.latencyTier ?? 'standard') as EngineCaps['latencyTier'],
          queueDepth: typeof engine.queueDepth === 'number' ? engine.queueDepth : undefined,
          region: engine.region ? String(engine.region) : undefined,
          vendorAccountId: engine.vendorAccountId ? String(engine.vendorAccountId) : undefined,
          modes: Array.isArray(engine.modes) && engine.modes.length ? (engine.modes as EngineCaps['modes']) : ['t2v'],
          maxDurationSec: Number(engine.maxDurationSec ?? 8),
          resolutions: Array.isArray(engine.resolutions) && engine.resolutions.length ? (engine.resolutions as EngineCaps['resolutions']) : ['720p', '1080p'],
          aspectRatios: Array.isArray(engine.aspectRatios) && engine.aspectRatios.length ? (engine.aspectRatios as EngineCaps['aspectRatios']) : ['16:9', '9:16', '1:1'],
          fps: Array.isArray(engine.fps) && engine.fps.length ? (engine.fps as number[]) : [24],
          audio: Boolean(engine.audio ?? false),
          upscale4k: Boolean(engine.upscale4k ?? false),
          extend: Boolean(engine.extend ?? false),
          motionControls: Boolean(engine.motionControls ?? false),
          keyframes: Boolean(engine.keyframes ?? false),
          params: typeof engine.params === 'object' && engine.params ? (engine.params as EngineCaps['params']) : {},
          inputLimits: typeof engine.inputLimits === 'object' && engine.inputLimits ? (engine.inputLimits as EngineCaps['inputLimits']) : {},
          inputSchema: engine.inputSchema ? (engine.inputSchema as EngineCaps['inputSchema']) : undefined,
          pricing,
          apiAvailability: typeof engine.apiAvailability === 'string' ? engine.apiAvailability : undefined,
          updatedAt: String(engine.updatedAt ?? new Date().toISOString()),
          ttlSec: Number(engine.ttlSec ?? 300),
          providerMeta: engine.providerMeta
            ? (engine.providerMeta as EngineCaps['providerMeta'])
            : {
                provider: String(engine.provider ?? 'unknown'),
                modelSlug: engine.modelSlug ? String(engine.modelSlug) : String(engine.id),
              },
          pricingDetails,
          iconUrl: typeof engine.icon_url === 'string' && engine.icon_url ? String(engine.icon_url) : undefined,
          fallbackIcon: typeof engine.fallback_icon === 'string' && engine.fallback_icon ? String(engine.fallback_icon) : undefined,
        };
      });

    return mapped.length ? mapped : null;
  } catch {
    return null;
  }
}

const INTERNAL_ENGINES: EngineCaps[] = [
  {
    id: 'pika-22',
    label: 'Pika 2.2',
    provider: 'Pika',
    version: '2.2',
    status: 'busy',
    latencyTier: 'standard',
    queueDepth: 8,
    modes: ['t2v', 'i2v', 'v2v'],
    maxDurationSec: 12,
    resolutions: ['720p', '1080p'],
    aspectRatios: ['16:9', '9:16', '1:1'],
    fps: [24, 30],
    audio: false,
    upscale4k: true,
    extend: true,
    motionControls: true,
    keyframes: true,
    params: { guidance: { min: 0, max: 20, default: 10 } },
    inputLimits: { imageMaxMB: 15, videoMaxMB: 120 },
    inputSchema: undefined,
    pricing: { unit: 'sec', byResolution: { '720p': 0.04, '1080p': 0.07 }, currency: 'USD' },
    updatedAt: new Date().toISOString(),
    ttlSec: 300,
    providerMeta: {
      provider: 'Pika',
      modelSlug: getDefaultModelMap()['pika-22'],
    },
    pricingDetails: {
      currency: 'USD',
      perSecondCents: {
        byResolution: { '720p': 4, '1080p': 7 },
      },
    },
    iconUrl: undefined,
    fallbackIcon: '/icons/engines/pika-22.svg',
  },
  {
    id: 'luma-dm',
    label: 'Luma Dream Machine',
    provider: 'Luma',
    version: '1',
    status: 'live',
    latencyTier: 'fast',
    queueDepth: 2,
    modes: ['t2v', 'v2v'],
    maxDurationSec: 8,
    resolutions: ['720p', '1080p'],
    aspectRatios: ['16:9', '1:1'],
    fps: [24],
    audio: true,
    upscale4k: false,
    extend: false,
    motionControls: true,
    keyframes: false,
    params: { guidance: { min: 0, max: 20, default: 8 } },
    inputLimits: { imageMaxMB: 10, videoMaxMB: 80 },
    inputSchema: undefined,
    pricing: { unit: 'sec', byResolution: { '720p': 0.05, '1080p': 0.09 }, currency: 'USD' },
    updatedAt: new Date().toISOString(),
    ttlSec: 300,
    providerMeta: {
      provider: 'Luma',
      modelSlug: getDefaultModelMap()['luma-dm'],
    },
    pricingDetails: {
      currency: 'USD',
      perSecondCents: {
        byResolution: { '720p': 5, '1080p': 9 },
      },
      addons: {
        audio: { perSecondCents: 2 },
      },
    },
    iconUrl: undefined,
    fallbackIcon: '/icons/engines/luma-dm.svg',
  },
  {
    id: 'veo-3',
    label: 'Veo 3',
    provider: 'Google DeepMind',
    version: '3',
    status: 'live',
    latencyTier: 'fast',
    queueDepth: 1,
    modes: ['t2v'],
    maxDurationSec: 16,
    resolutions: ['720p', '1080p', '4k'],
    aspectRatios: ['16:9', '9:16', '1:1'],
    fps: [24],
    audio: true,
    upscale4k: true,
    extend: true,
    motionControls: true,
    keyframes: false,
    params: {},
    inputLimits: {},
    inputSchema: undefined,
    pricing: {
      unit: 'sec',
      byResolution: { '720p': 0.08, '1080p': 0.12, '4k': 0.2 },
      currency: 'USD',
    },
    updatedAt: new Date().toISOString(),
    ttlSec: 300,
    providerMeta: {
      provider: 'Google DeepMind',
      modelSlug: getDefaultModelMap()['veo-3'],
    },
    pricingDetails: {
      currency: 'USD',
      perSecondCents: {
        byResolution: { '720p': 8, '1080p': 12, '4k': 20 },
      },
      addons: {
        audio: { perSecondCents: 3 },
        upscale4k: { flatCents: 250 },
      },
    },
    iconUrl: 'https://upload.wikimedia.org/wikipedia/commons/2/2f/Google_2015_logo.svg',
    fallbackIcon: '/icons/engines/veo-3.svg',
  },
];

type EngineCache = {
  engines: EngineCaps[];
  fetchedAt: number;
};

let enginesCache: EngineCache | null = null;
const ENGINE_CACHE_TTL_MS = 60_000;

async function buildEngines(): Promise<EngineCaps[]> {
  const fixtures = loadFixtureEngines() ?? [];
  const enginesMap = new Map<string, EngineCaps>();
  for (const engine of fixtures) {
    enginesMap.set(engine.id, engine);
  }

  const catalog = await getFalCatalog();
  if (catalog?.engines?.length) {
    for (const engine of catalog.engines) {
      enginesMap.set(engine.id, engine);
    }
  }

  if (!enginesMap.size) {
    for (const engine of INTERNAL_ENGINES) {
      enginesMap.set(engine.id, engine);
    }
  }

  return Array.from(enginesMap.values());
}

export async function getEngines(forceRefresh = false): Promise<EngineCaps[]> {
  if (!forceRefresh && enginesCache && Date.now() - enginesCache.fetchedAt < ENGINE_CACHE_TTL_MS) {
    return enginesCache.engines;
  }
  const engines = await buildEngines();
  enginesCache = { engines, fetchedAt: Date.now() };
  return engines;
}

export async function getEngineById(engineId: string): Promise<EngineCaps | undefined> {
  const engines = await getEngines();
  return engines.find((entry) => entry.id === engineId);
}

export async function enginesResponse(): Promise<EnginesResponse> {
  const engines = await getEngines();
  return { engines };
}

export async function computePreflight(req: PreflightRequest): Promise<PreflightResponse> {
  await ensureBillingSchema();

  const engines = await getEngines();
  const caps = engines.find((e) => e.id === req.engine);
  if (!caps) {
    return { ok: false, error: { code: 'ENGINE_NOT_FOUND', message: 'Unknown engine' } };
  }

  const pricing = await computePricingSnapshot({
    engine: caps,
    durationSec: req.durationSec,
    resolution: req.resolution,
    addons: req.addons,
    membershipTier: req.user?.memberTier,
  });

  const pricingDetails = caps.pricingDetails;
  const perSecondCents =
    pricingDetails?.perSecondCents?.byResolution?.[req.resolution] ?? pricingDetails?.perSecondCents?.default ?? undefined;
  const rate = perSecondCents != null ? perSecondCents / 100 : caps.pricing?.byResolution?.[req.resolution] ?? caps.pricing?.base ?? 0.05;
  const addons: ItemizationLine[] = pricing.addons.map((line) => ({
    type: line.type,
    subtotal: line.amountCents / 100,
  }));
  const fees: ItemizationLine[] = pricing.margin.amountCents
    ? [
        {
          type: 'margin',
          subtotal: pricing.margin.amountCents / 100,
          rateDisplay:
            pricing.margin.percentApplied != null
              ? `+${Math.round((pricing.margin.percentApplied ?? 0) * 100)}%`
              : undefined,
        },
      ]
    : [];

  const discountLine: ItemizationLine[] = pricing.discount
    ? [
        {
          type: 'member',
          amount: (pricing.discount.percentApplied ?? 0) * 100,
          subtotal: -(pricing.discount.amountCents / 100),
          tier: pricing.discount.tier,
        },
      ]
    : [];

  const taxes: ItemizationLine[] = []; // 0 for now
  const total = pricing.totalCents / 100;

  return {
    ok: true,
    currency: pricing.currency,
    itemization: {
      base: {
        unit: caps.pricing?.unit,
        rate,
        seconds: req.durationSec,
        subtotal: pricing.base.amountCents / 100,
      },
      addons,
      fees,
      discounts: discountLine,
      taxes,
    },
    total,
    caps: { ...caps, pricing: undefined },
    ttlSec: 60,
    messages: [],
    pricing,
  };
}
