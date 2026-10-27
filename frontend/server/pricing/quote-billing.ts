import { NANO21_ENGINE_ID } from '@/lib/nano-banana-2-1';
import { videoOperationTariffIdentity } from '@/lib/video-operation';
import {
  projectCanonicalQuoteToSnapshot,
  quoteCanonicalPricing,
  type PricingCompatibilityProfile,
  type PricingSnapshot,
  type ManualTariffSelector,
} from '@maxvideoai/pricing';
import { getPricingDetails } from '@/lib/fal-catalog';
import { buildAudioPricingPresentation, type AudioPricingInput } from '@/lib/audio-generation';
import { LIVE_MEMBERSHIP_POLICY, LIVE_MEMBERSHIP_DISCOUNTS } from '@/lib/membership-policy';
import { buildBillingPricingFacts } from '@/lib/pricing-billing-facts';
import { isGptImage25EngineId } from '@/lib/image/gptImage2';
import { getVersionedPricingPolicy, resolveLiveAudioPricingProfile } from '@/lib/pricing-policy-defaults';
import type { PricingContext } from '@/lib/pricing-context';
import type { QueryExecutor } from '@/lib/db';
import {
  buildStoryboardPricingProjection,
  STORYBOARD_BILLING_ENGINE_ID,
  type StoryboardPricingOperation,
  type StoryboardTier,
} from '@/lib/storyboard-pricing';

import {
  resolveServerBillingPolicy,
  type ResolveServerPricingPolicyDependencies,
} from './resolve-pricing-policy';
import {
  customerTariffsEnabledByCode,
  loadCustomerTariffQuoteState,
  type EffectiveCustomerTariffState,
} from './customer-tariff-store';
import { resolveCustomerTariffQuote } from './resolve-customer-tariff';
import { buildManualTariffScenario } from '@/lib/pricing-manual-scenario';
import { assertSeedanceWorkflowPricing } from '@/lib/seedance-workflow-pricing';
import { CustomerTariffUnavailableError } from './resolve-customer-tariff';
import { isSeedance25LasInputPricing, isSeedance25EditInputPricing } from '@/server/byteplus-las-tariff';
import { normalizeSeedancePricingContext, seedanceAutomaticDurationBounds, isSeedanceAdaptiveAspect,
  SEEDANCE_REVIEWED_PRICING_ASPECTS, seedanceAutomaticPricingMetadata } from '@/lib/seedance-option-pricing';

/** Finishing tools supply vendor facts; the canonical kernel owns all customer rounding and margins. */
export async function computeCanonicalFinishingBillingSnapshot(input: { toolId: string; quality: string; vendorBudgetUsd: number; durationSec: number; profileId: string; pricingSource: string },
  dependencies: { pricingPolicy?: ResolveServerPricingPolicyDependencies } = {}): Promise<PricingSnapshot> {
  if (!Number.isFinite(input.vendorBudgetUsd) || input.vendorBudgetUsd <= 0) throw new Error('Invalid tool vendor budget.');
  const engineId = 'toolbox-finishing';
  const { policy, vendorAccountId } = await resolveServerBillingPolicy({ engineId, mode: `${input.toolId}:${input.quality}`, resolution: 'video' }, undefined, dependencies.pricingPolicy);
  // A database-wide legacy default must not silently replace this product's policy.
  if (policy.rule.engineId !== engineId) throw new Error('TOOL_PRICING_UNAVAILABLE');
  if (policy.rule.currency !== 'USD') throw new Error('Tool pricing currency is unsupported.');
  const compatibilityProfile = getVersionedPricingPolicy().compatibilityProfiles.find(profile => profile.id === 'standard');
  if (!compatibilityProfile) throw new Error('Missing standard pricing profile.');
  const quote = quoteCanonicalPricing({
    facts: { engineId, currency: 'USD', vendorSubtotalExactCents: input.vendorBudgetUsd * 100, unit: 'video', quantity: 1 },
    scenario: { id: `billing:tool:${input.toolId}:${input.quality}`, engineId, mode: `${input.toolId}:${input.quality}`, membershipTier: LIVE_MEMBERSHIP_POLICY.tier, discountPercent: 0 },
    policy, compatibilityProfile,
  });
  return projectCanonicalQuoteToSnapshot({ quote, base: { seconds: input.durationSec, rate: input.vendorBudgetUsd, unit: 'video', amountCents: input.vendorBudgetUsd * 100 }, addons: [], vendorAccountId,
    meta: { surface: 'tool', toolId: input.toolId, quality: input.quality, profileId: input.profileId, providerCostSource: input.pricingSource, providerCostKind: 'conservative-budget', vendorBudgetUsd: input.vendorBudgetUsd, ruleId: policy.sourceRuleId } });
}

