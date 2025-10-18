'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import clsx from 'clsx';
import { useEngines } from '@/lib/api';
import type { EngineAvailability, EngineCaps, EngineInputField } from '@/types/engines';
import type { MemberTier as PricingMemberTier } from '@maxvideoai/pricing';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { PriceChip } from '@/components/marketing/PriceChip';
import { getPricingKernel } from '@/lib/pricing-kernel';
import { AVAILABILITY_BADGE_CLASS } from '@/lib/availability';
import { getModelByEngineId, listAvailableModels } from '@/lib/model-roster';
import { getPartnerByEngineId } from '@/lib/brand-partners';

type MemberTier = 'Member' | 'Plus' | 'Pro';

interface EngineOption {
  id: string;
  label: string;
  description: string;
  minDuration: number;
  maxDuration: number;
  resolutions: Array<{ value: string; label: string; rate: number }>;
  currency: string;
  availability: EngineAvailability;
  availabilityLink?: string | null;
}

interface PriceEstimatorProps {
  showWalletActions?: boolean;
  variant?: 'full' | 'lite';
}

const MEMBER_ORDER: MemberTier[] = ['Member', 'Plus', 'Pro'];

function centsToDollars(cents?: number | null) {
  if (typeof cents !== 'number' || Number.isNaN(cents)) return null;
  return cents / 100;
}

function getDurationField(engine: EngineCaps): EngineInputField | undefined {
  const optional = engine.inputSchema?.optional ?? [];
  return optional.find((field) => field.id === 'duration_seconds');
}

function buildEngineOptions(engines: EngineCaps[], descriptions: Record<string, string>) {
  const kernel = getPricingKernel();
  const options: EngineOption[] = [];

  engines.forEach((engine) => {
    const definition = kernel.getDefinition(engine.id);
    const rosterEntry = getModelByEngineId(engine.id);
    const brand = getPartnerByEngineId(engine.id);
    if (!rosterEntry || rosterEntry.availability === 'paused') {
      return;
    }

    const perSecond = engine.pricingDetails?.perSecondCents;
    const perSecondDefault = centsToDollars(perSecond?.default);
    const resolutionRates = engine.resolutions?.length
      ? engine.resolutions
      : definition
          ? Object.keys(definition.resolutionMultipliers)
          : ['720p', '1080p'];

    let rates = resolutionRates
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
      return;
    }

    const durationField = getDurationField(engine);
    const minDuration = definition?.durationSteps?.min ?? durationField?.min ?? 4;
    const maxDuration = definition?.durationSteps?.max ?? durationField?.max ?? engine.maxDurationSec ?? 30;
    const description = descriptions[engine.id] ?? rosterEntry.marketingName;

    options.push({
      id: engine.id,
      label: rosterEntry.marketingName,
      description,
      minDuration,
      maxDuration,
      resolutions: rates,
      currency: definition?.currency ?? engine.pricingDetails?.currency ?? 'USD',
      availability: rosterEntry.availability,
      availabilityLink:
        rosterEntry.availability !== 'available'
          ? brand?.availabilityLink ?? engine.apiAvailability ?? null
          : null,
    });
  });

  return options;
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

