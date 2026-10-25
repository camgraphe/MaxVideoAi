import { buildBillingPricingFacts } from '@/lib/pricing-billing-facts';
import { buildManualTariffScenario, continuousInputTariffSelector } from '@/lib/pricing-manual-scenario';
import { MINIMAX_H3_MAX_ENGINE } from '@/src/config/fal-engines/minimax-h3-max';
import { resolveVideoOperationEngine } from '@/lib/video-operation';
import { h3OperationRate } from '@/lib/h3-source-operations';

/** Maintenance input only. Task6 compiles current canonical policy into frozen bands and
 * binds review/application to the active revision. Nothing here writes or activates tariffs. */
export function prepareH3OperationTariffFacts() {
  return (['h3-recast','h3-relight'] as const).flatMap(operation => {
    const engine=resolveVideoOperationEngine(MINIMAX_H3_MAX_ENGINE,'v2v',operation);
    return engine.modeCaps!.v2v!.resolution!.map(resolution=>{
      const context={engine,mode:'v2v' as const,operation,resolution,durationSec:operation==='h3-recast'?5:124/24};
      const facts=buildBillingPricingFacts(context,engine.pricingDetails,'USD');
      const scenario=buildManualTariffScenario(context,facts.facts);
      return {selector:continuousInputTariffSelector(scenario.selector)!,
        sourceQuantity:{unit:'input_video_seconds' as const,min:operation==='h3-recast'?5:56/24,max:operation==='h3-recast'?30:15},
        supplierReference:{centsPerSecond:h3OperationRate(operation,resolution),sourceUrl:`https://fal.ai/models/minimax/h3-max/${operation.slice(3)}`,checkedAt:'2026-10-24',effectiveSupplierChargeVerified:false},
        canonicalFacts: facts.facts, customerPrice:null, activationReady:false,
        requiredPreparation:'Compile canonical current-policy customer-cent transitions using compileBoundedUnitBands; freeze literals before runtime.'};
    });
  });
}