export async function computeCanonicalBillingSnapshot(
  context: PricingContext,
  dependencies: {
    pricingPolicy?: ResolveServerPricingPolicyDependencies;
    membershipDiscounts?: Record<string, number>;
    loadCustomerTariffState?: () => Promise<EffectiveCustomerTariffState>;
    /** Public concurrent quotes can share selected reads within one response. */
    loadCustomerTariffQuoteState?: (selector: ManualTariffSelector) => Promise<EffectiveCustomerTariffState>;
    /** Operational cutover validates through the same selector reader before commit. */
    customerTariffExecutor?: QueryExecutor;
  } = {}
): Promise<PricingSnapshot> {
  const requestedContext = context;
  context = normalizeSeedancePricingContext(context);
  if (seedanceAutomaticDurationBounds(context.engine.id) && isSeedanceAdaptiveAspect(context.aspectRatio)) {
    const snapshots = await Promise.all(SEEDANCE_REVIEWED_PRICING_ASPECTS.map(aspectRatio =>
      computeCanonicalBillingSnapshot({ ...context, aspectRatio }, dependencies)));
    const first = snapshots[0]!;
    if (snapshots.some(snapshot => snapshot.currency !== first.currency
      || snapshot.meta?.customerTariffRevision !== first.meta?.customerTariffRevision)) {
      throw new CustomerTariffUnavailableError('Adaptive pricing changed during quotation; refresh the quote.');
    }
    const highest = snapshots.reduce((selected, snapshot) => snapshot.totalCents > selected.totalCents ? snapshot : selected);
    const providerCostBoundUsd = Math.max(...snapshots.map(snapshot => Number(snapshot.meta?.providerCostListUsd) || 0));
    return { ...highest, meta: { ...highest.meta, ...(providerCostBoundUsd > 0 ? { providerCostAdaptiveUpperBoundUsd: providerCostBoundUsd } : {}),
      seedanceAutomaticPricing: seedanceAutomaticPricingMetadata(requestedContext,
      { ...context, aspectRatio: highest.meta?.billed_aspect_ratio as string }, 'highest_current_tariff') } };
  }
  assertSeedanceWorkflowPricing(context);
  const pricingDetails = context.engine.pricingDetails ?? (context.engine.id === 'kling-v4' ? undefined : await getPricingDetails(context.engine.id));
  const { policy, vendorAccountId } = await resolveServerBillingPolicy(
    {
      engineId: context.engine.id,
      ...(context.mode ? { mode: context.mode } : {}),
      ...(context.resolution ? { resolution: context.resolution } : {}),
    },
    context.engine.vendorAccountId,
    dependencies.pricingPolicy
  );
  const currency = (context.currency ?? policy.rule.currency ?? pricingDetails?.currency ?? context.engine.pricing?.currency ?? 'USD').toUpperCase();
  const memberTier = LIVE_MEMBERSHIP_POLICY.tier;
  const memberTierDiscounts = LIVE_MEMBERSHIP_DISCOUNTS;

  const billingFacts = buildBillingPricingFacts(context, pricingDetails, currency);
  const operationBinding = videoOperationTariffIdentity(context.engine.id, context.mode ?? 't2v', context.operation);
  const requiresOperationTariff = Boolean(operationBinding) || (context.engine.id === 'veo-3-1'
    && context.mode === 'i2v' && [4,6].includes(context.durationSec));
  const requiresLasTariff = !context.workflowStep && isSeedance25LasInputPricing(context.engine.id, context.mode);
  const requiresEditTariff = !context.workflowStep && isSeedance25EditInputPricing(context.engine.id, context.mode);
  const requiresKlingV4Tariff = context.engine.id === 'kling-v4';
  const requiresNano21Tariff = context.engine.id === NANO21_ENGINE_ID;
  if (requiresKlingV4Tariff || requiresNano21Tariff || requiresOperationTariff || requiresEditTariff || context.workflowStep || dependencies.loadCustomerTariffState || dependencies.loadCustomerTariffQuoteState || customerTariffsEnabledByCode()) {
    const selector = buildManualTariffScenario(context, billingFacts.facts).selector;
    const tariffState = await (dependencies.loadCustomerTariffState
      ? dependencies.loadCustomerTariffState()
      : dependencies.loadCustomerTariffQuoteState
        ? dependencies.loadCustomerTariffQuoteState(selector)
        : loadCustomerTariffQuoteState(selector, dependencies.customerTariffExecutor));
    const manual = resolveCustomerTariffQuote({ context, facts: billingFacts.facts,
      at: new Date().toISOString(), state: tariffState });
    if (manual) {
      return projectCanonicalQuoteToSnapshot({
        quote: manual.quote,
        base: manual.supplierCost ? { ...billingFacts.base, rate: manual.supplierCost.amountUsd / billingFacts.base.seconds,
          amountCents: manual.quote.breakdown.vendorSubtotalExactCents } : billingFacts.base,
        // This all-in factual estimate includes image references; legacy addons must not be counted again.
        addons: manual.supplierCost ? [] : billingFacts.addons,
        vendorAccountId,
        meta: {
          ...billingFacts.meta,
          ...(operationBinding ? { videoOperation: operationBinding } : {}),
          ...(seedanceAutomaticPricingMetadata(requestedContext, context) ? {
            seedanceAutomaticPricing: seedanceAutomaticPricingMetadata(requestedContext, context) } : {}),
          ...(context.seedanceEditSource ? { seedanceEditSource: context.seedanceEditSource,
            output_duration_sec: context.seedanceEditSource.durationSec } : {}),
          ...(context.workflowStep ? { workflowStep: context.workflowStep } : {}),
          ...(manual.supplierCost ? { providerCostKind: manual.supplierCost.kind,
            providerCostSource: manual.supplierCost.source, providerCostSourceUrl: manual.supplierCost.sourceUrl,
            providerCostCheckedAt: manual.supplierCost.checkedAt, providerCostListUsd: manual.supplierCost.listAmountUsd,
            providerCostContract: manual.supplierCost.contract, providerCostUsage: manual.supplierCost.usage } : {}),
          pricingMode: 'manual_tariff',
          customerTariffRevision: manual.revision,
          customerTariffCellId: manual.quote.manualTariff.cellId,
          engineLabel: context.engine.label,
          engineVersion: context.engine.version,
        },
      });
    }
  }
  if (requiresKlingV4Tariff) throw new CustomerTariffUnavailableError('A separate active reviewed Kling V4 customer tariff is required.');
  if (requiresNano21Tariff) throw new CustomerTariffUnavailableError('An active reviewed Nano Banana 2.1 customer tariff is required.');
  if (requiresOperationTariff) throw new CustomerTariffUnavailableError('A separate active reviewed video operation tariff is required.');
  if (requiresEditTariff) throw new CustomerTariffUnavailableError(`An active reviewed ${requiresLasTariff ? 'LAS' : 'ModelArk'} Edit customer tariff is required.`);
  if (context.workflowStep) throw new CustomerTariffUnavailableError('A separate active Draft workflow tariff is required.');
  const policyDocument = getVersionedPricingPolicy();
  const profileId = policy.rule.compatibilityProfile ?? billingFacts.compatibilityProfileId;
  const compatibilityProfile: PricingCompatibilityProfile | undefined = policyDocument.compatibilityProfiles.find(
    (profile) => profile.id === profileId
  );
  if (!compatibilityProfile) throw new Error(`Missing pricing compatibility profile ${profileId}`);
  const discountPercent = memberTierDiscounts[memberTier] ?? 0;
  const isGptImage25Edit = isGptImage25EngineId(context.engine.id) && context.mode === 'i2i';
  const isGptImage25Edit4K = isGptImage25Edit && billingFacts.meta.billed_image_size === '3840x2160';
  const additionalReferenceImageCount = isGptImage25Edit
    ? Math.max(0, Math.round(Number(billingFacts.meta.additional_reference_image_count) || 0))
    : 0;
  const additionalReferenceCustomerCents = isGptImage25Edit4K ? 2 : 1;
  const minimumEditCustomerCents = isGptImage25Edit4K ? 3 : 2;
  const outputUnitExactCents = Number(billingFacts.meta.base_unit_price_exact_cents);
  const outputCount = Math.max(1, Math.round(billingFacts.base.seconds));
  if (isGptImage25Edit) {
    billingFacts.meta.included_reference_customer_cents = 0;
    billingFacts.meta.additional_reference_customer_cents = additionalReferenceCustomerCents;
    billingFacts.meta.minimum_edit_customer_cents = minimumEditCustomerCents;
  }
  const pricingScenario = {
    id: `billing:${context.engine.id}:${context.mode ?? 'default'}:${context.resolution}`,
    engineId: context.engine.id,
    ...(context.mode ? { mode: context.mode } : {}),
    resolution: context.resolution,
    membershipTier: memberTier,
    discountPercent,
    ...(isGptImage25Edit
      ? {
          commercialAdjustment: {
            pricingBasisExactCents: outputUnitExactCents * outputCount,
            minimumCustomerTotalCents: minimumEditCustomerCents,
            fixedCustomerCents: additionalReferenceImageCount * additionalReferenceCustomerCents,
          },
        }
      : {}),
  } as const;
  const quote = quoteCanonicalPricing({
    facts: billingFacts.facts,
    scenario: pricingScenario,
    policy,
    compatibilityProfile,
  });
  const snapshot = projectCanonicalQuoteToSnapshot({
    quote,
    base: billingFacts.base,
    addons: billingFacts.addons,
    vendorAccountId,
    meta: {
      ...billingFacts.meta,
      ...(seedanceAutomaticPricingMetadata(requestedContext, context) ? {
        seedanceAutomaticPricing: seedanceAutomaticPricingMetadata(requestedContext, context) } : {}),
      ruleId: policy.sourceRuleId,
      engineLabel: context.engine.label,
      engineVersion: context.engine.version,
      ruleCurrency: policy.rule.currency,
      membershipDiscounts: memberTierDiscounts,
    },
  });
  return snapshot;
}

