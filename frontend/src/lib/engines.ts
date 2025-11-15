import { listFalEngines } from '@/config/falEngines';
import { getModelRoster } from '@/lib/model-roster';
import { getPricingKernel } from '@/lib/pricing-kernel';
import type {
  EngineCaps,
  ItemizationLine,
  PreflightRequest,
  PreflightResponse,
  Resolution,
} from '@/types/engines';
import type { MemberTier, PricingSnapshot } from '@maxvideoai/pricing';
import { applyEngineVariantPricing } from '@/lib/pricing-addons';

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

const REGISTRY_ENGINES = listFalEngines().filter((entry) => (entry.category ?? 'video') === 'video');

const ENGINES_BASE: EngineCaps[] = REGISTRY_ENGINES.map((entry) => cloneEngine(entry.engine))
  .filter((engine) => !ENGINE_BLOCKLIST.has(engine.id.trim().toLowerCase()))
  .sort((a, b) => {
    const aPriority = MODEL_PRIORITY.get(a.id.toLowerCase()) ?? DEFAULT_PRIORITY;
    const bPriority = MODEL_PRIORITY.get(b.id.toLowerCase()) ?? DEFAULT_PRIORITY;
    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }
    return a.label.localeCompare(b.label);
  });

export function cloneEngine(engine: EngineCaps): EngineCaps {
  return {
    ...engine,
    params: { ...engine.params },
    inputLimits: { ...engine.inputLimits },
    providerMeta: engine.providerMeta ? { ...engine.providerMeta } : undefined,
    pricing: engine.pricing ? { ...engine.pricing } : undefined,
    pricingDetails: engine.pricingDetails ? { ...engine.pricingDetails } : undefined,
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
  let snapshot: PricingSnapshot;
  try {
    const quote = kernel.quote({
      engineId: pricingEngine.id,
      durationSec,
      resolution: effectiveResolution,
      memberTier,
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
