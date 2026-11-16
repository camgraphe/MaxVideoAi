import { createHash } from 'node:crypto';
import type { ManualTariffCell, ManualTariffPrice } from '@maxvideoai/pricing';
import { getBaseEngineIncludingHidden } from '@/lib/engines';
import type { PricingContext } from '@/lib/pricing-context';
import { buildManualTariffCoverageScenario } from '@/lib/pricing-audit/manual-tariff-coverage';
import { continuousInputTariffSelector } from '@/lib/pricing-manual-scenario';
import { SEEDANCE_REVIEWED_PRICING_ASPECTS } from '@/lib/seedance-option-pricing';
import { estimateBytePlusBillableTokens } from '@/server/byteplus-accounting';
import { getBytePlusVideoListRate } from '@/server/byteplus-list-tariff';
import { customerTariffCellId } from './customer-tariff-seed';

export type Seedance25CommercialModel = 'seedance-2-5' | 'seedance-2-5-flash';
/** Adrien's explicit decisions on 2026-11-13, including increases where needed. */
export const SEEDANCE25_COMMERCIAL_MULTIPLIERS = { 'seedance-2-5': 2, 'seedance-2-5-flash': 1.6 } as const;
export const SEEDANCE25_COMMERCIAL_POLICY = 'seedance25-list-2x-flash-1_6x-2026-11-13';

/** Authoring only. Runtime reads the resulting literal cells through canonical billing.
 * ModelArk is explicit: these prices must not silently replace a LAS transport tariff.
 * Provider usage remains authoritative; raster/minimum estimates are dated source facts.
 */
export function prepareSeedance25CommercialTariffs(input: {
  modelId: Seedance25CommercialModel; at: string; standardEditTransport: 'modelark';
}) {
  if (input.standardEditTransport !== 'modelark' || !Number.isFinite(Date.parse(input.at))
    || !Object.hasOwn(SEEDANCE25_COMMERCIAL_MULTIPLIERS, input.modelId)) throw new Error('An exact supported ModelArk release scope is required.');
  const engine = getBaseEngineIncludingHidden(input.modelId);
  if (!engine) throw new Error('Seedance commercial model is missing.');
  const flash = input.modelId === 'seedance-2-5-flash';
  const multiplier = SEEDANCE25_COMMERCIAL_MULTIPLIERS[input.modelId];
  const stages: Array<{ workflowStep?: 'draft' | 'final'; resolutions: string[] }> = [
    { resolutions: flash ? ['480p', '720p'] : ['480p', '720p', '1080p'] },
    ...(!flash ? [{ workflowStep: 'draft' as const, resolutions: ['480p'] },
      { workflowStep: 'final' as const, resolutions: ['1080p'] }] : []),
  ];
  const cells: ManualTariffCell[] = [];
  const scenarios: Array<{ context: PricingContext; cell: ManualTariffCell; supplierMinimumUsd: number }> = [];
  for (const stage of stages) for (const resolution of stage.resolutions) {
    for (const aspectRatio of SEEDANCE_REVIEWED_PRICING_ASPECTS) for (let durationSec = 4; durationSec <= 30; durationSec++) {
      for (const mode of ['t2v', 'i2v', 'ref2v', 'v2v', 'extend'] as const) {
        for (const hasVideoInput of mode === 'ref2v' ? [false, true] : [mode === 'v2v' || mode === 'extend']) {
          const context: PricingContext = { engine, mode, resolution, aspectRatio, durationSec, hasVideoInput,
            ...(hasVideoInput ? { inputVideoDurationSec: 2 } : {}),
            ...(stage.workflowStep ? { workflowStep: stage.workflowStep } : {}) };
          const billingInputType = hasVideoInput ? 'video_input' : 'no_video_input';
          const estimate = estimateBytePlusBillableTokens({ engineId: engine.id, durationSec, resolution, aspectRatio,
            billingInputType, ...(hasVideoInput ? { inputVideoDurationSec: Number.MIN_VALUE } : {}) });
          if (!estimate) throw new Error('An exact supported Seedance token estimate is required.');
          const rate = getBytePlusVideoListRate({ profile: flash ? 'seedance25Flash' : 'seedance25', resolution, billingInputType });
          const supplierMinimumUsd = estimate.tokenCount * rate.unitPriceUsdPer1kTokens / 1000;
          const retailCentsPerToken = rate.unitPriceUsdPer1kTokens * multiplier / 10;
          const tokensPerSecond = estimate.width * estimate.height * 24 / 1024;
          const price: ManualTariffPrice = hasVideoInput ? {
            kind: 'unit_components', rounding: 'up', components: [{ id: 'retail', rounding: 'none',
              flatCents: estimate.minimumTokens * retailCentsPerToken,
              terms: [{ unit: 'input_video_seconds', centsPerUnit: tokensPerSecond * retailCentsPerToken,
                includedUnits: estimate.minimumTokens / tokensPerSecond - durationSec }] }],
          } : { kind: 'fixed', customerCents: Math.ceil(estimate.tokenCount * retailCentsPerToken - 1e-9) };
          const scenario = buildManualTariffCoverageScenario(context, `${engine.id}:${stage.workflowStep ?? 'normal'}:${mode}`);
          const selector = hasVideoInput ? continuousInputTariffSelector(scenario.selector)! : scenario.selector;
          const identity = Object.entries(selector).map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('|');
          const cell: ManualTariffCell = { id: customerTariffCellId(identity), selector, price,
            source: 'database', currency: 'USD', version: 1, effectiveFrom: input.at };
          cells.push(cell);
          scenarios.push({ context, cell, supplierMinimumUsd });
        }
      }
    }
  }
  const key = (cell: ManualTariffCell) => JSON.stringify(Object.entries(cell.selector).sort(([a], [b]) => a.localeCompare(b)));
  if (new Set(cells.map(key)).size !== cells.length) throw new Error('Duplicate commercial tariff class.');
  const fingerprint = createHash('sha256').update(JSON.stringify({ policy: SEEDANCE25_COMMERCIAL_POLICY,
    modelId: input.modelId, multiplier, transport: input.standardEditTransport,
    cells: cells.map(({ selector, price, currency }) => ({ selector, price, currency })) })).digest('hex');
  return { policy: SEEDANCE25_COMMERCIAL_POLICY, modelId: input.modelId, multiplier,
    transport: input.standardEditTransport, fingerprint, cells, scenarios };
}
