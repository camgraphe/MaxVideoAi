import { calculateGptImage26ListOutputComponents, GPT_IMAGE_26_PRICING_SOURCE } from '@/lib/image/gptImage26Pricing';
import { gptImage26TariffScenarios } from '@/lib/pricing-audit/manual-tariff-coverage';
import { customerTariffCellId } from '@/server/pricing/customer-tariff-seed';
import { isGptImageTariffBatchModelId, isSeedanceTariffBatchModelId, type TariffBatchModelId } from './contract';
import { batchSelectorKey } from './input';
import { klingBatchClasses, klingBatchSourceFacts, klingBatchUsage, type KlingBatchClass } from './kling';
import { gpt26RasterBatchClasses, gpt26RasterEnvelope } from './gpt26';
import { seedanceBatchClasses, seedanceBatchSourceFacts, seedanceBatchUsage } from './seedance';

/** All selectors come from the same canonical inventory used by billing. */
export function tariffBatchClasses(modelId: TariffBatchModelId): KlingBatchClass[] {
  if (isSeedanceTariffBatchModelId(modelId)) return seedanceBatchClasses(modelId);
  if (!isGptImageTariffBatchModelId(modelId)) return klingBatchClasses(modelId);
  return [...gptImage26TariffScenarios().filter(scenario => scenario.modelId === modelId).map(scenario => ({
    selector: scenario.selector, key: batchSelectorKey(scenario.selector), scenario, id: customerTariffCellId(scenario.id),
  })), ...gpt26RasterBatchClasses(modelId)].sort((a, b) => a.key.localeCompare(b.key));
}

export function tariffBatchSupplierCost(row: KlingBatchClass): { supplierListCents: number; supplierCostIncomplete?: true } {
  if (isSeedanceTariffBatchModelId(row.scenario.modelId)) return { supplierListCents: seedanceBatchUsage(row).supplierListCents };
  if (!isGptImageTariffBatchModelId(row.scenario.modelId)) return { supplierListCents: klingBatchUsage(row).supplierExactCents };
  const output = calculateGptImage26ListOutputComponents(row.scenario.context, 'USD');
  return { supplierListCents: output.partialListUsd * 100, supplierCostIncomplete: true };
}

/** Fingerprints bind the precise model-specific calculator and its incomplete-cost status. */
export function tariffBatchSourceFacts(modelId: TariffBatchModelId) {
  if (isSeedanceTariffBatchModelId(modelId)) return seedanceBatchSourceFacts(modelId);
  if (!isGptImageTariffBatchModelId(modelId)) return klingBatchSourceFacts(modelId);
  return { source: GPT_IMAGE_26_PRICING_SOURCE, sourceDate: '2026-11-05', costKind: 'partial-list-output-components',
    supplierCostIncomplete: true, rasterEnvelope: gpt26RasterEnvelope(), classes: tariffBatchClasses(modelId).map(row => ({ selector: row.selector,
      usage: calculateGptImage26ListOutputComponents(row.scenario.context, 'USD') })) };
}
