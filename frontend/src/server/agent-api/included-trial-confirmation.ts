import type { TransactionQueryExecutor } from '@/lib/db';
import type { MembershipPricingContext } from '@/server/membership/user-membership-status';

import type { ConfirmGenerationDependencies } from './confirm-generation';
import { AgentApiError } from './errors';
import type { GenerationPricingResult } from './generation-pricing';
import { stableJson } from './generation-normalization';
import type { AgentPublicGenerationEngine } from './model-catalog';
import type { IncludedTrialGenerationReservation } from './paid-generation-execution';
import type { TrialRiskRequestContext } from './prepare-generation';
import type { AgentPrincipal } from './principal';
import type { McpGenerationQuote } from './quote-repository';
import {
  assertTrialPresetSupported,
  MCP_TRIAL_PRESET,
  TrialPresetUnsupportedError,
} from './trial-preset';
import type { TrialRiskDecision } from './trial-risk';
import { requireTrialProviderCostCents } from './trial-provider-cost';

export function requireTrialPrincipal(principal: AgentPrincipal): void {
  if (principal.emailVerified !== true || principal.clientId === null) {
    trialNotEligible();
  }
}

export function isValidConfirmationMembership(
  value: MembershipPricingContext,
): value is MembershipPricingContext {
  return Boolean(value)
    && ['member', 'plus', 'pro'].includes(value.tier)
    && value.source === 'app_receipts_rolling_30d'
    && Number.isSafeInteger(value.spent30Cents)
    && value.spent30Cents >= 0
    && Number.isSafeInteger(value.thresholdCents)
    && value.thresholdCents >= 0
    && typeof value.discountPercent === 'number'
    && Number.isFinite(value.discountPercent)
    && value.discountPercent >= 0
    && value.discountPercent <= 1;
}

export function requireTrialRiskRequestContext(value: unknown): TrialRiskRequestContext {
  if (!value
    || typeof value !== 'object'
    || Array.isArray(value)
    || Object.getPrototypeOf(value) !== Object.prototype
    || Object.getOwnPropertySymbols(value).length !== 0) {
    throw new Error('Invalid trial risk request context.');
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Object.keys(descriptors);
  if (keys.length !== 2
    || !keys.includes('clientIp')
    || !keys.includes('userAgent')
    || keys.some((key) => !descriptors[key]?.enumerable || !('value' in descriptors[key]!))) {
    throw new Error('Invalid trial risk request context.');
  }
  const clientIp = descriptors.clientIp!.value;
  const userAgent = descriptors.userAgent!.value;
  if (!(clientIp === null
      || (typeof clientIp === 'string' && clientIp.length <= 64))
    || !(userAgent === null
      || (typeof userAgent === 'string'
        && userAgent.length <= 2_048
        && !/[\u0000\r\n]/u.test(userAgent)))) {
    throw new Error('Invalid trial risk request context.');
  }
  return Object.freeze({ clientIp, userAgent });
}

export function trialNotEligible(): never {
  throw new AgentApiError(
    'TRIAL_NOT_ELIGIBLE',
    'This included trial is no longer available. Prepare a new paid quote to continue.',
    false,
    { type: 'use_paid_generation' },
  );
}

function trialRiskError(decision: Exclude<TrialRiskDecision, { allowed: true }>): never {
  if (decision.code === 'RATE_LIMITED') {
    throw new AgentApiError(
      'RATE_LIMITED',
      'Included trial confirmation is temporarily limited. Try again later.',
      true,
      { type: 'retry_later' },
    );
  }
  trialNotEligible();
}

function includedTrialPricingSnapshot(
  pricingSnapshot: Record<string, unknown>,
  normalPriceCents: number,
  providerCostCents: number,
): Record<string, unknown> {
  return {
    ...pricingSnapshot,
    funding: {
      kind: 'included_trial',
      customerChargeCents: 0,
      normalPriceCents,
      providerCostCents,
    },
  };
}

export function assertCanonicalTrialRequest(
  quote: McpGenerationQuote,
  candidate: AgentPublicGenerationEngine,
): void {
  const settings = quote.request.settings;
  try {
    assertTrialPresetSupported(candidate);
  } catch (error) {
    if (error instanceof TrialPresetUnsupportedError) trialNotEligible();
    throw error;
  }
  if (quote.fundingMode !== 'trial'
    || quote.priceCents !== 0
    || !quote.trialFunding
    || quote.request.surface !== MCP_TRIAL_PRESET.surface
    || quote.request.engineId !== MCP_TRIAL_PRESET.engineId
    || quote.request.mode !== MCP_TRIAL_PRESET.mode
    || quote.request.outputCount !== MCP_TRIAL_PRESET.outputCount
    || quote.request.references.length !== 0
    || settings.durationSec !== MCP_TRIAL_PRESET.durationSec
    || settings.resolution !== MCP_TRIAL_PRESET.resolution
    || typeof settings.aspectRatio !== 'string'
    || !MCP_TRIAL_PRESET.aspectRatios.includes(
      settings.aspectRatio as (typeof MCP_TRIAL_PRESET.aspectRatios)[number],
    )
    || typeof settings.audio !== 'boolean'
    || Object.keys(settings).length !== 4) {
    trialNotEligible();
  }
}

export async function reserveIncludedTrialConfirmation(params: {
  quote: McpGenerationQuote;
  candidate: AgentPublicGenerationEngine;
  pricingSnapshot: Record<string, unknown>;
  pricing: GenerationPricingResult;
  principal: AgentPrincipal;
  executor: TransactionQueryExecutor;
  dependencies: ConfirmGenerationDependencies;
}): Promise<IncludedTrialGenerationReservation> {
  const { quote, candidate, pricingSnapshot, pricing, principal, executor, dependencies } = params;
  let providerCostCents: number;
  try {
    providerCostCents = requireTrialProviderCostCents(quote.request);
  } catch {
    trialNotEligible();
  }
  const authoritativeTrialSnapshot = includedTrialPricingSnapshot(
    pricingSnapshot,
    pricing.priceCents,
    providerCostCents,
  );
  if (pricing.priceCents <= 0
    || pricing.currency !== quote.currency
    || quote.trialFunding?.normalPriceCents !== pricing.priceCents
    || quote.trialFunding.providerCostCents !== providerCostCents
    || stableJson(authoritativeTrialSnapshot) !== stableJson(quote.pricingSnapshot)) {
    trialNotEligible();
  }
  const risk = await dependencies.acceptTrialRisk({
    userId: principal.userId,
    oauthClientId: principal.clientId!,
    clientIp: dependencies.trialRiskContext.clientIp,
    userAgent: dependencies.trialRiskContext.userAgent,
    providerCostCents,
  }, { executor });
  if (!risk.allowed) trialRiskError(risk);
  const lockedEntitlement = await dependencies.lockReservableEntitlement(
    { userId: principal.userId },
    { executor },
  );
  if (!lockedEntitlement) trialNotEligible();
  const entitlement = await dependencies.reserveEntitlement({
    lockedEntitlement,
    quoteId: quote.quoteId,
    jobId: quote.quoteId,
    reasonCode: 'trial_confirmed',
  }, { executor });
  if (!entitlement
    || entitlement.status !== 'reserved'
    || entitlement.userId !== principal.userId
    || entitlement.reservedQuoteId !== quote.quoteId
    || entitlement.jobId !== quote.quoteId) {
    trialNotEligible();
  }
  return dependencies.reserveTrialInitialJob(
    { quote, candidate, pricingSnapshot: authoritativeTrialSnapshot },
    { executor },
  );
}
