import enginesFixture from '../../fixtures/engines.json';
import { getPricingKernel } from '@/lib/pricing-kernel';
import { getModelRoster } from '@/lib/model-roster';
import type {
  AspectRatio,
  EngineAvailability,
  EngineCaps,
  EngineInputLimits,
  EngineInputSchema,
  EngineParam,
  EnginePricing,
  EnginePricingDetails,
  EngineStatus,
  ItemizationLine,
  LatencyTier,
  Mode,
  PreflightRequest,
  PreflightResponse,
  Resolution,
} from '@/types/engines';
import type { MemberTier, PricingSnapshot } from '@maxvideoai/pricing';

type EnginesFixture = {
  engines?: unknown;
};

type RawEngine = Record<string, unknown>;

const ENGINE_STATUS: EngineStatus[] = ['live', 'busy', 'degraded', 'maintenance', 'early_access'];
const LATENCY: LatencyTier[] = ['fast', 'standard'];
const AVAILABILITY: EngineAvailability[] = ['available', 'limited', 'waitlist', 'paused'];
const MODES: Mode[] = ['t2v', 'i2v'];
const RESOLUTIONS: Resolution[] = ['720p', '1080p', '4k', '512P', '768P', 'auto'];
const ASPECT_RATIOS: AspectRatio[] = ['16:9', '9:16', '1:1', '4:5', 'custom', 'source', 'auto'];

function includesValue<T extends string>(values: readonly T[], value: string): value is T {
  return values.includes(value as T);
}

function normalizeMemberTier(value?: string | null): MemberTier {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (raw === 'plus' || raw === 'pro') {
    return raw as MemberTier;
  }
  return 'member';
}

function sanitizeString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
}

function sanitizeNumber(value: unknown, fallback = 0): number {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function sanitizeBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
  }
  if (typeof value === 'number') return value !== 0;
  return fallback;
}

function sanitizeModeArray(value: unknown): Mode[] {
  const result: Mode[] = [];
  if (Array.isArray(value)) {
    value.forEach((entry) => {
      const mode = sanitizeString(entry).toLowerCase();
      if (includesValue(MODES, mode)) {
        result.push(mode);
      }
    });
  }
  return result.length ? result : ['t2v'];
}

function sanitizeResolutionArray(value: unknown): Resolution[] {
  const result: Resolution[] = [];
  if (Array.isArray(value)) {
    value.forEach((entry) => {
      const resolution = sanitizeString(entry);
      if (includesValue(RESOLUTIONS, resolution)) {
        result.push(resolution);
      }
    });
  }
  return result.length ? result : ['1080p'];
}

function sanitizeAspectRatioArray(value: unknown): AspectRatio[] {
  const result: AspectRatio[] = [];
  if (Array.isArray(value)) {
    value.forEach((entry) => {
      const aspect = sanitizeString(entry);
      if (includesValue(ASPECT_RATIOS, aspect)) {
        result.push(aspect);
      }
    });
  }
  return result.length ? result : ['16:9'];
}

function sanitizeNumberArray(value: unknown, fallback: number[] = [24]): number[] {
  if (Array.isArray(value)) {
    const list = value
      .map((entry) => sanitizeNumber(entry))
      .filter((entry) => Number.isFinite(entry) && entry > 0);
    return list.length ? list : fallback;
  }
  return fallback;
}

function sanitizeParams(value: unknown): Record<string, EngineParam> {
  if (!value || typeof value !== 'object') return {};
  const result: Record<string, EngineParam> = {};
  Object.entries(value as Record<string, unknown>).forEach(([key, raw]) => {
    if (!raw || typeof raw !== 'object') return;
    const param = raw as Record<string, unknown>;
    const min = sanitizeNumber(param.min, 0);
    const max = sanitizeNumber(param.max, min);
    const defaultValue = sanitizeNumber(param.default, min);
    const stepRaw = param.step;
    const step = typeof stepRaw === 'number' && Number.isFinite(stepRaw) ? stepRaw : undefined;
    result[key] = {
      min,
      max,
      default: defaultValue,
      step,
    };
  });
  return result;
}

function sanitizeInputLimits(value: unknown): EngineInputLimits {
  if (!value || typeof value !== 'object') {
    return {};
  }
  const limits = value as Record<string, unknown>;
  return {
    imageMaxMB: limits.imageMaxMB != null ? sanitizeNumber(limits.imageMaxMB, 10) : undefined,
    videoMaxMB: limits.videoMaxMB != null ? sanitizeNumber(limits.videoMaxMB, 0) : undefined,
    videoMaxDurationSec:
      limits.videoMaxDurationSec != null ? sanitizeNumber(limits.videoMaxDurationSec, 0) : undefined,
    videoCodecs: Array.isArray(limits.videoCodecs)
      ? (limits.videoCodecs as unknown[]).map((codec) => sanitizeString(codec)).filter(Boolean)
      : undefined,
  };
}

function sanitizeInputSchema(value: unknown): EngineInputSchema | undefined {
  if (!value || typeof value !== 'object') return undefined;
  return value as EngineInputSchema;
}

