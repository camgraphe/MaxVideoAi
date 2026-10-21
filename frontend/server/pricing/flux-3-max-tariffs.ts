import { createHash } from 'node:crypto';
import type { ManualTariffCell } from '@maxvideoai/pricing';
import { collectSellableManualTariffCoverage, type ManualTariffCoverage } from '@/lib/pricing-audit/manual-tariff-coverage';
import { buildBillingPricingFacts } from '@/lib/pricing-billing-facts';
import { isTransactionQueryExecutor, type TransactionQueryExecutor } from '@/lib/db';
import { insertPricingChangeEvent } from '@/server/pricing-admin/event-store';
import { customerTariffsEnabledByCode, loadEffectiveCustomerTariffState, upsertCustomerTariffCell,
  type EffectiveCustomerTariffState } from './customer-tariff-store';
import { computeCanonicalBillingSnapshot } from './quote-billing';
import { FLUX_3_MAX_TARIFF_POLICY, FLUX_3_MAX_TARIFF_SCOPE } from './flux-3-max-tariff-policy';

export { FLUX_3_MAX_TARIFF_POLICY, FLUX_3_MAX_TARIFF_SCOPE } from './flux-3-max-tariff-policy';
const normalListCentsPerSecond = { '720p': 17, '1080p': 29 } as const;
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const key = (selector: object) => JSON.stringify(Object.entries(selector).sort(([a], [b]) => a.localeCompare(b)));
function releaseIdentity(actorId: string, candidateCommit: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(actorId)
    || !/^[0-9a-f]{40}$/.test(candidateCommit)) throw new Error('An authorized actor and committed candidate are required.');
}

/** Freeze literal customer amounts once; supplier promotions never alter these cells. No database writes. */
export async function prepareFlux3MaxTariffs(input: {
  state: EffectiveCustomerTariffState; actorId: string; candidateCommit: string; at?: string;
  coverage?: ManualTariffCoverage;
}) {
  releaseIdentity(input.actorId, input.candidateCommit);
  if (input.state.status !== 'loaded' || !input.state.active || !Number.isSafeInteger(input.state.revision)
    || input.state.revision < 0) throw new Error('Active current customer tariffs are required.');
  const state = input.state;
  if ([...state.databaseCells, ...state.versionedCells].some(cell => cell.selector.engineId === 'flux-3-max')) {
    throw new Error('Existing FLUX 3 Max tariffs require explicit admin review; initialization never overwrites them.');
  }
  const at = input.at ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(at)) || Date.parse(at) > Date.now()) throw new Error('A current or earlier effective date is required.');
  const coverage = input.coverage ?? collectSellableManualTariffCoverage({ modelId: 'flux-3-max' });
  if (coverage.gaps.length || coverage.scenarios.length !== FLUX_3_MAX_TARIFF_SCOPE.expectedCells) {
    throw new Error('Complete reviewed FLUX 3 Max tariff coverage is required.');
  }
  const expected = new Set<string>();
  for (const mode of FLUX_3_MAX_TARIFF_SCOPE.modes) for (const resolution of FLUX_3_MAX_TARIFF_SCOPE.resolutions)
    for (let duration = 5; duration <= 20; duration++) expected.add(key({ engineId: 'flux-3-max', mode, resolution, durationSec: String(duration) }));
  const cells: ManualTariffCell[] = [];
  for (const scenario of [...coverage.scenarios].sort((a, b) => key(a.selector).localeCompare(key(b.selector)))) {
    const { selector, context } = scenario;
    if (scenario.modelId !== 'flux-3-max' || !expected.delete(key(selector))) {
      throw new Error('Unexpected or duplicate FLUX 3 Max tariff selector coverage.');
    }
    const seconds = Number(selector.durationSec);
    const normalCents = normalListCentsPerSecond[selector.resolution as keyof typeof normalListCentsPerSecond] * seconds;
    const facts = buildBillingPricingFacts(context, context.engine.pricingDetails, 'USD').facts;
    if (facts.vendorSubtotalExactCents !== normalCents) throw new Error('The reviewed normal FLUX 3 Max supplier list rate changed.');
    // Integer arithmetic before division avoids rounding 22.1 * 10 to an extra cent.
    const customerCents = Math.ceil(normalCents * 13 / 10);
    const cell: ManualTariffCell = { id: `flux-3-max-launch-${digest(selector).slice(0, 32)}`,
      selector: { ...selector }, currency: 'USD', price: { kind: 'fixed', customerCents },
      source: 'database', version: 1, effectiveFrom: at };
    const quote = await computeCanonicalBillingSnapshot(context, {
      loadCustomerTariffState: async () => ({ ...state, databaseCells: [cell], versionedCells: [] }),
      pricingPolicy: { loadOverrides: async () => ({ status: 'loaded', rules: [] }) },
    });
    if (quote.totalCents !== customerCents || quote.currency !== 'USD' || quote.meta?.customerTariffCellId !== cell.id) {
      throw new Error('The authored FLUX 3 Max amount did not survive canonical quotation.');
    }
    cells.push(cell);
  }
  if (expected.size) throw new Error('Complete reviewed FLUX 3 Max tariff coverage is required.');
  const sourceRevision = state.revision;
  const basis = { normalListCentsPerSecond, markupNumerator: 13, markupDenominator: 10, rounding: 'up_to_cent',
    promotionApplied: false, checkedAt: '2026-10-20', sourceUrl: 'https://fal.ai/models/blackforestlabs/flux-3-max/text-to-video' };
  const fingerprint = digest({ policy: FLUX_3_MAX_TARIFF_POLICY, sourceRevision, actorId: input.actorId,
    candidateCommit: input.candidateCommit, scope: FLUX_3_MAX_TARIFF_SCOPE, basis,
    cells: cells.map(({ id, selector, currency, price }) => ({ id, selector, currency, price })) });
  return { policy: FLUX_3_MAX_TARIFF_POLICY, fingerprint, sourceRevision, scope: FLUX_3_MAX_TARIFF_SCOPE, basis, cells };
}

