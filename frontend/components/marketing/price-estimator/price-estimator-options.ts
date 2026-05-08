import type { EngineAvailability, EngineCaps, EngineInputField, Mode } from '@/types/engines';
import type { PricingKernel } from '@maxvideoai/pricing';
import { getPartnerByEngineId } from '@/lib/brand-partners';
import { listFalEngines, type FalEngineEntry } from '@/config/falEngines';
import { selectPricingRule, type PricingRuleLite } from '@/lib/pricing-rules';
import { buildPricingDefinition } from '@/lib/pricing-definition';
import { formatResolutionLabel } from '@/lib/resolution-labels';

export type MemberTier = 'Member' | 'Plus' | 'Pro';

export interface EngineOption {
  id: string;
  label: string;
  description: string;
  minDuration: number;
  maxDuration: number;
  durationOptions: Array<{ value: number; label: string }>;
  defaultDuration: number;
  resolutions: Array<{ value: string; label: string; rate: number }>;
  currency: string;
  availability: EngineAvailability;
  availabilityLink?: string | null;
  showResolution: boolean;
  rateUnit?: string;
  audioIncluded: boolean;
  audioToggle: boolean;
  audioAddonKey?: string | null;
  pricingEngineId: string;
  pricingEngineCaps?: EngineCaps;
  sortIndex: number;
  baseEngineId: string;
  showDuration: boolean;
}

type EngineOptionOverrides = {
  idOverride?: string;
  labelOverride?: string;
  descriptionOverride?: string;
  pricingEngineId?: string;
  sortIndexOverride?: number;
  showDuration?: boolean;
};

export const MEMBER_ORDER: MemberTier[] = ['Member', 'Plus', 'Pro'];
export const FAL_ENGINE_REGISTRY = listFalEngines();
export const FAL_ENGINE_META_BY_ID = new Map(FAL_ENGINE_REGISTRY.map((entry) => [entry.id, entry]));
export const FAL_ENGINE_DISCOVERY_RANK = new Map(
  FAL_ENGINE_REGISTRY.map((entry) => [entry.id, entry.surfaces.app.discoveryRank ?? Number.MAX_SAFE_INTEGER])
);
export const SUPPORTED_MODES = new Set<Mode>(['t2v', 'i2v', 't2i', 'i2i']);

const MIN_DURATION_SEC = 2;
const FAL_ENGINE_ORDER = new Map<string, number>(FAL_ENGINE_REGISTRY.map((entry, index) => [entry.id, index]));
const PER_IMAGE_ENGINE_CONFIG = new Map<
  string,
  { rates: Array<{ value: string; label: string; rate: number }> }
>([
  [
    'nano-banana',
    {
      rates: [
        {
          value: 'per-image',
          label: 'Per image',
          rate: 0.05,
        },
      ],
    },
  ],
  [
    'nano-banana-pro',
    {
      rates: [
        { value: '1k', label: '1K', rate: 0.15 },
        { value: '2k', label: '2K', rate: 0.15 },
        { value: '4k', label: '4K', rate: 0.3 },
      ],
    },
  ],
  [
    'nano-banana-2',
    {
      rates: [
        { value: '0.5k', label: '0.5K', rate: 0.04 },
        { value: '1k', label: '1K', rate: 0.08 },
        { value: '2k', label: '2K', rate: 0.12 },
        { value: '4k', label: '4K', rate: 0.16 },
      ],
    },
  ],
  [
    'gpt-image-2',
    {
      rates: [
        { value: '1024x768-low', label: '1024 x 768 · Low', rate: 0.01 },
        { value: '1024x768-medium', label: '1024 x 768 · Medium', rate: 0.04 },
        { value: '1024x768-high', label: '1024 x 768 · High', rate: 0.15 },
        { value: '1024x1024-low', label: '1024 x 1024 · Low', rate: 0.01 },
        { value: '1024x1024-medium', label: '1024 x 1024 · Medium', rate: 0.06 },
        { value: '1024x1024-high', label: '1024 x 1024 · High', rate: 0.22 },
        { value: '1024x1536-low', label: '1024 x 1536 · Low', rate: 0.01 },
        { value: '1024x1536-medium', label: '1024 x 1536 · Medium', rate: 0.05 },
        { value: '1024x1536-high', label: '1024 x 1536 · High', rate: 0.17 },
        { value: '1920x1080-low', label: '1920 x 1080 · Low', rate: 0.01 },
        { value: '1920x1080-medium', label: '1920 x 1080 · Medium', rate: 0.04 },
        { value: '1920x1080-high', label: '1920 x 1080 · High', rate: 0.16 },
        { value: '2560x1440-low', label: '2560 x 1440 · Low', rate: 0.01 },
        { value: '2560x1440-medium', label: '2560 x 1440 · Medium', rate: 0.06 },
        { value: '2560x1440-high', label: '2560 x 1440 · High', rate: 0.23 },
        { value: '3840x2160-low', label: '3840 x 2160 · Low', rate: 0.02 },
        { value: '3840x2160-medium', label: '3840 x 2160 · Medium', rate: 0.11 },
        { value: '3840x2160-high', label: '3840 x 2160 · High', rate: 0.41 },
      ],
    },
  ],
]);

