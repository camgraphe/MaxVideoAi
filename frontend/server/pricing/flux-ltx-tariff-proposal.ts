import { createHash } from 'node:crypto';
import { quoteCanonicalPricing } from '@maxvideoai/pricing';
import { getFalEngineById } from '@/config/falEngines';
import { resolveVideoOperationEngine } from '@/lib/video-operation';
import { fluxLtxDurationBounds } from '@/lib/flux-ltx-operations';
import { buildBillingPricingFacts } from '@/lib/pricing-billing-facts';
import { buildManualTariffScenario,continuousInputTariffSelector } from '@/lib/pricing-manual-scenario';
import { getVersionedPricingPolicy } from '@/lib/pricing-policy-defaults';
import type { PricingContext } from '@/lib/pricing-context';
import type { PricingPolicyOverrideLoadResult } from '@/lib/pricing-rule-store';
import { resolveServerBillingPolicy } from './resolve-pricing-policy';
import type { EffectiveCustomerTariffState } from './customer-tariff-store';
export const FLUX_LTX_SOURCE_TARIFF_CLASSES=[
 {engineId:'flux-3',mode:'v2v',operation:'flux-fast-edit',resolution:'720p'},
 {engineId:'flux-3-draft',mode:'v2v',operation:'flux-draft-enhance',resolution:'1080p'},
 {engineId:'ltx-2-3',mode:'reframe',operation:'ltx23-reframe',resolution:'720p'},
 {engineId:'ltx-2-3',mode:'reframe',operation:'ltx23-reframe',resolution:'1080p'},
] as const;
/** Maintenance-only factual/current-policy proposal. Continuous bands are compiled by
 * the separately reviewed activation owner; examples do not establish domain coverage. */
export async function prepareFluxLtxTariffProposal(input:{state:EffectiveCustomerTariffState;policy:PricingPolicyOverrideLoadResult}) {
 if(input.state.status!=='loaded'||!input.state.active||input.policy.status!=='loaded')throw new Error('Loaded active tariffs and effective policy are required.');
 const standard=getVersionedPricingPolicy().compatibilityProfiles.find(p=>p.id==='standard')!;
 async function quote(context:PricingContext){
  const billing=buildBillingPricingFacts(context,context.engine.pricingDetails,'USD');
  const {policy}=await resolveServerBillingPolicy({engineId:context.engine.id,mode:context.mode,resolution:context.resolution},undefined,{loadOverrides:async()=>input.policy});
  if(policy.rule.compatibilityProfile&&policy.rule.compatibilityProfile!=='standard')throw new Error('This proposal requires the reviewed standard rounding policy.');
  const result=quoteCanonicalPricing({facts:billing.facts,policy,compatibilityProfile:standard,scenario:{id:'flux-ltx-proposal',engineId:context.engine.id,mode:context.mode,resolution:context.resolution,membershipTier:'member',discountPercent:0}});
  return{selector:buildManualTariffScenario(context,billing.facts).selector,seconds:context.durationSec,supplierReferenceCents:billing.facts.vendorSubtotalExactCents,customerCents:result.customerTotalCents};
 }
 const continuous=[];
 for(const definition of FLUX_LTX_SOURCE_TARIFF_CLASSES){
  const engine=resolveVideoOperationEngine(getFalEngineById(definition.engineId)!.engine,definition.mode,definition.operation);
  const context={engine,...definition,durationSec:5};const first=await quote(context),bounds=fluxLtxDurationBounds(definition.operation);
  const examples=[first,await quote({...context,durationSec:10.041667}),...(definition.operation==='flux-draft-enhance'?[await quote({...context,durationSec:20+1/24}),await quote({...context,durationSec:20.04})]:[])];
  continuous.push({selector:continuousInputTariffSelector(first.selector)!,domain:{minimum:0,minimumExclusive:true,maximum:bounds.max,maximumExclusive:bounds.maxExclusive},unit:'input_video_seconds',quantityPolicy:definition.operation==='flux-draft-enhance'?'measured_owned_native_draft_up_to_21s_v1':'measured_owned_source_seconds_v1',examples,price:null,requiresWholeDomainCompilation:true,activationReady:false});
 }
 const fixed=[];
 for(const engineId of ['flux-3','flux-3-draft'])for(const resolution of engineId==='flux-3'?['720p','1080p']:['720p'])for(let durationSec=5;durationSec<=20;durationSec++){
  const result=await quote({engine:getFalEngineById(engineId)!.engine,mode:'ref2v',operation:'flux-keyframes',resolution,durationSec});
  fixed.push({...result,price:{kind:'fixed' as const,customerCents:result.customerCents},quantityPolicy:'explicit_requested_seconds_single_output',activationReady:false});
 }
 const proposal={sourceRevision:input.state.revision,continuous,fixed,providerEvidenceDate:'2026-10-24',supplierInvoiceQuantityVerified:false,writes:false,activationReady:false};
 return {...proposal,fingerprint:createHash('sha256').update(JSON.stringify({state:input.state,policy:input.policy,proposal})).digest('hex')};
}
