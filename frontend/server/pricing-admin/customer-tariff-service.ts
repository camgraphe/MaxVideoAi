import { createHash } from 'node:crypto';

import { resolveManualTariffCell, type ManualTariffCell } from '@maxvideoai/pricing';

import { collectSellableManualTariffCoverage, type ManualTariffCoverageScenario } from '@/lib/pricing-audit/manual-tariff-coverage';
import { supportsWan3TariffInputDuration, withWan3TariffInputDuration, resolveWan3TariffScenarioId } from '@/lib/pricing-audit/wan3-tariff-scenario';
import { ltx25AudioTariffBounds } from '@/lib/ltx25-audio-tariff';
import { withLtx25AudioTariffDuration, resolveLtx25AudioTariffScenarioId } from '@/lib/pricing-audit/ltx25-audio-tariff-scenario';
import { supportsOmniTariffMedia, withOmniTariffMedia, resolveOmniTariffScenarioId } from '@/lib/pricing-audit/omni-tariff-scenario';
import { loadPricingPolicyOverridesWithExecutor, loadPricingPolicyOverrides, type PricingPolicyOverrideLoadResult } from '@/lib/pricing-rule-store';
import { withDbTransaction, type TransactionQueryExecutor } from '@/lib/db';
import { computeCanonicalBillingSnapshot } from '@/server/pricing/quote-billing';
import { customerTariffsEnabledByCode, loadEffectiveCustomerTariffState, upsertCustomerTariffCell,
  deleteStagedCustomerTariffCell, validateCustomerTariffCell, type EffectiveCustomerTariffState } from '@/server/pricing/customer-tariff-store';

import { PricingAdminError } from './errors';
import { getPricingChangeEventById, insertPricingChangeEvent, listPricingChangeEvents } from './event-store';
import { loadPricingPolicyInventory } from './policy-read-model';
import { revalidateCustomerTariffChangeSurfaces } from './revalidation';
import { customerTariffCellId } from '@/server/pricing/customer-tariff-seed';
import { providerComparisonForTariffScenario } from './tariff-provider-comparison';
import { buildProviderCostComparisonRows, type ProviderCostComparisonInput } from './provider-cost-comparison';
import { continuousInputTariffDetail, continuousInputTariffIdentity, prepareContinuousInputTariffChange } from './continuous-input-tariff';
import type { CustomerTariffChangeConfirmation, CustomerTariffChangePreview,
  CustomerTariffChangeProposal, CustomerTariffInventory, CustomerTariffScenarioDetail,
  CustomerTariffScenarioChoice } from './customer-tariff-contract';

const SCENARIO_DIMENSIONS = ['mode', 'resolution', 'durationSec', 'aspectRatio', 'audio', 'quality',
  'referenceImageCount', 'inputImageCount', 'inputVideoDurationSec', 'inheritedDurationSec', 'inputAudioDurationSec',
  'referenceTokenBudget', 'billingInputType', 'voiceControl', 'loop', 'hdr', 'exrExport'] as const;

