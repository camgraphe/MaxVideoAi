import { createHash } from 'node:crypto';
import { isValidManualTariffPrice, type ManualTariffCell, type ManualTariffPrice } from '@maxvideoai/pricing';
import { collectSellableManualTariffCoverage } from '@/lib/pricing-audit/manual-tariff-coverage';
import { continuousInputTariffSelector } from '@/lib/pricing-manual-scenario';
import { GOOGLE_OMNI_1_1_OUTPUT_USD_PER_MILLION_TOKENS } from '@/lib/google-omni-pricing';
import { isTransactionQueryExecutor, type TransactionQueryExecutor } from '@/lib/db';
import { insertPricingChangeEvent } from '@/server/pricing-admin/event-store';
import { GOOGLE_VERTEX_OMNI_MODEL_ID } from '@/server/video-providers/google-vertex-omni/model-map';
import { computeCanonicalBillingSnapshot } from './quote-billing';
import { validateOmniContinuousTariffDomain } from './omni-continuous-tariff';
import { customerTariffsEnabledByCode, loadEffectiveCustomerTariffState, upsertCustomerTariffCell,
  validateCustomerTariffCell, type EffectiveCustomerTariffState } from './customer-tariff-store';
import { OMNI_12_TARIFF_POLICY, OMNI_12_TARIFF_SCOPE, OMNI_12_TARIFF_EVENT } from './omni-12-tariff-policy';

export { OMNI_12_TARIFF_POLICY, OMNI_12_TARIFF_SCOPE, OMNI_12_TARIFF_EVENT } from './omni-12-tariff-policy';
const key = (selector: object) => JSON.stringify(Object.entries(selector).sort(([a], [b]) => a.localeCompare(b)));
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function assertIdentity(actorId: string, candidateCommit: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(actorId)
    || !/^[0-9a-f]{40}$/.test(candidateCommit)) throw new Error('A release administrator and exact committed candidate are required.');
}
function increasedCents(cents: number) {
  if (!Number.isSafeInteger(cents) || cents < 0 || cents > Math.floor(Number.MAX_SAFE_INTEGER / 3)) {
    throw new Error('Customer amount exceeds the safe release range.');
  }
  return Math.ceil(cents * 3 / 2);
}

/** Scale the final saved cents, not supplier rates or component coefficients. Never mutates the original. */
export function scaleOmni11CustomerPrice(price: ManualTariffPrice): ManualTariffPrice {
  if (!isValidManualTariffPrice(price)) throw new Error('Invalid saved Omni customer price.');
  if (price.kind === 'fixed') return { kind: 'fixed', customerCents: increasedCents(price.customerCents) };
  if (price.kind !== 'unit_bands') throw new Error('Unsupported Omni price form; a separate release review is required.');
  return { ...price, terms: price.terms.map(term => ({ ...term })),
    bands: price.bands.map(band => ({ ...band, customerCents: increasedCents(band.customerCents) })) };
}

