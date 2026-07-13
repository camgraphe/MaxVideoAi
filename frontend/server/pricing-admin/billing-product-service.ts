import { ANGLE_TOOL_ENGINES } from '@/config/tools-angle-engines';
import { BACKGROUND_REMOVAL_TOOL_ENGINES } from '@/config/tools-background-removal-engines';
import { UPSCALE_TOOL_ENGINES } from '@/config/tools-upscale-engines';
import type {
  InsertPricingChangeEventInput,
  ListPricingChangeEventsInput,
  PricingChangeEvent,
  PricingChangeJsonObject,
  PricingChangeJsonValue,
  PricingChangePreview,
  PricingChangePreviewProvenance,
} from '@/lib/admin/pricing-change-contract';
import {
  buildCanonicalFixedProductSnapshot,
  invalidateBillingProductsCache,
  loadBillingProductsWithExecutor,
  updateBillingProductWithExecutor,
  type BillingProductLoadResult,
  type BillingProductMutationInput,
} from '@/lib/billing-products';
import { isDatabaseConfigured, query, withDbTransaction, type QueryExecutor } from '@/lib/db';
import { getVersionedPricingPolicy } from '@/lib/pricing-policy-defaults';
import { ensureBillingSchema } from '@/lib/schema';
import { getAngleBillingProductKeyForEngine } from '@/server/tools/angle-request-utils';
import { getBillingProductKey } from '@/server/tools/character-builder/utils';
import type { BillingProductRecord } from '@/types/billing';

import { PricingAdminError } from './errors';
import {
  getPricingChangeEventById,
  insertPricingChangeEvent,
  listPricingChangeEvents,
} from './event-store';
import { buildPricingPreviewFingerprint } from './fingerprint';
import { revalidatePricingChangeSurfaces } from './revalidation';

const POSTGRES_INTEGER_MAX = 2_147_483_647;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type BillingProductChangeProposal =
  | {
      operation?: 'update';
      productKey: string;
      label?: unknown;
      currency?: unknown;
      unitPriceCents?: unknown;
      active?: unknown;
    }
  | { operation: 'rollback'; productKey: string; eventId: string };

export type BillingProductInventory = {
  databaseStatus: BillingProductLoadResult['status'];
  products: BillingProductRecord[];
  historicalProductCount: number;
  missingReferencedProductKeys: string[];
  warnings: string[];
};

export type BillingProductChangeConfirmation = {
  committed: true;
  preview: PricingChangePreview;
  persistedState: PricingChangeJsonValue;
  event: PricingChangeEvent;
  operationalWarnings: Array<{
    code: 'cache_invalidation_failed' | 'path_revalidation_failed';
    message: string;
  }>;
};

export type BillingProductPricingServiceDependencies = {
  loadProducts(executor?: QueryExecutor): Promise<BillingProductLoadResult>;
  getEvent(id: string, domain: 'billing_product', executor?: QueryExecutor): Promise<PricingChangeEvent | null>;
  listEvents(input?: ListPricingChangeEventsInput): Promise<PricingChangeEvent[]>;
  withTransaction<TResult>(callback: (executor: QueryExecutor) => Promise<TResult>): Promise<TResult>;
  updateProduct(executor: QueryExecutor, proposal: BillingProductMutationInput): Promise<BillingProductRecord>;
  insertEvent(executor: QueryExecutor, input: InsertPricingChangeEventInput): Promise<PricingChangeEvent>;
  invalidateCache(): void;
  revalidate(preview: PricingChangePreview): void;
};

async function loadDefaultProducts(executor?: QueryExecutor): Promise<BillingProductLoadResult> {
  if (!isDatabaseConfigured()) return { status: 'unavailable', products: [] };
  try {
    if (!executor) await ensureBillingSchema();
    const products = await loadBillingProductsWithExecutor(executor ?? { query }, { lock: Boolean(executor) });
    return { status: 'loaded', products };
  } catch {
    return { status: 'unavailable', products: [] };
  }
}

