import { listFalEngines } from '@/config/falEngines';
import { getModelRoster } from '@/lib/model-roster';
import { getPricingKernel } from '@/lib/pricing-kernel';
import type {
  EngineCaps,
  EngineInputField,
  EngineModeUiCaps,
  ItemizationLine,
  PreflightRequest,
  PreflightResponse,
  Resolution,
} from '@/types/engines';
import type { MemberTier, PricingSnapshot } from '@maxvideoai/pricing';
import { applyEngineVariantPricing, buildEngineAddonInput } from '@/lib/pricing-addons';

export type EngineCategory = 'video' | 'image' | 'all';

export function normalizeMemberTier(value?: string | null): MemberTier {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (raw === 'plus' || raw === 'pro') {
    return raw as MemberTier;
  }
  return 'member';
}

const ENGINE_BLOCKLIST = new Set(['dev-sim', 'developer', 'developer-simulator']);

const MODEL_PRIORITY_ENTRIES = getModelRoster().map(
  (entry, index) => [String(entry.engineId).toLowerCase(), index] as [string, number]
);
const MODEL_PRIORITY = new Map<string, number>(MODEL_PRIORITY_ENTRIES);
const DEFAULT_PRIORITY = MODEL_PRIORITY_ENTRIES.length;

const REGISTRY_ENTRIES = listFalEngines();
const REGISTRY_META_BY_ID = new Map(REGISTRY_ENTRIES.map((entry) => [entry.id, entry]));
const REGISTRY_BY_CATEGORY = {
  video: REGISTRY_ENTRIES.filter((entry) => (entry.category ?? 'video') === 'video'),
  image: REGISTRY_ENTRIES.filter((entry) => (entry.category ?? 'video') === 'image'),
  all: REGISTRY_ENTRIES,
};

function buildBaseEngines(entries: typeof REGISTRY_ENTRIES): EngineCaps[] {
  return entries
    .filter((entry) => entry.surfaces.app.enabled)
    .map((entry) =>
      cloneEngine({
        ...entry.engine,
        modeCaps: Object.fromEntries(
          entry.modes.map((modeConfig) => [modeConfig.mode, cloneModeUiCaps(modeConfig.ui)])
        ),
      })
    )
    .filter((engine) => !ENGINE_BLOCKLIST.has(engine.id.trim().toLowerCase()))
    .sort((a, b) => {
      const aDiscoveryPriority = REGISTRY_META_BY_ID.get(a.id)?.surfaces.app.discoveryRank;
      const bDiscoveryPriority = REGISTRY_META_BY_ID.get(b.id)?.surfaces.app.discoveryRank;
      if (aDiscoveryPriority != null || bDiscoveryPriority != null) {
        if (aDiscoveryPriority == null) return 1;
        if (bDiscoveryPriority == null) return -1;
        if (aDiscoveryPriority !== bDiscoveryPriority) {
          return aDiscoveryPriority - bDiscoveryPriority;
        }
      }
      const aPriority = MODEL_PRIORITY.get(a.id.toLowerCase()) ?? DEFAULT_PRIORITY;
      const bPriority = MODEL_PRIORITY.get(b.id.toLowerCase()) ?? DEFAULT_PRIORITY;
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      return a.label.localeCompare(b.label);
    });
}

const ENGINES_BASE: EngineCaps[] = buildBaseEngines(REGISTRY_BY_CATEGORY.video);

function cloneModeUiCaps(caps: EngineModeUiCaps): EngineModeUiCaps {
  return {
    ...caps,
    modes: [...caps.modes],
    duration: caps.duration
      ? 'options' in caps.duration
        ? { ...caps.duration, options: [...caps.duration.options] }
        : { ...caps.duration }
      : undefined,
    frames: caps.frames ? [...caps.frames] : undefined,
    resolution: caps.resolution ? [...caps.resolution] : undefined,
    aspectRatio: caps.aspectRatio ? [...caps.aspectRatio] : undefined,
    fps: Array.isArray(caps.fps) ? [...caps.fps] : caps.fps,
    acceptsImageFormats: caps.acceptsImageFormats ? [...caps.acceptsImageFormats] : undefined,
  };
}

function cloneInputField(field: EngineInputField): EngineInputField {
  return {
    ...field,
    modes: field.modes ? [...field.modes] : undefined,
    requiredInModes: field.requiredInModes ? [...field.requiredInModes] : undefined,
    values: field.values ? [...field.values] : undefined,
  };
}

export function cloneEngine(engine: EngineCaps): EngineCaps {
  return {
    ...engine,
    params: { ...engine.params },
    inputLimits: { ...engine.inputLimits },
    inputSchema: engine.inputSchema
      ? {
          required: engine.inputSchema.required?.map(cloneInputField),
          optional: engine.inputSchema.optional?.map(cloneInputField),
          constraints: engine.inputSchema.constraints ? { ...engine.inputSchema.constraints } : undefined,
        }
      : undefined,
    providerMeta: engine.providerMeta ? { ...engine.providerMeta } : undefined,
    pricing: engine.pricing ? { ...engine.pricing } : undefined,
    pricingDetails: engine.pricingDetails ? { ...engine.pricingDetails } : undefined,
    modeCaps: engine.modeCaps
      ? Object.fromEntries(
          Object.entries(engine.modeCaps).map(([mode, caps]) => [
            mode,
            caps ? cloneModeUiCaps(caps) : caps,
          ])
        )
      : undefined,
  };
}

