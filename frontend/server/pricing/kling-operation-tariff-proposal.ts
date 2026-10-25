import { createHash } from 'node:crypto';
import { buildBillingPricingFacts } from '@/lib/pricing-billing-facts';
import { buildManualTariffScenario, continuousInputTariffSelector } from '@/lib/pricing-manual-scenario';
import { getFalEngineById } from '@/config/falEngines';
import { resolveVideoOperationEngine } from '@/lib/video-operation';
import { klingOperationPublishedRate } from '@/lib/kling-operation-pricing';
import type { EffectiveCustomerTariffState } from './customer-tariff-store';

/** Bounded, read-only review input. No copied Reference prices, invented markup or database writer.
 * Retail authoring and activation belong to normal revision-bound tariff maintenance. */
export function prepareKlingOperationTariffProposal(state: EffectiveCustomerTariffState) {
  if (state.status !== 'loaded' || !state.active) throw new Error('A loaded active tariff revision is required.');
  const selectors = ['kling-o3-standard', 'kling-o3-pro', 'kling-o3-4k'].flatMap(engineId => {
    const engine = getFalEngineById(engineId)!.engine;
    return (engineId === 'kling-o3-4k' ? ['kling-edit', 'kling-reference'] as const : ['kling-edit'] as const).flatMap(operation => {
      const resolved = resolveVideoOperationEngine(engine, 'v2v', operation);
      return (operation === 'kling-edit' ? [5] : Array.from({ length: 13 }, (_, i) => i + 3)).map(durationSec => {
        const context = { engine: resolved, mode: 'v2v' as const, operation, durationSec,
          resolution: resolved.modeCaps!.v2v!.resolution![0]!, hasVideoInput: true };
        const facts = buildBillingPricingFacts(context, resolved.pricingDetails, 'USD');
        const exact = buildManualTariffScenario(context, facts.facts).selector;
        const selector = continuousInputTariffSelector(exact) ?? exact;
        if ([...state.databaseCells, ...state.versionedCells].some(cell =>
          JSON.stringify(Object.entries(cell.selector).sort()) === JSON.stringify(Object.entries(selector).sort()))) {
          throw new Error('Operation tariffs already exist; review current cells in tariff maintenance.');
        }
        return { selector, quantity: operation === 'kling-edit' ? { unit: 'output_seconds', min: 3, max: 15, fractional: true } : null,
          supplierReference: klingOperationPublishedRate(engineId, 'v2v', operation),
          customerPrice: null, activationReady: false as const };
      });
    });
  });
  return { sourceRevision: state.revision, proposals: selectors, writes: false as const,
    fingerprint: createHash('sha256').update(JSON.stringify({ revision: state.revision, selectors })).digest('hex'),
    blockers: ['Author and review literal retail tariffs through canonical maintenance.',
      'Qualify effective provider billing and transport access separately; published rates are not invoices.'] };
}