/** Read-only authoring. All 456 classes must match the current seven-mode product domain. */
export async function prepareOmni12TariffRelease(input: {
  state: EffectiveCustomerTariffState; actorId: string; candidateCommit: string; at?: string;
}) {
  assertIdentity(input.actorId, input.candidateCommit);
  if (GOOGLE_VERTEX_OMNI_MODEL_ID !== OMNI_12_TARIFF_SCOPE.providerModel) throw new Error('Review the changed Omni provider model before a tariff release.');
  if (input.state.status !== 'loaded' || !input.state.active || !Number.isSafeInteger(input.state.revision)
    || input.state.revision < 0) throw new Error('An active current customer tariff grid is required.');
  const state = input.state, at = input.at ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(at)) || Date.parse(at) > Date.now()) throw new Error('A current or earlier release time is required.');
  const modelId = OMNI_12_TARIFF_SCOPE.modelId;
  if (state.versionedCells.some(cell => cell.selector.engineId === modelId)) throw new Error('Review versioned Omni exceptions before releasing prices.');
  const history = state.databaseCells.filter(cell => cell.selector.engineId === modelId && cell.effectiveUntil);
  if (history.some(cell => Date.parse(cell.effectiveUntil!) > Date.parse(at))) throw new Error('Current scheduled Omni intervals need separate review.');
  const source = state.databaseCells.filter(cell => cell.selector.engineId === modelId && !cell.effectiveUntil);
  const previousByKey = new Map<string, ManualTariffCell>();
  for (const cell of source) {
    validateCustomerTariffCell(cell);
    if (cell.currency !== 'USD') throw new Error('Only the reviewed USD grid can be released.');
    if (Date.parse(cell.effectiveFrom) > Date.parse(at)) throw new Error('A future Omni cell is not a current price.');
    if (previousByKey.has(key(cell.selector))) throw new Error('Duplicate or ambiguous Omni price coverage.');
    previousByKey.set(key(cell.selector), cell);
  }
  if (source.length !== OMNI_12_TARIFF_SCOPE.expectedCells) throw new Error('The complete 456-class Omni price grid is required.');
  const coverage = collectSellableManualTariffCoverage({ modelId });
  const expectedGaps = ['v2v', 'extend', 'retake'].map(mode => `${mode}: open input video duration needs a continuous unit tariff`);
  if (coverage.gaps.length !== expectedGaps.length || coverage.gaps.some(gap => gap.modelId !== modelId || !expectedGaps.includes(gap.reason))) {
    throw new Error('Changed Omni capability coverage needs a fresh release review.');
  }
  const proposedByKey = new Map<string, ManualTariffCell>();
  for (const scenario of coverage.scenarios) {
    const continuous = continuousInputTariffSelector(scenario.selector), selector = continuous ?? scenario.selector;
    const selectorKey = key(selector), previous = previousByKey.get(selectorKey);
    if (!previous) throw new Error('A current Omni price class is missing.');
    if (proposedByKey.has(selectorKey)) continue;
    if (continuous ? previous.price.kind !== 'unit_bands' : previous.price.kind !== 'fixed') {
      throw new Error('Unsupported saved Omni price form; review its exact customer rounding first.');
    }
    if (previous.price.kind === 'unit_bands'
      && previous.price.terms[0]?.centsPerUnit !== GOOGLE_OMNI_1_1_OUTPUT_USD_PER_MILLION_TOKENS) {
      throw new Error('The saved token bands are not the reviewed Omni 1.1 price basis.');
    }
    const price = scaleOmni11CustomerPrice(previous.price);
    if (continuous) validateOmniContinuousTariffDomain({ context: scenario.context, price });
    proposedByKey.set(selectorKey, { ...previous, selector: { ...previous.selector }, price });
  }
  const cells = [...proposedByKey.values()].sort((a, b) => a.id.localeCompare(b.id));
  if (cells.length !== source.length || cells.filter(c => c.price.kind === 'fixed').length !== OMNI_12_TARIFF_SCOPE.fixedCells
    || cells.filter(c => c.price.kind === 'unit_bands').length !== OMNI_12_TARIFF_SCOPE.bandCells) {
    throw new Error('Changed Omni selector coverage requires a new review.');
  }
  const policy = { loadOverrides: async () => ({ status: 'loaded' as const, rules: [], routingRules: [] }) };
  const nextState = { ...state, databaseCells: [...state.databaseCells.filter(cell => cell.selector.engineId !== modelId), ...history, ...cells] };
  const rows: { selector: typeof cells[number]['selector']; previousCustomerCents: number; proposedCustomerCents: number }[] = [];
  for (const scenario of coverage.scenarios) {
    const previous = await computeCanonicalBillingSnapshot(scenario.context, { pricingPolicy: policy, loadCustomerTariffState: async () => state });
    const proposed = await computeCanonicalBillingSnapshot(scenario.context, { pricingPolicy: policy, loadCustomerTariffState: async () => nextState });
    if (proposed.totalCents !== increasedCents(previous.totalCents) || proposed.currency !== 'USD'
      || proposed.meta?.customerTariffCellId !== previous.meta?.customerTariffCellId) {
      throw new Error('The 150% saved customer amount did not survive canonical quotation.');
    }
    rows.push({ selector: scenario.selector, previousCustomerCents: previous.totalCents, proposedCustomerCents: proposed.totalCents });
  }
  const sourceRevision = state.revision;
  const fingerprint = digest({ policy: OMNI_12_TARIFF_POLICY, scope: OMNI_12_TARIFF_SCOPE, sourceRevision,
    actorId: input.actorId, candidateCommit: input.candidateCommit,
    source: [...source, ...history].sort((a, b) => a.id.localeCompare(b.id) || a.version - b.version),
    proposed: cells.map(({ id, selector, price }) => ({ id, selector, price })) });
  return { policy: OMNI_12_TARIFF_POLICY, scope: OMNI_12_TARIFF_SCOPE, fingerprint, sourceRevision, cells, rows };
}