/** Resolve one supported exact selector while narrowing each subsequent control to valid options. */
export function chooseCustomerTariffScenario(
  scenarios: readonly ManualTariffCoverageScenario[], requested: Record<string, string>,
): { scenario: ManualTariffCoverageScenario; choices: CustomerTariffScenarioChoice[] } {
  if (!scenarios.length) throw new PricingAdminError('unsupported_scenario', 'This model has no supported tariff scenarios');
  let candidates = [...scenarios];
  const choices: CustomerTariffScenarioChoice[] = [];
  let decimalInputDuration: number | undefined;
  let decimalAudioDuration: number | undefined;
  let omniSource: number | undefined;
  let omniInherited: number | undefined;
  for (const key of SCENARIO_DIMENSIONS) {
    const audioBounds = ltx25AudioTariffBounds(candidates[0].modelId, candidates[0].selector.mode);
    const omni = supportsOmniTariffMedia(candidates[0].modelId, candidates[0].selector.mode);
    if (key === 'durationSec' && (audioBounds || (omni && candidates[0].selector.mode !== 'extend'))) continue;
    if (omni && ((key === 'inheritedDurationSec' && candidates[0].selector.mode === 'v2v')
      || (key === 'inputVideoDurationSec' && candidates[0].selector.mode === 'retake'))) continue;
    const options = [...new Set(candidates.map((scenario) => scenario.selector[key] ?? ''))]
      .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
    if (options.length === 1 && options[0] === '') continue;
    if (omni && (key === 'inputVideoDurationSec' || key === 'inheritedDurationSec')) {
      const value = requested[key] ?? (key === 'inputVideoDurationSec' && candidates[0].selector.mode === 'retake' ? '0' : options[0]);
      const seconds = value?.trim() ? Number(value) : NaN;
      const minimum = key === 'inheritedDurationSec' || candidates[0].selector.mode === 'v2v' ? 3 : Number.MIN_VALUE;
      if (!Number.isFinite(seconds) || seconds < minimum || seconds > 10) {
        throw new PricingAdminError('unsupported_scenario', 'Invalid Omni source/inherited duration');
      }
      if (key === 'inputVideoDurationSec') omniSource = seconds; else omniInherited = seconds;
      choices.push({ key, value: String(seconds), options: [], range: {
        ...(minimum === Number.MIN_VALUE ? { minExclusive: 0 } : { minInclusive: minimum }), max: 10 } });
      candidates = candidates.filter(candidate => (candidate.selector[key] ?? '') === options[0]);
      continue;
    }
    if (key === 'inputAudioDurationSec' && audioBounds) {
      try {
        const value = requested[key] ?? options[0];
        if (!value?.trim()) throw new Error('Audio duration required');
        decimalAudioDuration = Number(value);
        withLtx25AudioTariffDuration(candidates[0], decimalAudioDuration);
      } catch { throw new PricingAdminError('unsupported_scenario', 'Invalid source-audio duration'); }
      choices.push({ key, value: String(decimalAudioDuration), options: [], range: { minInclusive: audioBounds.min, max: audioBounds.max } });
      candidates = candidates.filter(candidate => candidate.selector[key] === options[0]);
      continue;
    }
    if (key === 'inputVideoDurationSec' && candidates.every(candidate =>
      supportsWan3TariffInputDuration(candidate.modelId, candidate.selector.mode))) {
      const requestedValue = requested[key] ?? (candidates[0].context.mode === 'ref2v' ? '0' : options[0]);
      try {
        if (!requestedValue?.trim()) throw new Error('Input-video duration is required');
        decimalInputDuration = Number(requestedValue);
        withWan3TariffInputDuration(candidates[0], decimalInputDuration);
      } catch { throw new PricingAdminError('unsupported_scenario', 'Input-video duration must be positive, at most 15 seconds, with input plus output at most 30 seconds'); }
      choices.push({ key, value: String(decimalInputDuration), options: [],
        range: { ...(candidates[0].context.mode === 'ref2v' ? { minInclusive: 0 } : { minExclusive: 0 }),
          max: Math.min(15, 30 - candidates[0].context.durationSec) } });
      candidates = candidates.filter(candidate => (candidate.selector[key] ?? '') === options[0]);
      continue;
    }
    const value = options.includes(requested[key] ?? '') ? (requested[key] ?? '') : options[0];
    if (value === undefined) throw new PricingAdminError('unsupported_scenario', 'No supported tariff selector');
    choices.push({ key, value, options });
    candidates = candidates.filter((scenario) => (scenario.selector[key] ?? '') === value);
  }
  if (candidates.length !== 1 || !candidates[0]) {
    throw new PricingAdminError('ambiguous_selector', 'Tariff selector does not resolve to one supported scenario');
  }
  return { scenario: omniSource !== undefined || omniInherited !== undefined ? withOmniTariffMedia(candidates[0], {
    inputVideoDurationSec: omniSource ?? 0, ...(omniInherited === undefined ? {} : { inheritedDurationSec: omniInherited }) })
    : decimalAudioDuration !== undefined ? withLtx25AudioTariffDuration(candidates[0], decimalAudioDuration)
    : decimalInputDuration === undefined ? candidates[0] : withWan3TariffInputDuration(candidates[0], decimalInputDuration), choices };
}