/** Maintenance only. The CLI verifies clean published Git, reviewed target and exact-head CI first. */
export async function applyFlux3MaxTariffs(executor: TransactionQueryExecutor, input: {
  actorId: string; candidateCommit: string; authorizedActorId: string; authorizedCandidateCommit: string;
  policy: typeof FLUX_3_MAX_TARIFF_POLICY; fingerprint: string; sourceRevision: number;
}) {
  releaseIdentity(input.actorId, input.candidateCommit);
  if (!isTransactionQueryExecutor(executor) || !customerTariffsEnabledByCode()
    || input.actorId !== input.authorizedActorId || input.candidateCommit !== input.authorizedCandidateCommit
    || input.policy !== FLUX_3_MAX_TARIFF_POLICY || !/^[0-9a-f]{64}$/.test(input.fingerprint)
    || !Number.isSafeInteger(input.sourceRevision) || input.sourceRevision < 0) {
    throw new Error('An explicitly authorized committed FLUX 3 Max tariff release transaction is required.');
  }
  await executor.query('SELECT revision FROM app_customer_tariff_state WHERE singleton = TRUE FOR UPDATE');
  await executor.query('LOCK TABLE app_customer_tariff_cells, app_customer_tariff_cell_versions, app_pricing_rules IN SHARE ROW EXCLUSIVE MODE');
  const state = await loadEffectiveCustomerTariffState(executor);
  if (state.status !== 'loaded' || state.revision !== input.sourceRevision) throw new Error('The reviewed FLUX 3 Max tariff release changed.');
  const prepared = await prepareFlux3MaxTariffs({ state, actorId: input.actorId, candidateCommit: input.candidateCommit });
  if (prepared.fingerprint !== input.fingerprint) throw new Error('The reviewed FLUX 3 Max tariff release changed.');
  const persisted: ManualTariffCell[] = [];
  for (const cell of prepared.cells) persisted.push(await upsertCustomerTariffCell(executor, cell, input.actorId));
  const [current] = await executor.query<{ revision: number | string }>('SELECT revision FROM app_customer_tariff_state WHERE singleton = TRUE');
  await insertPricingChangeEvent(executor, { domain: 'customer_tariff', operation: 'create', targetId: 'flux-3-max:normal-list-initialization',
    actorId: input.actorId, previousState: null, nextState: JSON.parse(JSON.stringify(persisted)),
    previewSummary: { fingerprint: prepared.fingerprint, sourceRevision: prepared.sourceRevision,
      candidateCommit: input.candidateCommit, policy: prepared.policy, insertedCells: persisted.length,
      existingPricesChanged: false, basis: prepared.basis, scope: JSON.parse(JSON.stringify(prepared.scope)) },
    affectedScenarioIds: persisted.map(cell => key(cell.selector)) });
  return { insertedCells: persisted.length, revision: Number(current.revision), fingerprint: prepared.fingerprint };
}
