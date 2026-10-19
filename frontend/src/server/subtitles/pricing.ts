import type {QueryExecutor} from '@/lib/db';
import {loadPricingPolicyOverridesWithExecutor} from '@/lib/pricing-rule-store';
import {timelineExportManifestHash} from '../timeline-exports/estimate-token';
import {estimateTimelineExportPrice} from '../timeline-exports/pricing';
import {assertSubtitleRenderFacts} from './media';
import type {SubtitleOperationRecord,SubtitleOperationRequest,SubtitlePricing} from './jobs';
export function subtitleExportPrice(facts:SubtitleOperationRequest['facts']){
  assertSubtitleRenderFacts(facts);
  const resolution=Math.min(facts.width,facts.height)>=2160?'4k':Math.min(facts.width,facts.height)>=1080?'1080p':'720p';
  return estimateTimelineExportPrice({durationSec:facts.durationMs/1000,resolution,fps:facts.fps,qualityPreset:'standard',freeExportsRemaining:0});
}
export function subtitleMixPricing(transcription:SubtitlePricing,facts:SubtitleOperationRequest['facts']):SubtitlePricing{
  const mix=subtitleExportPrice(facts);
  return {totalCents:transcription.totalCents+mix.amountCents,currency:'USD',source:'subtitle-transcription-and-mix',transcription,mixPreparation:{...mix,source:'timeline-export-paid-policy',qualityPreset:'standard'},breakdown:{transcription:{amountCents:transcription.totalCents,currency:transcription.currency},mixPreparation:{amountCents:mix.amountCents,currency:mix.currency,source:'timeline-export-paid-policy'}}};
}
export async function revalidateSubtitlePricing(operation:SubtitleOperationRecord,executor:QueryExecutor){
  const request=operation.request_snapshot;let current:SubtitlePricing;
  if(operation.operation_kind==='render'){
    const price=subtitleExportPrice(request.facts);current={totalCents:price.amountCents,currency:price.currency,source:'timeline-export-paid-policy',qualityPreset:'standard'};
  }else{
    const {quoteSubtitleTranscription}=await import('../tools/creator-subtitle-pricing');
    const transcription={...await quoteSubtitleTranscription({durationSec:request.facts.durationMs/1000,keyterms:request.settings.keyterms},{pricingPolicy:{loadOverrides:()=>loadPricingPolicyOverridesWithExecutor(executor,{lock:true})}})};
    current=operation.operation_kind==='mix-transcribe'?subtitleMixPricing(transcription,request.facts):transcription;
  }
  if(timelineExportManifestHash(current)!==timelineExportManifestHash(operation.pricing_snapshot))throw new Error('SUBTITLE_QUOTE_EXPIRED');
}
