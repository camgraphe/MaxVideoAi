'use client';

import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import type { EngineAvailability, EngineCaps, EngineInputField, EnginePricingDetails, Mode } from '@/types/engines';
import { computePricingSnapshot, type MemberTier as PricingMemberTier, type PricingKernel } from '@maxvideoai/pricing';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { getPricingKernel } from '@/lib/pricing-kernel';
import { getPartnerByEngineId } from '@/lib/brand-partners';
import { listFalEngines, type FalEngineEntry } from '@/config/falEngines';
import { getEngineSelectFamilyRank } from '@/lib/engine-family-priority';
import { selectPricingRule, type PricingRuleLite } from '@/lib/pricing-rules';
import { applyEnginePricingOverride, buildPricingDefinition } from '@/lib/pricing-definition';
import { formatResolutionLabel } from '@/lib/resolution-labels';
import { Button } from '@/components/ui/Button';
import { EngineSelect } from '@/components/ui/EngineSelect';
import { SelectMenu, type SelectOption } from '@/components/ui/SelectMenu';

type MemberTier = 'Member' | 'Plus' | 'Pro';

interface EngineOption {
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

export interface PriceEstimatorProps {
  variant?: 'full' | 'lite';
  pricingRules?: PricingRuleLite[];
  enginePricingOverrides?: Record<string, EnginePricingDetails | null | undefined>;
  defaultEngineId?: string;
  defaultDurationSec?: number;
}

const MEMBER_ORDER: MemberTier[] = ['Member', 'Plus', 'Pro'];
const MIN_DURATION_SEC = 2;
const FAL_ENGINE_REGISTRY = listFalEngines();
const FAL_ENGINE_META_BY_ID = new Map(FAL_ENGINE_REGISTRY.map((entry) => [entry.id, entry]));
const FAL_ENGINE_ORDER = new Map<string, number>(FAL_ENGINE_REGISTRY.map((entry, index) => [entry.id, index]));
const FAL_ENGINE_DISCOVERY_RANK = new Map(
  FAL_ENGINE_REGISTRY.map((entry) => [entry.id, entry.surfaces.app.discoveryRank ?? Number.MAX_SAFE_INTEGER])
);
const SUPPORTED_MODES = new Set<Mode>(['t2v', 'i2v', 't2i', 'i2i']);
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
const PER_IMAGE_ENGINE_IDS = new Set<string>(Array.from(PER_IMAGE_ENGINE_CONFIG.keys()));
type EngineOptionOverrides = {
  idOverride?: string;
  labelOverride?: string;
  descriptionOverride?: string;
  pricingEngineId?: string;
  sortIndexOverride?: number;
  showDuration?: boolean;
};

function SelectGroup({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string;
  options: SelectOption[];
  value: SelectOption['value'];
  onChange: (value: SelectOption['value']) => void;
  className?: string;
}) {
  if (!options.length) return null;
  return (
    <div className={clsx('flex min-w-0 flex-col gap-1', className)}>
      <span className="text-[10px] uppercase tracking-micro text-text-muted">{label}</span>
      <SelectMenu options={options} value={value} onChange={onChange} />
    </div>
  );
}

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

function buildAudioAddonPayload(
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

function buildEngineOption(
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

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

export function PriceEstimator({
  variant = 'full',
  pricingRules,
  enginePricingOverrides,
  defaultEngineId,
  defaultDurationSec,
}: PriceEstimatorProps) {
  const { t, dictionary } = useI18n();
  const kernel = getPricingKernel();

  const fields = t('pricing.estimator.fields', {
    engine: 'Engine',
    resolution: 'Resolution',
    duration: 'Duration (seconds)',
    memberStatus: 'Member status',
  }) as Record<string, string>;

  const estimateLabels = t('pricing.estimator.estimateLabels', {
    heading: 'Estimate',
    base: 'Base',
    discount: 'Discount',
    memberChipPrefix: 'Member price - You save',
  }) as Record<string, string>;

  const descriptions = dictionary.pricing.estimator.descriptions;
  const pricingEngineMap = useMemo(() => {
    const map = new Map<string, EngineCaps>();
    FAL_ENGINE_REGISTRY.forEach((entry) => {
      if (!entry.engine) return;
      const override = enginePricingOverrides?.[entry.id];
      const adjusted = override ? applyEnginePricingOverride(entry.engine, override) : entry.engine;
      map.set(entry.id, adjusted);
    });
    return map;
  }, [enginePricingOverrides]);

  const engineOptions = useMemo(() => {
    const options: EngineOption[] = [];
    FAL_ENGINE_REGISTRY.forEach((entry) => {
      if (!entry.surfaces.pricing.includeInEstimator) {
        return;
      }
      const engineCaps = entry.engine;
      if (!engineCaps) {
        return;
      }
      if (!engineCaps.modes?.some((mode) => SUPPORTED_MODES.has(mode))) {
        return;
      }
      const pricingEngineCaps = pricingEngineMap.get(entry.id) ?? engineCaps;
      const baseOption = buildEngineOption(entry, engineCaps, pricingEngineCaps, kernel, descriptions, undefined, pricingRules);
      if (baseOption && baseOption.availability !== 'paused') {
        options.push(baseOption);
      }
    });

    return options.sort((a, b) => {
      const familyRankA = getEngineSelectFamilyRank(FAL_ENGINE_META_BY_ID.get(a.baseEngineId));
      const familyRankB = getEngineSelectFamilyRank(FAL_ENGINE_META_BY_ID.get(b.baseEngineId));
      if (familyRankA !== familyRankB) {
        if (familyRankA === Number.MAX_SAFE_INTEGER) return 1;
        if (familyRankB === Number.MAX_SAFE_INTEGER) return -1;
        return familyRankA - familyRankB;
      }
      const prefA = FAL_ENGINE_DISCOVERY_RANK.get(a.baseEngineId) ?? Number.MAX_SAFE_INTEGER;
      const prefB = FAL_ENGINE_DISCOVERY_RANK.get(b.baseEngineId) ?? Number.MAX_SAFE_INTEGER;
      if (prefA !== prefB) return prefA - prefB;
      const orderA = a.sortIndex;
      const orderB = b.sortIndex;
      return orderA - orderB;
    });
  }, [descriptions, kernel, pricingRules, pricingEngineMap]);

  const engineSelectOptions = useMemo(() => {
    return engineOptions
      .map((option) => {
        const entry = FAL_ENGINE_REGISTRY.find((candidate) => candidate.id === option.baseEngineId);
        const engineCaps = entry?.engine;
        if (!engineCaps) return null;
        if (engineCaps.id === option.id) {
          return { ...engineCaps, availability: option.availability };
        }
        return {
          ...engineCaps,
          id: option.id,
          label: option.label,
          availability: option.availability,
        };
      })
      .filter((entry): entry is EngineCaps => Boolean(entry));
  }, [engineOptions]);

  const [selectedEngineId, setSelectedEngineId] = useState(
    () => engineOptions.find((option) => option.id === defaultEngineId)?.id ?? engineOptions[0]?.id ?? ''
  );
  const selectedEngine = useMemo(() => engineOptions.find((option) => option.id === selectedEngineId) ?? engineOptions[0], [engineOptions, selectedEngineId]);
  const [engineMode, setEngineMode] = useState<Mode>('t2v');

  useEffect(() => {
    if (!engineOptions.length) return;
    if (!engineOptions.some((option) => option.id === selectedEngineId)) {
      setSelectedEngineId(engineOptions[0]?.id ?? '');
    }
  }, [engineOptions, selectedEngineId]);

  const [selectedResolution, setSelectedResolution] = useState(() => selectedEngine?.resolutions[0]?.value ?? '');

  useEffect(() => {
    if (!selectedEngine) return;
    if (!selectedEngine.resolutions.some((resolution) => resolution.value === selectedResolution)) {
      setSelectedResolution(selectedEngine.resolutions[0]?.value ?? '');
    }
  }, [selectedEngine, selectedResolution]);

  const [duration, setDuration] = useState(() => {
    if (!selectedEngine) return 12;
    if (
      typeof defaultDurationSec === 'number' &&
      defaultDurationSec >= selectedEngine.minDuration &&
      defaultDurationSec <= selectedEngine.maxDuration &&
      (!selectedEngine.durationOptions.length ||
        selectedEngine.durationOptions.some((option) => option.value === defaultDurationSec))
    ) {
      return defaultDurationSec;
    }
    if (selectedEngine.durationOptions.length) {
      return selectedEngine.defaultDuration;
    }
    const midpoint = Math.round((selectedEngine.minDuration + selectedEngine.maxDuration) / 2);
    return Math.min(Math.max(midpoint, selectedEngine.minDuration), selectedEngine.maxDuration);
  });

  useEffect(() => {
    if (!selectedEngine) return;
    const cap =
      selectedEngine.id === 'ltx-2-fast' && selectedResolution === '4k' ? 10 : null;
    const allowedOptions = selectedEngine.durationOptions.length
      ? selectedEngine.durationOptions.filter((option) => (cap ? option.value <= cap : true))
      : [];
    if (allowedOptions.length) {
      const isAllowed = allowedOptions.some((option) => option.value === duration);
      if (!isAllowed) {
        const fallback =
          allowedOptions.find((option) => option.value === selectedEngine.defaultDuration) ??
          allowedOptions[0];
        setDuration(fallback?.value ?? allowedOptions[0]?.value ?? duration);
      }
      return;
    }
    if (duration < selectedEngine.minDuration) {
      setDuration(selectedEngine.minDuration);
    } else if (duration > selectedEngine.maxDuration) {
      const clampedMax = cap ? Math.min(selectedEngine.maxDuration, cap) : selectedEngine.maxDuration;
      setDuration(clampedMax);
    }
  }, [selectedEngine, duration, selectedResolution]);

  const [memberTier, setMemberTier] = useState<MemberTier>('Member');
  const [audioEnabled, setAudioEnabled] = useState(true);
  const selectedEngineKey = selectedEngine?.id ?? null;

  useEffect(() => {
    if (!selectedEngineKey) return;
    setAudioEnabled(true);
  }, [selectedEngineKey]);

  const activeResolution =
    selectedEngine?.resolutions.find((resolution) => resolution.value === selectedResolution) ??
    selectedEngine?.resolutions[0];
  const rate = activeResolution?.rate ?? 0;
  const bypassPricing = selectedEngine ? PER_IMAGE_ENGINE_IDS.has(selectedEngine.id) : false;
  const filteredDurationOptions = useMemo(() => {
    if (!selectedEngine) return [];
    const cap =
      selectedEngine.id === 'ltx-2-fast' && selectedResolution === '4k' ? 10 : null;
    return cap
      ? selectedEngine.durationOptions.filter((option) => option.value <= cap)
      : selectedEngine.durationOptions;
  }, [selectedEngine, selectedResolution]);

  const durationSelectOptions = useMemo<SelectOption[]>(() => {
    if (!selectedEngine) return [];
    if (filteredDurationOptions.length) {
      return filteredDurationOptions.map((option) => ({
        value: option.value,
        label: option.label,
      }));
    }
    const min = selectedEngine.minDuration;
    const max = selectedEngine.maxDuration;
    return Array.from({ length: max - min + 1 }, (_, index) => {
      const value = min + index;
      return { value, label: `${value}s` };
    });
  }, [filteredDurationOptions, selectedEngine]);

  const resolutionSelectOptions = useMemo<SelectOption[]>(() => {
    if (!selectedEngine?.resolutions?.length) return [];
    return selectedEngine.resolutions.map((option) => ({
      value: option.value,
      label: option.label,
    }));
  }, [selectedEngine]);

  const pricingMemberTier = (memberTier.toLowerCase() as PricingMemberTier);

  const pricingRule = useMemo(() => {
    if (!selectedEngine) return null;
    return selectPricingRule(pricingRules, selectedEngine.pricingEngineId, selectedResolution);
  }, [pricingRules, selectedEngine, selectedResolution]);

  const pricingQuote = useMemo(() => {
    if (!selectedEngine || bypassPricing) return null;
    const pricingCaps = selectedEngine.pricingEngineCaps ?? null;
    const baseDefinition = pricingCaps ? buildPricingDefinition(pricingCaps) : null;
    const fallbackDefinition = baseDefinition ?? kernel.getDefinition(selectedEngine.pricingEngineId);
    if (!fallbackDefinition) return null;
    try {
      const addons = buildAudioAddonPayload(selectedEngine.audioAddonKey, audioEnabled);
      const definition = pricingRule
        ? {
            ...fallbackDefinition,
            platformFeePct: pricingRule.marginPercent ?? fallbackDefinition.platformFeePct,
            platformFeeFlatCents: pricingRule.marginFlatCents ?? fallbackDefinition.platformFeeFlatCents,
            currency: pricingRule.currency ?? fallbackDefinition.currency,
          }
        : fallbackDefinition;
      return computePricingSnapshot(definition, {
        engineId: selectedEngine.pricingEngineId,
        durationSec: duration,
        resolution: selectedResolution,
        memberTier: pricingMemberTier,
        ...(addons ? { addons } : {}),
      }).quote;
    } catch {
      return null;
    }
  }, [kernel, selectedEngine, duration, selectedResolution, pricingMemberTier, bypassPricing, audioEnabled, pricingRule]);

  const pricingSnapshot = bypassPricing ? null : pricingQuote?.snapshot ?? null;
  const manualPricing = useMemo(() => {
    if (!selectedEngine || !PER_IMAGE_ENGINE_IDS.has(selectedEngine.id)) return null;
    return {
      base: rate,
      discountRate: 0,
      discountValue: 0,
      total: rate,
    };
  }, [selectedEngine, rate]);

  const pricing = useMemo(() => {
    if (manualPricing) {
      return manualPricing;
    }
    if (!pricingSnapshot) {
      return {
        base: 0,
        discountRate: 0,
        discountValue: 0,
        total: 0,
      };
    }
    const base = pricingSnapshot.base.amountCents / 100;
    const discountRate = pricingSnapshot.discount?.percentApplied ?? 0;
    const discountValue = (pricingSnapshot.discount?.amountCents ?? 0) / 100;
    const total = pricingSnapshot.totalCents / 100;
    return { base, discountRate, discountValue, total };
  }, [pricingSnapshot, manualPricing]);

  const currency = bypassPricing ? 'USD' : pricingSnapshot?.currency ?? selectedEngine?.currency ?? 'USD';
  const tiers = dictionary.pricing.member.tiers;
  const tooltip = dictionary.pricing.member.tooltip;
  const memberNames = useMemo(() => {
    const map = new Map<MemberTier, string>();
    MEMBER_ORDER.forEach((tier, index) => {
      const translation = tiers[index]?.name ?? tier;
      map.set(tier, translation as string);
    });
    return map;
  }, [tiers]);

  const memberBenefits = useMemo(() => {
    const map = new Map<MemberTier, string>();
    MEMBER_ORDER.forEach((tier, index) => {
      const benefit = dictionary.pricing.member.tiers[index]?.benefit ?? '';
      map.set(tier, benefit);
    });
    return map;
  }, [dictionary.pricing.member.tiers]);

  const chargedNote =
    dictionary.pricing.estimator.chargedNote ?? t('pricing.estimator.chargedNote', 'Charged only if render succeeds.') ??
    'Charged only if render succeeds.';
  const memberTooltipLabel = tooltip ?? 'Status updates daily on your last 30 days of spend.';
  const priceChipSuffix = t('pricing.priceChipSuffix', dictionary.pricing.priceChipSuffix);

  const isLite = variant === 'lite';
  const activeDurationOption = filteredDurationOptions.find((option) => option.value === duration) ?? null;
  const durationDisplay = activeDurationOption?.label ?? `${duration}s`;
  const discountPercent = Math.round(pricing.discountRate * 100);
  const memberBenefitCopy = memberBenefits.get(memberTier);

  return (
    <div className="flex flex-col gap-3">
      <div
        className={clsx(
          'price-estimator-border relative overflow-hidden rounded-[24px] border shadow-card',
          isLite
            ? 'border-hairline bg-surface-glass-95'
            : 'border-hairline bg-surface'
        )}
      >
        <div className="relative grid lg:grid-cols-[minmax(0,1.08fr)_minmax(300px,0.92fr)]">
          <div className="flex flex-col gap-4 p-5 sm:p-6">
            <div className="space-y-1">
              <p className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-text-muted">
                <span className="flex h-5 w-5 items-center justify-center rounded-full border border-hairline bg-surface-2 text-[10px] tracking-normal text-text-muted">
                  1
                </span>
                {t('pricing.estimator.configureLabel', 'Configure')}
              </p>
              <h3 className="text-xl font-semibold text-text-primary">
                {dictionary.pricing.estimator.title}
              </h3>
              <p className="max-w-xl text-sm leading-6 text-text-secondary">{dictionary.pricing.estimator.subtitle}</p>
            </div>

            <div className="grid gap-3">
              <div className="price-estimator-border price-estimator-surface relative rounded-[16px] border border-hairline bg-bg p-2 focus-within:z-20">
                <div className="mt-0.5">
                  <EngineSelect
                    engines={engineSelectOptions}
                    engineId={selectedEngine?.id ?? ''}
                    onEngineChange={setSelectedEngineId}
                    mode={engineMode}
                    onModeChange={setEngineMode}
                    showModeSelect={false}
                    showBillingNote={false}
                    variant="bar"
                    density="compact"
                    className="w-full"
                  />
                  {selectedEngine?.description ? (
                    <p className="mt-1 hidden text-xs text-text-muted sm:block">{selectedEngine.description}</p>
                  ) : null}
                  {selectedEngine?.audioIncluded ? (
                    <div className="mt-2 hidden items-center gap-2 rounded-full border border-hairline bg-surface px-3 py-1 text-[11px] font-semibold text-text-secondary sm:inline-flex">
                      <span className="text-[9px] leading-none text-text-muted">●</span>
                      <span>{t('pricing.estimator.audioIncluded', 'Audio included by default')}</span>
                    </div>
                  ) : null}
                  {selectedEngine && selectedEngine.availability !== 'available' && selectedEngine.availabilityLink ? (
                    <a
                      href={selectedEngine.availabilityLink}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 hidden text-[11px] font-medium text-text-muted underline underline-offset-4 transition hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white sm:inline-flex"
                    >
                      {selectedEngine.availability === 'waitlist'
                        ? t('pricing.estimator.joinWaitlist', 'Join waitlist')
                        : t('pricing.estimator.requestAccess', 'Request access')}
                    </a>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {selectedEngine?.showResolution !== false ? (
                  <div className="price-estimator-border price-estimator-surface relative rounded-[16px] border border-hairline bg-bg p-2 focus-within:z-20">
                    <SelectGroup
                      label={fields.resolution}
                      options={resolutionSelectOptions}
                      value={selectedResolution}
                      onChange={(value) => setSelectedResolution(String(value))}
                    />
                    {activeResolution ? (
                      <p className="mt-0.5 text-xs text-text-muted">
                        {t('pricing.estimator.engineRateLabel', 'Engine rate')}{' '}
                        {formatCurrency(rate, currency)}
                        {selectedEngine?.rateUnit ?? '/s'}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <div className="price-estimator-border price-estimator-surface relative rounded-[16px] border border-hairline bg-bg p-3 focus-within:z-20">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
                      {t('pricing.estimator.engineRateLabel', 'Engine rate')}
                    </span>
                    <p className="mt-1 text-2xl font-semibold text-text-primary">
                      {formatCurrency(rate, currency)}
                      {selectedEngine?.rateUnit ?? ''}
                    </p>
                    <p className="mt-1 text-xs text-text-muted">
                      {t('pricing.estimator.perImageLabel', 'Applies per generated image inside Generate.')}
                    </p>
                  </div>
                )}

                {selectedEngine?.showDuration !== false ? (
                  <div className="price-estimator-border price-estimator-surface relative rounded-[16px] border border-hairline bg-bg p-2 focus-within:z-20">
                    <SelectGroup
                      label={fields.duration}
                      options={durationSelectOptions}
                      value={duration}
                      onChange={(value) => setDuration(Number(value))}
                    />
                    <p className="mt-0.5 hidden text-xs text-text-muted sm:block">
                      {t('pricing.estimator.durationRangeLabel', 'Available')} •{' '}
                      {durationSelectOptions
                        .map((option) => (typeof option.label === 'string' ? option.label : ''))
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                ) : null}

                {selectedEngine?.audioToggle ? (
                  <div className="price-estimator-border price-estimator-surface relative rounded-[16px] border border-hairline bg-bg p-2 focus-within:z-20">
                    <SelectGroup
                      label={t('pricing.estimator.audioLabel', 'Audio') ?? 'Audio'}
                      options={[
                        { value: true, label: t('pricing.estimator.audioOn', 'On') ?? 'On' },
                        { value: false, label: t('pricing.estimator.audioOff', 'Off') ?? 'Off' },
                      ]}
                      value={audioEnabled}
                      onChange={(value) => setAudioEnabled(Boolean(value))}
                    />
                    <p className="mt-0.5 hidden text-xs text-text-muted sm:block">
                      {t('pricing.estimator.audioHint', 'Price updates when audio is toggled.')}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>

          </div>

          <aside className="border-t border-hairline bg-surface-2/70 p-5 text-sm text-text-secondary sm:p-6 lg:border-l lg:border-t-0">
            <div className="stack-gap">
              <div className="stack-gap-sm">
                <span className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-text-muted">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full border border-hairline bg-surface text-[10px] tracking-normal text-text-muted">
                    2
                  </span>
                  {estimateLabels.heading}
                </span>
                <p className="text-5xl font-semibold tracking-tight text-text-primary sm:text-6xl">
                  {formatCurrency(pricing.total, currency)}
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-text-muted">
                  {priceChipSuffix ?? t('pricing.priceChipSuffix', 'Price before you generate.')}
                </p>
              </div>

              <dl className="grid gap-3 border-b border-hairline pb-4 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-text-secondary">{t('pricing.estimator.engineLabel', 'Engine')}</dt>
                  <dd className="text-right font-semibold text-text-primary">{selectedEngine?.label ?? '—'}</dd>
                </div>
                {selectedEngine?.showDuration !== false ? (
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-text-secondary">{t('pricing.estimator.durationLabel', 'Duration')}</dt>
                    <dd className="text-right font-semibold text-text-primary">{durationDisplay}</dd>
                  </div>
                ) : null}
                {selectedEngine?.showResolution !== false ? (
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-text-secondary">{t('pricing.estimator.resolutionLabel', 'Resolution')}</dt>
                    <dd className="text-right font-semibold text-text-primary">
                      {activeResolution?.label ?? selectedResolution?.toUpperCase()}
                    </dd>
                  </div>
                ) : null}
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-text-secondary">{t('pricing.estimator.audioLabel', 'Audio') ?? 'Audio'}</dt>
                  <dd className="text-right font-semibold text-text-primary">
                    {selectedEngine?.audioIncluded || audioEnabled
                      ? t('pricing.estimator.audioOn', 'On')
                      : t('pricing.estimator.audioOff', 'Off')}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-text-secondary">{t('pricing.estimator.engineRateLabel', 'Engine rate')}</dt>
                  <dd className="text-right font-semibold text-text-primary">
                    {formatCurrency(rate, currency)}
                    {selectedEngine?.rateUnit ?? '/s'}
                  </dd>
                </div>
              </dl>

              <div className="stack-gap-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-text-muted">
                    {estimateLabels.memberChipPrefix}
                  </span>
                  <span className="rounded-full bg-state-success/15 px-3 py-1 text-xs font-semibold text-state-success">
                    {memberTier === 'Member' ? memberNames.get('Member') ?? 'Member' : `${discountPercent}%`}
                  </span>
                </div>
                {memberBenefitCopy ? <p className="text-xs text-text-muted">{memberBenefitCopy}</p> : null}
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-text-muted">
                    {fields.memberStatus}
                  </span>
                  <div className="mt-2 grid grid-cols-3 gap-2 rounded-full border border-hairline bg-surface p-1">
                    {MEMBER_ORDER.map((tier) => {
                      const selected = tier === memberTier;
                      return (
                        <Button
                          key={tier}
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setMemberTier(tier)}
                          className={clsx(
                            'member-status-pill min-h-0 h-8 rounded-full px-2 text-xs font-semibold',
                            selected
                              ? 'bg-text-primary !text-bg shadow-card hover:bg-text-primary hover:!text-bg'
                              : 'bg-transparent !text-text-secondary hover:bg-surface-2 hover:!text-text-primary'
                          )}
                          aria-pressed={selected}
                        >
                          {memberNames.get(tier) ?? tier}
                        </Button>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-[11px] text-text-muted" aria-label={memberTooltipLabel} title={memberTooltipLabel}>
                    {memberTooltipLabel}
                  </p>
                </div>
              </div>

              <div className="stack-gap-xs text-xs text-text-muted">
                {selectedEngine?.audioIncluded ? (
                  <p className="font-semibold text-text-secondary">
                    {t('pricing.estimator.audioIncluded', 'Audio included by default')}
                  </p>
                ) : null}
                <p>{chargedNote}</p>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Wallet actions removed for marketing surface */}
    </div>
  );
}
