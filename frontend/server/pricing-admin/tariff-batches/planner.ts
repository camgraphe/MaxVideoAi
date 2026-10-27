import { ManualTariffError, resolveManualTariffCell, type ManualTariffCell } from '@maxvideoai/pricing';
import type { PricingPolicyOverrideLoadResult } from '@/lib/pricing-rule-store';
import { klingV4PricingUsage } from '@/lib/kling-v4-pricing';
import { validateCustomerTariffCell, type EffectiveCustomerTariffState } from '@/server/pricing/customer-tariff-store';
import { validateCurrentContinuousTariffDomain } from '@/server/pricing/compile-current-continuous-tariff';
import { computeCanonicalBillingSnapshot } from '@/server/pricing/quote-billing';
import { PricingAdminError } from '../errors';
import { batchSelectorKey, parseTariffBatchProposal } from './input';
import { compileKlingBatchPrice, klingBatchClasses, type KlingBatchClass } from './kling';
import type { TariffBatchPlan, TariffBatchProposal, TariffBatchReceipt, TariffBatchRow } from './contract';

export function stableBatchJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableBatchJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${stableBatchJson(v)}`).join(',')}}`;
  return JSON.stringify(value);
}
function currentCell(row: KlingBatchClass, state: Extract<EffectiveCustomerTariffState, { status: 'loaded' }>, at: string) {
  try { return resolveManualTariffCell({ selector: row.selector, at, databaseCells: state.databaseCells, versionedCells: state.versionedCells }); }
  catch (error) { if (error instanceof ManualTariffError && error.code === 'missing_cell') return null; throw error; }
}
function overlap(row: KlingBatchClass, cell: ManualTariffCell, at: string): boolean {
  return Date.parse(cell.effectiveFrom) <= Date.parse(at) && (!cell.effectiveUntil || Date.parse(at) < Date.parse(cell.effectiveUntil))
    && batchSelectorKey(cell.selector) !== row.key
    && Object.entries(row.selector).every(([key, value]) => value === 'continuous' ? cell.selector[key] !== undefined : cell.selector[key] === value);
}

