import type { PricingSnapshot } from '@maxvideoai/pricing';
import { quoteCreatorProviderBillingSnapshot } from '@/server/pricing/quote-creator';
import { resolveServerBillingPolicy, type ResolveServerPricingPolicyDependencies } from '@/server/pricing/resolve-pricing-policy';
import { AgentApiError } from '@/server/agent-api/errors';
import type { PreparedCreatorProfile } from './creator-profiles';
export { isCreatorMotionControlEnabled } from './creator-profiles';

export const CREATOR_MOTION_ENDPOINT='fal-ai/kling-video/v3/standard/motion-control';
export function prepareCreatorMotionProvider(prepared:PreparedCreatorProfile) {
  const character=prepared.sources.find(source=>source.input.role==='source');
  const motion=prepared.sources.find(source=>source.input.role==='motion');
  if(prepared.profile.id!=='motion-kling-v3-v1'||prepared.input.toolId!=='motion-transfer'||character?.facts.kind!=='image'||motion?.facts.kind!=='video')throw new AgentApiError('PARAMETER_INVALID','Choose a character image and a performance video.');
  const maximum=prepared.input.settings.orientation==='image'?10:30;
  if(motion.facts.durationSec==null||motion.facts.durationSec<2||motion.facts.durationSec>maximum)throw new AgentApiError('PARAMETER_INVALID',`Choose an explicit performance segment between 2 and ${maximum} seconds.`);
  return {endpoint:CREATOR_MOTION_ENDPOINT,input:{image_url:character.url,video_url:motion.url,character_orientation:prepared.input.settings.orientation,prompt:prepared.input.settings.instruction,keep_original_sound:prepared.audioPolicy==='preserve'}};
}
/** Published list cost; no account billing or quality qualification is inferred from this estimate. */
export async function quoteCreatorMotion(durationSec:number,dependencies:{pricingPolicy?:ResolveServerPricingPolicyDependencies}={}):Promise<PricingSnapshot> {
  if(!Number.isFinite(durationSec)||durationSec<2||durationSec>30)throw new AgentApiError('PARAMETER_INVALID','Choose a performance segment between 2 and 30 seconds.');
  const engineId='toolbox-motion-control';
  const {policy,vendorAccountId}=await resolveServerBillingPolicy({engineId,mode:'kling-v3-standard-motion-control',resolution:'source'},undefined,dependencies.pricingPolicy);
  if(policy.rule.engineId!==engineId||policy.rule.currency!=='USD')throw new AgentApiError('ENGINE_UNAVAILABLE','Motion Control pricing is not configured.');
  const providerCostListUsd=Number((durationSec*0.126).toFixed(8));
  const vendorSubtotalExactCents=providerCostListUsd*100;
  return quoteCreatorProviderBillingSnapshot({toolId:'motion-transfer',facts:{engineId,currency:'USD',vendorSubtotalExactCents,unit:'second',quantity:durationSec},base:{seconds:durationSec,rate:0.126,unit:'second',amountCents:Math.round(vendorSubtotalExactCents)},addons:[],vendorAccountId,meta:{surface:'tool',toolId:'motion-transfer',profileId:'motion-kling-v3-v1',providerCostKind:'list-reference',providerCostListUsd,providerCostSource:'https://fal.ai/models/fal-ai/kling-video/v3/standard/motion-control',providerCostCheckedAt:'2026-10-19',ruleId:policy.sourceRuleId}});
}
