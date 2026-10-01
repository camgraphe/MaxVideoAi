import { compileCurrentContinuousTariffPrice, validateCurrentContinuousTariffDomain } from '@/server/pricing/compile-current-continuous-tariff';
import { ManualTariffError, manualTariffUnitNames, quoteCanonicalManualTariff, resolveManualTariffCell, type ManualTariffCell } from '@maxvideoai/pricing';
import { continuousInputTariffSelector } from '@/lib/pricing-manual-scenario';
import { ltx25AudioTariffBounds } from '@/lib/ltx25-audio-tariff';
import { buildManualTariffScenario } from '@/lib/pricing-manual-scenario';
import { buildBillingPricingFacts } from '@/lib/pricing-billing-facts';
import type { ManualTariffCoverageScenario } from '@/lib/pricing-audit/manual-tariff-coverage';
import type { PricingPolicyOverrideLoadResult } from '@/lib/pricing-rule-store';
import type { TransactionQueryExecutor } from '@/lib/db';
import { customerTariffCellId } from '@/server/pricing/customer-tariff-seed';
import { validateCustomerTariffCell, type EffectiveCustomerTariffState } from '@/server/pricing/customer-tariff-store';
import { getPricingChangeEventById } from './event-store';
import { PricingAdminError } from './errors';
import type { CustomerTariffChangeProposal, CustomerTariffScenarioDetail } from './customer-tariff-contract';
import { isOpenQuantityTariff } from '@/server/pricing/open-quantity-tariff';

export function continuousInputTariffIdentity(scenario: ManualTariffCoverageScenario) {
  const selector = continuousInputTariffSelector(scenario.selector);
  if (!selector) throw new PricingAdminError('unsupported_scenario', 'Continuous source pricing is unavailable for these model options.');
  const key = Object.entries(selector).map(([name, value]) => `${name}=${encodeURIComponent(value)}`).join('|');
  return { selector, id: customerTariffCellId(key) };
}

function currentCell(scenario: ManualTariffCoverageScenario, state: Extract<EffectiveCustomerTariffState, { status: 'loaded' }>) {
  const { selector } = continuousInputTariffIdentity(scenario);
  try { return resolveManualTariffCell({ selector, at: new Date().toISOString(), versionedCells: state.versionedCells, databaseCells: state.databaseCells }); }
  catch (error) { if (error instanceof ManualTariffError && error.code === 'missing_cell') return null; throw error; }
}


export function quoteContinuousInputPrice(scenario: ManualTariffCoverageScenario, price: ManualTariffCell['price'], seconds = isOpenQuantityTariff(scenario.modelId, scenario.selector.mode)
  ? scenario.context.referenceTokenBudget ?? scenario.context.durationSec : scenario.context.inputAudioDurationSec ?? scenario.context.inputVideoDurationSec ?? 0) {
  const { selector, id } = continuousInputTariffIdentity(scenario);
  const facts = buildBillingPricingFacts(scenario.context, scenario.context.engine.pricingDetails, 'USD').facts;
  const omni = scenario.modelId === 'gemini-omni-flash';
  const quotedContext = omni ? { ...scenario.context, inputVideoDurationSec: seconds } : scenario.context;
  const quotedFacts = omni ? buildBillingPricingFacts(quotedContext, quotedContext.engine.pricingDetails, 'USD').facts : facts;
  const available = { ...buildManualTariffScenario(quotedContext, quotedFacts).quantities,
    [selector.referenceTokenBudget === 'continuous' ? 'reference_tokens' : isOpenQuantityTariff(scenario.modelId, scenario.selector.mode)
      ? 'output_seconds' : selector.inputAudioDurationSec === 'continuous' ? 'input_audio_seconds' : 'input_video_seconds']: seconds };
  const quantities = Object.fromEntries(manualTariffUnitNames(price).map(unit => [unit, available[unit]]));
  return quoteCanonicalManualTariff({ facts: { ...facts, vendorSubtotalExactCents: 0 }, scenarioId: scenario.id, selector,
    quantities, at: '2026-09-30T00:00:00Z', databaseCells: [], versionedCells: [{
      id, selector, source: 'versioned', version: 1, currency: 'USD', effectiveFrom: '2026-09-29T00:00:00Z', price,
    }] }).customerTotalCents;
}