export async function loadCustomerTariffScenarioDetail(
  modelId: string, requested: Record<string, string>,
): Promise<CustomerTariffScenarioDetail> {
  const coverage = collectSellableManualTariffCoverage();
  const options = coverage.scenarios.filter((scenario) => scenario.modelId === modelId);
  const { scenario, choices } = chooseCustomerTariffScenario(options, requested);
  const [state, policy] = await Promise.all([loadEffectiveCustomerTariffState(), loadPricingPolicyOverrides()]);
  let currentCents: number | null = null;
  let customerQuote: ProviderCostComparisonInput['customerQuote'] = null;
  try {
    const snapshot = await quoteCurrentSnapshot(scenario, policy, state);
    currentCents = snapshot.totalCents;
    const provenance = snapshot.meta?.pricingPolicy as { source?: unknown; sourceRuleId?: unknown } | undefined;
    if ((provenance?.source === 'database' || provenance?.source === 'versioned') && typeof provenance.sourceRuleId === 'string') {
      customerQuote = { totalCents: snapshot.totalCents, currency: snapshot.currency,
        source: provenance.source, ruleId: provenance.sourceRuleId,
        pricingMode: snapshot.meta?.pricingMode === 'manual_tariff' ? 'manual_tariff' : 'legacy_margin_rule' };
    }
  } catch { /* No numeric fallback for an unavailable live quote. */ }
  const staged = currentDatabaseCell(state, cellId(scenario));
  const [supplierComparison] = buildProviderCostComparisonRows([{ ...providerComparisonForTariffScenario(scenario), customerQuote }], new Date().toISOString());
  const continuousInputTariff = (supportsWan3TariffInputDuration(scenario.modelId, scenario.selector.mode)
    || ltx25AudioTariffBounds(scenario.modelId, scenario.selector.mode) || supportsOmniTariffMedia(scenario.modelId, scenario.selector.mode))
    ? await continuousInputTariffDetail(scenario, state, policy).catch(() => undefined) : undefined;
  return { modelId, scenarioId: scenario.id, tariffCellId: cellId(scenario), selector: scenario.selector, choices,
    currentCents, stagedCents: staged?.price.kind === 'fixed' ? staged.price.customerCents : null,
    currency: 'USD', supplierComparison, ...(continuousInputTariff ? { continuousInputTariff } : {}) };
}

function cellId(scenario: ManualTariffCoverageScenario): string {
  return customerTariffCellId(scenario.id);
}

function currentDatabaseCell(state: EffectiveCustomerTariffState, id: string): ManualTariffCell | null {
  if (state.status !== 'loaded') return null;
  const now = Date.now();
  return state.databaseCells.find((cell) => cell.id === id && Date.parse(cell.effectiveFrom) <= now &&
    (!cell.effectiveUntil || now < Date.parse(cell.effectiveUntil))) ?? null;
}

function scenarioById(id: string): ManualTariffCoverageScenario {
  const coverage = collectSellableManualTariffCoverage().scenarios;
  const modelId = new URLSearchParams(id.replaceAll('|', '&')).get('engineId');
  const scenario = coverage.find(candidate => candidate.modelId === modelId && candidate.id === id)
    ?? resolveWan3TariffScenarioId(coverage, id) ?? resolveLtx25AudioTariffScenarioId(coverage, id) ?? resolveOmniTariffScenarioId(coverage, id);
  if (!scenario) throw new PricingAdminError('unsupported_scenario', 'Unknown or unsupported tariff scenario');
  return scenario;
}

function loadedState(state: EffectiveCustomerTariffState): Extract<EffectiveCustomerTariffState, { status: 'loaded' }> {
  if (state.status !== 'loaded') throw new PricingAdminError('database_unavailable', 'Customer tariff database is unavailable');
  return state;
}

function loadedPolicy(policy: PricingPolicyOverrideLoadResult): Extract<PricingPolicyOverrideLoadResult, { status: 'loaded' }> {
  if (policy.status !== 'loaded') throw new PricingAdminError('database_unavailable', 'Effective pricing rules are unavailable');
  return policy;
}