export async function computeCanonicalAudioBillingSnapshot(input: AudioPricingInput, dependencies: { pricingPolicy?: ResolveServerPricingPolicyDependencies } = {}): Promise<PricingSnapshot> {
  const { policy, vendorAccountId } = await resolveServerBillingPolicy({
    engineId: 'audio-generation',
    mode: input.pack,
    resolution: 'audio',
  }, undefined, dependencies.pricingPolicy);
  const policyDocument = getVersionedPricingPolicy();
  const profileId = resolveLiveAudioPricingProfile(policy.rule);
  const compatibilityProfile = policyDocument.compatibilityProfiles.find((profile) => profile.id === profileId);
  if (!compatibilityProfile) throw new Error(`Missing pricing compatibility profile ${profileId}`);
  const presentation = buildAudioPricingPresentation(input);
  const quote = quoteCanonicalPricing({
    facts: {
      engineId: 'audio-generation',
      currency: policy.rule.currency,
      vendorSubtotalExactCents: presentation.vendorSubtotalCents,
      unit: presentation.base.unit ?? 'audio',
      quantity: presentation.durationSec,
    },
    scenario: {
      id: `billing:audio-generation:${input.pack}`,
      engineId: 'audio-generation',
      mode: input.pack,
      resolution: 'audio',
      membershipTier: 'member',
      discountPercent: 0,
    },
    policy,
    compatibilityProfile,
  });
  const snapshot = projectCanonicalQuoteToSnapshot({
    quote,
    base: presentation.base,
    addons: presentation.addons,
    vendorAccountId,
    meta: {
      ...presentation.meta,
      marginPercent: quote.breakdown.marginPercent,
    },
  });
  delete snapshot.margin.ruleId;
  return snapshot;
}