function sanitizePricing(value: unknown): EnginePricing | undefined {
  if (!value || typeof value !== 'object') return undefined;
  return value as EnginePricing;
}

function sanitizePricingDetails(value: unknown): EnginePricingDetails | undefined {
  if (!value || typeof value !== 'object') return undefined;
  return value as EnginePricingDetails;
}

function sanitizeEngine(raw: RawEngine): EngineCaps | null {
  const id = sanitizeString(raw.id);
  if (!id) return null;

  const label = sanitizeString(raw.label, id);
  const provider = sanitizeString(raw.provider, 'unknown');
  const statusRaw = sanitizeString(raw.status, 'live').toLowerCase();
  const status = includesValue(ENGINE_STATUS, statusRaw) ? statusRaw : 'live';
  const latencyRaw = sanitizeString(raw.latencyTier, 'standard').toLowerCase();
  const latencyTier = includesValue(LATENCY, latencyRaw) ? latencyRaw : 'standard';
  const availabilityRaw = sanitizeString(raw.availability, 'available').toLowerCase();
  const availability = includesValue(AVAILABILITY, availabilityRaw) ? availabilityRaw : 'available';

  const params = sanitizeParams(raw.params);
  const inputLimits = sanitizeInputLimits(raw.inputLimits);
  const inputSchema = sanitizeInputSchema(raw.inputSchema);
  const pricing = sanitizePricing(raw.pricing);
  const pricingDetails = sanitizePricingDetails(raw.pricingDetails);

  const updatedAt = sanitizeString(raw.updatedAt, new Date().toISOString());
  const ttlSec = sanitizeNumber(raw.ttlSec, 600);

  const iconUrlValue = raw.icon_url ?? raw.iconUrl;
  const iconUrl = iconUrlValue == null ? null : sanitizeString(iconUrlValue);
  const fallbackIconValue = raw.fallback_icon ?? raw.fallbackIcon;
  const fallbackIcon = fallbackIconValue == null ? null : sanitizeString(fallbackIconValue);

  const brandPolicyRaw = raw.brandAssetPolicy;
  const brandAssetPolicy =
    brandPolicyRaw && typeof brandPolicyRaw === 'object'
      ? (() => {
          const policy = brandPolicyRaw as Record<string, unknown>;
          const linkRaw = policy.linkToGuidelines;
          const usageRaw = policy.usageNotes;
          const link =
            typeof linkRaw === 'string' && linkRaw.trim().length > 0 ? linkRaw.trim() : undefined;
          const usage =
            typeof usageRaw === 'string' && usageRaw.trim().length > 0 ? usageRaw.trim() : undefined;
          return {
            logoAllowed: sanitizeBoolean(policy.logoAllowed, false),
            textOnly: sanitizeBoolean(policy.textOnly, false),
            linkToGuidelines: link,
            usageNotes: usage,
          };
        })()
      : undefined;

  const providerMetaRaw = raw.providerMeta ?? raw.provider_meta;
  const providerMeta =
    providerMetaRaw && typeof providerMetaRaw === 'object'
      ? (providerMetaRaw as { provider?: string; modelSlug?: string })
      : undefined;

  return {
    id,
    label,
    provider,
    version: raw.version ? sanitizeString(raw.version) : undefined,
    variant: raw.variant ? sanitizeString(raw.variant) : undefined,
    isLab: sanitizeBoolean(raw.isLab, false),
    status,
    latencyTier,
    queueDepth: raw.queueDepth != null ? sanitizeNumber(raw.queueDepth, 0) : undefined,
    region: raw.region ? sanitizeString(raw.region) : undefined,
    vendorAccountId: raw.vendorAccountId ? sanitizeString(raw.vendorAccountId) : undefined,
    modes: sanitizeModeArray(raw.modes),
    maxDurationSec: sanitizeNumber(raw.maxDurationSec, 10),
    resolutions: sanitizeResolutionArray(raw.resolutions),
    aspectRatios: sanitizeAspectRatioArray(raw.aspectRatios),
    fps: sanitizeNumberArray(raw.fps),
    audio: sanitizeBoolean(raw.audio, false),
    upscale4k: sanitizeBoolean(raw.upscale4k, false),
    extend: sanitizeBoolean(raw.extend, false),
    motionControls: sanitizeBoolean(raw.motionControls, false),
    keyframes: sanitizeBoolean(raw.keyframes, false),
    params,
    inputLimits,
    inputSchema,
    pricing,
    apiAvailability: raw.apiAvailability ? sanitizeString(raw.apiAvailability) : undefined,
    updatedAt,
    ttlSec,
    providerMeta,
    pricingDetails,
    iconUrl,
    fallbackIcon,
    availability,
    brandId: raw.brandId ? sanitizeString(raw.brandId) : undefined,
    brandAssetPolicy,
  };
}

const RAW_ENGINES = Array.isArray((enginesFixture as EnginesFixture).engines)
  ? ((enginesFixture as EnginesFixture).engines as RawEngine[])
  : [];

