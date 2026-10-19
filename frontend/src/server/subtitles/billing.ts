import {z} from 'zod';
import type {TransactionQueryExecutor} from '@/lib/db';
import {getActiveAccountRestrictionInExecutor} from '../fraud-cleanup';
import {AgentApiError} from '../agent-api/errors';
import {checkMcpSpendingLimits,checkMcpConfirmationSpendingLimits} from '../agent-api/spending-limits';
import {createQuoteRepository} from '../agent-api/quote-repository';
import type {GenerationActor} from '../agent-api/generation-actor';
import {timelineExportManifestHash} from '../timeline-exports/estimate-token';
import type {SubtitleOperationRecord,SubtitlePricing} from './jobs';
import {isIncludedSubtitleExport} from './pricing';
const requestSchema=z.object({schemaVersion:z.literal(1),surface:z.literal('audio'),toolId:z.literal('subtitles'),operationId:z.string().uuid()}).strict();
const codec={surfaces:['audio'] as const,normalize:(value:unknown)=>requestSchema.parse(value),hash:timelineExportManifestHash,parseFunding:()=>null};
function repository(actor:GenerationActor){return createQuoteRepository(codec,actor.authMethod==='studio-session'?{origin:actor.authMethod,projectId:actor.projectId}:{origin:actor.authMethod});}
export async function assertSubtitlePurchaseAllowed(actor:GenerationActor,pricing:SubtitlePricing,executor:TransactionQueryExecutor,confirm:boolean){
  if(await getActiveAccountRestrictionInExecutor(actor.userId,executor))throw new AgentApiError('ACCOUNT_RESTRICTED','This account cannot purchase generation.');
  // Included document rendering remains authorized, but is not a new purchase.
  if(isIncludedSubtitleExport(pricing))return;
  const decision=await (confirm?checkMcpConfirmationSpendingLimits:checkMcpSpendingLimits)({userId:actor.userId,priceCents:pricing.totalCents,currency:pricing.currency},{executor});
  if(!decision.allowed)throw new AgentApiError('SPENDING_LIMIT_EXCEEDED','This operation exceeds your account spending controls.');
}
/** Accepted subtitle work shares the existing spending ledger, so other generation surfaces count it too. */
export async function recordSubtitlePurchase(actor:GenerationActor,operation:SubtitleOperationRecord,jobId:string,executor:TransactionQueryExecutor){
  const quotes=repository(actor),request=requestSchema.parse({schemaVersion:1,surface:'audio',toolId:'subtitles',operationId:operation.id}),pricing=operation.pricing_snapshot;
  const now=new Date(),owner={quoteId:operation.id,userId:actor.userId,oauthClientId:actor.clientId,jobId};
  await quotes.insertPreparedQuote({userId:actor.userId,oauthClientId:actor.clientId,request,requestHash:codec.hash(request),catalogRevision:'subtitles:1',pricingSnapshot:pricing,priceCents:pricing.totalCents,currency:pricing.currency,fundingMode:'wallet'},{executor,now:()=>now,randomUUID:()=>operation.id});
  if(!await quotes.claimPreparedQuote(owner,{executor,claimedAt:now}))throw new Error('SUBTITLE_CLAIM_LOST');
  if(!await quotes.markQuoteAccepted(owner,{executor,now:()=>now}))throw new Error('SUBTITLE_CLAIM_LOST');
}
export async function recordSubtitleRefund(operation:SubtitleOperationRecord,executor:TransactionQueryExecutor){
  const actor={userId:operation.user_id,authMethod:operation.auth_origin,clientId:operation.oauth_client_id,...operation.studio_project_id?{projectId:operation.studio_project_id}:{}} as GenerationActor;
  await repository(actor).markQuoteFailed({quoteId:operation.id,userId:actor.userId,oauthClientId:actor.clientId,jobId:operation.job_id!},{executor});
}
