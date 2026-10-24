import { resolveManualTariffCell, type ManualTariffCell } from '@maxvideoai/pricing';
import { evaluateManualTariffPrice } from '@maxvideoai/pricing/src/manual-tariff-price';
import { buildManualTariffCoverageScenario, collectSellableManualTariffCoverage } from '@/lib/pricing-audit/manual-tariff-coverage';
import { videoOperationTariffContexts, newVideoTariffFamily } from '@/lib/pricing-audit/video-operation-tariff-inventory';
import { continuousInputTariffSelector } from '@/lib/pricing-manual-scenario';
import { isTransactionQueryExecutor, type TransactionQueryExecutor } from '@/lib/db';
import { loadPricingPolicyOverridesWithExecutor, type PricingPolicyOverrideLoadResult } from '@/lib/pricing-rule-store';
import { insertPricingChangeEvent } from '@/server/pricing-admin/event-store';
import { lockPricingCutoverAdministrator } from './customer-tariff-cutover';
import { cutoverDigest } from './customer-tariff-cutover-evidence';
import { customerTariffsEnabledByCode, loadEffectiveCustomerTariffState, upsertCustomerTariffCell,
  type EffectiveCustomerTariffState } from './customer-tariff-store';
import { computeCanonicalBillingSnapshot } from './quote-billing';
import { computeCustomerTariffInitializationBaseline } from './customer-tariff-initialization-baseline';
import { compileCurrentContinuousTariffPrice } from './compile-current-continuous-tariff';
import { resolveServerBillingPolicy } from './resolve-pricing-policy';

import { VIDEO_OPERATION_TARIFF_POLICY, VIDEO_OPERATION_TARIFF_SCOPE, VIDEO_OPERATION_TARIFF_EVENT } from './video-operation-tariff-policy';
export { VIDEO_OPERATION_TARIFF_POLICY, VIDEO_OPERATION_TARIFF_SCOPE, VIDEO_OPERATION_TARIFF_EVENT } from './video-operation-tariff-policy';
const ordered = (cells: ManualTariffCell[]) => [...cells].sort((a,b) => a.id.localeCompare(b.id));
const grid = (state: Extract<EffectiveCustomerTariffState, { status: 'loaded' }>) => ({ active: state.active,
  databaseCells: ordered(state.databaseCells), versionedCells: ordered(state.versionedCells) });
type VideoOperationReleaseIdentity = { actorId: string; candidateCommit: string; databaseIdentity: string; releaseBranch: string };
function releaseIdentity({ actorId: actor, candidateCommit: candidate, databaseIdentity, releaseBranch }: VideoOperationReleaseIdentity) {
  const validBranch = typeof releaseBranch === 'string' && /^codex\/[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(releaseBranch)
    && !releaseBranch.includes('..') && releaseBranch.split('/').every(part => part && !part.startsWith('.')
      && !part.endsWith('.') && !part.endsWith('.lock'));
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(actor)
    || !/^[0-9a-f]{40}$/.test(candidate) || !/^[0-9a-f]{64}$/.test(databaseIdentity) || !validBranch) {
    throw new Error('A validated release identity requires an authorized actor, committed candidate, target hash and codex branch.');
  }
}
export function videoOperationInitializationScenarios() {
  return [...videoOperationTariffContexts().map(context => buildManualTariffCoverageScenario(context, 'operation-initialization')),
    ...collectSellableManualTariffCoverage({ modelId: 'veo-3-1', mode: 'i2v' }).scenarios.filter(s => newVideoTariffFamily(s.context))];
}

/** Bounded, missing-only maintenance. No route/build invokes this writer. All
 * before-prices are absent; the six existing Veo8s anchors remain exact. */
