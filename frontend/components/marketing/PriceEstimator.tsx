'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import clsx from 'clsx';
import type { EngineAvailability, EngineCaps, EngineInputField, EnginePricingDetails, Mode } from '@/types/engines';
import { computePricingSnapshot, type MemberTier as PricingMemberTier, type PricingKernel } from '@maxvideoai/pricing';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { getPricingKernel } from '@/lib/pricing-kernel';
import { AVAILABILITY_BADGE_CLASS } from '@/lib/availability';
import { getPartnerByEngineId } from '@/lib/brand-partners';
import { listFalEngines, type FalEngineEntry } from '@/config/falEngines';
import { selectPricingRule, type PricingRuleLite } from '@/lib/pricing-rules';
import { applyEnginePricingOverride, buildPricingDefinition } from '@/lib/pricing-definition';
import { Button } from '@/components/ui/Button';

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

interface PriceEstimatorProps {
  variant?: 'full' | 'lite';
  pricingRules?: PricingRuleLite[];
  enginePricingOverrides?: Record<string, EnginePricingDetails | null | undefined>;
}

const MEMBER_ORDER: MemberTier[] = ['Member', 'Plus', 'Pro'];
const MIN_DURATION_SEC = 2;
const FAL_ENGINE_REGISTRY = listFalEngines();
const FAL_ENGINE_ORDER = new Map<string, number>(FAL_ENGINE_REGISTRY.map((entry, index) => [entry.id, index]));
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