export async function continuousInputTariffDetail(scenario: ManualTariffCoverageScenario, state: EffectiveCustomerTariffState,
  rules: PricingPolicyOverrideLoadResult): Promise<CustomerTariffScenarioDetail['continuousInputTariff']> {
  if (state.status !== 'loaded') return undefined;
  const identity = continuousInputTariffIdentity(scenario);
  const cell = currentCell(scenario, state);
  const price = cell?.price ?? await compileCurrentContinuousTariffPrice(scenario, rules);
  if (price.kind === 'fixed') throw new PricingAdminError('unsupported_scenario', 'Continuous source pricing requires unit amounts');
  const terms = price.kind === 'unit_terms' || price.kind === 'unit_bands' ? price.terms : price.components.flatMap(c => c.terms);
  const audioBounds = ltx25AudioTariffBounds(scenario.modelId, scenario.selector.mode);
  const omni = scenario.modelId === 'gemini-omni-flash';
  const retake = omni && scenario.selector.mode === 'retake';
  if (isOpenQuantityTariff(scenario.modelId, scenario.selector.mode)) {
    const tokens = scenario.modelId === 'minimax-h3-max';
    const unit = tokens ? 'reference_tokens' : 'output_seconds';
    return { kind: tokens ? 'tokens' : 'output', tariffCellId: identity.id, prepared: cell?.source === 'database', price,
      unbounded: true, ...(tokens ? { includedUnits: 4096 } : {}), minInputSeconds: tokens ? 0 : 1,
      outputCents: tokens ? quoteContinuousInputPrice(scenario, price, 0) : 0,
      inputCentsPerSecond: terms.filter(t => t.unit === unit).reduce((sum, t) => sum + t.centsPerUnit, 0),
      maxInputSeconds: Number.MAX_SAFE_INTEGER };
  }
  const unit = audioBounds ? 'input_audio_seconds' : 'input_video_seconds';
  return { kind: audioBounds ? 'audio' : 'video', tariffCellId: identity.id, prepared: cell?.source === 'database', price,
    outputVaries: omni && scenario.selector.mode !== 'extend',
    minInputSeconds: audioBounds?.min ?? (['ref2v', 'retake'].includes(scenario.context.mode ?? '') ? 0 : null),
    outputCents: audioBounds ? 0 : quoteContinuousInputPrice(scenario, price, 0),
    inputCentsPerSecond: retake ? 0 : omni || price.kind === 'unit_bands' ? (() => {
      const maximum = omni ? 10 : Math.min(15, 30 - scenario.context.durationSec);
      return maximum > 0 ? (quoteContinuousInputPrice(scenario, price, maximum) - quoteContinuousInputPrice(scenario, price, 0)) / maximum : 0;
    })()
      : terms.filter(t => t.unit === unit).reduce((sum, t) => sum + t.centsPerUnit, 0),
    maxInputSeconds: retake ? 0 : omni ? 10 : audioBounds?.max ?? Math.min(15, 30 - scenario.context.durationSec) };
}

export async function prepareContinuousInputTariffChange(input: {
  proposal: CustomerTariffChangeProposal;
  scenario: ManualTariffCoverageScenario;
  state: Extract<EffectiveCustomerTariffState, { status: 'loaded' }>;
  policy: PricingPolicyOverrideLoadResult;
  executor?: TransactionQueryExecutor;
}) {
  const { proposal, scenario, state } = input;
  const { id, selector } = continuousInputTariffIdentity(scenario);
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
      price = state.active ? current!.price : await compileCurrentContinuousTariffPrice(scenario, input.policy);
    } else if (proposal.price?.kind === 'linear_open') {
      if (!isOpenQuantityTariff(scenario.modelId, scenario.selector.mode)) throw new PricingAdminError('invalid_payload', 'Unsupported open unit pricing.');
      const { outputCents, unitCents } = proposal.price;
      if (!Number.isSafeInteger(outputCents) || outputCents < 0 || !Number.isFinite(unitCents) || unitCents < 0) throw new PricingAdminError('invalid_number', 'Invalid open unit amounts.');
      const tokens = scenario.modelId === 'minimax-h3-max';
      if (!tokens && outputCents !== 0) throw new PricingAdminError('invalid_number', 'Luma output seconds have no flat output price.');
      price = { kind: 'unit_components', rounding: 'up', components: [{ id: 'retail', flatCents: outputCents, rounding: 'none', terms: [
        { unit: tokens ? 'reference_tokens' : 'output_seconds', centsPerUnit: unitCents, ...(tokens ? { includedUnits: 4096 } : {}) },
      ] }] };
    } else if (proposal.price?.kind === 'linear_input') {
      if (scenario.modelId === 'gemini-omni-flash') throw new PricingAdminError('invalid_payload', 'Omni requires separate output/source unit prices');
      const { outputCents, inputCentsPerSecond } = proposal.price;
      if (!Number.isSafeInteger(outputCents) || outputCents < 0 || !Number.isFinite(inputCentsPerSecond) || inputCentsPerSecond < 0) {
        throw new PricingAdminError('invalid_number', 'Invalid output amount or input-second rate');
      }
      const audio = Boolean(ltx25AudioTariffBounds(scenario.modelId, scenario.selector.mode));
      if (audio && outputCents !== 0) throw new PricingAdminError('invalid_number', 'Audio-second pricing has no independent output amount');
      price = { kind: 'unit_components', rounding: 'nearest', components: [{ id: 'retail', flatCents: outputCents, rounding: 'none',
        terms: [{ unit: audio ? 'input_audio_seconds' : 'input_video_seconds', centsPerUnit: inputCentsPerSecond }] }] };
    } else if (proposal.price?.kind === 'linear_video') {
      const { outputCentsPerSecond, inputCentsPerSecond } = proposal.price;
      if (scenario.modelId !== 'gemini-omni-flash' || ![outputCentsPerSecond, inputCentsPerSecond].every(value => Number.isFinite(value) && value >= 0)) {
        throw new PricingAdminError('invalid_number', 'Invalid continuous output/source unit rates');
      }
      if (scenario.selector.mode === 'retake' && inputCentsPerSecond !== 0) throw new PricingAdminError('invalid_number', 'Retake has no source-video charge');
      price = { kind: 'unit_components', rounding: 'nearest', components: [{ id: 'retail', flatCents: 0, rounding: 'none', terms: [
        { unit: 'output_seconds', centsPerUnit: outputCentsPerSecond }, { unit: 'input_video_seconds', centsPerUnit: inputCentsPerSecond },
      ] }] };
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
  try { if (price) domain = validateCurrentContinuousTariffDomain({ context: scenario.context, price }); }
  catch (error) { throw new PricingAdminError('unsupported_scenario', error instanceof Error ? error.message : 'Invalid continuous price'); }
  const proposedCell: ManualTariffCell | null = price ? { id, selector, source: 'database', version: state.revision + 1, currency: 'USD',
    effectiveFrom: previousCell?.effectiveFrom ?? '2026-09-29T00:00:00.000Z', price } : null;
  return { previousCell, proposedCell, proposedCents: price ? quoteContinuousInputPrice(scenario, price) : null,
    selector, continuousInputRange: domain };
}
