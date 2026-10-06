import {z} from 'zod';
import {studioProviderReservation} from '../assistance-provider-facts';
import {quoteCanonicalPricing} from '@maxvideoai/pricing';

const rate=z.number().int().positive().max(1_000_000_000);
const bounds={maxInputTokens:z.number().int().min(1024).max(128_000),maxOutputTokens:z.number().int().min(256).max(2200)};
export const studioAnalysisPolicySchema=z.object({
  version:z.string().min(1).max(128),processingNanoUsdPerSecond:z.number().int().nonnegative().max(1_000_000_000),processingBaseNanoUsd:z.number().int().nonnegative().max(1_000_000_000).optional(),marginPercent:z.number().min(0).max(10),
  video:z.object(bounds).strict().nullable(),
  audio:z.object({...bounds,rateVersion:z.string().min(1).max(128),textInputNanoUsd:rate,audioInputNanoUsd:rate,textOutputNanoUsd:rate}).strict().nullable(),
}).strict().refine(policy=>policy.video||policy.audio,'Qualify at least one profile.');
export type StudioAnalysisPolicy=z.infer<typeof studioAnalysisPolicySchema>;
/** Activation requires a separately approved measured policy, including local processing. */
export function studioAnalysisPolicy(env:NodeJS.ProcessEnv=process.env):StudioAnalysisPolicy|null {
  if(env.STUDIO_MEDIA_ANALYSIS_ENABLED!=='true'||!env.STUDIO_MEDIA_ANALYSIS_APPROVED_POLICY)return null;
  try {const value=studioAnalysisPolicySchema.parse(JSON.parse(env.STUDIO_MEDIA_ANALYSIS_POLICY_JSON??''));return value.version===env.STUDIO_MEDIA_ANALYSIS_APPROVED_POLICY?value:null;}catch{return null;}
}
export function priceStudioAnalysis(policy:StudioAnalysisPolicy,durationSec:number,providerNanoUsd:number) {
  if(!Number.isFinite(durationSec)||durationSec<=0||durationSec>60||!Number.isSafeInteger(providerNanoUsd)||providerNanoUsd<0)throw new Error('INVALID_ANALYSIS_COST');
  const processingNanoUsd=(policy.processingBaseNanoUsd??0)+Math.ceil(durationSec*policy.processingNanoUsdPerSecond),supplierNanoUsd=providerNanoUsd+processingNanoUsd;
  if(!Number.isSafeInteger(supplierNanoUsd))throw new Error('INVALID_ANALYSIS_COST');
  const id=policy.version;
  const price=quoteCanonicalPricing({facts:{engineId:'studio-media-analysis',currency:'USD',vendorSubtotalExactCents:supplierNanoUsd/10_000_000,unit:'analysis',quantity:1},
    scenario:{id,engineId:'studio-media-analysis',membershipTier:'member',discountPercent:0},
    policy:{source:'versioned',matchedBy:'engine',sourceRuleId:id,rule:{id,engineId:'studio-media-analysis',marginPercent:policy.marginPercent,marginFlatCents:0,surchargeAudioPercent:0,surchargeUpscalePercent:0,currency:'USD'}},
    compatibilityProfile:{id:'studio-analysis-v1',vendorSubtotalRounding:'preserve',marginRounding:'down',surchargeRounding:'down',discountRounding:'down',subtotalRounding:'up',totalRounding:'up'}});
  return {credits:price.customerTotalCents*10,cents:price.customerTotalCents,supplierNanoUsd,processingNanoUsd};
}
export function quoteStudioAnalysis(policy:StudioAnalysisPolicy,kind:'video'|'audio',durationSec:number) {
  const profile=policy[kind];if(!profile)throw new Error('ANALYSIS_PROFILE_UNAVAILABLE');
  const providerNanoUsd=kind==='video'?studioProviderReservation('gpt-6.1-sol',profile.maxInputTokens,profile.maxOutputTokens)
    : policy.audio!.maxInputTokens*Math.max(policy.audio!.textInputNanoUsd,policy.audio!.audioInputNanoUsd)+policy.audio!.maxOutputTokens*policy.audio!.textOutputNanoUsd;
  const priced=priceStudioAnalysis(policy,durationSec,providerNanoUsd);
  return {maxCredits:Math.max(10,priced.credits),reservedCents:Math.max(1,priced.cents),reservedSupplierNanoUsd:priced.supplierNanoUsd};
}