export const PER_IMAGE_ENGINE_IDS = new Set<string>(Array.from(PER_IMAGE_ENGINE_CONFIG.keys()));

function centsToDollars(cents?: number | null) {
  if (typeof cents !== 'number' || Number.isNaN(cents)) return null;
  return cents / 100;
}

function applyPerImageDisplayMargin(baseRateUsd: number, marginPercent = 0, marginFlatCents = 0) {
  const baseCents = Math.max(0, Math.round(baseRateUsd * 100));
  if (!baseCents) return 0;
  const normalizedMargin = Number.isFinite(marginPercent) ? Math.max(0, marginPercent) : 0;
  const normalizedFlat = Number.isFinite(marginFlatCents) ? Math.max(0, marginFlatCents) : 0;
  const marginCents = Math.ceil(baseCents * normalizedMargin + normalizedFlat - 1e-9);
  const effectiveMargin =
    (normalizedMargin > 0 || normalizedFlat > 0) && marginCents <= 0
      ? 1
      : Math.max(0, marginCents);
  return (baseCents + effectiveMargin) / 100;
}

function resolveAudioAddonKey(
  definition: ReturnType<PricingKernel['getDefinition']> | null,
  engineCaps: EngineCaps
): string | null {
  const addons = definition?.addons ?? engineCaps.pricingDetails?.addons ?? engineCaps.pricing?.addons ?? null;
  if (!addons) return null;
  if ('audio_off' in addons) return 'audio_off';
  if ('audio' in addons) return 'audio';
  return null;
}

export function buildAudioAddonPayload(
  addonKey: string | null | undefined,
  audioEnabled: boolean
): Record<string, boolean> | undefined {
  if (!addonKey) return undefined;
  if (addonKey === 'audio_off') {
    return audioEnabled ? undefined : { audio_off: true };
  }
  if (addonKey === 'audio') {
    return audioEnabled ? { audio: true } : undefined;
  }
  return undefined;
}

function getDurationField(engine: EngineCaps): EngineInputField | undefined {
  const optional = engine.inputSchema?.optional ?? [];
  return optional.find(
    (field) =>
      (field.id === 'duration_seconds' || field.id === 'duration') &&
      (!Array.isArray(field.modes) || !field.modes.length || field.modes.some((mode) => SUPPORTED_MODES.has(mode)))
  );
}

function parseDurationValue(raw: number | string | null | undefined) {
  if (raw == null) return null;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    const seconds = Math.round(raw);
    return { value: seconds, label: `${seconds}s` };
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const numeric = Number(trimmed.replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(numeric) || numeric <= 0) return null;
    const seconds = Math.round(numeric);
    const hasUnit = /[a-z]/i.test(trimmed);
    return { value: seconds, label: hasUnit ? trimmed : `${seconds}s` };
  }
  return null;
}