const DEFAULT_DEPENDENCIES: BillingProductPricingServiceDependencies = {
  loadProducts: loadDefaultProducts,
  getEvent: (id, domain, executor) => getPricingChangeEventById(id, domain, executor),
  listEvents: listPricingChangeEvents,
  withTransaction: async (callback) => {
    if (!isDatabaseConfigured()) {
      throw new PricingAdminError('database_unavailable', 'Billing product database is unavailable');
    }
    await ensureBillingSchema();
    return withDbTransaction((executor) => callback(executor));
  },
  updateProduct: updateBillingProductWithExecutor,
  insertEvent: insertPricingChangeEvent,
  invalidateCache: invalidateBillingProductsCache,
  revalidate: revalidatePricingChangeSurfaces,
};

export function listReferencedBillingProductKeys(): ReadonlySet<string> {
  return new Set([
    getBillingProductKey('draft'),
    getBillingProductKey('final'),
    ...ANGLE_TOOL_ENGINES.flatMap((engine) => [
      getAngleBillingProductKeyForEngine(engine.id, false),
      getAngleBillingProductKeyForEngine(engine.id, true),
    ]),
    ...UPSCALE_TOOL_ENGINES.map((engine) => engine.billingProductKey),
    ...BACKGROUND_REMOVAL_TOOL_ENGINES.map((engine) => engine.billingProductKey),
  ]);
}

function requiredText(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new PricingAdminError('invalid_payload', `${label} is required`);
  }
  return value.trim();
}

function normalizeJson(value: unknown): PricingChangeJsonValue | null {
  if (value == null) return null;
  try {
    return JSON.parse(JSON.stringify(value)) as PricingChangeJsonValue;
  } catch {
    throw new PricingAdminError('invalid_payload', 'Billing product metadata must be valid JSON');
  }
}

function productJson(product: BillingProductRecord): PricingChangeJsonObject {
  return {
    productKey: product.productKey,
    surface: product.surface,
    label: product.label,
    currency: product.currency,
    unitKind: product.unitKind,
    unitPriceCents: product.unitPriceCents,
    active: product.active,
    metadata: normalizeJson(product.metadata),
  };
}

function mutableStateFrom(value: unknown, current: BillingProductRecord): BillingProductRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new PricingAdminError('invalid_payload', 'Billing product state must be an object');
  }
  const record = value as Record<string, unknown>;
  return normalizeUpdate({
    productKey: current.productKey,
    label: record.label,
    currency: record.currency,
    unitPriceCents: record.unitPriceCents,
    active: record.active,
  }, current);
}

function normalizeUpdate(
  proposal: Exclude<BillingProductChangeProposal, { operation: 'rollback' }>,
  current: BillingProductRecord
): BillingProductRecord {
  const productKey = requiredText(proposal.productKey, 'productKey');
  if (productKey !== current.productKey) {
    throw new PricingAdminError('missing_target', `Billing product not found: ${productKey}`);
  }
  const label = proposal.label === undefined ? current.label : requiredText(proposal.label, 'label');
  const currency = proposal.currency === undefined
    ? current.currency
    : requiredText(proposal.currency, 'currency').toUpperCase();
  if (!getVersionedPricingPolicy().supportedCurrencies.includes(currency)) {
    throw new PricingAdminError('unsupported_currency', `Unsupported billing product currency: ${currency}`);
  }
  const unitPriceCents = proposal.unitPriceCents === undefined ? current.unitPriceCents : proposal.unitPriceCents;
  if (
    !Number.isSafeInteger(unitPriceCents) ||
    (unitPriceCents as number) < 0 ||
    (unitPriceCents as number) > POSTGRES_INTEGER_MAX
  ) {
    throw new PricingAdminError(
      'invalid_number',
      `unitPriceCents must be a safe PostgreSQL INTEGER between 0 and ${POSTGRES_INTEGER_MAX}`
    );
  }
  if (proposal.active !== undefined && typeof proposal.active !== 'boolean') {
    throw new PricingAdminError('invalid_payload', 'active must be a boolean');
  }
  return {
    ...current,
    label,
    currency,
    unitPriceCents: unitPriceCents as number,
    active: proposal.active === undefined ? current.active : proposal.active,
  };
}

