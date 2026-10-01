import { createHash } from 'node:crypto';
import { resolveManualTariffCell, type ManualTariffCell, type ManualTariffSelector } from '@maxvideoai/pricing';
import { evaluateManualTariffPrice } from '@maxvideoai/pricing/src/manual-tariff-price';
import type { ManualTariffCoverageScenario } from '@/lib/pricing-audit/manual-tariff-coverage';
import { supportsSeedanceInputTariff } from '@/lib/seedance-input-tariff';
import { continuousInputTariffSelector } from '@/lib/pricing-manual-scenario';
import { normalBytePlusSupplierCost } from '@/server/byteplus-normal-cost';
import type { EffectiveCustomerTariffState } from './customer-tariff-store';
import { customerTariffCellId } from './customer-tariff-seed';
import { prepareSeedanceInputTariffPrice, validateSeedanceInputTariffDomain } from './seedance-input-tariff';

const key = (selector: ManualTariffSelector) => JSON.stringify(Object.entries(selector).sort(([a],[b]) => a.localeCompare(b)));
function indexed(cells: ManualTariffCell[]) {
  const index = new Map<string,ManualTariffCell[]>();
  for (const cell of cells) { const k = key(cell.selector); index.set(k,[...(index.get(k) ?? []),cell]); }
  return index;
}

/** Bounded authoring: copies the reviewed minimum margin into literal unit amounts. */
export async function prepareSeedanceInputTariffSeed(input: {
  scenarios: readonly ManualTariffCoverageScenario[]; state: EffectiveCustomerTariffState; at: string;
}) {
  if (input.state.status !== 'loaded' || !input.state.active || !Number.isFinite(Date.parse(input.at))) {
    throw new Error('Active reviewed customer tariffs are required.');
  }
  const state = input.state;
  const database = indexed(state.databaseCells), versioned = indexed(state.versionedCells);
  const amount = (selector: ManualTariffSelector, quantities: Record<string,number>) => {
    const cell = resolveManualTariffCell({ selector, at: input.at,
      databaseCells: database.get(key(selector)) ?? [], versionedCells: versioned.get(key(selector)) ?? [] });
    if (cell.currency !== 'USD') throw new Error('Reviewed USD tariffs are required.');
    return evaluateManualTariffPrice(cell.price,quantities).customerTotalCents;
  };
  const scenarios = input.scenarios.filter(s => !s.context.workflowStep
    && supportsSeedanceInputTariff(s.modelId,s.selector.mode,s.selector.billingInputType));
  if (!scenarios.length) throw new Error('Supported Seedance video-input scenarios are required.');
  const cells: ManualTariffCell[] = [], rows = [];
  const seen = new Set<string>(), validated = new Set<string>();
  for (const scenario of scenarios) {
    const selector = continuousInputTariffSelector(scenario.selector)!;
    const identity = key(selector);
    if (seen.has(identity)) throw new Error('Duplicate Seedance source tariff class.');
    seen.add(identity);
    if (database.has(identity) || versioned.has(identity)) throw new Error('Seedance source tariff already exists; edit it in the admin.');
    const { inputVideoDurationSec: _, ...oldSelector } = scenario.selector;
    const currentCustomerCents = amount(oldSelector,scenario.quantities);
    const minimumCost = normalBytePlusSupplierCost({ ...scenario.context, inputVideoDurationSec: Number.MIN_VALUE },input.at);
    if (!minimumCost) throw new Error('The selected execution provider has no current BytePlus supplier reference.');
    const needsAnchor = currentCustomerCents <= minimumCost.amountUsd * 100;
    const noVideoCustomerCents = needsAnchor ? amount({ ...oldSelector, billingInputType: 'no_video_input' },scenario.quantities) : undefined;
    const prepared = prepareSeedanceInputTariffPrice({ context: scenario.context, currentCustomerCents, noVideoCustomerCents, at: input.at });
    const maximumCost = normalBytePlusSupplierCost({ ...scenario.context, inputVideoDurationSec: prepared.maximum },input.at);
    const validationKey = JSON.stringify({ modelId: scenario.modelId, mode: scenario.selector.mode,
      duration: scenario.context.durationSec, resolution: scenario.context.resolution, aspect: scenario.context.aspectRatio,
      minimumCost: minimumCost.amountUsd, maximumCost: maximumCost?.amountUsd, price: prepared.price });
    if (!validated.has(validationKey)) {
      validateSeedanceInputTariffDomain({ context: scenario.context, price: prepared.price, at: input.at });
      validated.add(validationKey);
    }
    cells.push({ id: customerTariffCellId(Object.entries(selector).map(([k,v]) => `${k}=${encodeURIComponent(v)}`).join('|')),
      selector, source: 'database', version: 1, currency: 'USD', effectiveFrom: input.at, price: prepared.price });
    rows.push({ scenarioId: scenario.id, currentCustomerCents, minimumCustomerCents: prepared.minimumCustomerCents,
      marginSource: prepared.marginSource, marginPercent: prepared.marginPercent,
      minimumSupplierUsd: minimumCost.amountUsd, maximumSupplierUsd: maximumCost?.amountUsd,
      minimumBillableSeconds: prepared.minimumBillableSeconds });
  }
  const fingerprint = createHash('sha256').update(JSON.stringify({ revision: state.revision,
    sourceCells: [...state.databaseCells,...state.versionedCells].sort((a,b) => a.id.localeCompare(b.id) || a.version-b.version),
    cells: cells.map(({ id,selector,currency,price }) => ({ id,selector,currency,price })), rows })).digest('hex');
  return { fingerprint, sourceRevision: state.revision, cells, rows,
    correctedMinimumCount: rows.filter(row => row.marginSource === 'no_video_variant').length };
}