function fingerprint(preview: Omit<CustomerTariffChangePreview, 'fingerprint'>, rules: PricingPolicyOverrideLoadResult): string {
  return createHash('sha256').update(JSON.stringify({
    scenarioId: preview.scenarioId, operation: preview.operation,
    currentCents: preview.currentCents, proposedCents: preview.proposedCents,
    revision: preview.revision, active: preview.active,
    previousCell: preview.previousCell, proposedCell: preview.proposedCell,
    rollbackEventId: preview.rollbackEventId, selector: preview.selector,
    rules: rules.status === 'loaded' ? rules.rules : [],
    continuousInputRange: preview.continuousInputRange,
  })).digest('hex');
}

async function quoteCurrentSnapshot(scenario: ManualTariffCoverageScenario, policy: PricingPolicyOverrideLoadResult,
  state: EffectiveCustomerTariffState) {
  const loaded = loadedPolicy(policy);
  const snapshot = await computeCanonicalBillingSnapshot(scenario.context, {
    pricingPolicy: { loadOverrides: async () => loaded },
    ...(state.status === 'loaded' || customerTariffsEnabledByCode()
      ? { loadCustomerTariffState: async () => state } : {}),
  });
  if (!Number.isSafeInteger(snapshot.totalCents) || snapshot.totalCents < 0) {
    throw new PricingAdminError('unsupported_scenario', 'The current scenario has no exact customer price');
  }
  return snapshot;
}

async function quoteCurrent(scenario: ManualTariffCoverageScenario, policy: PricingPolicyOverrideLoadResult,
  state: EffectiveCustomerTariffState): Promise<number> {
  return (await quoteCurrentSnapshot(scenario, policy, state)).totalCents;
}

export async function loadCustomerTariffInventory(): Promise<CustomerTariffInventory> {
  const [policyInventory, state] = await Promise.all([
    loadPricingPolicyInventory(), loadEffectiveCustomerTariffState(),
  ]);
  const coverage = collectSellableManualTariffCoverage();
  const byModel = new Map<string, ManualTariffCoverageScenario[]>();
  for (const scenario of coverage.scenarios) {
    const bucket = byModel.get(scenario.modelId) ?? [];
    bucket.push(scenario);
    byModel.set(scenario.modelId, bucket);
  }
  const rows = policyInventory.providerComparisons.map((comparison) => {
    const options = byModel.get(comparison.engineId) ?? [];
    const selected = options.find((candidate) => candidate.id === comparison.scenarioId);
    if (!selected) throw new PricingAdminError('unsupported_scenario', `No tariff scenario for ${comparison.engineId}`);
    const staged = currentDatabaseCell(state, cellId(selected));
    return {
      modelId: comparison.engineId,
      familyId: comparison.familyId ?? comparison.brandId,
      mediaType: comparison.mediaType,
      scenarioId: selected.id,
      selector: selected.selector,
      currentCents: comparison.customerQuote?.totalCents ?? null,
      currency: comparison.customerQuote?.currency ?? 'USD',
      stagedCents: staged?.price.kind === 'fixed' ? staged.price.customerCents : null,
      supplierListUsd: comparison.supplierList.amountUsd,
      supplierEffectiveUsd: comparison.supplierEffective.amountUsd,
      supplierObservedUsd: comparison.supplierObserved.amountUsd,
      supplierComparison: comparison,
    };
  });
  return {
    active: state.status === 'loaded' && state.active,
    revision: state.status === 'loaded' ? state.revision : null,
    databaseStatus: state.status,
    coverageGapCount: coverage.gaps.length,
    rows,
  };
}