function collectDurationOptions(
  entry: FalEngineEntry,
  engineCaps: EngineCaps,
  durationField: EngineInputField | undefined,
  definition: ReturnType<PricingKernel['getDefinition']> | null
) {
  const map = new Map<number, string>();
  const add = (raw: number | string | null | undefined) => {
    const parsed = parseDurationValue(raw);
    if (!parsed) return;
    if (!map.has(parsed.value)) {
      map.set(parsed.value, parsed.label);
    }
  };

  entry.modes
    .filter((mode) => SUPPORTED_MODES.has(mode.mode))
    .forEach((mode) => {
      const durationCaps = mode.ui?.duration as
        | { options?: Array<number | string>; default?: number | string; min?: number | string; max?: number | string }
        | undefined;
      if (!durationCaps) return;
      if (Array.isArray(durationCaps.options)) {
        durationCaps.options.forEach((value) => add(value));
      }
      add(durationCaps.default);
      add(durationCaps.min);
      add(durationCaps.max);
    });

  if (Array.isArray(durationField?.values)) {
    durationField?.values.forEach((value) => add(value));
  }
  if (typeof durationField?.default === 'string' || typeof durationField?.default === 'number') {
    add(durationField.default);
  }

  const durationSteps = definition?.durationSteps;
  if (durationSteps) {
    const { options: stepOptions, default: stepDefault, min: stepMin, max: stepMax } = durationSteps as {
      options?: Array<number | string>;
      default?: number | string;
      min?: number | string;
      max?: number | string;
    };
    if (Array.isArray(stepOptions)) {
      stepOptions.forEach((value) => add(value));
    }
    add(stepDefault);
    add(stepMin);
    add(stepMax);
  }

  if (!map.size && engineCaps.maxDurationSec) {
    add(engineCaps.maxDurationSec);
  }

  return Array.from(map.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.value - b.value);
}