const ENGINE_BLOCKLIST = new Set(['dev-sim', 'developer', 'developer-simulator']);
const MODEL_PRIORITY_ENTRIES = getModelRoster().map(
  (entry, index) => [String(entry.engineId).toLowerCase(), index] as [string, number]
);
const MODEL_PRIORITY = new Map<string, number>(MODEL_PRIORITY_ENTRIES);
const DEFAULT_PRIORITY = MODEL_PRIORITY_ENTRIES.length;

const ENGINES_BASE: EngineCaps[] = RAW_ENGINES.map((entry) => sanitizeEngine(entry)).filter(
  (engine): engine is EngineCaps =>
    engine !== null && !ENGINE_BLOCKLIST.has(engine.id.trim().toLowerCase())
).sort((a, b) => {
  const aPriority = MODEL_PRIORITY.get(a.id.toLowerCase()) ?? DEFAULT_PRIORITY;
  const bPriority = MODEL_PRIORITY.get(b.id.toLowerCase()) ?? DEFAULT_PRIORITY;
  if (aPriority !== bPriority) {
    return aPriority - bPriority;
  }
  return a.label.localeCompare(b.label);
});

function cloneEngine(engine: EngineCaps): EngineCaps {
  return {
    ...engine,
    params: { ...engine.params },
    inputLimits: { ...engine.inputLimits },
    providerMeta: engine.providerMeta ? { ...engine.providerMeta } : undefined,
    pricing: engine.pricing ? { ...engine.pricing } : undefined,
    pricingDetails: engine.pricingDetails ? { ...engine.pricingDetails } : undefined,
  };
}

function normalizeStatus(value: string | null | undefined, fallback: EngineStatus): EngineStatus {
  if (!value) return fallback;
  const normalized = value.toLowerCase();
  return ENGINE_STATUS.includes(normalized as EngineStatus) ? (normalized as EngineStatus) : fallback;
}

function normalizeAvailability(value: string | null | undefined, fallback: EngineAvailability): EngineAvailability {
  if (!value) return fallback;
  const normalized = value.toLowerCase();
  return AVAILABILITY.includes(normalized as EngineAvailability) ? (normalized as EngineAvailability) : fallback;
}

function normalizeLatency(value: string | null | undefined, fallback: LatencyTier): LatencyTier {
  if (!value) return fallback;
  const normalized = value.toLowerCase();
  return LATENCY.includes(normalized as LatencyTier) ? (normalized as LatencyTier) : fallback;
}

async function getEnginesWithOverrides(options?: { includeDisabled?: boolean }) {
  const base = ENGINES_BASE.map(cloneEngine);
  if (!process.env.DATABASE_URL || typeof window !== 'undefined') {
    return base.map((engine) => ({ engine, disabled: false, override: null as const }));
  }

  const { fetchEngineOverrides } = await import('@/server/engine-overrides');
  const overridesMap = await fetchEngineOverrides();

  return base
    .map((engine) => {
      const override = overridesMap.get(engine.id);
      if (!override) return { engine, disabled: false, override: null as const };
      const disabled = override.active === false;
      engine.availability = normalizeAvailability(override.availability, engine.availability);
      engine.status = normalizeStatus(override.status, engine.status);
      engine.latencyTier = normalizeLatency(override.latency_tier, engine.latencyTier);
      return { engine, disabled, override };
    })
    .filter((item) => options?.includeDisabled || !item.disabled);
}

function ensureEngine(engineId: string): EngineCaps | undefined {
  const normalisedId = engineId.trim().toLowerCase();
  return ENGINES_BASE.find((engine) => engine.id.toLowerCase() === normalisedId);
}

function toItemization(snapshot: PricingSnapshot, memberTier?: string): PreflightResponse['itemization'] {
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

export async function enginesResponse(): Promise<{ ok: true; engines: EngineCaps[] }> {
  const collection = await getEnginesWithOverrides();
  return { ok: true, engines: collection.map((entry) => entry.engine) };
}

export async function listEngines(): Promise<EngineCaps[]> {
  const collection = await getEnginesWithOverrides();
  return collection.map((entry) => entry.engine);
}

export type AdminEngineEntry = Awaited<ReturnType<typeof getEnginesWithOverrides>>[number];

export async function listEnginesForAdmin(): Promise<AdminEngineEntry[]> {
  return getEnginesWithOverrides({ includeDisabled: true });
}

export async function getEngineById(engineId: string): Promise<EngineCaps | undefined> {
  if (!engineId) return undefined;
  return ensureEngine(engineId);
}

export async function computePreflight(request: PreflightRequest): Promise<PreflightResponse> {
  const engine = request.engine ? ensureEngine(request.engine) : undefined;
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
  const addons = {
    audio: Boolean(request.addons?.audio),
    upscale4k: Boolean(request.addons?.upscale4k),
  };
  const memberTier = normalizeMemberTier(request.user?.memberTier);

  let snapshot: PricingSnapshot;
  try {
    const quote = kernel.quote({
      engineId: engine.id,
      durationSec,
      resolution: effectiveResolution,
      addons,
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
      pricing: engine.pricing,
      pricingDetails: engine.pricingDetails,
    },
    messages: engine.pricing?.notes ? [engine.pricing.notes] : undefined,
  };
}
