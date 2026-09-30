import { createHash } from 'node:crypto';
import { ManualTariffError, type ManualTariffCell } from '@maxvideoai/pricing';
import type { EffectiveCustomerTariffBaseline, ManualTariffCoverageScenario } from '@/lib/pricing-audit/manual-tariff-coverage';
import type { PricingPolicyOverrideLoadResult } from '@/lib/pricing-rule-store';
import { continuousInputTariffSelector } from '@/lib/pricing-manual-scenario';
import { buildBillingPricingFacts } from '@/lib/pricing-billing-facts';
import { buildCustomerTariffSeed, customerTariffCellId } from './customer-tariff-seed';
import { compileCurrentContinuousTariffPrice, validateCurrentContinuousTariffDomain } from './compile-current-continuous-tariff';
import { resolveCustomerTariffQuote } from './resolve-customer-tariff';

export type ApprovedGptImage25ReferenceFloor = {
  capturedAt: string;
  registryHash: string;
  databaseRulesHash: string;
  databaseIdentity: string;
  changes: readonly { scenarioId: string; currentCustomerCents: number; proposedCustomerCents: number }[];
};

function reviewedGap(modelId: string, mode: string): string | null {
  if (['wan-3', 'wan-3-prime'].includes(modelId) && ['ref2v', 'v2v', 'extend'].includes(mode)) {
    return `${mode}: fractional input video duration needs a continuous unit tariff`;
  }
  if (modelId === 'gemini-omni-flash' && ['v2v', 'extend', 'retake'].includes(mode)) {
    return `${mode}: open input video duration needs a continuous unit tariff`;
  }
  if (['ltx-2-5-fast', 'ltx-2-5-pro'].includes(modelId) && mode === 'a2v') {
    return `${mode}: open input audio duration needs a continuous unit tariff`;
  }
  return null;
}

