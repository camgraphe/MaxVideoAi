import { createHash } from 'node:crypto';
import { resolveManualTariffCell, type ManualTariffCell, type ManualTariffSelector } from '@maxvideoai/pricing';
import { collectSellableManualTariffCoverage, type ManualTariffCoverageScenario } from '@/lib/pricing-audit/manual-tariff-coverage';
import { isTransactionQueryExecutor, type TransactionQueryExecutor } from '@/lib/db';
import { loadPricingPolicyOverridesWithExecutor, type PricingPolicyOverrideLoadResult } from '@/lib/pricing-rule-store';
import { insertPricingChangeEvent } from '@/server/pricing-admin/event-store';
import { lockPricingCutoverAdministrator } from './customer-tariff-cutover';
import { customerTariffsEnabledByCode, loadEffectiveCustomerTariffState, upsertCustomerTariffCell,
  type EffectiveCustomerTariffState } from './customer-tariff-store';
import { computeCanonicalBillingSnapshot } from './quote-billing';
import { prepareKlingModifyResolutionTariffs } from './kling-modify-resolution-tariffs';
import { MODIFY_TARIFF_POLICY, MODIFY_TARIFF_SCOPE, MODIFY_LUMA_ANCHORS } from './modify-tariff-policy';

export { MODIFY_TARIFF_POLICY, MODIFY_TARIFF_SCOPE } from './modify-tariff-policy';
const stable = (value: unknown): string => JSON.stringify(value, (_key, item) => item && typeof item === 'object'
  && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
const digest = (value: unknown) => createHash('sha256').update(stable(value)).digest('hex');
const ordered = (cells: ManualTariffCell[]) => [...cells].sort((a, b) => stable(a).localeCompare(stable(b)));
const grid = (state: Extract<EffectiveCustomerTariffState, { status: 'loaded' }>) => ({
  databaseCells: ordered(state.databaseCells), versionedCells: ordered(state.versionedCells), active: state.active,
});
function releaseIdentity(actorId: string, candidateCommit: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(actorId)
    || !/^[0-9a-f]{40}$/.test(candidateCommit)) throw new Error('An authorized actor and committed candidate are required.');
}

function releaseScenarios() {
  const scenarios = new Map<string, ManualTariffCoverageScenario>();
  for (const modelId of ['kling-o3-standard', 'luma-ray-3-2']) {
    const coverage = collectSellableManualTariffCoverage({ modelId, mode: 'v2v' });
    if (coverage.gaps.length) throw new Error('Complete Modify catalog coverage is required.');
    for (const scenario of coverage.scenarios) scenarios.set(stable(scenario.selector), scenario);
  }
  return (selector: ManualTariffSelector) => {
    const scenario = scenarios.get(stable(selector));
    if (!scenario) throw new Error('A reviewed Modify selector is absent from canonical catalog coverage.');
    return scenario;
  };
}