function loadedProducts(result: BillingProductLoadResult): BillingProductRecord[] {
  if (result.status === 'unavailable') {
    throw new PricingAdminError('database_unavailable', 'Billing product database is unavailable');
  }
  return result.products;
}

function findEditableProduct(products: BillingProductRecord[], productKey: string): BillingProductRecord {
  if (!listReferencedBillingProductKeys().has(productKey)) {
    throw new PricingAdminError('missing_target', `Billing product ${productKey} is not referenced and is not editable`);
  }
  const product = products.find((candidate) => candidate.productKey === productKey);
  if (!product) throw new PricingAdminError('missing_target', `Billing product not found: ${productKey}`);
  return product;
}

type BillingProductPreviewContext = {
  operation: 'update' | 'rollback';
  current: BillingProductRecord;
  proposed: BillingProductRecord;
  rollbackEventId?: string;
};

async function buildPreviewContext(
  proposal: BillingProductChangeProposal,
  dependencies: BillingProductPricingServiceDependencies,
  executor?: QueryExecutor
): Promise<BillingProductPreviewContext> {
  if (!proposal || typeof proposal !== 'object' || Array.isArray(proposal)) {
    throw new PricingAdminError('invalid_payload', 'Billing product proposal must be an object');
  }
  const productKey = requiredText(proposal.productKey, 'productKey');
  const rollbackEventId = proposal.operation === 'rollback'
    ? requiredText(proposal.eventId, 'eventId')
    : null;
  if (rollbackEventId && !UUID_PATTERN.test(rollbackEventId)) {
    throw new PricingAdminError('invalid_payload', 'eventId must be a UUID');
  }
  const current = findEditableProduct(loadedProducts(await dependencies.loadProducts(executor)), productKey);
  if (proposal.operation === 'rollback') {
    const event = await dependencies.getEvent(rollbackEventId!, 'billing_product', executor);
    if (!event || event.targetId !== productKey || !event.previousState) {
      throw new PricingAdminError('missing_target', 'Billing product change event not found');
    }
    return {
      operation: 'rollback',
      current,
      proposed: mutableStateFrom(event.previousState, current),
      rollbackEventId: rollbackEventId!,
    };
  }
  if (proposal.operation !== undefined && proposal.operation !== 'update') {
    throw new PricingAdminError('invalid_payload', 'Unsupported billing product operation');
  }
  return { operation: 'update', current, proposed: normalizeUpdate(proposal, current) };
}

function projectProduct(product: BillingProductRecord) {
  return buildCanonicalFixedProductSnapshot({
    engineId: product.productKey,
    currency: product.currency,
    amountCents: product.unitPriceCents,
    quantity: 1,
    unit: product.unitKind,
    unitRate: Number((product.unitPriceCents / 100).toFixed(4)),
    memberTier: 'member',
    discountPercent: 0,
    meta: {
      pricingModel: 'billing-product',
      surface: product.surface,
      billingProductKey: product.productKey,
      billingProductLabel: product.label,
      unitKind: product.unitKind,
      quantity: 1,
      active: product.active,
    },
  });
}

function provenance(snapshot: ReturnType<typeof projectProduct>): PricingChangePreviewProvenance {
  const value = snapshot.meta?.pricingPolicy;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new PricingAdminError('unsupported_scenario', 'Fixed-product projection has no policy provenance');
  }
  const record = value as Record<string, unknown>;
  return {
    source: record.source === 'database' ? 'database' : 'versioned',
    matchedBy: record.matchedBy === 'precise' || record.matchedBy === 'engine' ? record.matchedBy : 'global',
    sourceRuleId: typeof record.sourceRuleId === 'string' ? record.sourceRuleId : 'versioned-default',
    compatibilityProfile: 'fixed-product-current',
  };
}

function deltaPercent(current: number, delta: number): number | null {
  return current === 0 ? null : delta / current;
}