/** Explicit maintenance only; caller owns target/admin/Git/CI guards and the enclosing transaction. */
export async function applyOmni12TariffRelease(executor: TransactionQueryExecutor, input: {
  actorId: string; candidateCommit: string; authorizedActorId: string; authorizedCandidateCommit: string;
  policy: typeof OMNI_12_TARIFF_POLICY; sourceRevision: number; fingerprint: string;
}) {
  assertIdentity(input.actorId, input.candidateCommit);
  if (!isTransactionQueryExecutor(executor) || !customerTariffsEnabledByCode()
    || input.actorId !== input.authorizedActorId || input.candidateCommit !== input.authorizedCandidateCommit
    || input.policy !== OMNI_12_TARIFF_POLICY || !/^[0-9a-f]{64}$/.test(input.fingerprint)
    || !Number.isSafeInteger(input.sourceRevision) || input.sourceRevision < 0) {
    throw new Error('An explicitly authorized Omni release transaction is required.');
  }
  await executor.query('SELECT revision FROM app_customer_tariff_state WHERE singleton=TRUE FOR UPDATE');
  await executor.query('LOCK TABLE app_customer_tariff_cells, app_customer_tariff_cell_versions IN SHARE ROW EXCLUSIVE MODE');
  const events = await executor.query('SELECT id FROM app_pricing_change_events WHERE domain=$1 AND target_id=$2 LIMIT 1', ['customer_tariff', OMNI_12_TARIFF_EVENT]);
  if (events.length) throw new Error('This one-time Omni 1.2 release was already applied; never multiply prices twice.');
  const state = await loadEffectiveCustomerTariffState(executor);
  if (state.status !== 'loaded' || state.revision !== input.sourceRevision) throw new Error('The reviewed Omni source revision changed.');
  const prepared = await prepareOmni12TariffRelease({ state, actorId: input.actorId, candidateCommit: input.candidateCommit });
  if (prepared.fingerprint !== input.fingerprint) throw new Error('The reviewed Omni source prices changed.');
  const persisted: ManualTariffCell[] = [];
  for (const cell of prepared.cells) persisted.push(await upsertCustomerTariffCell(executor, cell, input.actorId));
  const event = await insertPricingChangeEvent(executor, { domain: 'customer_tariff', operation: 'update', targetId: OMNI_12_TARIFF_EVENT,
    actorId: input.actorId,
    previousState: JSON.parse(JSON.stringify(state.databaseCells.filter(cell => cell.selector.engineId === OMNI_12_TARIFF_SCOPE.modelId && !cell.effectiveUntil))),
    nextState: JSON.parse(JSON.stringify(persisted)),
    previewSummary: { policy: prepared.policy, scope: JSON.parse(JSON.stringify(prepared.scope)), fingerprint: prepared.fingerprint,
      sourceRevision: prepared.sourceRevision, candidateCommit: input.candidateCommit, updatedCells: persisted.length,
      providerActivated: false, historicalChargesChanged: false },
    affectedScenarioIds: persisted.map(cell => key(cell.selector)),
  });
  return { updatedCells: persisted.length, revision: persisted.at(-1)!.version, fingerprint: prepared.fingerprint, eventId: event.id };
}