async function buildPreview(
  proposal: CustomerTariffChangeProposal,
  stateInput: EffectiveCustomerTariffState,
  policy: PricingPolicyOverrideLoadResult,
  executor?: TransactionQueryExecutor,
): Promise<CustomerTariffChangePreview> {
  if (!proposal || !['create', 'update', 'delete', 'rollback'].includes(proposal.operation)) {
    throw new PricingAdminError('invalid_payload', 'Unsupported tariff operation');
  }
  if ('scope' in proposal && proposal.scope !== 'continuous_input') throw new PricingAdminError('invalid_payload', 'Unknown tariff scope');
  if ('customerCents' in proposal && (!Number.isSafeInteger(proposal.customerCents) || proposal.customerCents < 0)) {
    throw new PricingAdminError('invalid_number', 'Customer price must be a non-negative amount in cents');
  }
  if (proposal.operation === 'rollback' && (typeof proposal.eventId !== 'string' || !/^[0-9a-f-]{36}$/i.test(proposal.eventId))) {
    throw new PricingAdminError('invalid_payload', 'Rollback needs a pricing event ID');
  }
  const state = loadedState(stateInput);
  if (state.active && proposal.operation === 'delete') {
    throw new PricingAdminError('unsupported_scenario', 'Active customer tariffs cannot be deleted');
  }
  const scenario = scenarioById(proposal.scenarioId);
  const currentCents = await quoteCurrent(scenario, policy, state);
  if ('scope' in proposal && proposal.scope === 'continuous_input') {
    const prepared = await prepareContinuousInputTariffChange({ proposal, scenario, state, policy, executor });
    const previewBase = { ...prepared, operation: proposal.operation, scenarioId: scenario.id, modelId: scenario.modelId,
      currentCents, currency: 'USD', revision: state.revision, active: state.active,
      ...(proposal.operation === 'rollback' ? { rollbackEventId: proposal.eventId } : {}),
      warnings: [state.active ? 'Applies to all valid source durations for these output options. Exact exceptions retain precedence.'
        : 'Continuous source price prepared; live prices stay unchanged until the global parity gate passes.'],
    };
    if (state.active && prepared.proposedCell) {
      previewBase.proposedCents = await quoteCurrent(scenario, policy, { ...state,
        databaseCells: [...state.databaseCells.filter(cell => cell.id !== prepared.proposedCell!.id), prepared.proposedCell] });
    }
    return { ...previewBase, fingerprint: fingerprint(previewBase, policy) };
  }
  const id = cellId(scenario);
  const previousDatabaseCell = currentDatabaseCell(state, id);
  if (proposal.operation === 'create' && previousDatabaseCell ||
      (proposal.operation === 'update' || proposal.operation === 'delete') && !previousDatabaseCell) {
    throw new PricingAdminError('invalid_payload', 'Tariff operation does not match the current cell');
  }
  // The first DB override must retain the authored effective price for an append-only rollback.
  const previousCell = previousDatabaseCell ?? (state.active ? resolveManualTariffCell({
    selector: scenario.selector, at: new Date().toISOString(),
    databaseCells: state.databaseCells, versionedCells: state.versionedCells,
  }) : null);
  let proposedCents: number | null = 'customerCents' in proposal ? proposal.customerCents : null;
  if (proposal.operation === 'rollback') {
    const event = await getPricingChangeEventById(proposal.eventId, 'customer_tariff', executor);
    if (!event || event.targetId !== id || !event.affectedScenarioIds.includes(scenario.id)) {
      throw new PricingAdminError('missing_target', 'No matching tariff history event');
    }
    if (event.previousState != null) {
      if (!event.previousState || typeof event.previousState !== 'object' || Array.isArray(event.previousState)) {
        throw new PricingAdminError('invalid_payload', 'Historical tariff cell is invalid');
      }
      const historical = event.previousState as ManualTariffCell;
      if (historical.source !== 'versioned' && historical.source !== 'database') {
        throw new PricingAdminError('invalid_payload', 'Historical tariff source is invalid');
      }
      // Reuse structural validation without falsely relabeling versioned event provenance.
      validateCustomerTariffCell({ ...historical, source: 'database' });
      if ((historical.source === 'database' && historical.id !== id) ||
          Object.keys(historical.selector).length !== Object.keys(scenario.selector).length ||
          Object.entries(scenario.selector).some(([key, value]) => historical.selector[key] !== value) ||
          historical.price.kind !== 'fixed') {
        throw new PricingAdminError('invalid_payload', 'Historical tariff selector does not match');
      }
      proposedCents = historical.price.customerCents;
    }
    if (proposedCents === null && !previousCell) {
      throw new PricingAdminError('invalid_payload', 'No staged tariff exists to remove');
    }
  }
  if (state.active && proposedCents === null) {
    throw new PricingAdminError('unsupported_scenario', 'Active customer tariffs cannot be deleted by rollback');
  }
  const proposedCell: ManualTariffCell | null = proposedCents === null ? null : {
    id, selector: scenario.selector, source: 'database', version: state.revision + 1,
    currency: 'USD', effectiveFrom: previousCell?.effectiveFrom ?? '2026-09-29T00:00:00.000Z',
    price: { kind: 'fixed', customerCents: proposedCents },
  };
  if (state.active && proposedCell) {
    await quoteCurrent(scenario, policy, { ...state,
      databaseCells: [...state.databaseCells.filter((cell) => cell.id !== id), proposedCell] });
  }
  const previewBase = {
    operation: proposal.operation, scenarioId: scenario.id, modelId: scenario.modelId,
    selector: scenario.selector, currentCents, proposedCents,
    currency: 'USD', revision: state.revision, active: state.active,
    previousCell, proposedCell,
    ...(proposal.operation === 'rollback' ? { rollbackEventId: proposal.eventId } : {}),
    warnings: state.active ? [] : ['Tariffs are staged; live customer prices stay unchanged until the global parity gate passes.'],
  };
  return { ...previewBase, fingerprint: fingerprint(previewBase, policy) };
}

