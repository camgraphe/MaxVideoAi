import type { ManualTariffCell } from '@maxvideoai/pricing';
import type { ManualTariffCoverageScenario } from '@/lib/pricing-audit/manual-tariff-coverage';
import type { EffectiveCustomerTariffState } from './customer-tariff-store';
import type { PricingPolicyOverrideLoadResult } from '@/lib/pricing-rule-store';
import { createHash } from 'node:crypto';
import { seedanceWorkflowScenarios } from '@/lib/pricing-audit/seedance-workflow-scenarios';
import { computeCanonicalBillingSnapshot } from './quote-billing';
import { customerTariffCellId } from './customer-tariff-seed';

/** Initialization freezes the existing reviewed normal amount; later workflow edits are independent. */
export async function prepareSeedanceWorkflowTariffSeed(input: {
  normalScenarios: readonly ManualTariffCoverageScenario[]; state: EffectiveCustomerTariffState; policy: PricingPolicyOverrideLoadResult;
}): Promise<{ fingerprint: string; sourceRevision: number; cells: ManualTariffCell[] }> {
  if (input.state.status !== 'loaded' || !input.state.active || input.policy.status !== 'loaded') throw new Error('Active current tariffs are required.');
  if (input.normalScenarios.some(s => s.context.workflowStep)) throw new Error('Normal source scenarios are required.');
  const sources = input.normalScenarios.filter(s => s.modelId === 'seedance-2-5' && s.context.mode === 't2v'
    && ['480p', '1080p'].includes(s.context.resolution));
  const workflows = seedanceWorkflowScenarios(sources);
  if (!workflows.length || new Set(workflows.map(s => s.id)).size !== workflows.length) throw new Error('Unique supported workflow scenarios are required.');
  const cells: ManualTariffCell[] = [];
  const state = input.state;
  const quote = (scenario: ManualTariffCoverageScenario, selectedState = state) => computeCanonicalBillingSnapshot(scenario.context,
    { loadCustomerTariffState: async () => selectedState, pricingPolicy: { loadOverrides: async () => input.policy } });
  for (const [index, scenario] of workflows.entries()) {
    const snapshot = await quote(sources[index]);
    if (snapshot.meta?.customerTariffRevision !== state.revision || snapshot.currency !== 'USD'
      || !Number.isSafeInteger(snapshot.totalCents) || snapshot.totalCents <= 0) throw new Error('Current source quote is unavailable.');
    const cell: ManualTariffCell = { id: customerTariffCellId(scenario.id), selector: scenario.selector,
      source: 'database', version: 1, currency: 'USD', effectiveFrom: new Date().toISOString(),
      price: { kind: 'fixed', customerCents: snapshot.totalCents } };
    const workflowQuote = await quote(scenario, { ...state, databaseCells: [cell], versionedCells: [] });
    if (workflowQuote.totalCents !== snapshot.totalCents) throw new Error('Workflow initialization changed customer cents.');
    cells.push(cell);
  }
  const fingerprint = createHash('sha256').update(JSON.stringify({ sourceRevision: state.revision,
    cells: cells.map(({ id, selector, currency, price }) => ({ id, selector, currency, price })) })).digest('hex');
  return { fingerprint, sourceRevision: state.revision, cells };
}
