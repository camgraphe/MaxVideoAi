import { createHash } from 'node:crypto';
import { evaluateManualTariffPrice } from '@maxvideoai/pricing/src/manual-tariff-price';
import type { ManualTariffCell, ManualTariffSelector } from '@maxvideoai/pricing';
import { withDbTransaction } from '@/lib/db';
import { collectSellableManualTariffCoverage } from '@/lib/pricing-audit/manual-tariff-coverage';
import { continuousInputTariffSelector } from '@/lib/pricing-manual-scenario';
import { quoteSeedance25LasListCost, BYTEPLUS_LAS_LIST_PRICE_SOURCE, isSeedance25LasInputPricing } from '@/server/byteplus-las-tariff';
import { isBytePlusLasExecutionEnabled } from '@/server/video-providers/byteplus-modelark';
import { loadEffectiveCustomerTariffState, upsertCustomerTariffCell, type EffectiveCustomerTariffState } from '@/server/pricing/customer-tariff-store';
import { seedanceInputTariffPriceFromRate, validateSeedanceInputTariffDomain } from '@/server/pricing/seedance-input-tariff';
import { insertPricingChangeEvent } from './event-store';
import { PricingAdminError } from './errors';
import { revalidateCustomerTariffChangeSurfaces } from './revalidation';

const MODEL_ID = 'seedance-2-5';
const TARGET_CELL_COUNT = 324;
const POLICY = { customerMultiplier: 2.5, source: 'approved_seedance_2_5_launch_policy',
  supplierSource: BYTEPLUS_LAS_LIST_PRICE_SOURCE, rounding: 'ceil_cent' } as const;
const selectorKey = (selector: ManualTariffSelector) => JSON.stringify(Object.entries(selector).sort(([a], [b]) => a.localeCompare(b)));

/** Explicit authoring only. Runtime quotes never compute retail from supplier rates. */
export function prepareSeedance25LasTariffRelease(input: { state: EffectiveCustomerTariffState; at: string }) {
  if (!isSeedance25LasInputPricing(MODEL_ID, 'v2v')) {
    throw new PricingAdminError('unsupported_scenario', 'LAS Edit must be selected before a LAS tariff release.');
  }
  if (input.state.status !== 'loaded' || !input.state.active || !Number.isFinite(Date.parse(input.at))) {
    throw new PricingAdminError('unsupported_scenario', 'An active reviewed customer tariff grid is required.');
  }
  const state = input.state;
  const effectiveVersionedExceptions = state.versionedCells.filter(c => c.selector.engineId === MODEL_ID && c.selector.mode === 'v2v'
    && Date.parse(c.effectiveFrom) <= Date.parse(input.at) && (!c.effectiveUntil || Date.parse(input.at) < Date.parse(c.effectiveUntil))
    && c.selector.inputVideoDurationSec !== 'continuous');
  if (effectiveVersionedExceptions.length) {
    throw new PricingAdminError('unsupported_scenario', 'Review exact versioned Edit tariff exceptions before the LAS release.');
  }
  // The store projects closed database versions in databaseCells as well.
  // Keep them in the fingerprint, and author only the current open intervals.
  const allSourceCells = state.databaseCells.filter(c => c.selector.engineId === MODEL_ID && c.selector.mode === 'v2v');
  const sourceCells = allSourceCells.filter(c => !c.effectiveUntil);
  if (sourceCells.some(c => c.selector.inputVideoDurationSec !== 'continuous')) {
    throw new PricingAdminError('unsupported_scenario', 'Review exact Edit tariff exceptions before the LAS release.');
  }
  const source = new Map<string, ManualTariffCell>();
  for (const cell of sourceCells) {
    const key = selectorKey(cell.selector);
    if (source.has(key) || cell.currency !== 'USD' || cell.effectiveUntil || Date.parse(cell.effectiveFrom) > Date.parse(input.at)) {
      throw new PricingAdminError('unsupported_scenario', 'The current Edit tariff classes are ambiguous or unavailable.');
    }
    source.set(key, cell);
  }
  const scenarios = collectSellableManualTariffCoverage({ modelId: MODEL_ID, mode: 'v2v' }).scenarios
    .filter(s => ['480p', '720p'].includes(s.context.resolution));
  const cells: ManualTariffCell[] = [];
  const rows: { selector: ManualTariffSelector; previousSavedCustomerCents: number; proposedCustomerCents: number;
    supplierListUsd: number; sourceDurationSec: number }[] = [];
  const validated = new Set<string>();
  for (const scenario of scenarios) {
    const selector = continuousInputTariffSelector(scenario.selector);
    const previous = selector && source.get(selectorKey(selector));
    if (!selector || !previous) throw new PricingAdminError('missing_target', 'A current continuous Edit tariff class is missing.');
    const context = { ...scenario.context, inputVideoDurationSec: 4 };
    const cost = quoteSeedance25LasListCost({ resolution: context.resolution,
      outputDurationSec: context.durationSec, inputVideoDurationSec: 4 });
    if (!cost) throw new PricingAdminError('unsupported_scenario', 'The LAS supplier scenario is unsupported.');
    const rate = cost.unitPriceUsdPerSecond * 100 * POLICY.customerMultiplier;
    const price = seedanceInputTariffPriceFromRate(context, rate);
    // LAS billing is independent of aspect/audio. Validate each full duration
    // domain once, then retain every exact authored option in the batch.
    const domainKey = `${context.resolution}:${context.durationSec}:${rate}`;
    if (!validated.has(domainKey)) {
      validateSeedanceInputTariffDomain({ context, price, at: input.at });
      validated.add(domainKey);
    }
    cells.push({ ...previous, selector, version: state.revision + 1, price });
    rows.push({ selector, sourceDurationSec: 4, supplierListUsd: cost.amountUsd,
      previousSavedCustomerCents: evaluateManualTariffPrice(previous.price, { input_video_seconds: 4 }).customerTotalCents,
      proposedCustomerCents: evaluateManualTariffPrice(price, { input_video_seconds: 4 }).customerTotalCents });
  }
  if (cells.length !== TARGET_CELL_COUNT || new Set(cells.map(c => selectorKey(c.selector))).size !== TARGET_CELL_COUNT) {
    throw new PricingAdminError('unsupported_scenario', 'The complete 324-class LAS release requires a fresh review.');
  }
  const fingerprint = createHash('sha256').update(JSON.stringify({ policy: POLICY, revision: state.revision,
    source: sourceCells.sort((a, b) => a.id.localeCompare(b.id)),
    history: [...allSourceCells.filter(c => c.effectiveUntil), ...state.versionedCells.filter(c => c.selector.engineId === MODEL_ID && c.selector.mode === 'v2v')]
      .sort((a, b) => a.id.localeCompare(b.id) || a.version - b.version),
    proposed: cells.map(c => ({ id: c.id, selector: c.selector, price: c.price })),
  })).digest('hex');
  return { fingerprint, sourceRevision: state.revision, policy: POLICY, cells, rows };
}