async function previewBillingProductChangeWithExecutor(
  proposal: BillingProductChangeProposal,
  dependencies: BillingProductPricingServiceDependencies,
  executor?: QueryExecutor
): Promise<PricingChangePreview> {
  const context = await buildPreviewContext(proposal, dependencies, executor);
  const currentSnapshot = projectProduct(context.current);
  const proposedSnapshot = projectProduct(context.proposed);
  const currentState = productJson(context.current);
  const proposedState = productJson(context.proposed);
  if (JSON.stringify(currentState) === JSON.stringify(proposedState)) {
    throw new PricingAdminError('invalid_payload', 'Billing product proposal does not change any editable value');
  }
  const scenarioId = `billing-product:${context.current.productKey}`;
  const currentProvenance = provenance(currentSnapshot);
  const proposedProvenance = provenance(proposedSnapshot);
  const deltaCents = proposedSnapshot.totalCents - currentSnapshot.totalCents;
  const warnings: string[] = [];
  if (context.current.active !== context.proposed.active) {
    warnings.push(context.proposed.active ? 'This billing product will be activated.' : 'This billing product will be deactivated.');
  }
  if (context.current.label !== context.proposed.label) warnings.push('The customer-facing billing product label will change.');
  if (context.current.currency !== context.proposed.currency) warnings.push('The billing product currency will change.');
  const projectionState: PricingChangeJsonValue = {
    current: {
      currency: currentSnapshot.currency,
      totalCents: currentSnapshot.totalCents,
      pricingPolicy: normalizeJson(currentSnapshot.meta?.pricingPolicy),
    },
    proposed: {
      currency: proposedSnapshot.currency,
      totalCents: proposedSnapshot.totalCents,
      pricingPolicy: normalizeJson(proposedSnapshot.meta?.pricingPolicy),
    },
    ...(context.rollbackEventId ? { rollbackEventId: context.rollbackEventId } : {}),
  };
  const previewFingerprint = buildPricingPreviewFingerprint({
    domain: 'billing_product',
    operation: context.operation,
    targetId: context.current.productKey,
    currentState,
    proposedState,
    versionedPolicyVersion: getVersionedPricingPolicy().version,
    affectedScenarioIds: [scenarioId],
    unsupportedScenarioIds: [],
    projectionState,
  });
  return {
    previewFingerprint,
    domain: 'billing_product',
    operation: context.operation,
    targetId: context.current.productKey,
    currentState,
    proposedState,
    affectedScenarioIds: [scenarioId],
    affectedSurfaces: [context.current.surface],
    rows: [{
      scenarioId,
      engineId: context.current.productKey,
      surface: context.current.surface,
      currentTotalCents: currentSnapshot.totalCents,
      proposedTotalCents: proposedSnapshot.totalCents,
      deltaCents,
      deltaPercent: deltaPercent(currentSnapshot.totalCents, deltaCents),
      currentProvenance,
      proposedProvenance,
      compatibilityProfile: 'fixed-product-current',
    }],
    warnings,
    ...(context.rollbackEventId ? { rollbackEventId: context.rollbackEventId } : {}),
  };
}

export function previewBillingProductChange(
  proposal: BillingProductChangeProposal,
  dependencies: BillingProductPricingServiceDependencies = DEFAULT_DEPENDENCIES
): Promise<PricingChangePreview> {
  return previewBillingProductChangeWithExecutor(proposal, dependencies);
}

function previewSummary(preview: PricingChangePreview): PricingChangeJsonObject {
  return {
    previewFingerprint: preview.previewFingerprint,
    affectedSurfaces: preview.affectedSurfaces,
    rowCount: preview.rows.length,
    ...(preview.rollbackEventId ? { rollbackEventId: preview.rollbackEventId } : {}),
  };
}

function mutationFromState(state: PricingChangeJsonValue | null): BillingProductMutationInput {
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    throw new PricingAdminError('invalid_payload', 'Billing product preview state is invalid');
  }
  const record = state as Record<string, PricingChangeJsonValue>;
  return {
    productKey: requiredText(record.productKey, 'productKey'),
    label: requiredText(record.label, 'label'),
    currency: requiredText(record.currency, 'currency'),
    unitPriceCents: record.unitPriceCents as number,
    active: record.active as boolean,
  };
}