/** No writes. Existing anchors and the current canonical policy must agree before extension. */
export async function prepareModifyTariffs(input: {
  state: EffectiveCustomerTariffState; policy: PricingPolicyOverrideLoadResult;
  actorId: string; candidateCommit: string; at?: string;
}) {
  releaseIdentity(input.actorId, input.candidateCommit);
  if (input.state.status !== 'loaded' || !input.state.active || !Number.isSafeInteger(input.state.revision)
    || input.state.revision < 0) throw new Error('Active current customer tariffs are required.');
  if (input.policy.status !== 'loaded') throw new Error('The effective database pricing policy is required.');
  const state = input.state, at = input.at ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(at)) || Date.parse(at) > Date.now()) throw new Error('A current or earlier effective date is required.');
  const scenarioFor = releaseScenarios();
  const pricingPolicy = { loadOverrides: async () => input.policy };
  // Maintenance-only projection through the existing calculator. This cannot serve live quotes.
  const project = (selector: ManualTariffSelector) => computeCanonicalBillingSnapshot(scenarioFor(selector).context, {
    pricingPolicy, loadCustomerTariffState: async () => ({ ...state, active: false }),
  });
  const sourceBindings: ManualTariffCell[] = [];
  for (const resolution of MODIFY_TARIFF_SCOPE.luma.resolutions) for (const [index, durationSec] of [5, 10].entries()) {
    const selector = { engineId: 'luma-ray-3-2', mode: 'v2v', resolution, durationSec: String(durationSec) };
    const source = resolveManualTariffCell({ selector, at, databaseCells: state.databaseCells, versionedCells: state.versionedCells });
    const proposed = await project(selector);
    if (source.currency !== 'USD' || source.price.kind !== 'fixed'
      || source.price.customerCents !== MODIFY_LUMA_ANCHORS[resolution][index]
      || proposed.currency !== source.currency || proposed.totalCents !== source.price.customerCents) {
      throw new Error('The reviewed Luma 5s/10s anchors or their canonical policy changed.');
    }
    sourceBindings.push(source);
  }
  const kling = prepareKlingModifyResolutionTariffs({ state, at });
  const cells = [...kling.cells];
  for (const resolution of MODIFY_TARIFF_SCOPE.luma.resolutions) for (const seconds of MODIFY_TARIFF_SCOPE.luma.durations) {
    const selector = { engineId: 'luma-ray-3-2', mode: 'v2v', resolution, durationSec: String(seconds) };
    const quote = await project(selector);
    if (quote.currency !== 'USD' || !Number.isSafeInteger(quote.totalCents) || quote.totalCents <= 0) {
      throw new Error('A valid canonical Luma commercial proposal is required.');
    }
    cells.push({ id: `luma-modify-source-${digest(selector).slice(0, 32)}`, selector, currency: 'USD',
      price: { kind: 'fixed', customerCents: quote.totalCents }, source: 'database', version: 1, effectiveFrom: at });
  }
  const current = [...state.databaseCells, ...state.versionedCells];
  for (const cell of cells) {
    if (current.some(existing => existing.id === cell.id || stable(existing.selector) === stable(cell.selector))) {
      throw new Error('An existing Modify tariff selector or identity requires explicit admin review.');
    }
    const quote = await computeCanonicalBillingSnapshot(scenarioFor(cell.selector).context, { pricingPolicy,
      loadCustomerTariffState: async () => ({ ...state, databaseCells: [...state.databaseCells, ...cells] }),
    });
    if (cell.price.kind !== 'fixed' || quote.totalCents !== cell.price.customerCents || quote.currency !== cell.currency
      || quote.meta?.customerTariffCellId !== cell.id) throw new Error('Modify canonical quotation changed the proposed tariff.');
  }
  if (cells.length !== MODIFY_TARIFF_SCOPE.expectedCells) throw new Error('Exactly 49 missing Modify tariff cells are required.');
  const basis = { kling: 'copy_exact_current_1080p_customer_cells', luma: 'canonical_existing_commercial_reference_projection',
    lumaAnchors: MODIFY_LUMA_ANCHORS, lumaIntermediateSupplierCost: { status: 'unknown', amountUsd: null },
    existingHdrExrPricesChanged: false } as const;
  const sourceStateHash = digest({ revision: state.revision, grid: grid(state), policy: input.policy });
  const fingerprint = digest({ policy: MODIFY_TARIFF_POLICY, sourceStateHash, actorId: input.actorId,
    candidateCommit: input.candidateCommit, scope: MODIFY_TARIFF_SCOPE, basis,
    cells: cells.map(({ id, selector, currency, price }) => ({ id, selector, currency, price })) });
  return { policy: MODIFY_TARIFF_POLICY, fingerprint, sourceRevision: state.revision, sourceStateHash,
    scope: MODIFY_TARIFF_SCOPE, basis, sourceBindings, cells, existingPricesChanged: false as const };
}

