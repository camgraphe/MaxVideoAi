import { customerDisplayPrice, type CustomerDisplayPrice } from '@/lib/customer-price-presentation';
import { readOwnedSeedanceWorkflowView } from '@/server/seedance-workflow-view';
import type { CanonicalGenerationRequest } from './generation-types';
import type { GenerationPricingReadDependencies } from './generation-pricing-read';
import type { GenerationPricingReferenceContext, GenerationPricingResult } from './generation-pricing';

export type SeedanceWorkflowPrices = {
  draft: CustomerDisplayPrice | null;
  final: CustomerDisplayPrice | null;
  total: CustomerDisplayPrice | null;
  finalPriceStatus: 'current_estimate' | 'exact_quote' | 'unavailable';
  separateFinalQuoteRequired: true;
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
  if (request.seedanceWorkflow.step === 'final') {
    const view = await readOwnedSeedanceWorkflowView(userId,request.seedanceWorkflow.draftJobId);
    if (view && Number.isSafeInteger(view.draft.amountCents) && Number(view.draft.amountCents) >= 0) {
      draft = customerDisplayPrice(Number(view.draft.amountCents),view.draft.currency);
    }
  } else {
    try {
      const estimate = await deps.priceGeneration({ ...request, settings: { ...request.settings, resolution:'1080p' },
        seedanceWorkflow: { step:'final',draftJobId:'estimate-only' } },pricing.membershipTier,context);
      if (Number.isSafeInteger(estimate.priceCents) && estimate.priceCents >= 0 && /^[A-Z]{3}$/.test(estimate.currency)) {
        final = customerDisplayPrice(estimate.priceCents,estimate.currency);
        finalPriceStatus = 'current_estimate';
      }
    } catch { /* Missing final tariff is not a free finalization or a standard-price fallback. */ }
  }
  const sum = draft && final && draft.currency === final.currency ? draft.amountCents + final.amountCents : null;
  return { draft, final, total: sum !== null && Number.isSafeInteger(sum) ? customerDisplayPrice(sum,draft!.currency) : null,
    finalPriceStatus, separateFinalQuoteRequired:true };
}
