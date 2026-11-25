import {getBaseEngineIncludingHidden} from '@/lib/engines';
import {studioReferenceDisplayLabel} from '@/lib/mobile-studio';
import {videoDurationPolicy} from '@/lib/video-workflow-capabilities';
import {createQuoteRepository,generationQuoteCodec} from '@/server/agent-api/quote-repository';
import {audioQuoteRepositoryForActor} from '@/server/agent-api/audio-quote-repository';
import {draftSurface} from '@/lib/studio/image-conversation-contract';
import {getAudioPackConfig} from '@/lib/audio-generation';
import {studioActionRequestSchema, type StudioActionRequest} from '@/lib/studio/conversation-action-contract';
import type {ImageDraft} from '@/lib/studio/image-conversation-contract';
import {imageSelectionStripSchema} from '@/lib/studio/conversation-creation-contract';
import type {CanonicalAudioRequest} from '@/server/agent-api/audio-normalization';
import type {CanonicalGenerationRequest} from '@/server/agent-api/generation-types';
import type {StudioGenerationActor} from '@/server/agent-api/generation-actor';
import {AgentApiError} from '@/server/agent-api/errors';
import type {StudioDirectorContext} from './conversation-director';
import type {StudioRecalledReference} from './project-reference-registry';
import {studioRevisionModel} from './conversation-model-choice';
import {studioQuoteModelLabel} from './conversation-quote-sources';

type Request = CanonicalAudioRequest | CanonicalGenerationRequest;
type Prepare = Extract<StudioActionRequest,{action:'image.prepare'|'video.prepare'|'audio.prepare'}>;
type Locale = 'en'|'fr'|'es';
export type StudioQuoteRevision = {action:Prepare|null; previousModel:string; target:string; workflow:string; labels:string[]; alternative?:Prepare|null};

export async function readStudioRevisionRequest(actor:StudioGenerationActor,quoteId:string,draft:ImageDraft) {
  const surface=draftSurface(draft);
  const quotes=surface==='audio' ? audioQuoteRepositoryForActor(actor)
    : createQuoteRepository({...generationQuoteCodec,surfaces:[surface]},{origin:'studio-session',projectId:actor.projectId});
  return (await quotes.getOwnedQuote({userId:actor.userId,oauthClientId:null,quoteId}))?.request;
}

export function revisionAssetIds(request:Request) {
  return request.surface==='audio' ? request.references.map(({asset})=>asset.type==='asset'?asset.assetId:null)
    : request.references.map(ref=>ref.kind==='asset'?ref.assetId:null);
}