export async function prepareVideoOperationTariffs(input: VideoOperationReleaseIdentity & {
  state: EffectiveCustomerTariffState; policy: PricingPolicyOverrideLoadResult; at?: string;
}) {
  releaseIdentity(input);
  if (input.state.status !== 'loaded' || !input.state.active || !Number.isSafeInteger(input.state.revision) || input.state.revision < 0) throw new Error('Active current tariffs are required.');
  if (input.policy.status !== 'loaded') throw new Error('Current effective policy is required.');
  const state = input.state, at = input.at ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(at)) || Date.parse(at) > Date.now()) throw new Error('A current effective date is required.');
  const current = [...state.databaseCells, ...state.versionedCells], sourceBindings: ManualTariffCell[] = [];
  for (const resolution of ['720p','1080p','4k']) for (const audio of ['false','true']) {
    const cell = resolveManualTariffCell({ selector: { engineId: 'veo-3-1', mode: 'i2v', durationSec: '8', resolution, audio }, at,
      databaseCells: state.databaseCells, versionedCells: state.versionedCells });
    const cents = resolution === '4k' ? audio === 'true' ? 624 : 416 : audio === 'true' ? 416 : 208;
    if (cell.currency !== 'USD' || cell.price.kind !== 'fixed' || cell.price.customerCents !== cents) throw new Error('Existing Veo 8s anchor changed; review current state.');
    sourceBindings.push(cell);
  }
  const scenarios = videoOperationInitializationScenarios(), cells: ManualTariffCell[] = [], families: Record<string,number> = {};
  for (const scenario of scenarios) {
    const family = newVideoTariffFamily(scenario.context)!;
    families[family] = (families[family] ?? 0) + 1;
    const { policy } = await resolveServerBillingPolicy({ engineId: scenario.modelId, mode: scenario.context.mode,
      resolution: scenario.context.resolution }, undefined, { loadOverrides: async () => input.policy });
    if (policy.rule.marginPercent !== .3 || policy.rule.marginFlatCents !== 0 || policy.rule.surchargeAudioPercent !== 0
      || policy.rule.surchargeUpscalePercent !== 0 || policy.rule.currency !== 'USD'
      || (policy.rule.compatibilityProfile && policy.rule.compatibilityProfile !== 'standard')) throw new Error('The reviewed current standard 30% policy changed.');
    const continuous = continuousInputTariffSelector(scenario.selector), selector = continuous ?? scenario.selector;
    const id = `video-operation-${cutoverDigest(selector).slice(0,32)}`;
    if (current.some(cell => cell.id === id || cutoverDigest(cell.selector) === cutoverDigest(selector))) throw new Error('An existing operation selector or identity requires explicit maintenance review.');
    const price = continuous ? await compileCurrentContinuousTariffPrice(scenario, input.policy)
      : { kind: 'fixed' as const, customerCents: (await computeCustomerTariffInitializationBaseline(scenario.context, input.policy)).totalCents };
    cells.push({ id, selector, price, source: 'database', version: 1, currency: 'USD', effectiveFrom: at });
  }
  if (cutoverDigest(families) !== cutoverDigest(VIDEO_OPERATION_TARIFF_SCOPE.families) || cells.length !== 89
    || cells.filter(cell => cell.price.kind === 'unit_bands').length !== 13) throw new Error('Complete reviewed operation inventory changed.');
  for (const [index,scenario] of scenarios.entries()) {
    const cell = cells[index], quote = await computeCanonicalBillingSnapshot(scenario.context, {
      pricingPolicy: { loadOverrides: async () => input.policy }, loadCustomerTariffState: async () => ({ ...state, databaseCells: [cell] }) });
    if (quote.totalCents !== evaluateManualTariffPrice(cell.price, scenario.quantities).customerTotalCents
      || quote.meta?.customerTariffCellId !== cell.id) throw new Error('New operation failed canonical quotation.');
  }
  const sourceStateHash = cutoverDigest({ revision: state.revision, grid: grid(state), policy: input.policy });
  const basis = { customerPolicy: 'current_standard_30_percent', providerEvidenceDate: '2026-10-24',
    supplierInvoiceVerified: false, supplierCostKind: 'published_reference_estimate', beforeCents: null,
    enhanceQuantity: 'exact_measured_owned_native_draft_up_to_21s_v1', draftExtendCacheQualified: false } as const;
  const fingerprint = cutoverDigest({ policy: VIDEO_OPERATION_TARIFF_POLICY, sourceStateHash, actorId: input.actorId,
    candidateCommit: input.candidateCommit, databaseIdentity: input.databaseIdentity, releaseBranch: input.releaseBranch,
    scope: VIDEO_OPERATION_TARIFF_SCOPE, basis,
    cells: cells.map(({ id,selector,currency,price }) => ({ id,selector,currency,price })) });
  return { policy: VIDEO_OPERATION_TARIFF_POLICY, fingerprint, databaseIdentity: input.databaseIdentity, releaseBranch: input.releaseBranch,
    sourceRevision: state.revision, sourceStateHash, cells,
    sourceBindings, basis, scope: VIDEO_OPERATION_TARIFF_SCOPE, existingPricesChanged: false as const, activationReady: false as const };
}

