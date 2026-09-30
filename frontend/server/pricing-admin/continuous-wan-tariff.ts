import { ManualTariffError, quoteCanonicalManualTariff, resolveManualTariffCell, type ManualTariffCell } from '@maxvideoai/pricing';
import { continuousWan3TariffSelector } from '@/lib/pricing-manual-scenario';
import { buildBillingPricingFacts } from '@/lib/pricing-billing-facts';
import { getVersionedPricingPolicy } from '@/lib/pricing-policy-defaults';
import type { ManualTariffCoverageScenario } from '@/lib/pricing-audit/manual-tariff-coverage';
import type { PricingPolicyOverrideLoadResult } from '@/lib/pricing-rule-store';
import type { TransactionQueryExecutor } from '@/lib/db';
import { resolveServerBillingPolicy } from '@/server/pricing/resolve-pricing-policy';
import { compileWan3ContinuousTariffPrice } from '@/server/pricing/wan3-continuous-tariff';
import { validateWan3ContinuousTariffDomain } from '@/server/pricing/wan3-continuous-tariff-domain';
import { customerTariffCellId } from '@/server/pricing/customer-tariff-seed';
import { validateCustomerTariffCell, type EffectiveCustomerTariffState } from '@/server/pricing/customer-tariff-store';
import { getPricingChangeEventById } from './event-store';
import { PricingAdminError } from './errors';
import type { CustomerTariffChangeProposal, CustomerTariffScenarioDetail } from './customer-tariff-contract';

export function continuousWanTariffIdentity(scenario: ManualTariffCoverageScenario) {
  const selector = continuousWan3TariffSelector(scenario.selector);
  if (!selector) throw new PricingAdminError('unsupported_scenario', 'Continuous source pricing is unavailable for these Wan options.');
  const key = Object.entries(selector).map(([name, value]) => `${name}=${encodeURIComponent(value)}`).join('|');
  return { selector, id: customerTariffCellId(key) };
}

function currentCell(scenario: ManualTariffCoverageScenario, state: Extract<EffectiveCustomerTariffState, { status: 'loaded' }>) {
  const { selector } = continuousWanTariffIdentity(scenario);
  try { return resolveManualTariffCell({ selector, at: new Date().toISOString(), versionedCells: state.versionedCells, databaseCells: state.databaseCells }); }
  catch (error) { if (error instanceof ManualTariffError && error.code === 'missing_cell') return null; throw error; }
}

async function compiledCurrentPrice(scenario: ManualTariffCoverageScenario, rules: PricingPolicyOverrideLoadResult) {
  if (rules.status !== 'loaded') throw new PricingAdminError('database_unavailable', 'Effective pricing rules are unavailable');
  const { policy } = await resolveServerBillingPolicy({ engineId: scenario.modelId, mode: scenario.context.mode, resolution: scenario.context.resolution },
    null, { loadOverrides: async () => rules });
  const facts = buildBillingPricingFacts(scenario.context, scenario.context.engine.pricingDetails, 'USD');
  const profile = getVersionedPricingPolicy().compatibilityProfiles.find(p => p.id === (policy.rule.compatibilityProfile ?? facts.compatibilityProfileId));
  if (!profile) throw new PricingAdminError('unsupported_scenario', 'Current price rounding is unavailable');
  return compileWan3ContinuousTariffPrice({ context: scenario.context, policy, compatibilityProfile: profile });
}

export function quoteContinuousWanPrice(scenario: ManualTariffCoverageScenario, price: ManualTariffCell['price'], seconds = scenario.context.inputVideoDurationSec ?? 0) {
  const { selector, id } = continuousWanTariffIdentity(scenario);
  const facts = buildBillingPricingFacts(scenario.context, scenario.context.engine.pricingDetails, 'USD').facts;
  return quoteCanonicalManualTariff({ facts: { ...facts, vendorSubtotalExactCents: 0 }, scenarioId: scenario.id, selector,
    quantities: { input_video_seconds: seconds }, at: '2026-09-30T00:00:00Z', databaseCells: [], versionedCells: [{
      id, selector, source: 'versioned', version: 1, currency: 'USD', effectiveFrom: '2026-09-29T00:00:00Z', price,
    }] }).customerTotalCents;
}