export async function previewCustomerTariffChange(proposal: CustomerTariffChangeProposal): Promise<CustomerTariffChangePreview> {
  const [state, policy] = await Promise.all([loadEffectiveCustomerTariffState(), loadPricingPolicyOverrides()]);
  return buildPreview(proposal, state, policy);
}

export async function confirmCustomerTariffChange(
  proposal: CustomerTariffChangeProposal, expectedFingerprint: string, actorId: string,
  revalidate: (modelId: string) => void = revalidateCustomerTariffChangeSurfaces,
): Promise<CustomerTariffChangeConfirmation> {
  if (!expectedFingerprint?.trim()) throw new PricingAdminError('preview_stale', 'Preview this tariff again');
  const committed = await withDbTransaction(async (executor: TransactionQueryExecutor) => {
    await executor.query('SELECT revision FROM app_customer_tariff_state WHERE singleton = TRUE FOR UPDATE');
    const policy = await loadPricingPolicyOverridesWithExecutor(executor, { lock: true });
    const state = await loadEffectiveCustomerTariffState(executor);
    const preview = await buildPreview(proposal, state, policy, executor);
    if (preview.fingerprint !== expectedFingerprint) {
      throw new PricingAdminError('preview_stale', 'Tariff preview changed; review the current price again');
    }
    const persistedCell = preview.proposedCell
      ? await upsertCustomerTariffCell(executor, preview.proposedCell, actorId) : null;
    const targetId = 'scope' in proposal && proposal.scope === 'continuous_input'
      ? continuousInputTariffIdentity(scenarioById(preview.scenarioId)).id : cellId(scenarioById(preview.scenarioId));
    const revision = persistedCell?.version ?? await deleteStagedCustomerTariffCell(executor, targetId);
    const event = await insertPricingChangeEvent(executor, {
      domain: 'customer_tariff', operation: proposal.operation,
      targetId, actorId,
      previousState: preview.previousCell as unknown as null | Record<string, string | number | boolean | null>,
      nextState: persistedCell as unknown as null | Record<string, string | number | boolean | null>,
      previewSummary: { fingerprint: preview.fingerprint, currentCents: preview.currentCents,
        proposedCents: preview.proposedCents, tariffRevision: revision, active: preview.active,
        ...(preview.rollbackEventId ? { rollbackEventId: preview.rollbackEventId } : {}) },
      affectedScenarioIds: [preview.scenarioId],
    });
    return { committed: true as const, revision, event, preview };
  });
  const operationalWarnings: string[] = [];
  if (committed.preview.active) {
    try { revalidate(committed.preview.modelId); }
    catch { operationalWarnings.push('Customer price saved; public page refresh failed. Retry page revalidation.'); }
  }
  return { ...committed, operationalWarnings };
}

export async function loadCustomerTariffHistory(targetId?: string) {
  return listPricingChangeEvents({ domain: 'customer_tariff', ...(targetId ? { targetId } : {}), limit: 100 });
}