export type CanonicalStoryboardSnapshotInput = {
  snapshot: PricingSnapshot;
  operation: StoryboardPricingOperation;
  tier?: StoryboardTier;
};

export async function computeCanonicalStoryboardBillingSnapshot(
  input: CanonicalStoryboardSnapshotInput,
  dependencies: { pricingPolicy?: ResolveServerPricingPolicyDependencies } = {}
): Promise<PricingSnapshot> {
  const projection = buildStoryboardPricingProjection(input);
  const { policy, vendorAccountId } = await resolveServerBillingPolicy(
    {
      engineId: STORYBOARD_BILLING_ENGINE_ID,
      mode: input.operation,
      resolution: projection.resolution,
    },
    input.snapshot.vendorAccountId,
    dependencies.pricingPolicy
  );
  const policyDocument = getVersionedPricingPolicy();
  const profileId = policy.rule.compatibilityProfile ?? 'standard';
  const compatibilityProfile = policyDocument.compatibilityProfiles.find((profile) => profile.id === profileId);
  if (!compatibilityProfile) throw new Error(`Missing pricing compatibility profile ${profileId}`);
  const quote = quoteCanonicalPricing({
    facts: {
      ...projection.facts,
      currency: policy.rule.currency,
    },
    scenario: {
      id: `billing:${STORYBOARD_BILLING_ENGINE_ID}:${input.operation}:${projection.resolution}`,
      engineId: STORYBOARD_BILLING_ENGINE_ID,
      mode: input.operation,
      resolution: projection.resolution,
      membershipTier: LIVE_MEMBERSHIP_POLICY.tier,
      discountPercent: LIVE_MEMBERSHIP_POLICY.discountPercent,
    },
    policy,
    compatibilityProfile,
  });
  return projectCanonicalQuoteToSnapshot({
    quote,
    base: projection.base,
    addons: projection.addons,
    vendorAccountId,
    meta: projection.meta,
  });
}
