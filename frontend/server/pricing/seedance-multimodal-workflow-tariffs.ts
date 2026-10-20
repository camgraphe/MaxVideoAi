import { createHash } from 'node:crypto';
import { ManualTariffError, resolveManualTariffCell, type ManualTariffCell, type ManualTariffSelector } from '@maxvideoai/pricing';
import { collectSellableManualTariffCoverage, type ManualTariffCoverageScenario } from '@/lib/pricing-audit/manual-tariff-coverage';
import { continuousInputTariffSelector } from '@/lib/pricing-manual-scenario';
import { buildBillingPricingFacts } from '@/lib/pricing-billing-facts';
import { isTransactionQueryExecutor, type TransactionQueryExecutor } from '@/lib/db';
import { normalBytePlusSupplierCost, bytePlusNormalListCost } from '@/server/byteplus-normal-cost';
import { estimateBytePlusBillableTokens } from '@/server/byteplus-accounting';
import { insertPricingChangeEvent } from '@/server/pricing-admin/event-store';
import { customerTariffsEnabledByCode, loadEffectiveCustomerTariffState, upsertCustomerTariffCell,
  type EffectiveCustomerTariffState } from './customer-tariff-store';
import { computeCanonicalBillingSnapshot } from './quote-billing';
import { validateMonotoneContinuousTariffDomain } from './continuous-tariff-domain';

export const SEEDANCE_MULTIMODAL_WORKFLOW_POLICY = 'clone_current_normal_multimodal_prices_v1';
const modes = ['i2v', 'ref2v', 'v2v', 'extend'];
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const key = (selector: object) => JSON.stringify(Object.entries(selector).sort(([a], [b]) => a.localeCompare(b)));
const classKey = (selector: ManualTariffSelector) => key({ ...selector, inputVideoDurationSec: undefined, workflowStep: undefined });
function releaseIdentity(actorId: string, candidateCommit: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(actorId)
    || !/^[0-9a-f]{40}$/.test(candidateCommit)) throw new Error('An authorized actor and committed candidate are required.');
}