export async function previewSeedance25LasTariffRelease() {
  return withDbTransaction(async executor => {
    await executor.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    return prepareSeedance25LasTariffRelease({ state: await loadEffectiveCustomerTariffState(executor), at: new Date().toISOString() });
  });
}

/** Bounded atomic correction; the ordinary store appends history for every cell. */
export async function confirmSeedance25LasTariffRelease(fingerprint: string, actorId: string,
  revalidate: (modelId: string) => void = revalidateCustomerTariffChangeSurfaces) {
  if (!/^[a-f0-9]{64}$/.test(fingerprint)) throw new PricingAdminError('preview_stale', 'Review the current LAS release first.');
  if (isBytePlusLasExecutionEnabled()) throw new PricingAdminError('unsupported_scenario', 'Disable new LAS submissions before this release.');
  const result = await withDbTransaction(async executor => {
    await executor.query('SELECT revision FROM app_customer_tariff_state WHERE singleton = TRUE FOR UPDATE');
    await executor.query('LOCK TABLE app_customer_tariff_cells IN SHARE ROW EXCLUSIVE MODE');
    const release = prepareSeedance25LasTariffRelease({ state: await loadEffectiveCustomerTariffState(executor), at: new Date().toISOString() });
    if (release.fingerprint !== fingerprint) throw new PricingAdminError('preview_stale', 'LAS source prices changed; review them again.');
    const previous = await loadEffectiveCustomerTariffState(executor);
    const persisted: ManualTariffCell[] = [];
    for (const cell of release.cells) persisted.push(await upsertCustomerTariffCell(executor, cell, actorId));
    const event = await insertPricingChangeEvent(executor, {
      domain: 'customer_tariff', operation: 'update', targetId: 'seedance-2-5:las-v2v-release', actorId,
      previousState: JSON.parse(JSON.stringify(previous.status === 'loaded'
        ? previous.databaseCells.filter(c => !c.effectiveUntil && release.cells.some(next => next.id === c.id)) : [])),
      nextState: JSON.parse(JSON.stringify(persisted)),
      previewSummary: { fingerprint, sourceRevision: release.sourceRevision, cellCount: persisted.length,
        policy: JSON.parse(JSON.stringify(POLICY)), executionActivated: false, otherModesChanged: false },
      affectedScenarioIds: release.cells.map(c => selectorKey(c.selector)),
    });
    return { committed: true, revision: persisted.at(-1)!.version, cellCount: persisted.length, eventId: event.id,
      executionActivated: false };
  });
  const operationalWarnings: string[] = [];
  try { revalidate(MODEL_ID); } catch { operationalWarnings.push('Prices saved; retry public page revalidation.'); }
  return { ...result, operationalWarnings };
}