export function PriceEstimator({ showWalletActions = true, variant = 'full' }: PriceEstimatorProps) {
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
    memberChipPrefix: 'Member price — You save',
  }) as Record<string, string>;

  const descriptions = dictionary.pricing.estimator.descriptions;
  const availabilityLabels = dictionary.models.availabilityLabels;

  const fallbackEngines = useMemo<EngineOption[]>(() => {
    const kernel = getPricingKernel();
    const options: EngineOption[] = [];

    listAvailableModels(true).forEach((entry) => {
      const definition = kernel.getDefinition(entry.engineId);
      if (!definition) {
        return;
      }
      const multiplierEntries = Object.entries(definition.resolutionMultipliers).filter(([key]) => key !== 'default');
      const baseRate = definition.baseUnitPriceCents / 100;
      const resolutions = multiplierEntries.length
        ? multiplierEntries.map(([resolution, multiplier]) => ({
            value: resolution,
            label: resolution.toUpperCase(),
            rate: (definition.baseUnitPriceCents * multiplier) / 100,
          }))
        : [
            {
              value: 'default',
              label: 'DEFAULT',
              rate: baseRate,
            },
          ];
      const brand = getPartnerByEngineId(entry.engineId);
      const minDuration = definition.durationSteps?.min ?? 4;
      const maxDuration = definition.durationSteps?.max ?? 30;
      options.push({
        id: entry.engineId,
        label: entry.marketingName,
        description: descriptions[entry.engineId] ?? entry.marketingName,
        minDuration,
        maxDuration,
        resolutions,
        currency: definition.currency,
        availability: entry.availability,
        availabilityLink: entry.availability !== 'available' ? brand?.availabilityLink ?? null : null,
      });
    });

    return options;
  }, [descriptions]);

  const engineOptions = useMemo(() => {
    const payload = data?.engines ?? [];
    if (!payload.length) return fallbackEngines;
    const preferredOrder = ['veo3', 'sora-2', 'lumaDM', 'pika22', 'minimax_video_01'];
    const filtered = payload.filter((engine) => preferredOrder.includes(engine.id));
    const mapped = buildEngineOptions(filtered.length ? filtered : payload, descriptions);
    if (!mapped.length) return fallbackEngines;
    return preferredOrder
      .map((id) => mapped.find((option) => option.id === id))
      .filter((option): option is EngineOption => Boolean(option));
  }, [data?.engines, descriptions, fallbackEngines]);

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
    const midpoint = Math.round((selectedEngine.minDuration + selectedEngine.maxDuration) / 2);
    return Math.min(Math.max(midpoint, selectedEngine.minDuration), selectedEngine.maxDuration);
  });

  useEffect(() => {
    if (!selectedEngine) return;
    if (duration < selectedEngine.minDuration) {
      setDuration(selectedEngine.minDuration);
    } else if (duration > selectedEngine.maxDuration) {
      setDuration(selectedEngine.maxDuration);
    }
  }, [selectedEngine, duration]);

  const [memberTier, setMemberTier] = useState<MemberTier>('Member');
  const [autoTopUp, setAutoTopUp] = useState(false);
  const [walletBalance, setWalletBalance] = useState(25);

  const activeResolution = selectedEngine?.resolutions.find((resolution) => resolution.value === selectedResolution) ?? selectedEngine?.resolutions[0];
  const rate = activeResolution?.rate ?? 0;

  const pricingMemberTier = (memberTier.toLowerCase() as PricingMemberTier);

  const pricingQuote = useMemo(() => {
    if (!selectedEngine) return null;
    try {
      return kernel.quote({
        engineId: selectedEngine.id,
        durationSec: duration,
        resolution: selectedResolution,
        memberTier: pricingMemberTier,
        addons: {},
      });
    } catch {
      return null;
    }
  }, [kernel, selectedEngine, duration, selectedResolution, pricingMemberTier]);

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

  const handleTopUp = (amount: number) => {
    setWalletBalance((prev) => Math.round((prev + amount) * 100) / 100);
  };

  const currency = pricingSnapshot?.currency ?? selectedEngine?.currency ?? 'USD';
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

  const walletBalanceLabel =
    dictionary.pricing.wallet.balanceLabel ?? t('pricing.wallet.balanceLabel', 'Wallet balance') ?? 'Wallet balance';
  const walletHelper =
    dictionary.pricing.wallet.balanceHelper ?? t('pricing.wallet.balanceHelper', 'Starter Credits begin at $10. Shared wallets sync automatically.') ??
    'Starter Credits begin at $10. Shared wallets sync automatically.';
  const walletAutoLabel =
    dictionary.pricing.wallet.autoTopUpLabel ?? t('pricing.wallet.autoTopUpLabel', 'Auto top-up when balance dips below $10') ??
    'Auto top-up when balance dips below $10';
  const addLabelTemplate =
    dictionary.pricing.wallet.addLabel ?? t('pricing.wallet.addLabel', 'Add ${amount}') ?? 'Add ${amount}';
  const chargedNote =
    dictionary.pricing.estimator.chargedNote ?? t('pricing.estimator.chargedNote', 'Charged only if render succeeds.') ??
    'Charged only if render succeeds.';
  const memberTooltipLabel = tooltip ?? 'Status updates daily on your last 30 days of spend.';
  const priceChipSuffix = t('pricing.priceChipSuffix', dictionary.pricing.priceChipSuffix);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label htmlFor={engineId} className="flex flex-col gap-2 text-sm font-medium text-text-secondary">
          {fields.engine}
          <select
            id={engineId}
            value={selectedEngine?.id ?? ''}
            onChange={(event) => setSelectedEngineId(event.target.value)}
            className="rounded-input border border-hairline bg-bg px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            {engineOptions.map((option) => (
              <option key={option.id} value={option.id} disabled={option.availability === 'paused'}>
                {option.availability ? `${option.label} — ${availabilityLabels[option.availability] ?? option.availability}` : option.label}
              </option>
            ))}
          </select>
          {selectedEngine?.description ? <span className="text-xs text-text-muted">{selectedEngine.description}</span> : null}
          {selectedEngine && selectedEngine.availability !== 'available' && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
              <span
                className={clsx(
                  'inline-flex items-center rounded-pill border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-micro',
                  AVAILABILITY_BADGE_CLASS[selectedEngine.availability]
                )}
              >
                {availabilityLabels[selectedEngine.availability] ?? selectedEngine.availability}
              </span>
              {selectedEngine.availability === 'waitlist' && selectedEngine.availabilityLink && (
                <a
                  href={selectedEngine.availabilityLink}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] font-medium text-text-muted underline underline-offset-4 transition hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                >
                  Join waitlist
                </a>
              )}
              {selectedEngine.availability === 'limited' && selectedEngine.availabilityLink && (
                <a
                  href={selectedEngine.availabilityLink}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] font-medium text-text-muted underline underline-offset-4 transition hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                >
                  Request access
                </a>
              )}
              {selectedEngine.availability === 'paused' && <span>Temporarily unavailable.</span>}
            </div>
          )}
        </label>

        <label htmlFor={resolutionId} className="flex flex-col gap-2 text-sm font-medium text-text-secondary">
          {fields.resolution}
          <select
            id={resolutionId}
            value={selectedResolution}
            onChange={(event) => setSelectedResolution(event.target.value)}
            className="rounded-input border border-hairline bg-bg px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            {selectedEngine?.resolutions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {activeResolution ? (
            <span className="text-xs text-text-muted">
              {`${activeResolution.label} · ${formatCurrency(activeResolution.rate, currency)}/s`}
            </span>
          ) : null}
        </label>

        {selectedEngine ? (
          <div className="flex flex-col gap-2 text-sm font-medium text-text-secondary">
            <label htmlFor={durationId}>{fields.duration}</label>
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
              <span>{duration}s</span>
              <span>{selectedEngine.maxDuration}s</span>
            </div>
          </div>
        ) : null}

        <fieldset className="flex flex-col gap-3 rounded-card border border-hairline bg-white px-3 py-3">
          <legend className="flex items-center gap-2 px-1 text-sm font-medium text-text-secondary">
            <span>{fields.memberStatus}</span>
            <span className="text-xs text-text-muted" title={memberTooltipLabel} aria-label={memberTooltipLabel}>
              ⓘ
            </span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {MEMBER_ORDER.map((tier) => {
              const selected = tier === memberTier;
              return (
                <button
                  key={tier}
                  type="button"
                  onClick={() => setMemberTier(tier)}
                  className={clsx(
                    'rounded-pill border px-3 py-1 text-xs font-semibold uppercase tracking-micro transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white',
                    selected ? 'border-accent bg-accent text-white' : 'border-hairline text-text-secondary hover:text-text-primary'
                  )}
                  aria-pressed={selected}
                >
                  {memberNames.get(tier) ?? tier}
                </button>
              );
            })}
          </div>
            <p className="text-xs text-text-muted">{memberBenefits.get(memberTier)}</p>
        </fieldset>
      </div>

      <div className="space-y-3 rounded-card border border-hairline bg-white p-4 shadow-card">
        {selectedEngine && pricingSnapshot && (
          <PriceChip
            engineId={selectedEngine.id}
            durationSec={duration}
            resolution={selectedResolution}
            memberTier={pricingMemberTier}
            suffix={priceChipSuffix}
          />
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-text-primary">{estimateLabels.heading}</p>
            <p className="text-2xl font-semibold text-text-primary">{formatCurrency(pricing.total, currency)}</p>
            <p className="text-xs text-text-muted">
              {estimateLabels.base} {formatCurrency(pricing.base, currency)} · {estimateLabels.discount} {formatCurrency(pricing.discountValue, currency)} ({Math.round(pricing.discountRate * 100)}%)
            </p>
            <p className="text-xs text-text-secondary">{chargedNote}</p>
          </div>
          <div className="space-y-2 text-xs text-text-secondary">
            <p>
              {t('pricing.estimator.engineRateLabel', 'Engine rate')} {formatCurrency(rate, currency)}/s · {t('pricing.estimator.durationLabel', 'Duration')} {duration}s · {t('pricing.estimator.resolutionLabel', 'Resolution')} {activeResolution?.label ?? ''}.
            </p>
            <p>
              {estimateLabels.memberChipPrefix}{' '}
              <span className="font-semibold text-accent">{memberTier === 'Member' ? memberNames.get('Member') ?? 'Member' : `${Math.round(pricing.discountRate * 100)}%`}</span>
            </p>
          </div>
        </div>
      </div>

      {showWalletActions && variant === 'full' && (
        <div className="grid gap-4 rounded-card border border-hairline bg-white p-4 shadow-card sm:grid-cols-2">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-text-primary">{walletBalanceLabel}</p>
            <p className="text-2xl font-semibold text-text-primary">{formatCurrency(walletBalance, currency)}</p>
            <p className="text-xs text-text-muted">{walletHelper}</p>
          </div>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 text-xs">
              {[5, 10, 25].map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => handleTopUp(amount)}
                  className="rounded-pill border border-hairline px-3 py-1 font-semibold text-text-secondary transition hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                >
                  {addLabelTemplate.replace('{amount}', amount.toString()).replace('${amount}', `$${amount}`)}
                </button>
              ))}
            </div>
            <label className="inline-flex items-center gap-2 text-xs text-text-secondary">
              <input
                type="checkbox"
                checked={autoTopUp}
                onChange={(event) => setAutoTopUp(event.target.checked)}
                className="h-4 w-4 rounded border-hairline text-accent focus:ring-2 focus:ring-ring"
              />
              {walletAutoLabel}
            </label>
            <p className="text-xs text-text-muted">{dictionary.pricing.wallet.autoTopUpHint ?? t('pricing.wallet.autoTopUpHint', 'Daily status emails keep finance in the loop.')}</p>
          </div>
        </div>
      )}
    </div>
  );
}