/** Keep the signed order and roles; substitute only a source the user explicitly identified. */
export function studioQuoteRevision(request:Request, draft:ImageDraft, choice:string|null,
  sources:StudioRecalledReference[], locale:Locale):StudioQuoteRevision {
  const model = choice ? studioRevisionModel(choice) : {modelId:request.engineId};
  const previousModel = studioQuoteModelLabel(request);
  const target = model?.modelId ? getBaseEngineIncludingHidden(model.modelId)?.label ?? model.modelId : choice ?? previousModel;
  const ids = revisionAssetIds(request);
  const workflow = request.surface==='audio' ? getAudioPackConfig(request.mode).label : request.mode;
  const revision:StudioQuoteRevision = {previousModel,target,workflow,labels:sources.map(s=>s.label),
    action:null};
  if (!model || !sources.length || sources.length!==ids.length) return revision;

  const reply = {en:'Review the new quote.',fr:'Voici le nouveau devis.',es:'Revisa el nuevo presupuesto.'}[locale];
  const ref = (i:number) => ({type:'asset' as const,assetId:sources[i].assetId,kind:sources[i].kind});
  let proposed:unknown;
  if (request.surface==='audio') {
    if (model.modelId && model.modelId!==request.engineId) return revision;
    const mode = model.audio?.mode ?? request.mode;
    const pack = getAudioPackConfig(mode);
    if (model.audio?.voiceModel && !pack.includesVoice || model.audio?.musicModel && mode!=='music_only') return revision;
    const settings = {...request.settings, ...(model.audio?.voiceModel ? {voiceModel:model.audio.voiceModel}:{}),
      ...(model.audio?.musicModel ? {musicModel:model.audio.musicModel}:{})};
    proposed = {action:'audio.prepare',reply,mode,modelId:pack.engineId,prompt:request.prompt,
      settings:Object.entries(settings).map(([name,value])=>({name,value})),
      references:request.references.map(({role},i)=>({role,asset:ref(i)}))};
  } else {
    if (!model.modelId) return revision;
    const references = request.references.map((r,i)=>({role:r.role,slot:r.slot ?? null,ref:ref(i)}));
    if (request.surface==='image' && draft.image) {
      proposed = {...draft.image,action:'image.prepare',reply,modelId:model.modelId,mode:request.mode,references};
    } else if (request.surface==='video' && draft.media?.action==='video.prepare') {
      // A generic edit and an extension are different operations. Specialised operations
      // may only carry over to an engine that explicitly supports the same operation.
      const {operation:previousOperation,...previous} = draft.media;
      let operation = request.operation ?? previousOperation;
      if (request.engineId!==model.modelId && request.mode==='v2v' && (!operation || operation==='kling-edit')) {
        operation = ['kling-o3-standard','kling-o3-pro','kling-o3-4k'].includes(model.modelId) ? 'kling-edit'
          : model.modelId==='flux-3' ? 'flux-fast-edit' : null;
      }
      const engine = getBaseEngineIncludingHidden(model.modelId);
      const caps = request.mode==='v2v' ? engine?.modeCaps?.v2v : undefined;
      const aspectRatio = previous.aspectRatio ?? (caps?.aspectRatio?.includes('auto') ? 'auto' : null);
      // Wan delivers MP4 directly. Seedance's container selector is not a Wan input.
      const wanEdit = request.mode==='v2v' && ['wan-3','wan-3-prime'].includes(model.modelId);
      const settings = (previous.settings ?? []).filter(s=>!(wanEdit && s.name==='outputFormat' && s.value==='mp4'));
      if (engine && caps && videoDurationPolicy(engine,'v2v',caps)==='requested' && operation!=='kling-edit'
        && typeof request.settings.durationSec==='number' && !settings.some(s=>s.name==='duration' || s.name==='durationSec'))
        settings.push({name:'durationSec',value:request.settings.durationSec});
      proposed = {...previous,reply,modelId:model.modelId,mode:request.mode,aspectRatio,settings,operation,source:null,references};
    }
  }
  const parsed = studioActionRequestSchema.safeParse(proposed);
  if (parsed.success && (parsed.data.action==='image.prepare'||parsed.data.action==='video.prepare'||parsed.data.action==='audio.prepare'))
    revision.action=parsed.data;
  return revision;
}

export async function prepareStudioQuoteRevision(revision:StudioQuoteRevision, locale:Locale, execute:StudioDirectorContext['execute'], validate:NonNullable<StudioDirectorContext['validateRevision']>):Promise<ImageDraft> {
  const {action,previousModel,target}=revision;
  // Test compatibility before draft persistence expires the preceding quote.
  // A later infrastructure/pricing failure must retain the normal recovery path.
  const problem = action ? await validate(action) : undefined;
  if (action && !problem) {
    const result=await execute('revise-reference-quote',action);
    if (!result.ok) throw new AgentApiError(result.error.code,result.error.message,result.error.retryable,result.error.nextAction);
    return action.action==='image.prepare' ? {reply:action.reply,image:imageSelectionStripSchema.parse(action)}
      : {reply:action.reply,image:null,media:action};
  }
  const labels = new Intl.ListFormat(locale).format([...new Set(revision.labels)].map(label=>studioReferenceDisplayLabel(label,locale)));
  const workflow = revision.workflow==='v2v' ? {en:'video editing',fr:'modification vidéo',es:'edición de vídeo'}[locale] : revision.workflow;
  const reason = problem?.code==='MODE_UNSUPPORTED' || problem?.code==='ENGINE_UNAVAILABLE' || !action
    ? {en:`This Studio model does not currently offer the required mode (${workflow}) with these sources.`,fr:`Le mode requis (${workflow}) est indisponible avec ce modèle et ces sources dans Studio.`,es:`El modo necesario (${workflow}) no está disponible con este modelo y estas fuentes en Studio.`}[locale]
    : problem?.message ?? '';
  const message = {fr:`J’ai retrouvé ${labels}. Je ne peux pas préparer cette opération avec ${target} et ces réglages.`,
    en:`I found ${labels}. I can’t prepare this operation with ${target} and these settings.`,
    es:`He encontrado ${labels}. No puedo preparar esta operación con ${target} y estos ajustes.`}[locale];
  const offer = {fr:`Veux-tu reprendre le modèle du devis précédent, ${previousModel} ?`,
    en:`Would you like to use the previous quote’s model, ${previousModel}?`,
    es:`¿Quieres volver al modelo del presupuesto anterior, ${previousModel}?`}[locale];
  return {image:null,reply:[message,reason,revision.alternative && previousModel!==target && !await validate(revision.alternative) ? offer:''].filter(Boolean).join(' ')};
}
