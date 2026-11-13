import type { ManualTariffPrice } from '@maxvideoai/pricing';
import { buildManualTariffCoverageScenario } from '@/lib/pricing-audit/manual-tariff-coverage';
import { estimateBytePlusBillableTokens } from '@/server/byteplus-accounting';
import { getBytePlusVideoListRate } from '@/server/byteplus-list-tariff';
import { seedanceInputTariffBasis, seedanceInputTariffRate } from '@/server/pricing/seedance-input-tariff';
import { prepareSeedance25CommercialTariffs } from '@/server/pricing/seedance25-commercial-tariffs';
import { resolveBytePlusTransport } from '@/server/video-providers/byteplus-modelark-transport';
import { TARIFF_BATCH_MAX_CLASSES, type SeedanceTariffBatchModelId, type TariffBatchProposal } from './contract';
import type { KlingBatchClass } from './kling';
import { batchSelectorKey } from './input';

/** Exact JSON imports use the existing admin preview/confirm/receipt/refresh flow. */
export function prepareSeedanceAdminBatches(modelId: SeedanceTariffBatchModelId): TariffBatchProposal[] {
  const plan = prepareSeedance25CommercialTariffs({ modelId, at: '2026-11-13T00:00:00Z', standardEditTransport: 'modelark' });
  const batches: TariffBatchProposal[] = [];
  for (let offset = 0; offset < plan.cells.length; offset += TARIFF_BATCH_MAX_CLASSES) {
    batches.push({ schemaVersion: 1, modelId, intent: modelId === 'seedance-2-5' ? 'replace_selected' : 'create_missing',
      reason: `${modelId}: public BytePlus LIST ×${plan.multiplier}; approved 2026-11-13; part ${batches.length + 1}`,
      pricing: { kind: 'explicit' }, selections: plan.cells.slice(offset, offset + TARIFF_BATCH_MAX_CLASSES)
        .map(({ selector, price }) => ({ selector, price: price as import('./contract').TariffBatchPrice })) });
  }
  return batches;
}

export function seedanceBatchClasses(modelId: SeedanceTariffBatchModelId): KlingBatchClass[] {
  if (resolveBytePlusTransport(modelId, 'v2v') !== 'modelark') throw new Error('Seedance batch prices require the reviewed ModelArk transport.');
  return prepareSeedance25CommercialTariffs({ modelId, at: '2026-11-13T00:00:00Z', standardEditTransport: 'modelark' })
    .scenarios.map(({ context, cell }) => ({ selector: cell.selector, key: batchSelectorKey(cell.selector), id: cell.id,
      scenario: buildManualTariffCoverageScenario(context, cell.id) })).sort((a, b) => a.key.localeCompare(b.key));
}

export function seedanceBatchUsage(row: KlingBatchClass, inputSeconds = row.scenario.context.inputVideoDurationSec) {
  const context = row.scenario.context;
  const billingInputType = context.hasVideoInput ? 'video_input' : 'no_video_input';
  const estimate = estimateBytePlusBillableTokens({ engineId: context.engine.id, durationSec: context.durationSec,
    resolution: context.resolution, aspectRatio: context.aspectRatio, billingInputType, inputVideoDurationSec: inputSeconds });
  if (!estimate) throw new Error('Verified Seedance supplier usage is required.');
  const rate = getBytePlusVideoListRate({ profile: context.engine.id === 'seedance-2-5-flash' ? 'seedance25Flash' : 'seedance25',
    resolution: context.resolution, billingInputType });
  return { supplierListCents: estimate.tokenCount * rate.unitPriceUsdPer1kTokens / 10, estimate, rate };
}

/** Both supplier and retail use the same minimum and linear slope. A retail slope
 * at least LIST proves nonnegative gross over the whole fractional-second domain;
 * upward cent rounding preserves that ordering. No sampled-domain relaxation.
 */
export function validateSeedanceBatchDomain(row: KlingBatchClass, price: ManualTariffPrice) {
  // Draft/final use the same ModelArk token minimum; their selectors remain separate.
  const context = { ...row.scenario.context, workflowStep: undefined };
  const basis = seedanceInputTariffBasis(context);
  const retailRate = seedanceInputTariffRate(context, price);
  const usage = seedanceBatchUsage(row, Number.MIN_VALUE);
  const supplierRate = usage.estimate.width * usage.estimate.height * 24 / 1024 * usage.rate.unitPriceUsdPer1kTokens / 10;
  if (retailRate < supplierRate) throw new Error('Seedance proportional price is below the published supplier rate.');
  return { maxInputSeconds: basis.maximum, checkedBoundaries: 2,
    minimumGrossCents: Math.floor(basis.minimumBillableSeconds * (retailRate - supplierRate)) };
}

export function seedanceBatchSourceFacts(modelId: SeedanceTariffBatchModelId) {
  return { transport: 'modelark', costKind: 'supplier_list',
    classes: seedanceBatchClasses(modelId).map(row => ({ selector: row.selector, usage: seedanceBatchUsage(row) })) };
}