function centsToDollars(cents?: number | null) {
  if (typeof cents !== 'number' || Number.isNaN(cents)) return null;
  return cents / 100;
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
  return optional.find((field) => field.id === 'duration_seconds' || field.id === 'duration');
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

  entry.modes.forEach((mode) => {
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
  add(durationField?.default);

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

  if (engineCaps.maxDurationSec) {
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
      rate: rate.rate * defaultMultiplier,
    }));
  } else {
    rates = resolutionSources
      .map((resolution) => {
        const rule = pricingRules ? selectPricingRule(pricingRules, pricingEngineId, resolution) : null;
        const platformMultiplier = 1 + (rule?.marginPercent ?? defaultMarginPct);
        if (definition) {
          const multiplier =
            definition.resolutionMultipliers[resolution] ?? definition.resolutionMultipliers.default ?? 1;
          const rate = (definition.baseUnitPriceCents * multiplier) / 100;
          if (!rate) return null;
          return { value: resolution, label: resolution.toUpperCase(), rate: rate * platformMultiplier };
        }
        const cents = perSecond?.byResolution?.[resolution] ?? perSecond?.default;
        const rate = centsToDollars(cents) ?? perSecondDefault;
        if (!rate) return null;
        return { value: resolution, label: resolution.toUpperCase(), rate: rate * platformMultiplier };
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
    parseDurationValue(durationField?.default)?.value ??
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

export function PriceEstimator({ variant = 'full', pricingRules, enginePricingOverrides }: PriceEstimatorProps) {
  const engineId = useId();
  const durationId = useId();
  const resolutionId = useId();
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
  const availabilityLabels = dictionary.models.availabilityLabels;
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
      if (entry.id === 'veo-3-1-first-last') {
        const fastPricingCaps = pricingEngineMap.get('veo-3-1-fast') ?? engineCaps;
        const fastOption = buildEngineOption(entry, engineCaps, fastPricingCaps, kernel, descriptions, {
          idOverride: 'veo-3-1-first-last-fast',
          labelOverride: `${entry.marketingName} (Fast)`,
          descriptionOverride:
            descriptions['veo-3-1-first-last-fast'] ?? descriptions[entry.id] ?? entry.seo.description ?? entry.marketingName,
          pricingEngineId: 'veo-3-1-fast',
          sortIndexOverride: (FAL_ENGINE_ORDER.get(entry.id) ?? Number.MAX_SAFE_INTEGER) + 0.1,
        }, pricingRules);
        if (fastOption && fastOption.availability !== 'paused') {
          options.push(fastOption);
        }
      }
    });

    const preferredOrder = [
      'sora-2',
      'sora-2-pro',
      'veo-3-1',
      'veo-3-1-fast',
      'veo-3-1-first-last',
      'veo-3-1-first-last-fast',
      'pika-text-to-video',
      'minimax-hailuo-02-text',
      'nano-banana',
      'nano-banana-pro',
    ];
    const preferredIndex = new Map<string, number>(preferredOrder.map((id, index) => [id, index]));

    return options.sort((a, b) => {
      const prefA = preferredIndex.get(a.id) ?? Number.MAX_SAFE_INTEGER;
      const prefB = preferredIndex.get(b.id) ?? Number.MAX_SAFE_INTEGER;
      if (prefA !== prefB) return prefA - prefB;
      const orderA = a.sortIndex;
      const orderB = b.sortIndex;
      return orderA - orderB;
    });
  }, [descriptions, kernel, pricingRules, pricingEngineMap]);

  const [selectedEngineId, setSelectedEngineId] = useState(() => engineOptions[0]?.id ?? '');
  const selectedEngine = useMemo(() => engineOptions.find((option) => option.id === selectedEngineId) ?? engineOptions[0], [engineOptions, selectedEngineId]);

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
    <div className="stack-gap-lg">
      <div
        className={clsx(
          'relative overflow-hidden rounded-[32px] border p-6 shadow-[0_20px_60px_-25px_rgba(17,24,39,0.35)] sm:p-8 lg:p-10',
          isLite
            ? 'border-hairline bg-surface-glass-95'
            : 'border-surface-on-media-40 bg-gradient-to-br from-white via-white/95 to-[#f3f6ff]'
        )}
      >
        {!isLite && (
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -left-28 top-[-96px] h-72 w-72 rounded-full bg-surface-2 opacity-70 blur-[140px]" />
            <div className="absolute -right-24 bottom-[-120px] h-80 w-80 rounded-full bg-[#7c4dff]/12 blur-[160px]" />
          </div>
        )}
        <div className="relative grid grid-gap-lg lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="stack-gap-lg">
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-text-muted">
                {t('pricing.estimator.configureLabel', 'Configure')}
              </p>
              <h3 className="text-2xl font-semibold text-text-primary sm:text-3xl">
                {dictionary.pricing.estimator.title}
              </h3>
              <p className="text-sm text-text-secondary sm:text-base">{dictionary.pricing.estimator.subtitle}</p>
            </div>

            <div className="grid grid-gap">
              <div className="rounded-[24px] border border-surface-on-media-60 bg-surface-glass-85 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] backdrop-blur">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor={engineId}
                    className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted"
                  >
                    {fields.engine}
                  </label>
                  {selectedEngine && (
                    <span
                      className={clsx(
                        'inline-flex items-center rounded-pill border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-micro',
                        AVAILABILITY_BADGE_CLASS[selectedEngine.availability]
                      )}
                    >
                      {availabilityLabels[selectedEngine.availability] ?? selectedEngine.availability}
                    </span>
                  )}
                </div>
                <div className="mt-3">
                  <div className="relative">
                    <select
                      id={engineId}
                      value={selectedEngine?.id ?? ''}
                      onChange={(event) => setSelectedEngineId(event.target.value)}
                      className="w-full appearance-none rounded-[16px] border border-transparent bg-surface px-4 py-3 pr-12 text-sm font-semibold text-text-primary shadow-[0_1px_3px_rgba(15,23,42,0.1)] transition focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                    >
                      {engineOptions.map((option) => (
                        <option key={option.id} value={option.id} disabled={option.availability === 'paused'}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-text-muted/60">
                      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  </div>
                  {selectedEngine?.description ? (
                    <p className="mt-3 text-xs text-text-muted">{selectedEngine.description}</p>
                  ) : null}
                  {selectedEngine?.audioIncluded ? (
                    <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-hairline bg-surface-2 px-3 py-1 text-[11px] font-semibold text-text-secondary">
                      <span className="text-[9px] leading-none text-text-muted">●</span>
                      <span>{t('pricing.estimator.audioIncluded', 'Audio included by default')}</span>
                    </div>
                  ) : null}
                  {selectedEngine && selectedEngine.availability !== 'available' && selectedEngine.availabilityLink ? (
                    <a
                      href={selectedEngine.availabilityLink}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex text-[11px] font-medium text-text-muted underline underline-offset-4 transition hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                    >
                      {selectedEngine.availability === 'waitlist'
                        ? t('pricing.estimator.joinWaitlist', 'Join waitlist')
                        : t('pricing.estimator.requestAccess', 'Request access')}
                    </a>
                  ) : null}
                </div>
              </div>

              <div className="grid grid-gap sm:grid-cols-2">
                {selectedEngine?.showResolution !== false ? (
                  <div className="rounded-[24px] border border-surface-on-media-60 bg-surface-glass-85 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] backdrop-blur">
                    <label
                      htmlFor={resolutionId}
                      className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted"
                    >
                      {fields.resolution}
                    </label>
                    <div className="relative mt-3">
                      <select
                        id={resolutionId}
                        value={selectedResolution}
                        onChange={(event) => setSelectedResolution(event.target.value)}
                        className="w-full appearance-none rounded-[16px] border border-transparent bg-surface px-4 py-3 pr-12 text-sm font-semibold text-text-primary shadow-[0_1px_3px_rgba(15,23,42,0.1)] transition focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                      >
                        {selectedEngine?.resolutions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {`${option.label} — ${formatCurrency(option.rate, selectedEngine.currency)}${selectedEngine.rateUnit ?? '/s'}`}
                          </option>
                        ))}
                      </select>
                      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-text-muted/60">
                        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                          <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    </div>
                    {activeResolution ? (
                      <p className="mt-3 text-xs text-text-muted">
                        {t('pricing.estimator.engineRateLabel', 'Engine rate')}{' '}
                        {formatCurrency(rate, currency)}
                        {selectedEngine?.rateUnit ?? '/s'}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded-[24px] border border-surface-on-media-60 bg-surface-glass-85 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] backdrop-blur">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
                      {t('pricing.estimator.engineRateLabel', 'Engine rate')}
                    </span>
                    <p className="mt-3 text-2xl font-semibold text-text-primary">
                      {formatCurrency(rate, currency)}
                      {selectedEngine?.rateUnit ?? ''}
                    </p>
                    <p className="mt-2 text-xs text-text-muted">
                      {t('pricing.estimator.perImageLabel', 'Applies per generated image inside Generate.')}
                    </p>
                  </div>
                )}

                {selectedEngine?.showDuration !== false ? (
                  <div className="rounded-[24px] border border-surface-on-media-60 bg-surface-glass-85 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] backdrop-blur">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">{fields.duration}</span>
                    {filteredDurationOptions.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {filteredDurationOptions.map((option) => {
                          const selected = option.value === duration;
                          return (
                            <Button
                              key={option.value}
                              type="button"
                              size="sm"
                              variant={selected ? 'primary' : 'ghost'}
                              onClick={() => setDuration(option.value)}
                              className={clsx(
                                'min-h-0 h-auto rounded-full px-3 py-1.5 text-sm font-medium',
                                selected
                                  ? 'shadow-[0_10px_30px_-12px_rgba(66,106,174,0.55)]'
                                  : 'bg-surface-glass-70 text-text-secondary hover:bg-surface'
                              )}
                              aria-pressed={selected}
                            >
                              {option.label}
                            </Button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="mt-4 stack-gap-sm">
                        <input
                          id={durationId}
                          type="range"
                          min={selectedEngine.minDuration}
                          max={selectedEngine.maxDuration}
                          step={1}
                          value={duration}
                          onChange={(event) => setDuration(Number(event.target.value))}
                          className="range-input"
                          aria-valuemin={selectedEngine.minDuration}
                          aria-valuemax={selectedEngine.maxDuration}
                          aria-valuenow={duration}
                        />
                        <div className="flex items-center justify-between text-xs text-text-muted">
                          <span>{selectedEngine.minDuration}s</span>
                          <span>{durationDisplay}</span>
                          <span>{selectedEngine.maxDuration}s</span>
                        </div>
                      </div>
                    )}
                    {filteredDurationOptions.length ? (
                      <p className="mt-3 text-xs text-text-muted">
                        {t('pricing.estimator.durationRangeLabel', 'Available')} •{' '}
                        {filteredDurationOptions.map((option) => option.label).join(' · ')}
                      </p>
                    ) : (
                      <p className="mt-3 text-xs text-text-muted">
                        {t('pricing.estimator.durationRangeLabel', 'Range')} {selectedEngine.minDuration}s – {selectedEngine.maxDuration}s
                      </p>
                    )}
                  </div>
                ) : null}

                {selectedEngine?.audioToggle ? (
                  <div className="rounded-[24px] border border-surface-on-media-60 bg-surface-glass-85 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] backdrop-blur">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
                      {t('pricing.estimator.audioLabel', 'Audio')}
                    </span>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {[
                        { value: true, label: t('pricing.estimator.audioOn', 'On') },
                        { value: false, label: t('pricing.estimator.audioOff', 'Off') },
                      ].map((option) => {
                        const selected = audioEnabled === option.value;
                        return (
                          <Button
                            key={String(option.value)}
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => setAudioEnabled(option.value)}
                            className={clsx(
                              'min-h-0 h-auto rounded-full px-3 py-1.5 text-sm font-medium',
                              selected
                                ? 'bg-brand text-on-brand shadow-[0_10px_30px_-12px_rgba(66,106,174,0.55)]'
                                : 'bg-surface-glass-70 text-text-secondary hover:bg-surface'
                            )}
                            aria-pressed={selected}
                          >
                            {option.label}
                          </Button>
                        );
                      })}
                    </div>
                    <p className="mt-3 text-xs text-text-muted">
                      {t('pricing.estimator.audioHint', 'Price updates when audio is toggled.')}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>

            <fieldset className="rounded-[24px] border border-surface-on-media-60 bg-surface-glass-85 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] backdrop-blur">
              <legend className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
                {fields.memberStatus}
              </legend>
              <div className="mt-3 flex flex-wrap gap-2">
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
                        'min-h-0 h-auto rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-micro',
                        selected
                          ? 'bg-neutral-900 text-on-inverse shadow-[0_10px_25px_-12px_rgba(17,24,39,0.6)]'
                          : 'bg-surface-glass-70 text-text-secondary hover:bg-surface'
                      )}
                      aria-pressed={selected}
                    >
                      {memberNames.get(tier) ?? tier}
                    </Button>
                  );
                })}
              </div>
              {memberBenefitCopy ? <p className="mt-3 text-xs text-text-muted">{memberBenefitCopy}</p> : null}
              <p className="mt-2 text-[11px] text-text-muted" aria-label={memberTooltipLabel} title={memberTooltipLabel}>
                {memberTooltipLabel}
              </p>
            </fieldset>
          </div>

          <aside className="flex flex-col gap-6">
            <div className="rounded-[28px] border border-surface-on-media-70 bg-surface-glass-95 p-6 text-sm text-text-secondary shadow-[0_28px_60px_-24px_rgba(15,23,42,0.3)] sm:p-7">
              <div className="stack-gap-lg">
                <div className="stack-gap-sm">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-text-muted">
                    {estimateLabels.heading}
                  </span>
                  <p className="text-5xl font-semibold tracking-tight text-text-primary">
                    {formatCurrency(pricing.total, currency)}
                  </p>
                  <p className="text-xs uppercase tracking-[0.3em] text-text-muted">
                    {priceChipSuffix ?? t('pricing.priceChipSuffix', 'Price before you generate.')}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-text-muted">
                    {t('pricing.estimator.engineLabel', 'Engine')}
                  </span>
                  <p className="text-base font-semibold text-text-primary">{selectedEngine?.label ?? '—'}</p>
                </div>
                <div className="grid grid-cols-2 grid-gap-sm">
                  {selectedEngine?.showDuration !== false ? (
                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-text-muted">
                        {t('pricing.estimator.durationLabel', 'Duration')}
                      </span>
                      <p className="text-base font-semibold text-text-primary">{durationDisplay}</p>
                    </div>
                  ) : null}
                  {selectedEngine?.showResolution !== false ? (
                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-text-muted">
                        {t('pricing.estimator.resolutionLabel', 'Resolution')}
                      </span>
                      <p className="text-base font-semibold text-text-primary">
                        {activeResolution?.label ?? selectedResolution?.toUpperCase()}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-text-muted">
                        {t('pricing.estimator.engineRateLabel', 'Engine rate')}
                      </span>
                      <p className="text-base font-semibold text-text-primary">
                        {formatCurrency(rate, currency)}
                        {selectedEngine?.rateUnit ?? ''}
                      </p>
                    </div>
                  )}
                </div>
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-text-muted">
                    {estimateLabels.memberChipPrefix}
                  </span>
                  <p className="text-base font-semibold text-text-primary">
                    {memberTier === 'Member' ? memberNames.get('Member') ?? 'Member' : `${discountPercent}%`}
                  </p>
                  {memberBenefitCopy ? <p className="mt-1 text-xs text-text-muted">{memberBenefitCopy}</p> : null}
                </div>
                {selectedEngine?.audioIncluded ? (
                  <p className="text-xs font-semibold text-text-secondary">
                    {t('pricing.estimator.audioIncluded', 'Audio included by default')}
                  </p>
                ) : null}
                <p className="text-xs text-text-muted">{chargedNote}</p>
              </div>
            </div>

            <div className="rounded-[24px] border border-surface-on-media-70 bg-surface-glass-90 p-5 text-sm text-text-secondary shadow-[0_14px_30px_-22px_rgba(15,23,42,0.35)]">
              <p className="font-semibold text-text-primary">
                {t('pricing.estimator.memberReminder', 'Need invoice routing or team wallets?')}
              </p>
              <p className="mt-2 text-xs text-text-muted">
                {t('pricing.estimator.memberReminderBody', 'Enable shared wallets and member tiers in Settings → Billing to automatically apply discounts.')}
              </p>
            </div>
          </aside>
        </div>
      </div>

      {/* Wallet actions removed for marketing surface */}
    </div>
  );
}
