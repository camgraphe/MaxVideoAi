'use client';

import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import type { EngineCaps, EnginePricingDetails, Mode } from '@/types/engines';
import { computePricingSnapshot, type MemberTier as PricingMemberTier } from '@maxvideoai/pricing';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { getPricingKernel } from '@/lib/pricing-kernel';
import { getEngineSelectFamilyRank } from '@/lib/engine-family-priority';
import { selectPricingRule, type PricingRuleLite } from '@/lib/pricing-rules';
import { applyEnginePricingOverride, buildPricingDefinition } from '@/lib/pricing-definition';
import { Button } from '@/components/ui/Button';
import { EngineSelect } from '@/components/ui/EngineSelect';
import { SelectMenu, type SelectOption } from '@/components/ui/SelectMenu';
import {
  buildAudioAddonPayload,
  buildEngineOption,
  FAL_ENGINE_DISCOVERY_RANK,
  FAL_ENGINE_META_BY_ID,
  FAL_ENGINE_REGISTRY,
  formatCurrency,
  MEMBER_ORDER,
  PER_IMAGE_ENGINE_IDS,
  SUPPORTED_MODES,
  type EngineOption,
  type MemberTier,
} from '@/components/marketing/price-estimator/price-estimator-options';

export interface PriceEstimatorProps {
  variant?: 'full' | 'lite';
  pricingRules?: PricingRuleLite[];
  enginePricingOverrides?: Record<string, EnginePricingDetails | null | undefined>;
  defaultEngineId?: string;
  defaultDurationSec?: number;
}

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