/** Complete server snapshot in, reviewable plan out. No reads, writes or runtime policy changes. */
export async function buildTariffBatchPlan(input: {
  proposal: TariffBatchProposal; state: EffectiveCustomerTariffState; policy: PricingPolicyOverrideLoadResult;
  rollbackReceipt?: TariffBatchReceipt | null; at?: string;
}): Promise<TariffBatchPlan> {
  const proposal = parseTariffBatchProposal(input.proposal), { state, policy } = input;
  if (state.status !== 'loaded' || policy.status !== 'loaded') throw new PricingAdminError('database_unavailable', 'Current pricing snapshot unavailable.');
  if (!state.active) throw new PricingAdminError('unsupported_scenario', 'An active tariff registry is required.');
  const at = input.at ?? new Date().toISOString();
  const classes = klingBatchClasses(), byKey = new Map(classes.map(row => [row.key, row]));
  const index = (cells: ManualTariffCell[]) => {
    const grouped = new Map<string, ManualTariffCell[]>();
    for (const cell of cells) {
      const key = batchSelectorKey(cell.selector), bucket = grouped.get(key) ?? [];
      bucket.push(cell); grouped.set(key, bucket);
    }
    return grouped;
  };
  const databaseByKey = index(state.databaseCells), versionedByKey = index(state.versionedCells);
  // Noncanonical exact exceptions still participate in every relevant continuous
  // class check. Historical versions of ordinary classes need not be rescanned.
  const exceptions = [...databaseByKey, ...versionedByKey].filter(([key]) => !byKey.has(key)).flatMap(([, cells]) => cells);
  const selections = proposal.intent === 'rollback' ? proposal.selectors.map(selector => ({ selector, price: undefined })) : proposal.selections;
  const rows: TariffBatchRow[] = [];
  for (const selection of [...selections].sort((a, b) => batchSelectorKey(a.selector).localeCompare(batchSelectorKey(b.selector)))) {
    const key = batchSelectorKey(selection.selector), definition = byKey.get(key);
    if (!definition) throw new PricingAdminError('unsupported_scenario', 'Unsupported canonical tariff class.');
    const row: TariffBatchRow = { key, scenarioId: definition.scenario.id, selector: definition.selector,
      action: 'conflict', previousCell: null, proposedCell: null, currentCents: null, proposedCents: null,
      supplierListCents: klingV4PricingUsage(definition.scenario.context).supplierExactCents };
    rows.push(row);
    try {
      const selectedState = { ...state, databaseCells: databaseByKey.get(key) ?? [], versionedCells: versionedByKey.get(key) ?? [] };
      const previous = currentCell(definition, selectedState, at);
      row.previousCell = previous;
      const all = [...selectedState.databaseCells, ...selectedState.versionedCells, ...exceptions];
      if (previous?.effectiveUntil || all.some(cell => Date.parse(cell.effectiveFrom) > Date.parse(at)
        && (batchSelectorKey(cell.selector) === key || (definition.selector.billingInputType === 'video_input'
          && Object.entries(definition.selector).every(([name, value]) => value === 'continuous' ? cell.selector[name] !== undefined : cell.selector[name] === value))))) {
        throw new Error('A scheduled or future tariff requires explicit review.');
      }
      if (!previous && all.some(cell => batchSelectorKey(cell.selector) === key)) throw new Error('A closed or future tariff requires explicit review.');
      if (definition.selector.billingInputType === 'video_input' && all.some(cell => overlap(definition, cell, at))) {
        throw new Error('Review the exact tariff exception before changing this continuous class.');
      }
      if (previous && previous.currency !== 'USD') throw new Error('The current price currency is not USD.');
      if (previous) row.currentCents = (await computeCanonicalBillingSnapshot(definition.scenario.context, {
        loadCustomerTariffState: async () => selectedState, pricingPolicy: { loadOverrides: async () => policy },
      })).totalCents;
      let desired;
      if (proposal.intent === 'rollback') {
        const receipt = input.rollbackReceipt;
        const change = receipt?.operationId === proposal.sourceOperationId ? receipt.changes.find(c => c.key === key) : null;
        if (!change?.before) throw new Error('Active creations cannot be rolled back to absence.');
        if (!previous || stableBatchJson(previous) !== stableBatchJson(change.after)) throw new Error('This tariff changed since the selected operation.');
        desired = change.before.price;
        row.rollbackEventId = change.eventId;
      } else desired = proposal.pricing.kind === 'explicit' ? selection.price! : compileKlingBatchPrice(definition, proposal.pricing.multiplier);
      if (definition.selector.billingInputType === 'video_input') {
        row.domain = validateCurrentContinuousTariffDomain({ context: definition.scenario.context, price: desired });
      } else if (desired.kind !== 'fixed') throw new Error('A fixed class requires an exact fixed price.');
      const proposedCell: ManualTariffCell = { id: previous?.source === 'database' ? previous.id : definition.id,
        selector: definition.selector, source: 'database', version: state.revision + 1, currency: 'USD',
        effectiveFrom: previous?.effectiveFrom ?? '2026-10-01T00:00:00.000Z', price: desired };
      validateCustomerTariffCell(proposedCell);
      const candidate = { ...selectedState, databaseCells: [...selectedState.databaseCells.filter(cell => cell.id !== proposedCell.id), proposedCell] };
      const quote = await computeCanonicalBillingSnapshot(definition.scenario.context, {
        loadCustomerTariffState: async () => candidate, pricingPolicy: { loadOverrides: async () => policy },
      });
      if (quote.currency !== 'USD' || quote.meta?.customerTariffCellId !== proposedCell.id) throw new Error('The proposed tariff is masked by another current price.');
      row.proposedCell = proposedCell;
      row.proposedCents = quote.totalCents;
      if (previous && stableBatchJson(previous.price) === stableBatchJson(desired)) row.action = 'unchanged';
      else if (previous && proposal.intent === 'create_missing') throw new Error('The existing tariff differs from this missing-only proposal.');
      else if (!previous && proposal.intent !== 'create_missing') throw new Error('The selected replacement target is missing.');
      else row.action = previous ? 'update' : 'create';
    } catch (error) { row.issue = error instanceof Error ? error.message : 'The tariff class could not be verified.'; }
  }
  const counts = { create: 0, update: 0, unchanged: 0, conflict: 0 };
  for (const row of rows) counts[row.action]++;
  return { modelId: 'kling-v4', intent: proposal.intent, reason: proposal.reason, revision: state.revision,
    currency: 'USD', datePolicy: 'server_now_per_cell', fullScopeCount: classes.length, rows, counts };
}
