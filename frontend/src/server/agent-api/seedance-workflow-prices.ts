import { customerDisplayPrice, type CustomerDisplayPrice } from '@/lib/customer-price-presentation';
import { readOwnedSeedanceWorkflowView } from '@/server/seedance-workflow-view';
import type { CanonicalGenerationRequest } from './generation-types';
import type { GenerationPricingReadDependencies } from './generation-pricing-read';
import type { GenerationPricingReferenceContext, GenerationPricingResult } from './generation-pricing';
import { SEEDANCE_FINAL_RESOLUTIONS, type SeedanceFinalResolution } from '@/lib/seedance-workflow-contract';

export type SeedanceWorkflowPrices = {
  draft: CustomerDisplayPrice | null;
  final: CustomerDisplayPrice | null;
  total: CustomerDisplayPrice | null;
  finalPriceStatus: 'current_estimate' | 'exact_quote' | 'unavailable';
  separateFinalQuoteRequired: true;
  finalResolution: SeedanceFinalResolution;
  finalOptions: Array<{ resolution: SeedanceFinalResolution; final: CustomerDisplayPrice | null; total: CustomerDisplayPrice | null; finalPriceStatus: SeedanceWorkflowPrices['finalPriceStatus'] }>;
};

/** Informational prices only; no extra quotes, reservation, debit or discount arithmetic. */
export async function readSeedanceWorkflowPrices(request: CanonicalGenerationRequest, userId: string,
  pricing: GenerationPricingResult, context: GenerationPricingReferenceContext,
  deps: Pick<GenerationPricingReadDependencies, 'priceGeneration'>): Promise<SeedanceWorkflowPrices | undefined> {
  if (!request.seedanceWorkflow) return undefined;
  const display = customerDisplayPrice(pricing.priceCents,pricing.currency);
  let draft: CustomerDisplayPrice | null = request.seedanceWorkflow.step === 'draft' ? display : null;
  let final: CustomerDisplayPrice | null = request.seedanceWorkflow.step === 'final' ? display : null;
  let finalPriceStatus: SeedanceWorkflowPrices['finalPriceStatus'] = final ? 'exact_quote' : 'unavailable';
  const finalResolution = request.seedanceWorkflow.step === 'final' && request.settings.resolution === '4k' ? '4k' : '1080p';
  const total = (price: CustomerDisplayPrice | null) => {
    const sum = draft && price && draft.currency === price.currency ? draft.amountCents + price.amountCents : null;
    return sum !== null && Number.isSafeInteger(sum) ? customerDisplayPrice(sum, draft!.currency) : null;
  };
  const finalOptions: SeedanceWorkflowPrices['finalOptions'] = [];
  if (request.seedanceWorkflow.step === 'final') {
    const view = await readOwnedSeedanceWorkflowView(userId,request.seedanceWorkflow.draftJobId);
    if (view && Number.isSafeInteger(view.draft.amountCents) && Number(view.draft.amountCents) >= 0) {
      draft = customerDisplayPrice(Number(view.draft.amountCents),view.draft.currency);
    }
  } else {
    for (const resolution of SEEDANCE_FINAL_RESOLUTIONS) {
      let price: CustomerDisplayPrice | null = null;
    try {
      const estimate = await deps.priceGeneration({ ...request, settings: { ...request.settings, resolution },
        seedanceWorkflow: { step:'final',draftJobId:'estimate-only' } },pricing.membershipTier,context);
      if (Number.isSafeInteger(estimate.priceCents) && estimate.priceCents >= 0 && /^[A-Z]{3}$/.test(estimate.currency)) {
        price = customerDisplayPrice(estimate.priceCents,estimate.currency);
      }
    } catch { /* Missing final tariff is not a free finalization or a standard-price fallback. */ }
      finalOptions.push({ resolution, final: price, total: total(price), finalPriceStatus: price ? 'current_estimate' : 'unavailable' });
    }
    final = finalOptions[0].final; finalPriceStatus = finalOptions[0].finalPriceStatus;
  }
  if (request.seedanceWorkflow.step === 'final') finalOptions.push({ resolution: finalResolution, final, total: total(final), finalPriceStatus });
  return { draft, final, total: total(final), finalResolution, finalOptions, finalPriceStatus, separateFinalQuoteRequired:true };
}
