import type {
  CreateVideoInitialJobParams,
  GenerationFunding,
} from './initial-video-job';

type WalletFunding = Extract<GenerationFunding, { kind: 'wallet' }>;
type McpTrialFunding = Extract<GenerationFunding, { kind: 'mcp_trial' }>;

const FUNDING_WALLET_KEYS = new Set(['kind', 'reservation']);
const FUNDING_TRIAL_KEYS = new Set(['kind', 'entitlementUserId', 'quoteId']);
const INCLUDED_TRIAL_KEYS = new Set([
  'kind',
  'customerChargeCents',
  'normalPriceCents',
  'providerCostCents',
]);

function exactRecord(value: unknown, keys: ReadonlySet<string>): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.getPrototypeOf(value) !== Object.prototype
    || Object.getOwnPropertySymbols(value).length !== 0) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const names = Object.keys(descriptors);
  if (names.length !== keys.size
    || !names.every((key) => keys.has(key))
    || names.some((key) => !descriptors[key]?.enumerable || !('value' in descriptors[key]!))) {
    return null;
  }
  return Object.fromEntries(names.map((key) => [key, descriptors[key]!.value]));
}

function dataProperty(
  value: object,
  key: string,
): { present: false } | { present: true; value: unknown } | null {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor) return { present: false };
  if (!descriptor.enumerable || !('value' in descriptor)) return null;
  return { present: true, value: descriptor.value };
}

export function readExactMcpTrialFunding(value: unknown): McpTrialFunding | null {
  const exact = exactRecord(value, FUNDING_TRIAL_KEYS);
  if (!exact
    || exact.kind !== 'mcp_trial'
    || typeof exact.entitlementUserId !== 'string'
    || typeof exact.quoteId !== 'string') return null;
  return {
    kind: 'mcp_trial',
    entitlementUserId: exact.entitlementUserId,
    quoteId: exact.quoteId,
  };
}

function readExactWalletFunding(value: unknown): WalletFunding | null {
  const exact = exactRecord(value, FUNDING_WALLET_KEYS);
  if (!exact
    || exact.kind !== 'wallet'
    || (exact.reservation !== 'reserve' && exact.reservation !== 'already_reserved')) return null;
  return { kind: 'wallet', reservation: exact.reservation };
}

function assertTrialAccounting(
  params: CreateVideoInitialJobParams,
  funding: McpTrialFunding,
): void {
  let pricingSnapshot: Record<string, unknown> | null = null;
  try {
    const parsed: unknown = JSON.parse(params.jobInsert.pricingSnapshotJson);
    pricingSnapshot = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    pricingSnapshot = null;
  }
  const included = exactRecord(pricingSnapshot?.funding, INCLUDED_TRIAL_KEYS);
  const canonicalPricing = pricingSnapshot?.canonicalPricing;
  const canonical = canonicalPricing
    && typeof canonicalPricing === 'object'
    && !Array.isArray(canonicalPricing)
    && Object.getPrototypeOf(canonicalPricing) === Object.prototype
    ? canonicalPricing as Record<string, unknown>
    : null;
  const normalPriceCents = included?.normalPriceCents;
  const providerCostCents = included?.providerCostCents;
  const canonicalCurrency = canonical?.currency;
  if (funding.entitlementUserId !== params.userId
    || funding.quoteId !== params.jobId
    || params.pendingReceipt !== null
    || params.preferredCurrency !== null
    || params.jobInsert.jobId !== params.jobId
    || params.jobInsert.userId !== params.userId
    || params.jobInsert.finalPriceCents !== 0
    || params.jobInsert.paymentStatus !== 'included_mcp_trial'
    || params.jobInsert.stripePaymentIntentId !== null
    || params.jobInsert.stripeChargeId !== null
    || params.jobInsert.visibility !== 'private'
    || params.jobInsert.indexable !== false
    || !included
    || included.kind !== 'included_trial'
    || included.customerChargeCents !== 0
    || !Number.isSafeInteger(normalPriceCents)
    || (normalPriceCents as number) <= 0
    || !Number.isSafeInteger(providerCostCents)
    || (providerCostCents as number) <= 0
    || (providerCostCents as number) > (normalPriceCents as number)
    || canonical?.totalCents !== normalPriceCents
    || typeof canonicalCurrency !== 'string'
    || canonicalCurrency !== params.jobInsert.currency
    || params.resolvedCurrencyLower !== canonicalCurrency.toLowerCase()) {
    throw new Error('Invalid MCP trial funding state.');
  }
}

export function validateInitialVideoFunding(
  params: CreateVideoInitialJobParams,
): McpTrialFunding | null {
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    throw new Error('Invalid initial video funding state.');
  }
  const paymentMode = dataProperty(params, 'paymentMode');
  const walletReservation = dataProperty(params, 'walletReservation');
  const fundingProperty = dataProperty(params, 'funding');
  if (!paymentMode || !walletReservation || !fundingProperty) {
    throw new Error('Invalid initial video funding state.');
  }

  if (!paymentMode.present) {
    const trialFunding = fundingProperty.present
      ? readExactMcpTrialFunding(fundingProperty.value)
      : null;
    if (walletReservation.present || !trialFunding) {
      throw new Error('Invalid initial video funding state.');
    }
    assertTrialAccounting(params, trialFunding);
    return trialFunding;
  }

  if (paymentMode.value === 'wallet') {
    const walletFunding = fundingProperty.present
      ? readExactWalletFunding(fundingProperty.value)
      : null;
    if (!walletReservation.present
      || (walletReservation.value !== 'reserve' && walletReservation.value !== 'already_reserved')
      || !walletFunding
      || walletFunding.reservation !== walletReservation.value) {
      throw new Error('Invalid initial video funding state.');
    }
    return null;
  }

  if (paymentMode.value === 'direct' || paymentMode.value === 'platform') {
    if (!walletReservation.present
      || (walletReservation.value !== 'reserve' && walletReservation.value !== 'already_reserved')
      || fundingProperty.present) {
      throw new Error('Invalid initial video funding state.');
    }
    return null;
  }

  throw new Error('Invalid initial video funding state.');
}
