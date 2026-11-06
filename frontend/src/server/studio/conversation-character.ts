import { createCharacterStudioIntegration, type CharacterStudioIntegrationOptions } from '@/server/character-studio/integration';
import type { StudioGenerationActor } from '@/server/agent-api/generation-actor';
import { AgentApiError } from '@/server/agent-api/errors';
import type { ResolvedReference } from '@/server/agent-api/reference-types';
import type { StudioRecastIntent } from '@/lib/studio/conversation-character-contract';
import type { ImageTurnInput } from '@/lib/studio/image-conversation-contract';
import { customerDisplayPrice } from '@/lib/customer-price-presentation';
import { studioConversationSourceAsset } from './conversation-media-generation';
import { attachImageQuote, persistImageDraft, type StoredImageTurn } from './image-conversation-repository';
import { completeStudioAction } from './conversation-run-repository';

export type StudioCharacterFactory = (
  actor: StudioGenerationActor, options: Pick<CharacterStudioIntegrationOptions,'executionEnabled'|'onQuotePrepared'>,
) => ReturnType<typeof createCharacterStudioIntegration>;

export async function prepareStudioConversationRecast(options: {
  actor:StudioGenerationActor;
  turn:StoredImageTurn;
  input:ImageTurnInput;
  references:readonly ResolvedReference[];
  referenceFingerprint:string;
  characterFactory?:StudioCharacterFactory;
  characterEnabled?:boolean;
}, action:StudioRecastIntent, callId:string) {
  if (!options.characterEnabled) throw new AgentApiError('ENGINE_UNAVAILABLE','Studio Recast preparation is unavailable.');
  if (options.input.shotPlanRevision) throw new AgentApiError('PARAMETER_INVALID','The revised shot plan requires a new video quote.');
  const {actor,turn,input} = options;
  const assetId = (ref:Parameters<typeof studioConversationSourceAsset>[1]) =>
    studioConversationSourceAsset(actor,ref,input,options.references);
  const portrait = 'characterId' in action.portrait ? action.portrait : {assetId:await assetId(action.portrait)};
  const product = action.product ? await assetId(action.product) : undefined;
  const video = action.video ? {assetId:await assetId(action.video.ref),range:action.video.range} : undefined;
  const audio = action.audio ? {assetId:await assetId(action.audio.ref),range:action.audio.range} : undefined;
  if (!turn.draft_json) await persistImageDraft(actor,turn,{reply:action.reply,image:null,recast:action},options.referenceFingerprint);
  const service = (options.characterFactory ?? createCharacterStudioIntegration)(actor,{
    executionEnabled:true,
    onQuotePrepared:async(quote,executor) => {
      await attachImageQuote(actor,turn,quote.quoteId,executor);
      await completeStudioAction(actor,turn,callId,{ok:true,action:'recast.prepare',data:{
        quoteId:quote.quoteId,expiresAt:quote.expiresAt.toISOString(),requestHash:quote.requestHash,summary:quote.request,
        price:customerDisplayPrice(quote.priceCents,quote.currency),fundingMode:quote.fundingMode,confirmationRequired:true,
      }},executor);
    },
  });
  const {quote} = await service.prepareRecast({portrait,product,video,audio,direction:action.direction,dialogue:action.dialogue,
    seconds:action.seconds,resolution:action.resolution,aspectRatio:action.aspectRatio});
  return quote;
}
