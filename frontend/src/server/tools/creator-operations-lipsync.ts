import { withDbTransaction, type TransactionQueryExecutor } from '@/lib/db';
import { customerDisplayPrice } from '@/lib/customer-price-presentation';
import { loadPricingPolicyOverridesWithExecutor } from '@/lib/pricing-rule-store';
import { getUserPreferredCurrency } from '@/lib/currency';
import { createInitialVideoJobInExecutor } from '@/app/api/generate/_lib/initial-video-job';
import { getActiveAccountRestrictionInExecutor } from '@/server/fraud-cleanup';
import { getWalletSummary } from '@/server/wallet-summary';
import { isStorageConfigured } from '@/server/storage';
import { ENV } from '@/lib/env';
import { AgentApiError } from '@/server/agent-api/errors';
import { quoteMatchesActor,studioReferenceFingerprint,type GenerationActor } from '@/server/agent-api/generation-actor';
import { hashCanonicalGenerationRequest,stableJson } from '@/server/agent-api/generation-normalization';
import { createQuoteRepository,generationQuoteCodec } from '@/server/agent-api/quote-repository';
import { checkMcpSpendingLimits,checkMcpConfirmationSpendingLimits } from '@/server/agent-api/spending-limits';
import { resolveOwnedReferenceAssetForActor } from '@/server/agent-api/reference-assets';
import { resolveStudioMedia } from '@/server/studio/media-resolver';
import type { PreparedGeneration } from '@/server/agent-api/prepare-generation';
import { creatorSourceFingerprint } from './creator-sources';
import { isCreatorLipVideoEnabled,prepareCreatorProfile } from './creator-profiles';
import { prepareCreatorLipSyncProvider,quoteCreatorLipSync } from './creator-profiles-lipsync';
import { insertCreatorOperation,readCreatorOperation,type CreatorOperationSnapshot } from './creator-operations-store';
import { submitCreatorLipSyncOnce,failCreatorLipSync } from './creator-operations-lipsync-provider';