export function buildEngineOption(
  entry: FalEngineEntry,
  engineCaps: EngineCaps,
  pricingEngineCaps: EngineCaps,
  kernel: PricingKernel,
  descriptions: Record<string, string>,
  overrides?: EngineOptionOverrides,
  pricingRules?: PricingRuleLite[]
): EngineOption | null {
  if (entry.availability === 'paused') {
    return null;
  }

  const pricingEngineId = overrides?.pricingEngineId ?? entry.id;
  const definition = buildPricingDefinition(pricingEngineCaps) ?? kernel.getDefinition(pricingEngineId);
  const optionId = overrides?.idOverride ?? entry.id;
  const labelOverride = overrides?.labelOverride;
  const perSecond = pricingEngineCaps.pricingDetails?.perSecondCents ?? engineCaps.pricingDetails?.perSecondCents;
  const perSecondDefault = centsToDollars(perSecond?.default);
  const engineRule = pricingRules ? selectPricingRule(pricingRules, pricingEngineId, null) : null;
  const defaultMarginPct = engineRule?.marginPercent ?? definition?.platformFeePct ?? 0;
  const defaultMultiplier = 1 + defaultMarginPct;
  const resolutionSources = engineCaps.resolutions?.length
    ? engineCaps.resolutions
    : definition
      ? Object.keys(definition.resolutionMultipliers)
      : [];

  const perImageConfig = PER_IMAGE_ENGINE_CONFIG.get(entry.id);

  let rates: Array<{ value: string; label: string; rate: number }>;

  if (perImageConfig) {
    rates = perImageConfig.rates.map((rate) => ({
      ...rate,
      rate: applyPerImageDisplayMargin(rate.rate, defaultMarginPct, engineRule?.marginFlatCents ?? undefined),
    }));
  } else {
    rates = resolutionSources
      .map((resolution) => {
        const rule = pricingRules ? selectPricingRule(pricingRules, pricingEngineId, resolution) : null;
        const platformMultiplier = 1 + (rule?.marginPercent ?? defaultMarginPct);
        const displayResolution = formatResolutionLabel(entry.id, resolution);
        if (definition) {
          const multiplier =
            definition.resolutionMultipliers[resolution] ?? definition.resolutionMultipliers.default ?? 1;
          const rate = (definition.baseUnitPriceCents * multiplier) / 100;
          if (!rate) return null;
          return { value: resolution, label: displayResolution.toUpperCase(), rate: rate * platformMultiplier };
        }
        const cents = perSecond?.byResolution?.[resolution] ?? perSecond?.default;
        const rate = centsToDollars(cents) ?? perSecondDefault;
        if (!rate) return null;
        return { value: resolution, label: displayResolution.toUpperCase(), rate: rate * platformMultiplier };
      })
      .filter((rate): rate is { value: string; label: string; rate: number } => Boolean(rate));

    if (!rates.length && definition) {
      const fallbackRate = definition.baseUnitPriceCents / 100;
      rates = [
        {
          value: 'default',
          label: 'DEFAULT',
          rate: fallbackRate * defaultMultiplier,
        },
      ];
    }

    if (!rates.length) {
      return null;
    }
  }

  const durationField = getDurationField(engineCaps);
  const defaultMin = typeof durationField?.min === 'number' ? durationField.min : engineCaps.maxDurationSec || 4;
  const defaultMax = typeof durationField?.max === 'number' ? durationField.max : engineCaps.maxDurationSec || defaultMin;
  const fallbackMin = Math.max(definition?.durationSteps?.min ?? defaultMin ?? 4, MIN_DURATION_SEC);
  let fallbackMax = definition?.durationSteps?.max ?? defaultMax ?? fallbackMin;
  if (fallbackMax < fallbackMin) {
    fallbackMax = fallbackMin;
  }

  const rawDurationOptions = collectDurationOptions(entry, engineCaps, durationField, definition).filter(
    (option) => option.value >= fallbackMin && option.value <= fallbackMax
  );
  const minDuration = rawDurationOptions.length ? rawDurationOptions[0].value : fallbackMin;
  const maxDuration = rawDurationOptions.length ? rawDurationOptions[rawDurationOptions.length - 1].value : fallbackMax;
  const durationOptions = rawDurationOptions;

  const defaultDurationRaw =
    parseDurationValue(definition?.durationSteps?.default as number | string | undefined)?.value ??
    parseDurationValue(
      typeof durationField?.default === 'string' || typeof durationField?.default === 'number'
        ? durationField.default
        : undefined
    )?.value ??
    durationOptions[Math.floor(durationOptions.length / 2)]?.value ??
    Math.round((minDuration + maxDuration) / 2);
  const defaultDuration = Math.min(Math.max(defaultDurationRaw ?? minDuration, minDuration), maxDuration);

  const brand = getPartnerByEngineId(entry.id);
  const availabilityLink =
    entry.availability !== 'available' ? brand?.availabilityLink ?? engineCaps.apiAvailability ?? null : null;
  const description =
    overrides?.descriptionOverride ??
    descriptions[optionId] ??
    descriptions[entry.id] ??
    entry.seo.description ??
    entry.marketingName;
  const sortIndex = overrides?.sortIndexOverride ?? FAL_ENGINE_ORDER.get(entry.id) ?? Number.MAX_SAFE_INTEGER;
  const audioAddonKey = resolveAudioAddonKey(definition, engineCaps);
  const audioToggle = Boolean(audioAddonKey);

  return {
    id: optionId,
    label: labelOverride ?? entry.marketingName,
    description,
    minDuration,
    maxDuration,
    durationOptions,
    defaultDuration,
    resolutions: rates,
    currency: engineRule?.currency ?? definition?.currency ?? engineCaps.pricingDetails?.currency ?? 'USD',
    availability: entry.availability,
    availabilityLink,
    showResolution: !perImageConfig,
    rateUnit: perImageConfig ? '/image' : '/s',
    audioIncluded: Boolean(engineCaps.audio) && !audioToggle,
    audioToggle,
    audioAddonKey,
    pricingEngineId,
    pricingEngineCaps,
    sortIndex,
    baseEngineId: entry.id,
    showDuration: overrides?.showDuration ?? !perImageConfig,
  };
}

export function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}
