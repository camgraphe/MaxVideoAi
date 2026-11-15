import {query} from '@/lib/db';
import {resolveOwnedReferenceAssetForActor} from '@/server/agent-api/reference-assets';
import {resolveStudioMedia} from './media-resolver';
import {createCharacterStudioIntegration} from '@/server/character-studio/integration';
import type {StudioCharacterFactory} from './conversation-character';
import {studioCharacterSelectActionSchema} from '@/lib/studio/conversation-character-authoring-contract';
import type {StudioCharacterSaveResult} from '@/lib/studio/conversation-character-authoring-contract';
import {trustedAccountUrlFromOrigin} from '@/server/agent-api/account-destinations';
import {createCharacterBuilderAuthoringService,type CharacterBuilderAuthoringOptions} from '@/server/character-studio/authoring';
import type {StudioGenerationActor} from '@/server/agent-api/generation-actor';
import type {ResolvedReference} from '@/server/agent-api/reference-types';
import type {ImageTurnInput} from '@/lib/studio/image-conversation-contract';
import {parseStudioCharacterRecipe,type StudioCharacterBuilderIntent} from '@/lib/studio/conversation-character-authoring-contract';
import {AgentApiError} from '@/server/agent-api/errors';
import {attachImageQuote,persistImageDraft,type StoredImageTurn} from './image-conversation-repository';
import {completeStudioAction} from './conversation-run-repository';
import {studioConversationSourceAsset} from './conversation-media-generation';
import {customerDisplayPrice} from '@/lib/customer-price-presentation';

export type StudioCharacterBuilderFactory=(actor:StudioGenerationActor,options:CharacterBuilderAuthoringOptions)=>ReturnType<typeof createCharacterBuilderAuthoringService>;
export const isStudioCharacterBuilderEnabled=()=>process.env.MCP_CHARACTER_BUILDER_ENABLED==='1';
export async function prepareStudioConversationCharacterBuilder(options:{
  actor:StudioGenerationActor;turn:StoredImageTurn;input:ImageTurnInput;references:readonly ResolvedReference[];
  referenceFingerprint:string;characterFactory?:StudioCharacterFactory;characterBuilderEnabled?:boolean;characterBuilderFactory?:StudioCharacterBuilderFactory;requestOrigin?:string;
},action:StudioCharacterBuilderIntent,callId:string){
  if(!options.characterBuilderEnabled)throw new AgentApiError('ENGINE_UNAVAILABLE','Character Builder preparation is unavailable.');
  if(options.input.shotPlanRevision)throw new AgentApiError('PARAMETER_INVALID','A Character Builder recipe cannot replace the requested shot plan.');
  const recipe=parseStudioCharacterRecipe(action.recipe);
  for(const image of recipe.referenceImages??[]){
    const attached=options.input.references.includes(image.assetId)||options.input.attachments?.some(ref=>ref.type==='asset'&&ref.assetId===image.assetId&&ref.kind==='image');
    if(attached)await studioConversationSourceAsset(options.actor,{type:'asset',kind:'image',assetId:image.assetId},options.input,options.references);
    else {
      const [selected]=await query<{data:{characterId:string;lookId:string|null;jobId:string}}>(`SELECT result_json->'data' data FROM studio_conversation_steps WHERE user_id=$1 AND project_id=$2 AND state='completed'
        AND action_json->>'action'='character.select' AND result_json->>'ok'='true' AND result_json->'data'->>'assetId'=$3 LIMIT 1`,
        [options.actor.userId,options.actor.projectId,image.assetId]);
      if(!selected)throw new AgentApiError('REFERENCE_INVALID','Attach this image or select this saved character/look in this project first.');
      const selection=studioCharacterSelectActionSchema.parse({action:'character.select',characterId:selected.data.characterId,lookId:selected.data.lookId});
      const fresh=await (options.characterFactory??createCharacterStudioIntegration)(options.actor,{executionEnabled:false}).select({characterId:selection.characterId,lookId:selection.lookId});
      if(fresh.assetId!==image.assetId||fresh.jobId!==selected.data.jobId)throw new AgentApiError('REFERENCE_INVALID','This saved original changed. Select the character/look again.');
      const owned=await resolveOwnedReferenceAssetForActor(options.actor,image.assetId);
      if(owned.mediaKind!=='image')throw new AgentApiError('REFERENCE_INVALID','Choose an owned original image.');
      await resolveStudioMedia(options.actor.userId,{type:'asset',kind:'image',assetId:image.assetId});
    }
  }
  const {actor,turn}=options;
  if(!turn.draft_json)await persistImageDraft(actor,turn,{reply:action.reply,image:null,characterBuilder:action},options.referenceFingerprint);
  const service=(options.characterBuilderFactory??createCharacterBuilderAuthoringService)(actor,{
    executionEnabled:options.characterBuilderEnabled,accountUrl:trustedAccountUrlFromOrigin(options.requestOrigin),
    onQuotePrepared:async(quote,executor)=>{
      await attachImageQuote(actor,turn,quote.quoteId,executor);
      await completeStudioAction(actor,turn,callId,{ok:true,action:'character.prepare',data:{
        quoteId:quote.quoteId,expiresAt:quote.expiresAt.toISOString(),requestHash:quote.requestHash,summary:quote.request,
        price:customerDisplayPrice(quote.priceCents,quote.currency),fundingMode:quote.fundingMode,confirmationRequired:true,
      }},executor);
    },
  });
  return (await service.prepare(recipe)).quote;
}

/** Resolve the completed original from this project's immutable Builder quote, never model-supplied media. */
export async function saveStudioConversationCharacter(actor:StudioGenerationActor,input:{quoteId:string;name:string},
  builder:ReturnType<typeof createCharacterBuilderAuthoringService>,character:Pick<ReturnType<typeof createCharacterStudioIntegration>,'save'>):Promise<StudioCharacterSaveResult>{
  const owned=await builder.readStoredQuote({quoteId:input.quoteId});
  const job=owned?.quote.jobId?await builder.recover({quoteId:input.quoteId}):null;
  if(!job||job.status!=='completed'||job.result?.surface!=='image'||job.result.imageUrls.length!==1)
    throw new AgentApiError('REFERENCE_INVALID','Choose one completed Character Builder result from this project before saving.');
  const imageUrl=job.result.imageUrls[0];
  const saved=await character.save({name:input.name,jobId:job.jobId,imageUrl});
  const [look]=saved.kind==='look'?await query<{id:string;name:string}>(`SELECT id::text,name FROM character_studio_looks
    WHERE user_id=$1 AND character_id=$2 AND source_job_id=$3 AND image_url=$4 LIMIT 1`,[actor.userId,saved.character.id,job.jobId,imageUrl]):[];
  if(saved.kind==='look'&&!look)throw new AgentApiError('REFERENCE_NOT_FOUND','The saved look is temporarily unavailable. Recover this request.');
  return {kind:saved.kind,characterId:saved.character.id,name:saved.character.name,lookId:look?.id??null,lookName:look?.name??null};
}