const defaults={quote:quoteCreatorLipSync,submit:submitCreatorLipSyncOnce,storageReady:isStorageConfigured,providerReady:()=>Boolean(ENV.FAL_API_KEY)};
function repository(actor:GenerationActor){return createQuoteRepository(generationQuoteCodec,actor.authMethod==='studio-session'?{origin:actor.authMethod,projectId:actor.projectId}:{origin:actor.authMethod});}
function requireReleased(enabled:boolean){if(!enabled||!isCreatorLipVideoEnabled())throw new AgentApiError('ENGINE_UNAVAILABLE','Video Lip Sync requires qualification before activation.');}
async function requireAccount(actor:GenerationActor,tx:TransactionQueryExecutor){if(await getActiveAccountRestrictionInExecutor(actor.userId,tx))throw new AgentApiError('ACCOUNT_RESTRICTED','This account cannot purchase generation.');}
async function verifySources(actor:GenerationActor,snapshot:CreatorOperationSnapshot,tx:TransactionQueryExecutor){
  for(const source of snapshot.sources){const original=await resolveStudioMedia(actor.userId,source.input.source,(sql,params)=>tx.query(sql,params),{lockAsset:true});if(creatorSourceFingerprint(original)!==source.fingerprint)throw new AgentApiError('REFERENCE_INVALID','An original source changed. Prepare a new quote.');}
  const references=[];
  for(const ref of snapshot.request.references){if(ref.kind!=='asset')throw new Error('Owned references required.');const asset=await resolveOwnedReferenceAssetForActor(actor,ref.assetId,{executor:tx});await resolveStudioMedia(actor.userId,{type:'asset',assetId:ref.assetId,kind:asset.mediaKind},(sql,params)=>tx.query(sql,params),{lockAsset:true});references.push({...asset,role:ref.role,...(ref.slot===undefined?{}:{slot:ref.slot})});}
  if(studioReferenceFingerprint(references)!==snapshot.referenceFingerprint)throw new AgentApiError('REFERENCE_INVALID','The selected media changed. Prepare a new quote.');
}
export async function prepareCreatorLipSyncQuote(actor:GenerationActor,snapshot:CreatorOperationSnapshot,enabled:boolean,dependencies:Partial<typeof defaults>={}):Promise<PreparedGeneration>{
  requireReleased(enabled);const deps={...defaults,...dependencies};
  if(!deps.storageReady()||!deps.providerReady())throw new AgentApiError('ENGINE_UNAVAILABLE','Video Lip Sync execution is not configured.');
  prepareCreatorLipSyncProvider(snapshot);
  return withDbTransaction(async tx=>{
    await requireAccount(actor,tx);await verifySources(actor,snapshot,tx);
    const pricing=await deps.quote(snapshot.expectedDurationSec!,{pricingPolicy:{loadOverrides:()=>loadPricingPolicyOverridesWithExecutor(tx,{lock:true})}});
    const spending=await checkMcpSpendingLimits({userId:actor.userId,priceCents:pricing.totalCents,currency:pricing.currency},{executor:tx});
    if(!spending.allowed)throw new AgentApiError('SPENDING_LIMIT_EXCEEDED','This operation exceeds your account spending controls.');
    const balance=await getWalletSummary(actor.userId,tx);
    const quote=await repository(actor).insertPreparedQuote({userId:actor.userId,oauthClientId:actor.clientId,request:snapshot.request,requestHash:hashCanonicalGenerationRequest(snapshot.request),catalogRevision:'creator-profile:lip-video-latentsync-v1:1',pricingSnapshot:{schemaVersion:1,profileId:snapshot.profile.id,canonicalPricing:pricing},priceCents:pricing.totalCents,currency:pricing.currency,fundingMode:'wallet'},{executor:tx});
    if(!quoteMatchesActor(quote,actor))throw new Error('Quote scope mismatch.');
    await insertCreatorOperation(actor,quote,snapshot,tx);
    return{quoteId:quote.quoteId,expiresAt:quote.expiresAt.toISOString(),requestHash:quote.requestHash,summary:quote.request,price:customerDisplayPrice(quote.priceCents,quote.currency),balance:{beforeCents:balance.balanceCents,afterCents:balance.balanceCents-quote.priceCents},fundingMode:'wallet',confirmationRequired:true,topupRequired:balance.balanceCents<quote.priceCents};
  });
}
export async function confirmCreatorLipSync(actor:GenerationActor,operationId:string,enabled:boolean,dependencies:Partial<typeof defaults>={}):Promise<void>{
  const deps={...defaults,...dependencies};const quotes=repository(actor);const owner={quoteId:operationId,userId:actor.userId,oauthClientId:actor.clientId};
  const preferredCurrency=await getUserPreferredCurrency(actor.userId);
  const claimed=await withDbTransaction(async tx=>{
    const locked=await quotes.lockOwnedQuote(owner,{executor:tx});
    if(!locked||!quoteMatchesActor(locked.quote,actor))throw new AgentApiError('QUOTE_EXPIRED','This tool quote is unavailable.');
    const operation=await readCreatorOperation(actor,operationId,tx,true);const {quote,databaseNow}=locked;
    if(quote.jobId)return null;
    requireReleased(enabled);
    if(!deps.providerReady()||!deps.storageReady())throw new AgentApiError('ENGINE_UNAVAILABLE','Video Lip Sync execution is not configured.');
    if(quote.state!=='prepared'||quote.expiresAt<=databaseNow)throw new AgentApiError('QUOTE_EXPIRED','Prepare a new quote.');
    const prepared=prepareCreatorProfile(operation.snapshot.input,operation.snapshot.sources);
    if(prepared.profile.id!=='lip-video-latentsync-v1'||prepared.profile.revision!==operation.profile_revision||hashCanonicalGenerationRequest(prepared.request)!==quote.requestHash||operation.request_hash!==quote.requestHash)throw new AgentApiError('QUOTE_EXPIRED','The tool profile changed. Prepare a new quote.');
    await requireAccount(actor,tx);await verifySources(actor,operation.snapshot,tx);
    const pricing=await deps.quote(prepared.expectedDurationSec!,{pricingPolicy:{loadOverrides:()=>loadPricingPolicyOverridesWithExecutor(tx,{lock:true})}});
    if(pricing.totalCents!==quote.priceCents||pricing.currency!==quote.currency||stableJson(pricing)!==stableJson(quote.pricingSnapshot.canonicalPricing))throw new AgentApiError('QUOTE_EXPIRED','The price changed. Prepare a new quote.');
    const spending=await checkMcpConfirmationSpendingLimits({userId:actor.userId,priceCents:quote.priceCents,currency:quote.currency},{executor:tx});
    if(!spending.allowed)throw new AgentApiError('SPENDING_LIMIT_EXCEEDED','This operation exceeds your account spending controls.');
    const pricingJson=JSON.stringify(pricing);
    const inserted=await createInitialVideoJobInExecutor(tx,{jobId:operationId,userId:actor.userId,paymentMode:'wallet',walletReservation:'reserve',funding:{kind:'wallet',reservation:'reserve'},preferredCurrency,resolvedCurrencyLower:quote.currency.toLowerCase(),pendingReceipt:{userId:actor.userId,jobId:operationId,amountCents:quote.priceCents,currency:quote.currency,description:'Video Lip Sync',snapshot:pricing,applicationFeeCents:null,vendorAccountId:pricing.vendorAccountId??null},jobInsert:{jobId:operationId,userId:actor.userId,engineId:'toolbox-lip-sync',engineLabel:'Lip Sync · LatentSync',durationSec:Math.ceil(prepared.expectedDurationSec!),prompt:'Video Lip Sync',thumbUrl:'/assets/frames/thumb-1x1.svg',aspectRatio:null,hasAudio:true,canUpscale:false,previewFrame:'/assets/frames/thumb-1x1.svg',batchId:null,groupId:null,iterationIndex:null,iterationCount:null,renderIdsJson:null,heroRenderId:null,localKey:null,message:null,etaSeconds:null,etaLabel:null,provider:'fal',finalPriceCents:quote.priceCents,pricingSnapshotJson:pricingJson,costBreakdownJson:null,settingsSnapshotJson:JSON.stringify({toolId:'lip-sync',creatorOperationId:operationId,profileId:prepared.profile.id}),currency:quote.currency,vendorAccountId:pricing.vendorAccountId??null,paymentStatus:'paid_wallet',stripePaymentIntentId:null,stripeChargeId:null,visibility:'private',indexable:false}});
    if(inserted.kind!=='created')throw new Error('Unexpected existing job.');
    const accepted=await quotes.claimPreparedQuote({...owner,jobId:operationId},{executor:tx,claimedAt:databaseNow});
    if(!accepted)throw new Error('Quote claim failed.');
    await tx.query("UPDATE creator_operations SET status='running',provider_state='submitting',provider_started_at=now(),updated_at=now() WHERE id=$1",[operationId]);
    return prepared;
  });
  if(!claimed)return;
  // Exactly one POST follows the durable reservation; duplicates only observe the claimed quote.
  const outcome=await deps.submit(prepareCreatorLipSyncProvider(claimed));
  if(outcome.kind==='rejected'){await failCreatorLipSync(actor,operationId,'The provider rejected this operation.');return;}
  await withDbTransaction(async tx=>{
    if(outcome.kind==='accepted'){
      await tx.query("UPDATE creator_operations SET provider_state='pending',provider_request_id=$2,updated_at=now() WHERE id=$1 AND provider_state='submitting'",[operationId,outcome.requestId]);
      await tx.query("UPDATE app_jobs SET provider_job_id=$2,status='queued',provisional=FALSE,updated_at=now() WHERE job_id=$1 AND user_id=$3",[operationId,outcome.requestId,actor.userId]);
      await quotes.markQuoteAccepted({...owner,jobId:operationId},{executor:tx});
    }else await tx.query("UPDATE creator_operations SET provider_state='ambiguous',updated_at=now() WHERE id=$1 AND provider_state='submitting'",[operationId]);
  });
}