export function toItemization(snapshot: PricingSnapshot, memberTier?: string): PreflightResponse['itemization'] {
  const base: ItemizationLine = {
    unit: snapshot.base.unit,
    rate: snapshot.base.rate,
    seconds: snapshot.base.seconds,
    subtotal: snapshot.base.amountCents,
    type: 'base',
  };

  const addons: ItemizationLine[] = snapshot.addons.map((addon) => ({
    type: addon.type,
    subtotal: addon.amountCents,
  }));

  const fees: ItemizationLine[] = snapshot.platformFeeCents
    ? [
        {
          type: 'platform_fee',
          subtotal: snapshot.platformFeeCents,
        },
      ]
    : [];

  const discounts: ItemizationLine[] =
    snapshot.discount && snapshot.discount.amountCents
      ? [
          {
            type: 'discount',
            subtotal: -snapshot.discount.amountCents,
            tier: memberTier,
          },
        ]
      : [];

  return {
    base,
    addons,
    fees: fees.length ? fees : undefined,
    discounts,
    taxes: [],
  };
}

export function getBaseEngines(): EngineCaps[] {
  return ENGINES_BASE.map(cloneEngine);
}

export function getBaseEnginesByCategory(category: EngineCategory = 'video'): EngineCaps[] {
  const entries = REGISTRY_BY_CATEGORY[category] ?? REGISTRY_BY_CATEGORY.video;
  return buildBaseEngines(entries);
}

export async function enginesResponse(): Promise<{ ok: true; engines: EngineCaps[] }> {
  return { ok: true, engines: getBaseEngines() };
}

export async function listEngines(): Promise<EngineCaps[]> {
  return getBaseEngines();
}

export async function getEngineById(engineId: string): Promise<EngineCaps | undefined> {
  if (!engineId) return undefined;
  const normalized = engineId.trim().toLowerCase();
  const engine = ENGINES_BASE.find((entry) => entry.id.toLowerCase() === normalized);
  return engine ? cloneEngine(engine) : undefined;
}

export async function computePreflight(request: PreflightRequest): Promise<PreflightResponse> {
  const engineId = typeof request.engine === 'string' ? request.engine : '';
  const engine = await getEngineById(engineId);
  if (!engine) {
    return {
      ok: false,
      messages: ['Unknown engine selection'],
      error: {
        code: 'ENGINE_NOT_FOUND',
        message: 'Unknown engine',
      },
    };
  }

  const kernel = getPricingKernel();
  const definition = kernel.getDefinition(engine.id);
  if (!definition) {
    return {
      ok: false,
      messages: ['Pricing not available for this engine'],
      error: {
        code: 'PRICING_UNAVAILABLE',
        message: 'Pricing definition missing',
      },
    };
  }

  const requestedResolution: Resolution =
    request.resolution === 'auto'
      ? (engine.resolutions.find((value) => value !== 'auto') ?? engine.resolutions[0] ?? '1080p')
      : request.resolution;

  const availableResolutions = Object.keys(definition.resolutionMultipliers);
  let effectiveResolution: Resolution = requestedResolution;
  if (!availableResolutions.includes(effectiveResolution)) {
    const fallbackResolution =
      availableResolutions.find((value) => value !== 'default') ??
      availableResolutions[0] ??
      engine.resolutions[0] ??
      '1080p';
    effectiveResolution = fallbackResolution as Resolution;
  }

  const durationSec = Number.isFinite(request.durationSec) ? Math.max(1, Math.round(request.durationSec)) : 4;
  const memberTier = normalizeMemberTier(request.user?.memberTier);
  const pricingEngine = applyEngineVariantPricing(engine, request.mode);
  const audioEnabled = typeof request.audio === 'boolean' ? request.audio : undefined;
  const addons = buildEngineAddonInput(pricingEngine, {
    audioEnabled,
    voiceControl: request.voiceControl,
  });
  let snapshot: PricingSnapshot;
  try {
    const quote = kernel.quote({
      engineId: pricingEngine.id,
      durationSec,
      resolution: effectiveResolution,
      memberTier,
      ...(addons ? { addons } : {}),
    });
    snapshot = quote.snapshot;
  } catch (error) {
    return {
      ok: false,
      messages: ['Unable to compute pricing'],
      error: {
        code: 'PRICING_ERROR',
        message: error instanceof Error ? error.message : 'Pricing calculation failed',
      },
    };
  }

  return {
    ok: true,
    currency: snapshot.currency,
    total: snapshot.totalCents,
    itemization: toItemization(snapshot, memberTier),
    pricing: snapshot,
    caps: {
      id: engine.id,
      label: engine.label,
      maxDurationSec: engine.maxDurationSec,
      resolutions: engine.resolutions,
      aspectRatios: engine.aspectRatios,
      fps: engine.fps,
      params: engine.params,
      inputLimits: engine.inputLimits,
      inputSchema: engine.inputSchema,
      pricing: pricingEngine.pricing,
      pricingDetails: pricingEngine.pricingDetails,
    },
  };
}
