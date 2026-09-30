import { getFalEngineById } from '@/config/falEngines';
import type { ManualTariffCoverageScenario } from '@/lib/pricing-audit/manual-tariff-coverage';
import { buildManualTariffScenario } from '@/lib/pricing-manual-scenario';
import { buildBillingPricingFacts } from '@/lib/pricing-billing-facts';
import { isGptImage25EngineId } from '@/lib/image/gptImage2';
import { isLumaAgentsImageEngineId } from '@/lib/luma-agents';
import { isMinimaxH3EngineId } from '@/lib/minimax-h3';

/** Admin navigation for bounded, already-priced references; the captured baseline remains immutable. */
export function expandAdminTariffReferenceOptions(scenarios: readonly ManualTariffCoverageScenario[]): ManualTariffCoverageScenario[] {
  return scenarios.flatMap(scenario => {
    const { modelId, context } = scenario;
    const gptEdit = isGptImage25EngineId(modelId) && context.mode === 'i2i';
    const lumaImage = isLumaAgentsImageEngineId(modelId) && ['t2i', 'i2i'].includes(context.mode ?? '');
    const h3References = isMinimaxH3EngineId(modelId) && context.mode === 'ref2v';
    if (!gptEdit && !lumaImage && !h3References) return [scenario];
    const schema = getFalEngineById(modelId)?.engine.inputSchema;
    const field = [...(schema?.required ?? []), ...(schema?.optional ?? [])].find(field =>
      field.id === (h3References ? 'reference_image_urls' : 'image_urls')
      && (!field.modes || field.modes.includes(context.mode!)));
    const max = lumaImage
      ? Number(schema?.constraints?.[context.mode === 'i2i' ? 'maxReferenceImagesEdit' : 'maxReferenceImagesTextToImage'])
      : field?.maxCount;
    const min = lumaImage ? 0 : Math.max(1, field?.minCount ?? 1);
    if (!Number.isSafeInteger(max) || max! < min || max! > 32) return [scenario];
    return Array.from({ length: max! - min + 1 }, (_, index) => {
      const referenceImageCount = min + index;
      const selectedContext = { ...context, referenceImageCount };
      const facts = buildBillingPricingFacts(selectedContext, selectedContext.engine.pricingDetails, 'USD').facts;
      const { selector, quantities } = buildManualTariffScenario(selectedContext, facts);
      const id = Object.entries(selector).map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('|');
      return { ...scenario, id, selector, quantities, context: selectedContext };
    });
  });
}