/** Caller owns exact Git/target/CI fences; all writes/history/verification share
 * this transaction. A retry after commit fails its revision fence without writes. */
export async function applyVideoOperationTariffs(executor: TransactionQueryExecutor, input: VideoOperationReleaseIdentity & {
  authorizedActorId: string; authorizedCandidateCommit: string;
  policy: typeof VIDEO_OPERATION_TARIFF_POLICY; fingerprint: string; sourceRevision: number;
}) {
  releaseIdentity(input);
  if (!isTransactionQueryExecutor(executor) || !customerTariffsEnabledByCode() || input.actorId !== input.authorizedActorId
    || input.candidateCommit !== input.authorizedCandidateCommit || input.policy !== VIDEO_OPERATION_TARIFF_POLICY
    || !/^[0-9a-f]{64}$/.test(input.fingerprint) || !Number.isSafeInteger(input.sourceRevision) || input.sourceRevision < 0) {
    throw new Error('An explicitly authorized operation tariff transaction is required.');
  }
  await lockPricingCutoverAdministrator(executor,input.actorId);
  await executor.query('SELECT revision FROM app_customer_tariff_state WHERE singleton = TRUE FOR UPDATE');
  await executor.query('LOCK TABLE app_customer_tariff_cells, app_customer_tariff_cell_versions, app_pricing_rules IN SHARE ROW EXCLUSIVE MODE');
  const state = await loadEffectiveCustomerTariffState(executor);
  if (state.status !== 'loaded' || state.revision !== input.sourceRevision) throw new Error('Reviewed operation tariff revision changed.');
  if ((await executor.query('SELECT id FROM app_pricing_change_events WHERE target_id=$1', [VIDEO_OPERATION_TARIFF_EVENT])).length) throw new Error('Operation initialization already recorded; inspect its immutable event.');
  const policy = await loadPricingPolicyOverridesWithExecutor(executor);
  const prepared = await prepareVideoOperationTariffs({ ...input, state, policy });
  if (prepared.fingerprint !== input.fingerprint) throw new Error('Reviewed operation tariff fingerprint changed.');
  const persisted: ManualTariffCell[] = [];
  for (const cell of prepared.cells) persisted.push(await upsertCustomerTariffCell(executor,cell,input.actorId));
  const after = await loadEffectiveCustomerTariffState(executor), ids = new Set(persisted.map(cell => cell.id));
  if (after.status !== 'loaded' || after.revision !== state.revision + 89
    || cutoverDigest(grid({ ...after, databaseCells: after.databaseCells.filter(cell => !ids.has(cell.id)) })) !== cutoverDigest(grid(state))) {
    throw new Error('Operation initialization changed an existing tariff.');
  }
  for (const [index,scenario] of videoOperationInitializationScenarios().entries()) {
    const cell = persisted[index], quote = await computeCanonicalBillingSnapshot(scenario.context, {
      pricingPolicy: { loadOverrides: async () => policy }, customerTariffExecutor: executor });
    if (quote.totalCents !== evaluateManualTariffPrice(cell.price, scenario.quantities).customerTotalCents
      || quote.meta?.customerTariffCellId !== cell.id || quote.meta?.customerTariffRevision !== after.revision) throw new Error('Persisted operation quote changed.');
  }
  const event = await insertPricingChangeEvent(executor, { domain: 'customer_tariff', operation: 'create', targetId: VIDEO_OPERATION_TARIFF_EVENT,
    actorId: input.actorId, previousState: null, nextState: JSON.parse(JSON.stringify(persisted)),
    previewSummary: { fingerprint: prepared.fingerprint, sourceRevision: state.revision, targetRevision: after.revision,
      sourceStateHash: prepared.sourceStateHash, candidateCommit: input.candidateCommit, policy: prepared.policy,
      databaseIdentity: prepared.databaseIdentity, releaseBranch: prepared.releaseBranch,
      insertedCells: persisted.length, existingPricesChanged: false, basis: prepared.basis, scope: JSON.parse(JSON.stringify(prepared.scope)) },
    affectedScenarioIds: persisted.map(cell => cutoverDigest(cell.selector)) });
  return { insertedCells: persisted.length, revision: after.revision, fingerprint: prepared.fingerprint, eventId: event.id };
}
