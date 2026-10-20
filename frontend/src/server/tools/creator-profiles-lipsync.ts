import type { PricingSnapshot } from '@maxvideoai/pricing';
import { quoteCreatorProviderBillingSnapshot } from '@/server/pricing/quote-creator';
import { resolveServerBillingPolicy, type ResolveServerPricingPolicyDependencies } from '@/server/pricing/resolve-pricing-policy';
import { AgentApiError } from '@/server/agent-api/errors';
import type { PreparedCreatorProfile } from './creator-profiles';
export { isCreatorLipVideoEnabled } from './creator-profiles';
export const CREATOR_LIP_SYNC_ENDPOINT='fal-ai/latentsync';
export function prepareCreatorLipSyncProvider(prepared:PreparedCreatorProfile) {
  const video=prepared.sources.find(source=>source.input.role==='source');const audio=prepared.sources.find(source=>source.input.role==='audio');
  if(prepared.profile.id!=='lip-video-latentsync-v1'||prepared.input.toolId!=='lip-sync'||prepared.input.settings.mode!=='video'||!video||!audio||video.facts.kind!=='video'||audio.facts.kind!=='audio'||audio.facts.durationSec==null||video.facts.durationSec==null||audio.facts.durationSec>video.facts.durationSec||Math.abs(video.facts.durationSec-audio.facts.durationSec)>0.001) throw new AgentApiError('PARAMETER_INVALID','Video and audio must have the same duration.');
  // No loop_mode: the duration precondition prevents the provider's extension behavior.
  return{endpoint:CREATOR_LIP_SYNC_ENDPOINT,input:{video_url:video.url,audio_url:audio.url}};
}
/** Published list cost. Execution remains disabled until billing/quality canary qualification. */
export async function quoteCreatorLipSync(durationSec:number,dependencies:{pricingPolicy?:ResolveServerPricingPolicyDependencies}={}):Promise<PricingSnapshot> {
  if(!Number.isFinite(durationSec)||durationSec<2||durationSec>20)throw new AgentApiError('PARAMETER_INVALID','Choose matching segments between 2 and 20 seconds.');
  const engineId='toolbox-lip-sync';
  const {policy,vendorAccountId}=await resolveServerBillingPolicy({engineId,mode:'latentsync',resolution:'source'},undefined,dependencies.pricingPolicy);
  if(policy.rule.engineId!==engineId||policy.rule.currency!=='USD')throw new AgentApiError('ENGINE_UNAVAILABLE','Lip Sync pricing is not configured.');
  return quoteCreatorProviderBillingSnapshot({toolId:'lip-sync',facts:{engineId,currency:'USD',vendorSubtotalExactCents:20,unit:'video',quantity:1},base:{seconds:durationSec,rate:0.2,unit:'video',amountCents:20},addons:[],vendorAccountId,meta:{surface:'tool',toolId:'lip-sync',profileId:'lip-video-latentsync-v1',providerCostKind:'list-reference',providerCostListUsd:0.2,providerCostSource:'https://fal.ai/models/fal-ai/latentsync',providerCostCheckedAt:'2026-10-19',ruleId:policy.sourceRuleId}});
}
