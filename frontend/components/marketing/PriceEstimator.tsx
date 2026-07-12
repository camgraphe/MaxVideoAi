'use client';

import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import type { EngineCaps, EnginePricingDetails, Mode } from '@/types/engines';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { getPricingKernel } from '@/lib/pricing-kernel';
import { getEngineSelectFamilyRank } from '@/lib/engine-family-priority';
import type { PricingRuleLite } from '@/lib/pricing-rules';
import { applyEnginePricingOverride } from '@/lib/pricing-definition';
import { buildPublicPricingFacts, buildPublicUnitPricingFacts } from '@/lib/pricing-public-facts';
import { projectPublicPricingSnapshot, quotePublicPricing, type PublicPricingMembershipTier } from '@/lib/pricing-public-quote';
import { EngineSelect } from '@/components/ui/EngineSelect';
import type { SelectOption } from '@/components/ui/SelectMenu';
import { PriceEstimatorSelectGroup } from '@/components/marketing/price-estimator/PriceEstimatorSelectGroup';
import { PriceEstimatorSummaryPanel } from '@/components/marketing/price-estimator/PriceEstimatorSummaryPanel';
import { buildPriceEstimatorSummaryLabels } from '@/components/marketing/price-estimator/price-estimator-summary-labels';
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

  const pricingMemberTier = memberTier.toLowerCase() as PublicPricingMembershipTier;

  const pricingQuote = useMemo(() => {
    if (!selectedEngine || !activeResolution) return null;
    const pricingCaps = selectedEngine.pricingEngineCaps ?? null;
    if (!pricingCaps) return null;
    try {
      const addons = buildAudioAddonPayload(selectedEngine.audioAddonKey, audioEnabled);
      const perImage = PER_IMAGE_ENGINE_IDS.has(selectedEngine.id);
      const mode = pricingCaps.modes.includes(engineMode)
        ? engineMode
        : pricingCaps.modes.find((candidate) => SUPPORTED_MODES.has(candidate)) ?? pricingCaps.modes[0];
      const facts = perImage
        ? buildPublicUnitPricingFacts({
            engineId: selectedEngine.pricingEngineId,
            currency: selectedEngine.currency,
            unitPriceCents: activeResolution.providerRate * 100,
            unit: 'image',
          })
        : buildPublicPricingFacts({
            engine: pricingCaps,
            durationSec: duration,
            resolution: selectedResolution,
            mode,
            ...(addons ? { addons } : {}),
            useStandardDefinitionFacts: true,
          });
      const quote = quotePublicPricing({
        facts: facts.facts,
        scenario: {
          id: `estimator:${selectedEngine.pricingEngineId}:${duration}:${selectedResolution}`,
          engineId: facts.facts.engineId,
          ...(mode ? { mode } : {}),
          resolution: selectedResolution,
          membershipTier: pricingMemberTier,
        },
        compatibilityProfileId: perImage
          ? facts.compatibilityProfileId
          : 'public-rounded-vendor-current',
        pricingRules,
      });
      return {
        quote,
        snapshot: projectPublicPricingSnapshot({
          quote,
          base: facts.base,
          addons: facts.addons,
          meta: facts.meta,
        }),
      };
    } catch {
      return null;
    }
  }, [selectedEngine, activeResolution, audioEnabled, engineMode, duration, selectedResolution, pricingMemberTier, pricingRules]);

  const pricingSnapshot = pricingQuote?.snapshot ?? null;

  const pricing = useMemo(() => {
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
  }, [pricingSnapshot]);

  const currency = pricingSnapshot?.currency ?? selectedEngine?.currency ?? 'USD';
  const tiers = dictionary.pricing.member.tiers;
  const tooltip = dictionary.pricing.member.tooltip;
  const memberNames = useMemo(
    () => new Map<MemberTier, string>(MEMBER_ORDER.map((tier, index) => [tier, (tiers[index]?.name ?? tier) as string])),
    [tiers]
  );
  const memberBenefits = useMemo(
    () => new Map<MemberTier, string>(MEMBER_ORDER.map((tier, index) => [tier, dictionary.pricing.member.tiers[index]?.benefit ?? ''])),
    [dictionary.pricing.member.tiers]
  );

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
  const summaryLabels = buildPriceEstimatorSummaryLabels({
    chargedNote,
    fields,
    memberTooltipLabel,
    priceChipSuffix,
    t,
  });

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
                    <PriceEstimatorSelectGroup
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
                    <PriceEstimatorSelectGroup
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
                    <PriceEstimatorSelectGroup
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

          <PriceEstimatorSummaryPanel
            activeResolutionLabel={activeResolution?.label}
            audioEnabled={audioEnabled}
            currency={currency}
            discountPercent={discountPercent}
            durationDisplay={durationDisplay}
            estimateLabels={estimateLabels}
            labels={summaryLabels}
            memberBenefitCopy={memberBenefitCopy}
            memberNames={memberNames}
            memberTier={memberTier}
            priceTotal={pricing.total}
            rate={rate}
            selectedEngine={selectedEngine}
            selectedResolution={selectedResolution}
            onMemberTierChange={setMemberTier}
          />
        </div>
      </div>

      {/* Wallet actions removed for marketing surface */}
    </div>
  );
}