/** Explicit maintenance only. The CLI verifies published Git, target and exact-candidate CI. */
export async function applyModifyTariffs(executor: TransactionQueryExecutor, input: {
  actorId: string; candidateCommit: string; authorizedActorId: string; authorizedCandidateCommit: string;
  policy: typeof MODIFY_TARIFF_POLICY; fingerprint: string; sourceRevision: number;
}) {
  releaseIdentity(input.actorId, input.candidateCommit);
  if (!isTransactionQueryExecutor(executor) || !customerTariffsEnabledByCode()
    || input.actorId !== input.authorizedActorId || input.candidateCommit !== input.authorizedCandidateCommit
    || input.policy !== MODIFY_TARIFF_POLICY || !/^[0-9a-f]{64}$/.test(input.fingerprint)
    || !Number.isSafeInteger(input.sourceRevision) || input.sourceRevision < 0) {
    throw new Error('An explicitly authorized committed Modify tariff release transaction is required.');
  }
  await lockPricingCutoverAdministrator(executor, input.actorId);
  await executor.query('SELECT revision FROM app_customer_tariff_state WHERE singleton = TRUE FOR UPDATE');
  await executor.query('LOCK TABLE app_customer_tariff_cells, app_customer_tariff_cell_versions, app_pricing_rules IN SHARE ROW EXCLUSIVE MODE');
  const state = await loadEffectiveCustomerTariffState(executor);
  if (state.status !== 'loaded' || state.revision !== input.sourceRevision) throw new Error('The reviewed Modify tariff release changed.');
  const policy = await loadPricingPolicyOverridesWithExecutor(executor);
  const prepared = await prepareModifyTariffs({ state, policy, actorId: input.actorId, candidateCommit: input.candidateCommit });
  if (prepared.fingerprint !== input.fingerprint) throw new Error('The reviewed Modify tariff release changed.');
  const persisted: ManualTariffCell[] = [];
  for (const cell of prepared.cells) persisted.push(await upsertCustomerTariffCell(executor, cell, input.actorId));
  const after = await loadEffectiveCustomerTariffState(executor);
  const ids = new Set(persisted.map(cell => cell.id));
  if (after.status !== 'loaded' || after.revision !== state.revision + 49
    || digest(grid({ ...after, databaseCells: after.databaseCells.filter(cell => !ids.has(cell.id)) })) !== digest(grid(state))) {
    throw new Error('Modify initialization changed an existing tariff.');
  }
  const scenarioFor = releaseScenarios();
  for (const cell of persisted) {
    const quote = await computeCanonicalBillingSnapshot(scenarioFor(cell.selector).context, {
      pricingPolicy: { loadOverrides: async () => policy }, customerTariffExecutor: executor,
    });
    if (cell.price.kind !== 'fixed' || quote.totalCents !== cell.price.customerCents || quote.currency !== cell.currency
      || quote.meta?.customerTariffCellId !== cell.id || quote.meta?.customerTariffRevision !== after.revision) {
      throw new Error('The persisted Modify tariff failed canonical quotation.');
    }
  }
  const event = await insertPricingChangeEvent(executor, { domain: 'customer_tariff', operation: 'create',
    targetId: 'modify:bounded-source-class-initialization', actorId: input.actorId, previousState: null,
    nextState: JSON.parse(JSON.stringify(persisted)), previewSummary: { fingerprint: prepared.fingerprint,
      sourceRevision: state.revision, targetRevision: after.revision, sourceStateHash: prepared.sourceStateHash,
      candidateCommit: input.candidateCommit, policy: prepared.policy, insertedCells: persisted.length,
      existingPricesChanged: false, basis: JSON.parse(JSON.stringify(prepared.basis)), scope: JSON.parse(JSON.stringify(prepared.scope)) },
    affectedScenarioIds: persisted.map(cell => stable(cell.selector)) });
  return { insertedCells: persisted.length, revision: after.revision, fingerprint: prepared.fingerprint, eventId: event.id };
}