export async function continuousWanTariffDetail(scenario: ManualTariffCoverageScenario, state: EffectiveCustomerTariffState,
  rules: PricingPolicyOverrideLoadResult): Promise<CustomerTariffScenarioDetail['continuousInputTariff']> {
  if (state.status !== 'loaded') return undefined;
  const identity = continuousWanTariffIdentity(scenario);
  const cell = currentCell(scenario, state);
  const price = cell?.price ?? await compiledCurrentPrice(scenario, rules);
  if (price.kind === 'fixed') throw new PricingAdminError('unsupported_scenario', 'Continuous source pricing requires unit amounts');
  const terms = price.kind === 'unit_terms' ? price.terms : price.components.flatMap(c => c.terms);
  return { tariffCellId: identity.id, prepared: cell?.source === 'database', price,
    minInputSeconds: scenario.context.mode === 'ref2v' ? 0 : null,
    outputCents: quoteContinuousWanPrice(scenario, price, 0),
    inputCentsPerSecond: terms.filter(t => t.unit === 'input_video_seconds').reduce((sum, t) => sum + t.centsPerUnit, 0),
    maxInputSeconds: Math.min(15, 30 - scenario.context.durationSec) };
}

export async function prepareContinuousWanTariffChange(input: {
  proposal: CustomerTariffChangeProposal;
  scenario: ManualTariffCoverageScenario;
  state: Extract<EffectiveCustomerTariffState, { status: 'loaded' }>;
  policy: PricingPolicyOverrideLoadResult;
  executor?: TransactionQueryExecutor;
}) {
  const { proposal, scenario, state } = input;
  const { id, selector } = continuousWanTariffIdentity(scenario);
  const current = currentCell(scenario, state);
  const previousCell = current?.source === 'database' || state.active ? current : null;
  if ((proposal.operation === 'create' && current?.source === 'database') ||
      ((proposal.operation === 'update' || proposal.operation === 'delete') && current?.source !== 'database')) {
    throw new PricingAdminError('invalid_payload', 'Tariff operation does not match the current continuous price');
  }
  let price: ManualTariffCell['price'] | null = null;
  if (proposal.operation === 'create' || proposal.operation === 'update') {
    if (!('scope' in proposal) || proposal.scope !== 'continuous_input' || !('price' in proposal) || 'customerCents' in proposal) {
      throw new PricingAdminError('invalid_payload', 'Continuous source pricing requires unit amounts');
    }
    if (proposal.price?.kind === 'preserve_current') {
      if (state.active && !current) throw new PricingAdminError('unsupported_scenario', 'No current continuous tariff');
      price = state.active ? current!.price : await compiledCurrentPrice(scenario, input.policy);
    } else if (proposal.price?.kind === 'linear_input') {
      const { outputCents, inputCentsPerSecond } = proposal.price;
      if (!Number.isSafeInteger(outputCents) || outputCents < 0 || !Number.isFinite(inputCentsPerSecond) || inputCentsPerSecond < 0) {
        throw new PricingAdminError('invalid_number', 'Invalid output amount or input-second rate');
      }
      price = { kind: 'unit_components', rounding: 'nearest', components: [{ id: 'retail', flatCents: outputCents, rounding: 'none',
        terms: [{ unit: 'input_video_seconds', centsPerUnit: inputCentsPerSecond }] }] };
    } else throw new PricingAdminError('invalid_payload', 'Unknown continuous source price');
  } else if (proposal.operation === 'rollback') {
    const event = await getPricingChangeEventById(proposal.eventId, 'customer_tariff', input.executor);
    if (!event || event.targetId !== id) throw new PricingAdminError('missing_target', 'No matching continuous price history event');
    if (event.previousState !== null) {
      const historical = event.previousState as unknown as ManualTariffCell;
      if (!historical || !['database', 'versioned'].includes(historical.source)) throw new PricingAdminError('invalid_payload', 'Invalid historical continuous price');
      validateCustomerTariffCell({ ...historical, source: 'database' });
      if (Object.keys(historical.selector).length !== Object.keys(selector).length ||
          Object.entries(selector).some(([key, value]) => historical.selector[key] !== value)) {
        throw new PricingAdminError('invalid_payload', 'Historical continuous selector does not match');
      }
      price = historical.price;
    }
  }
  if (!price && state.active) throw new PricingAdminError('unsupported_scenario', 'Active customer tariffs cannot be deleted');
  if (!price && !previousCell) throw new PricingAdminError('invalid_payload', 'No continuous prepared price to remove');
  let domain;
  try { if (price) domain = validateWan3ContinuousTariffDomain({ context: scenario.context, price }); }
  catch (error) { throw new PricingAdminError('unsupported_scenario', error instanceof Error ? error.message : 'Invalid continuous price'); }
  const proposedCell: ManualTariffCell | null = price ? { id, selector, source: 'database', version: state.revision + 1, currency: 'USD',
    effectiveFrom: previousCell?.effectiveFrom ?? '2026-09-29T00:00:00.000Z', price } : null;
  return { previousCell, proposedCell, proposedCents: price ? quoteContinuousWanPrice(scenario, price) : null,
    selector, continuousInputRange: domain };
}