/** Read-only initialization of new variants. Existing stage and normal prices remain independent. */
export async function prepareSeedanceMultimodalWorkflowTariffs(input: {
  state: EffectiveCustomerTariffState; actorId: string; candidateCommit: string; at?: string;
  normalScenarios?: readonly ManualTariffCoverageScenario[];
}) {
  releaseIdentity(input.actorId, input.candidateCommit);
  if (input.state.status !== 'loaded' || !input.state.active) throw new Error('Active current customer tariffs are required.');
  const state = input.state;
  const at = input.at ?? new Date().toISOString();
  const scenarios = (input.normalScenarios ?? collectSellableManualTariffCoverage({ modelId: 'seedance-2-5', bytePlusTransport: 'modelark' }).scenarios)
    .filter(s => s.modelId === 'seedance-2-5' && !s.context.workflowStep && modes.includes(s.context.mode ?? '')
      && ['480p', '1080p'].includes(s.context.resolution));
  if (!scenarios.length) throw new Error('Supported multimodal normal tariff scenarios are required.');
  const classes = new Map(scenarios.map(s => [classKey(s.selector), s]));
  const resolve = (selector: ManualTariffSelector) => resolveManualTariffCell({ selector, at,
    databaseCells: state.databaseCells, versionedCells: state.versionedCells });
  const sourceCells = new Map<string, { cell: ManualTariffCell; scenario: ManualTariffCoverageScenario }>();
  for (const scenario of classes.values()) {
    const selector = continuousInputTariffSelector(scenario.selector) ?? scenario.selector;
    sourceCells.set(key(selector), { cell: resolve(selector), scenario });
  }
  // Exact source-duration exceptions retain their own independently frozen stage point.
  for (const candidate of [...state.versionedCells, ...state.databaseCells]) {
    const scenario = classes.get(classKey(candidate.selector));
    if (!scenario || candidate.selector.workflowStep || candidate.selector.inputVideoDurationSec === undefined
      || candidate.selector.inputVideoDurationSec === 'continuous') continue;
    const seconds = Number(candidate.selector.inputVideoDurationSec);
    if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 30) continue;
    let current;
    try { current = resolve(candidate.selector); } catch (error) {
      if (error instanceof ManualTariffError && error.code === 'missing_cell') continue;
      throw error;
    }
    sourceCells.set(key(candidate.selector), { cell: current, scenario: { ...scenario, context: { ...scenario.context, inputVideoDurationSec: seconds } } });
  }
  const cells: ManualTariffCell[] = [];
  const sourceBindings: object[] = [];
  const verifiedDomains = new Set<string>();
  let preservedStageCells = 0;
  for (const { cell: source, scenario } of [...sourceCells.values()].sort((a, b) => key(a.cell.selector).localeCompare(key(b.cell.selector)))) {
    const workflowStep = scenario.context.resolution === '480p' ? 'draft' : 'final';
    const selector: ManualTariffSelector = { ...source.selector, workflowStep };
    const context = { ...scenario.context, workflowStep } as const;
    sourceBindings.push({ id: source.id, version: source.version, source: source.source, selector: source.selector,
      currency: source.currency, effectiveFrom: source.effectiveFrom, effectiveUntil: source.effectiveUntil, price: source.price });
    try { resolve(selector); preservedStageCells++; continue; } catch (error) {
      if (!(error instanceof ManualTariffError) || error.code !== 'missing_cell') throw error;
    }
    if ([...state.databaseCells, ...state.versionedCells].some(existing => key(existing.selector) === key(selector))) {
      throw new Error('An existing inactive workflow tariff requires explicit admin review.');
    }
    if (source.currency !== 'USD') throw new Error('Multimodal workflow tariffs require reviewed USD source prices.');
    const cell: ManualTariffCell = { id: `seedance-workflow-mm-${digest(selector).slice(0, 32)}`, selector, currency: source.currency,
      price: structuredClone(source.price), source: 'database', version: 1, effectiveFrom: at };
    const quoteState = { ...state, databaseCells: [cell], versionedCells: [] };
    await computeCanonicalBillingSnapshot(context, { loadCustomerTariffState: async () => quoteState,
      pricingPolicy: { loadOverrides: async () => ({ status: 'loaded', rules: [] }) } });
    if (selector.inputVideoDurationSec === 'continuous') {
      const minimumContext = { ...context, inputVideoDurationSec: Number.MIN_VALUE };
      const supplier = normalBytePlusSupplierCost(minimumContext, at);
      if (!supplier) throw new Error('Verified workflow supplier budget is required.');
      const domainIdentity = digest({ price: cell.price, currency: cell.currency, usage: supplier.usage,
        amountUsd: supplier.listAmountUsd, outputSeconds: context.durationSec, quantity: 'input_video_seconds' });
      // Different modes can share the exact same literal curve and ModelArk usage function.
      // The selector's mode is not a quantity or supplier rate; certify that function once.
      if (verifiedDomains.has(domainIdentity)) { cells.push(cell); continue; }
      const facts = buildBillingPricingFacts(minimumContext, context.engine.pricingDetails, 'USD').facts;
      validateMonotoneContinuousTariffDomain({ price: cell.price, selector, unit: 'input_video_seconds', minimum: Number.MIN_VALUE, maximum: 30,
        factsAt: seconds => {
          const tokens = estimateBytePlusBillableTokens({ engineId: context.engine.id, durationSec: context.durationSec,
            resolution: context.resolution, aspectRatio: context.aspectRatio, billingInputType: 'video_input', inputVideoDurationSec: seconds });
          const list = bytePlusNormalListCost({ ...supplier.usage, videoTokens: tokens?.tokenCount });
          if (!list) throw new Error('Verified workflow supplier budget is required.');
          return { ...facts, vendorSubtotalExactCents: Number((list.amountUsd * 100).toFixed(6)) };
        } });
      verifiedDomains.add(domainIdentity);
    }
    cells.push(cell);
  }
  const sourceRevision = state.revision;
  const fingerprint = digest({ policy: SEEDANCE_MULTIMODAL_WORKFLOW_POLICY, sourceRevision,
    actorId: input.actorId, candidateCommit: input.candidateCommit, sourceBindings,
    cells: cells.map(({ id, selector, currency, price }) => ({ id, selector, currency, price })), preservedStageCells });
  return { fingerprint, sourceRevision, policy: SEEDANCE_MULTIMODAL_WORKFLOW_POLICY, cells, sourceBindings, preservedStageCells,
    scope: { modelId: 'seedance-2-5', modes, resolutions: ['480p', '1080p'], workflowSteps: ['draft', 'final'] } };
}