export async function confirmBillingProductChange(
  proposal: BillingProductChangeProposal,
  fingerprint: string,
  actorId: string,
  dependencies: BillingProductPricingServiceDependencies = DEFAULT_DEPENDENCIES
): Promise<BillingProductChangeConfirmation> {
  const serverActorId = requiredText(actorId, 'actorId');
  const preview = await previewBillingProductChange(proposal, dependencies);
  if (!fingerprint || preview.previewFingerprint !== fingerprint) {
    throw new PricingAdminError('preview_stale', 'Billing product preview is stale; review the current impact again');
  }
  let result: { persistedState: PricingChangeJsonValue; event: PricingChangeEvent };
  try {
    result = await dependencies.withTransaction(async (executor) => {
      const transactionPreview = await previewBillingProductChangeWithExecutor(proposal, dependencies, executor);
      if (transactionPreview.previewFingerprint !== fingerprint) {
        throw new PricingAdminError('preview_stale', 'Billing product preview became stale before persistence');
      }
      const persisted = await dependencies.updateProduct(executor, mutationFromState(transactionPreview.proposedState));
      const persistedState = productJson(persisted);
      const event = await dependencies.insertEvent(executor, {
        domain: 'billing_product',
        operation: transactionPreview.operation,
        targetId: transactionPreview.targetId,
        actorId: serverActorId,
        previousState: transactionPreview.currentState,
        nextState: persistedState,
        previewSummary: previewSummary(transactionPreview),
        affectedScenarioIds: transactionPreview.affectedScenarioIds,
      });
      return { persistedState, event };
    });
  } catch (error) {
    if (error instanceof PricingAdminError) throw error;
    throw new PricingAdminError('persistence_failed', 'Failed to persist billing product change');
  }
  const operationalWarnings: BillingProductChangeConfirmation['operationalWarnings'] = [];
  try {
    dependencies.invalidateCache();
  } catch {
    operationalWarnings.push({
      code: 'cache_invalidation_failed',
      message: 'Billing product change committed; in-process cache invalidation failed.',
    });
  }
  try {
    dependencies.revalidate(preview);
  } catch {
    operationalWarnings.push({
      code: 'path_revalidation_failed',
      message: 'Billing product change committed; path revalidation failed.',
    });
  }
  return { committed: true, preview, ...result, operationalWarnings };
}

export async function loadBillingProductInventory(
  dependencies: BillingProductPricingServiceDependencies = DEFAULT_DEPENDENCIES
): Promise<BillingProductInventory> {
  const result = await dependencies.loadProducts();
  if (result.status === 'unavailable') {
    return {
      databaseStatus: 'unavailable',
      products: [],
      historicalProductCount: 0,
      missingReferencedProductKeys: [...listReferencedBillingProductKeys()].sort(),
      warnings: ['Billing product database is unavailable; no product can be edited.'],
    };
  }
  const referencedKeys = listReferencedBillingProductKeys();
  const products = result.products
    .filter((product) => referencedKeys.has(product.productKey))
    .sort((left, right) => left.surface.localeCompare(right.surface) || left.productKey.localeCompare(right.productKey));
  const presentKeys = new Set(result.products.map((product) => product.productKey));
  const missingReferencedProductKeys = [...referencedKeys].filter((key) => !presentKeys.has(key)).sort();
  const warnings = missingReferencedProductKeys.length
    ? [`${missingReferencedProductKeys.length} referenced billing product(s) are missing from persistence.`]
    : [];
  return {
    databaseStatus: 'loaded',
    products,
    historicalProductCount: result.products.length - products.length,
    missingReferencedProductKeys,
    warnings,
  };
}

export function loadBillingProductHistory(
  filter: Omit<ListPricingChangeEventsInput, 'domain'> = {},
  dependencies: BillingProductPricingServiceDependencies = DEFAULT_DEPENDENCIES
): Promise<PricingChangeEvent[]> {
  return dependencies.listEvents({ ...filter, domain: 'billing_product' });
}
