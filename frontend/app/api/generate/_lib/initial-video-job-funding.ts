import type {
  CreateVideoInitialJobParams,
  GenerationFunding,
} from './initial-video-job';

type McpTrialFunding = Extract<GenerationFunding, { kind: 'mcp_trial' }>;

const FUNDING_WALLET_KEYS = new Set(['kind', 'reservation']);
const FUNDING_TRIAL_KEYS = new Set(['kind', 'entitlementUserId', 'quoteId']);

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

function trialFunding(params: CreateVideoInitialJobParams): McpTrialFunding | null {
  const funding = params.funding;
  if (!funding || funding.kind !== 'mcp_trial') return null;
  const exact = exactRecord(funding, FUNDING_TRIAL_KEYS);
  let pricingSnapshot: Record<string, unknown> | null = null;
  try {
    const parsed: unknown = JSON.parse(params.jobInsert.pricingSnapshotJson);
    pricingSnapshot = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    pricingSnapshot = null;
  }
  const included = pricingSnapshot?.funding;
  if (!exact
    || typeof exact.entitlementUserId !== 'string'
    || exact.entitlementUserId !== params.userId
    || typeof exact.quoteId !== 'string'
    || exact.quoteId !== params.jobId
    || Object.hasOwn(params, 'paymentMode')
    || Object.hasOwn(params, 'walletReservation')
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
    || typeof included !== 'object'
    || Array.isArray(included)
    || (included as Record<string, unknown>).kind !== 'included_trial'
    || (included as Record<string, unknown>).customerChargeCents !== 0) {
    throw new Error('Invalid MCP trial funding state.');
  }
  return {
    kind: 'mcp_trial',
    entitlementUserId: exact.entitlementUserId,
    quoteId: exact.quoteId,
  };
}

function assertWalletFunding(params: CreateVideoInitialJobParams): void {
  if (!params.funding || params.funding.kind !== 'wallet') return;
  const exact = exactRecord(params.funding, FUNDING_WALLET_KEYS);
  if (!exact
    || exact.reservation !== params.walletReservation
    || params.paymentMode !== 'wallet') {
    throw new Error('Invalid wallet funding state.');
  }
}

export function validateInitialVideoFunding(
  params: CreateVideoInitialJobParams,
): McpTrialFunding | null {
  const includedTrialFunding = trialFunding(params);
  assertWalletFunding(params);
  return includedTrialFunding;
}