/** Private operational release only; callers must verify clean Git provenance before this transaction. */
export async function applySeedanceMultimodalWorkflowTariffs(executor: TransactionQueryExecutor, input: {
  actorId: string; candidateCommit: string; authorizedActorId: string; authorizedCandidateCommit: string;
  policy: typeof SEEDANCE_MULTIMODAL_WORKFLOW_POLICY; fingerprint: string; sourceRevision: number;
}) {
  releaseIdentity(input.actorId, input.candidateCommit);
  if (!isTransactionQueryExecutor(executor) || !customerTariffsEnabledByCode()
    || input.actorId !== input.authorizedActorId || input.candidateCommit !== input.authorizedCandidateCommit
    || input.policy !== SEEDANCE_MULTIMODAL_WORKFLOW_POLICY || !input.fingerprint) {
    throw new Error('An explicitly authorized committed workflow tariff release transaction is required.');
  }
  await executor.query('SELECT revision FROM app_customer_tariff_state WHERE singleton = TRUE FOR UPDATE');
  await executor.query('LOCK TABLE app_customer_tariff_cells, app_customer_tariff_cell_versions, app_pricing_rules IN SHARE ROW EXCLUSIVE MODE');
  const state = await loadEffectiveCustomerTariffState(executor);
  if (state.status !== 'loaded' || state.revision !== input.sourceRevision) {
    throw new Error('The reviewed multimodal workflow tariff release changed.');
  }
  const prepared = await prepareSeedanceMultimodalWorkflowTariffs({ state, actorId: input.actorId, candidateCommit: input.candidateCommit });
  if (prepared.sourceRevision !== input.sourceRevision || prepared.fingerprint !== input.fingerprint || !prepared.cells.length) {
    throw new Error('The reviewed multimodal workflow tariff release changed.');
  }
  const persisted: ManualTariffCell[] = [];
  for (const cell of prepared.cells) persisted.push(await upsertCustomerTariffCell(executor, cell, input.actorId));
  const [current] = await executor.query<{ revision: number | string }>('SELECT revision FROM app_customer_tariff_state WHERE singleton = TRUE');
  await insertPricingChangeEvent(executor, { domain: 'customer_tariff', operation: 'create', targetId: 'seedance-2-5:multimodal-workflow-initialization',
    actorId: input.actorId, previousState: null, nextState: JSON.parse(JSON.stringify(persisted)),
    previewSummary: { fingerprint: prepared.fingerprint, sourceRevision: prepared.sourceRevision,
      candidateCommit: input.candidateCommit, policy: prepared.policy, insertedCells: persisted.length,
      existingPricesChanged: false, sourceBindings: JSON.parse(JSON.stringify(prepared.sourceBindings)) },
    affectedScenarioIds: persisted.map(cell => key(cell.selector)) });
  return { insertedCells: persisted.length, revision: Number(current.revision), fingerprint: prepared.fingerprint };
}
