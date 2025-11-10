'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import clsx from 'clsx';
import { useEngines } from '@/lib/api';
import type { EngineAvailability, EngineCaps, EngineInputField } from '@/types/engines';
import type { MemberTier as PricingMemberTier } from '@maxvideoai/pricing';
import type { PricingKernel } from '@maxvideoai/pricing';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { getPricingKernel } from '@/lib/pricing-kernel';
import { AVAILABILITY_BADGE_CLASS } from '@/lib/availability';
import { getPartnerByEngineId } from '@/lib/brand-partners';
import { listFalEngines, type FalEngineEntry } from '@/config/falEngines';

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
}

interface PriceEstimatorProps {
  variant?: 'full' | 'lite';
}

const MEMBER_ORDER: MemberTier[] = ['Member', 'Plus', 'Pro'];
const FAL_ENGINE_REGISTRY = listFalEngines();
const FAL_ENGINE_ORDER = new Map<string, number>(FAL_ENGINE_REGISTRY.map((entry, index) => [entry.id, index]));

function centsToDollars(cents?: number | null) {
  if (typeof cents !== 'number' || Number.isNaN(cents)) return null;
  return cents / 100;
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
  kernel: PricingKernel,
  descriptions: Record<string, string>
): EngineOption | null {
  if (entry.availability === 'paused') {
    return null;
  }

  const definition = kernel.getDefinition(entry.id);
  const perSecond = engineCaps.pricingDetails?.perSecondCents;
  const perSecondDefault = centsToDollars(perSecond?.default);
  const resolutionSources = engineCaps.resolutions?.length
    ? engineCaps.resolutions
    : definition
        ? Object.keys(definition.resolutionMultipliers)
        : [];

  const isNanoBanana = entry.id === 'nano-banana';

  let rates = resolutionSources
    .map((resolution) => {
      if (definition) {
        const multiplier =
          definition.resolutionMultipliers[resolution] ?? definition.resolutionMultipliers.default ?? 1;
        const rate = (definition.baseUnitPriceCents * multiplier) / 100;
        if (!rate) return null;
        return { value: resolution, label: resolution.toUpperCase(), rate };
      }
      const cents = perSecond?.byResolution?.[resolution] ?? perSecond?.default;
      const rate = centsToDollars(cents) ?? perSecondDefault;
      if (!rate) return null;
      return { value: resolution, label: resolution.toUpperCase(), rate };
    })
    .filter((rate): rate is { value: string; label: string; rate: number } => Boolean(rate));

  if (!rates.length && definition) {
    const fallbackRate = definition.baseUnitPriceCents / 100;
    rates = [
      {
        value: 'default',
        label: 'DEFAULT',
        rate: fallbackRate,
      },
    ];
  }

  if (!rates.length) {
    return null;
  }

  if (isNanoBanana) {
    rates = [
      {
        value: 'per-image',
        label: 'Per image',
        rate: 0.05,
      },
    ];
  }

  const durationField = getDurationField(engineCaps);
  const defaultMin = typeof durationField?.min === 'number' ? durationField.min : engineCaps.maxDurationSec || 4;
  const defaultMax = typeof durationField?.max === 'number' ? durationField.max : engineCaps.maxDurationSec || defaultMin;
  const minDuration = definition?.durationSteps?.min ?? defaultMin ?? 4;
  let maxDuration = definition?.durationSteps?.max ?? defaultMax ?? minDuration;
  if (maxDuration < minDuration) {
    maxDuration = minDuration;
  }

  const durationOptions = collectDurationOptions(entry, engineCaps, durationField, definition).filter(
    (option) => option.value >= minDuration && option.value <= maxDuration
  );

  const defaultDuration =
    parseDurationValue(definition?.durationSteps?.default as number | string | undefined)?.value ??
    parseDurationValue(durationField?.default)?.value ??
    durationOptions[Math.floor(durationOptions.length / 2)]?.value ??
    Math.round((minDuration + maxDuration) / 2);

  const brand = getPartnerByEngineId(entry.id);
  const availabilityLink =
    entry.availability !== 'available' ? brand?.availabilityLink ?? engineCaps.apiAvailability ?? null : null;
  const description = descriptions[entry.id] ?? entry.seo.description ?? entry.marketingName;

  return {
    id: entry.id,
    label: entry.marketingName,
    description,
    minDuration,
    maxDuration,
    durationOptions,
    defaultDuration,
    resolutions: rates,
    currency: definition?.currency ?? engineCaps.pricingDetails?.currency ?? 'USD',
    availability: entry.availability,
    availabilityLink,
    showResolution: !isNanoBanana,
    rateUnit: isNanoBanana ? '/image' : '/s',
  };
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

export function PriceEstimator({ variant = 'full' }: PriceEstimatorProps) {
  const engineId = useId();
  const durationId = useId();
  const resolutionId = useId();
  const { t, dictionary } = useI18n();
  const { data } = useEngines();
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

  const engineOptions = useMemo(() => {
    const payload = data?.engines ?? [];
    const runtimeMap = new Map<string, EngineCaps>(payload.map((engine) => [engine.id, engine]));
    const options = FAL_ENGINE_REGISTRY.map((entry) => {
      const runtimeCaps = runtimeMap.get(entry.id) ?? entry.engine;
      return buildEngineOption(entry, runtimeCaps, kernel, descriptions);
    })
      .filter((option): option is EngineOption => Boolean(option))
      .filter((option) => option.availability !== 'paused');

    const preferredOrder = [
      'sora-2',
      'sora-2-pro',
      'veo-3-1',
      'veo-3-fast',
      'veo-3-1-fast',
      'pika-text-to-video',
      'pika-image-to-video',
      'minimax-hailuo-02-text',
      'minimax-hailuo-02-image',
    ];
    const preferredIndex = new Map<string, number>(preferredOrder.map((id, index) => [id, index]));

    return options.sort((a, b) => {
      const prefA = preferredIndex.get(a.id) ?? Number.MAX_SAFE_INTEGER;
      const prefB = preferredIndex.get(b.id) ?? Number.MAX_SAFE_INTEGER;
      if (prefA !== prefB) return prefA - prefB;
      const orderA = FAL_ENGINE_ORDER.get(a.id) ?? Number.MAX_SAFE_INTEGER;
      const orderB = FAL_ENGINE_ORDER.get(b.id) ?? Number.MAX_SAFE_INTEGER;
      return orderA - orderB;
    });
  }, [data?.engines, descriptions, kernel]);

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
    if (selectedEngine.durationOptions.length) {
      if (!selectedEngine.durationOptions.some((option) => option.value === duration)) {
        setDuration(selectedEngine.defaultDuration);
      }
      return;
    }
    if (duration < selectedEngine.minDuration) {
      setDuration(selectedEngine.minDuration);
    } else if (duration > selectedEngine.maxDuration) {
      setDuration(selectedEngine.maxDuration);
    }
  }, [selectedEngine, duration]);

  const [memberTier, setMemberTier] = useState<MemberTier>('Member');

  const activeResolution =
    selectedEngine?.resolutions.find((resolution) => resolution.value === selectedResolution) ??
    selectedEngine?.resolutions[0];
  const rate = activeResolution?.rate ?? 0;
  const bypassPricing = selectedEngine?.id === 'nano-banana';

  const pricingMemberTier = (memberTier.toLowerCase() as PricingMemberTier);

  const pricingQuote = useMemo(() => {
    if (!selectedEngine || bypassPricing) return null;
    try {
      return kernel.quote({
        engineId: selectedEngine.id,
        durationSec: duration,
        resolution: selectedResolution,
        memberTier: pricingMemberTier,
      });
    } catch {
      return null;
    }
  }, [kernel, selectedEngine, duration, selectedResolution, pricingMemberTier, bypassPricing]);

  const pricingSnapshot = bypassPricing ? null : pricingQuote?.snapshot ?? null;
  const manualPricing = useMemo(() => {
    if (!selectedEngine || selectedEngine.id !== 'nano-banana') return null;
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
  const activeDurationOption = selectedEngine?.durationOptions.find((option) => option.value === duration) ?? null;
  const durationDisplay = activeDurationOption?.label ?? `${duration}s`;
  const discountPercent = Math.round(pricing.discountRate * 100);
  const memberBenefitCopy = memberBenefits.get(memberTier);

  return (
    <div className="space-y-8">
      <div
        className={clsx(
          'relative overflow-hidden rounded-[32px] border p-6 shadow-[0_20px_60px_-25px_rgba(17,24,39,0.35)] sm:p-8 lg:p-10',
          isLite
            ? 'border-hairline bg-white/95'
            : 'border-white/40 bg-gradient-to-br from-white via-white/95 to-[#f3f6ff]'
        )}
      >
        {!isLite && (
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -left-28 top-[-96px] h-72 w-72 rounded-full bg-accent/16 blur-[140px]" />
            <div className="absolute -right-24 bottom-[-120px] h-80 w-80 rounded-full bg-[#7c4dff]/12 blur-[160px]" />
          </div>
        )}
        <div className="relative grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-8">
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-text-muted">
                {t('pricing.estimator.configureLabel', 'Configure')}
              </p>
              <h3 className="text-2xl font-semibold text-text-primary sm:text-3xl">
                {dictionary.pricing.estimator.title}
              </h3>
              <p className="text-sm text-text-secondary sm:text-base">{dictionary.pricing.estimator.subtitle}</p>
            </div>

            <div className="grid gap-6">
              <div className="rounded-[24px] border border-white/60 bg-white/85 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] backdrop-blur">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">{fields.engine}</span>
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
                  <select
                    id={engineId}
                    value={selectedEngine?.id ?? ''}
                    onChange={(event) => setSelectedEngineId(event.target.value)}
                    className="w-full rounded-[16px] border border-transparent bg-white px-4 py-3 text-sm font-semibold text-text-primary shadow-[0_1px_3px_rgba(15,23,42,0.1)] transition focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                  >
                    {engineOptions.map((option) => (
                      <option key={option.id} value={option.id} disabled={option.availability === 'paused'}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {selectedEngine?.description ? (
                    <p className="mt-3 text-xs text-text-muted">{selectedEngine.description}</p>
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

              <div className="grid gap-6 sm:grid-cols-2">
                {selectedEngine?.showResolution !== false ? (
                  <div className="rounded-[24px] border border-white/60 bg-white/85 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] backdrop-blur">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">{fields.resolution}</span>
                    <select
                      id={resolutionId}
                      value={selectedResolution}
                      onChange={(event) => setSelectedResolution(event.target.value)}
                      className="mt-3 w-full rounded-[16px] border border-transparent bg-white px-4 py-3 text-sm font-semibold text-text-primary shadow-[0_1px_3px_rgba(15,23,42,0.1)] transition focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                    >
                      {selectedEngine?.resolutions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {activeResolution ? (
                      <p className="mt-3 text-xs text-text-muted">
                        {t('pricing.estimator.engineRateLabel', 'Engine rate')}{' '}
                        {formatCurrency(rate, currency)}
                        {selectedEngine?.rateUnit ?? '/s'}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded-[24px] border border-white/60 bg-white/85 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] backdrop-blur">
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

                {selectedEngine ? (
                  <div className="rounded-[24px] border border-white/60 bg-white/85 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] backdrop-blur">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">{fields.duration}</span>
                    {selectedEngine.durationOptions.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {selectedEngine.durationOptions.map((option) => {
                          const selected = option.value === duration;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => setDuration(option.value)}
                              className={clsx(
                                'rounded-full px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white',
                                selected
                                  ? 'bg-accent text-white shadow-[0_10px_30px_-12px_rgba(0,109,255,0.7)]'
                                  : 'bg-white/70 text-text-secondary hover:bg-white'
                              )}
                              aria-pressed={selected}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="mt-4 space-y-3">
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
                    {selectedEngine.durationOptions.length ? (
                      <p className="mt-3 text-xs text-text-muted">
                        {t('pricing.estimator.durationRangeLabel', 'Available')} •{' '}
                        {selectedEngine.durationOptions.map((option) => option.label).join(' · ')}
                      </p>
                    ) : (
                      <p className="mt-3 text-xs text-text-muted">
                        {t('pricing.estimator.durationRangeLabel', 'Range')} {selectedEngine.minDuration}s – {selectedEngine.maxDuration}s
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            </div>

            <fieldset className="rounded-[24px] border border-white/60 bg-white/85 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] backdrop-blur">
              <legend className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
                {fields.memberStatus}
              </legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {MEMBER_ORDER.map((tier) => {
                  const selected = tier === memberTier;
                  return (
                    <button
                      key={tier}
                      type="button"
                      onClick={() => setMemberTier(tier)}
                      className={clsx(
                        'rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-micro transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white',
                        selected
                          ? 'bg-neutral-900 text-white shadow-[0_10px_25px_-12px_rgba(17,24,39,0.6)]'
                          : 'bg-white/70 text-text-secondary hover:bg-white'
                      )}
                      aria-pressed={selected}
                    >
                      {memberNames.get(tier) ?? tier}
                    </button>
                  );
                })}
              </div>
              {memberBenefitCopy ? <p className="mt-3 text-xs text-text-muted">{memberBenefitCopy}</p> : null}
              <p className="mt-2 text-[11px] text-text-muted" aria-label={memberTooltipLabel} title={memberTooltipLabel}>
                {memberTooltipLabel}
              </p>
            </fieldset>
          </div>

          <aside className="flex flex-col gap-5">
            <div className="rounded-[28px] border border-white/70 bg-white/95 p-6 text-sm text-text-secondary shadow-[0_28px_60px_-24px_rgba(15,23,42,0.3)] sm:p-7">
              <div className="space-y-6">
                <div className="space-y-3">
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
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-text-muted">
                      {t('pricing.estimator.durationLabel', 'Duration')}
                    </span>
                    <p className="text-base font-semibold text-text-primary">{durationDisplay}</p>
                  </div>
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
                <div className="space-y-1 text-xs text-text-muted">
                  <p>
                    {estimateLabels.base} {formatCurrency(pricing.base, currency)} · {estimateLabels.discount}{' '}
                    {formatCurrency(pricing.discountValue, currency)} ({discountPercent}%)
                  </p>
                  <p>{chargedNote}</p>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-white/70 bg-white/90 p-5 text-sm text-text-secondary shadow-[0_14px_30px_-22px_rgba(15,23,42,0.35)]">
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