/** Read-only candidate construction. Never writes or authorizes global activation. */
export async function auditReviewedCustomerTariffSeed(input: {
  baseline: EffectiveCustomerTariffBaseline & { databaseRulesHash: string };
  scenarios: readonly ManualTariffCoverageScenario[];
  registryHash: string;
  coverageGaps: readonly { modelId: string; reason: string }[];
  policy: PricingPolicyOverrideLoadResult;
  approvedGptImage25ReferenceFloor?: ApprovedGptImage25ReferenceFloor;
}) {
  if (input.policy.status !== 'loaded') throw new Error('Effective policy unavailable');
  const rulesHash = createHash('sha256').update(JSON.stringify([...input.policy.rules]
    .sort((left, right) => left.id.localeCompare(right.id)))).digest('hex');
  if (rulesHash !== input.baseline.databaseRulesHash) throw new Error('Captured policy changed');
  const original = buildCustomerTariffSeed(input);
  const pointCells = new Map(original.cells.map(cell => [cell.id, cell]));
  const cells = new Map<string, ManualTariffCell>();
  const reviewedContinuousClasses: Array<{ id: string; modelId: string; mode: string;
    domain: ReturnType<typeof validateCurrentContinuousTariffDomain> }> = [];
  const certifiedGaps = new Set<string>();
  for (const scenario of input.scenarios) {
    const selector = continuousInputTariffSelector(scenario.selector);
    if (!selector) {
      const cell = pointCells.get(customerTariffCellId(scenario.id))!;
      cells.set(cell.id, cell);
      continue;
    }
    const key = Object.entries(selector).map(([name, value]) => `${name}=${encodeURIComponent(value)}`).join('|');
    const id = customerTariffCellId(key);
    if (cells.has(id)) continue;
    const price = await compileCurrentContinuousTariffPrice(scenario, input.policy);
    const domain = validateCurrentContinuousTariffDomain({ context: scenario.context, price });
    cells.set(id, { id, selector, source: 'database', version: 1, currency: 'USD', effectiveFrom: input.baseline.at, price });
    reviewedContinuousClasses.push({ id, modelId: scenario.modelId, mode: scenario.selector.mode, domain });
    const gap = reviewedGap(scenario.modelId, scenario.selector.mode);
    if (gap) certifiedGaps.add(`${scenario.modelId}|${gap}`);
  }
  const candidateCells = [...cells.values()];
  const selectorKey = (selector: ManualTariffCell['selector']) => JSON.stringify(Object.entries(selector).sort(([a], [b]) => a.localeCompare(b)));
  const cellsBySelector = new Map(candidateCells.map(cell => [selectorKey(cell.selector), cell]));
  const rows = new Map(input.baseline.rows.map(row => [row.scenarioId, row]));
  const approvedPriceChanges: Array<{ scenarioId: string; currentCustomerCents: number;
    proposedCustomerCents: number; referenceCeilCents: number }> = [];
  const approval = input.approvedGptImage25ReferenceFloor;
  if (approval) {
    function rejectApproval(): never { throw new Error('Approved GPT Image 2.5 reference floor does not match captured evidence'); }
    if (approval.capturedAt !== input.baseline.at || approval.registryHash !== input.registryHash
      || approval.databaseRulesHash !== rulesHash || approval.databaseIdentity !== input.baseline.databaseIdentity
      || !approval.changes.length) rejectApproval();
    const scenariosById = new Map(input.scenarios.map(scenario => [scenario.id, scenario]));
    const seen = new Set<string>();
    for (const change of approval.changes) {
      const scenario = scenariosById.get(change.scenarioId);
      const row = rows.get(change.scenarioId);
      if (!scenario || !row || seen.has(change.scenarioId)) rejectApproval();
      seen.add(change.scenarioId);
      if (!['gpt-image-2-5-flare', 'gpt-image-2-5-sunburst'].includes(scenario.modelId)
        || scenario.selector.mode !== 'i2i' || !((scenario.context.referenceImageCount ?? 0) > 0)
        || row.currency !== 'USD' || change.currentCustomerCents !== row.customerCents
        || !Number.isSafeInteger(change.currentCustomerCents) || !Number.isSafeInteger(change.proposedCustomerCents)
        || change.proposedCustomerCents - change.currentCustomerCents !== 1) rejectApproval();
      const facts = buildBillingPricingFacts(scenario.context, scenario.context.engine.pricingDetails, 'USD').facts;
      const referenceCeilCents = Math.ceil(facts.vendorSubtotalExactCents - 1e-9);
      const key = selectorKey(scenario.selector);
      const cell = cellsBySelector.get(key);
      if (referenceCeilCents !== change.proposedCustomerCents || cell?.price.kind !== 'fixed'
        || cell.price.customerCents !== change.currentCustomerCents) rejectApproval();
      cellsBySelector.set(key, { ...cell, price: { kind: 'fixed', customerCents: change.proposedCustomerCents } });
      approvedPriceChanges.push({ ...change, referenceCeilCents });
    }
  }
  const approvedAmounts = new Map(approvedPriceChanges.map(change => [change.scenarioId, change.proposedCustomerCents]));
  const settlementGuardFailures: Array<{ scenarioId: string; customerCents: number; referenceCeilCents: number }> = [];
  for (const scenario of input.scenarios) {
    const facts = buildBillingPricingFacts(scenario.context, scenario.context.engine.pricingDetails, 'USD').facts;
    const continuous = continuousInputTariffSelector(scenario.selector);
    const databaseCells = [cellsBySelector.get(selectorKey(scenario.selector)),
      ...(continuous ? [cellsBySelector.get(selectorKey(continuous))] : [])].filter((cell): cell is ManualTariffCell => Boolean(cell));
    const state = { status: 'loaded' as const, active: true, revision: 1, databaseCells, versionedCells: [] };
    const row = rows.get(scenario.id)!;
    let current;
    try { current = resolveCustomerTariffQuote({ context: scenario.context, facts, at: input.baseline.at, state })!.quote; }
    catch (error) {
      const exact = cellsBySelector.get(selectorKey(scenario.selector));
      if (error instanceof ManualTariffError && error.code === 'below_cost' && exact?.price.kind === 'fixed'
        && exact.price.customerCents === row.customerCents && exact.currency === row.currency) {
        settlementGuardFailures.push({ scenarioId: scenario.id, customerCents: row.customerCents,
          referenceCeilCents: Math.ceil(facts.vendorSubtotalExactCents - 1e-9) });
        continue;
      }
      throw new Error(`Candidate quote failed: ${scenario.id}: ${error instanceof Error ? error.message : 'unavailable'}`);
    }
    if (current.customerTotalCents !== (approvedAmounts.get(scenario.id) ?? row.customerCents) || current.currency !== row.currency) {
      throw new Error(`Candidate cent parity failed: ${scenario.id}`);
    }
  }
  const remainingCoverageGaps = input.coverageGaps.filter(gap => !certifiedGaps.has(`${gap.modelId}|${gap.reason}`));
  return { cells: [...cellsBySelector.values()], reviewedContinuousClasses, checkedScenarios: input.scenarios.length,
    quotedScenarios: input.scenarios.length - settlementGuardFailures.length, settlementGuardFailures,
    approvedPriceChanges,
    remainingCoverageGaps, registryHash: input.registryHash, databaseRulesHash: rulesHash,
    capturedAt: input.baseline.at, databaseIdentity: input.baseline.databaseIdentity, activationReady: false as const };
}
