import type {QueryExecutor} from '@/lib/db';
import {loadPricingPolicyOverridesWithExecutor} from '@/lib/pricing-rule-store';
import {timelineExportManifestHash} from '../timeline-exports/estimate-token';
import {assertSubtitleRenderFacts} from './media';
import type {SubtitleOperationRecord,SubtitleOperationRequest,SubtitlePricing} from './jobs';
export function subtitleExportPrice(facts:SubtitleOperationRequest['facts']){
  assertSubtitleRenderFacts(facts);
  return {amountCents:0,currency:'USD',included:true,source:'subtitle-export-included-v1'} as const;
}
export function subtitleExportPricing(facts:SubtitleOperationRequest['facts']):SubtitlePricing{
  const price=subtitleExportPrice(facts);
  return {totalCents:price.amountCents,currency:price.currency,source:price.source,qualityPreset:'standard',processing:'included'};
}
export function isIncludedSubtitleExport(pricing:SubtitlePricing):boolean{
  return pricing.totalCents===0&&pricing.currency==='USD'&&pricing.source==='subtitle-export-included-v1'&&pricing.processing==='included';
}
export function subtitleMixPricing(transcription:SubtitlePricing,facts:SubtitleOperationRequest['facts']):SubtitlePricing{
  const mix=subtitleExportPrice(facts);
  return {totalCents:transcription.totalCents,currency:'USD',source:'subtitle-transcription-includes-processing-v1',transcription,mixPreparation:{...mix,source:'subtitle-mix-included-v1',qualityPreset:'standard'},breakdown:{transcription:{amountCents:transcription.totalCents,currency:transcription.currency},mixPreparation:{amountCents:0,currency:mix.currency,source:'subtitle-mix-included-v1',included:true}}};
}
export async function revalidateSubtitlePricing(operation:SubtitleOperationRecord,executor:QueryExecutor){
  const request=operation.request_snapshot;let current:SubtitlePricing;
  if(operation.operation_kind==='render'){
    current=subtitleExportPricing(request.facts);
  }else{
    const {quoteSubtitleTranscription}=await import('../tools/creator-subtitle-pricing');
    const transcription={...await quoteSubtitleTranscription({durationSec:request.facts.durationMs/1000,keyterms:request.settings.keyterms},{pricingPolicy:{loadOverrides:()=>loadPricingPolicyOverridesWithExecutor(executor,{lock:true})}})};
    current=operation.operation_kind==='mix-transcribe'?subtitleMixPricing(transcription,request.facts):transcription;
  }
  if(timelineExportManifestHash(current)!==timelineExportManifestHash(operation.pricing_snapshot))throw new Error('SUBTITLE_QUOTE_EXPIRED');
}
