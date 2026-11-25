import {getBaseEngineIncludingHidden} from '@/lib/engines';
import {editOutputSeconds,editSourceAspect} from '@/lib/video-edit-output-defaults';
import {videoDurationPolicy,videoInheritsSourceFraming} from '@/lib/video-workflow-capabilities';
import type {StudioActionRequest} from '@/lib/studio/conversation-action-contract';
import type {ImageDraft} from '@/lib/studio/image-conversation-contract';
import type {StudioDirectorContext} from './conversation-director';
import {AgentApiError} from '@/server/agent-api/errors';
import {videoEditModels} from './conversation-video-edit-preference';
import {studioReferenceDisplayLabel} from '@/lib/mobile-studio';

type Locale='en'|'fr'|'es';
type Creator=Extract<StudioActionRequest,{action:'creator.prepare'}>;
type Video=Extract<StudioActionRequest,{action:'video.prepare'}>;

export function unavailableEditSource(locale:Locale): ImageDraft {
  return {image:null,reply:{
    fr:"Je ne peux pas utiliser la source sélectionnée. Peux-tu choisir la vidéo dans ta bibliothèque ou la joindre au projet ?",
    en:"I can’t use the selected source. Could you select the video from your library or attach it to the project?",
    es:"No puedo usar la fuente seleccionada. ¿Puedes elegir el vídeo de tu biblioteca o adjuntarlo al proyecto?",
  }[locale]};
}

/** Recover a misplaced, confirmed personal edit from the exact source and authored direction. */
export async function recoverPortraitEdit(action:Creator,context:StudioDirectorContext,locale:Locale):Promise<ImageDraft|undefined> {
  const source=action.inputs[0]?.source;
  if (!context.validateRevision || source?.type!=='asset' || source.kind!=='video' || context.selectedModelId) return;
  const reference=context.references.find(ref=>ref.assetId===source.assetId && ref.mediaKind==='video');
  if (!reference) return unavailableEditSource(locale);
  const instruction=action.settings?.find(s=>s.name==='instruction')?.value;
  const resolution=action.settings?.find(s=>s.name==='resolution')?.value;
  const mute=action.settings?.some(s=>s.name==='audioPolicy' && s.value==='mute');
  if (typeof instruction!=='string'||(resolution!=null && typeof resolution!=='string')) return;
  const brief=[...context.history.slice(-4).map(t=>t.message),context.message].join(' ');
  // More specific settings and explicit engines require the regular tool correction rather than guessed parameters.
  if (/\b(?:audio|voix|son|sound|voice|voz|sonido|fps|\d+\s*(?:s\b|sec|second|seg)|\d+\s*:\s*\d+|wan|luma|seedance|gemini|kling|veo|grok|flux|happyhorse|minimax)\b/i.test(brief)) return;
  const receipt=context.referenceMentions?.find(ref=>ref.assetId===reference.assetId);
  const sourceLabel=receipt ? studioReferenceDisplayLabel(receipt.label,locale) : {en:'your video',fr:'ta vidéo',es:'tu vídeo'}[locale];
  for (const model of videoEditModels) {
    const engine=getBaseEngineIncludingHidden(model.id);
    const caps=engine?.modeCaps?.v2v;
    if (!engine||!caps) continue;
    const seconds=videoDurationPolicy(engine,'v2v',caps)==='requested' ? editOutputSeconds(caps.duration,engine.maxDurationSec,reference.durationSec) : undefined;
    const aspectRatio=videoInheritsSourceFraming(engine,'v2v') ? null : editSourceAspect(caps.aspectRatio??[],reference.width,reference.height)??null;
    const reply={fr:`Voici la retouche avec ${model.label} à partir de ${sourceLabel}.`,en:`Here’s the edit with ${model.label} using ${sourceLabel}.`,es:`Esta es la edición con ${model.label} a partir de ${sourceLabel}.`}[locale];
    const candidate:Video={action:'video.prepare',mode:'v2v',modelId:model.id,prompt:instruction,source:null,aspectRatio,
      reply,references:[{role:'source',ref:source}],settings:[
        ...(typeof resolution==='string'?[{name:'resolution',value:resolution}]:[]),
        ...(seconds!==undefined?[{name:'durationSec',value:seconds}]:[]),...(mute?[{name:'audio',value:false}]:[])]};
    const problem=await context.validateRevision(candidate);
    if (problem) {
      if (problem.code==='MODE_UNSUPPORTED'||problem.code==='ENGINE_UNAVAILABLE'||problem.code==='PARAMETER_INVALID') continue;
      // A reference rejection can describe either a file constraint or lost access. Do not infer why or switch engines.
      return;
    }
    const result=await context.execute('recover-personal-video-edit',candidate);
    if (!result.ok) throw new AgentApiError(result.error.code,result.error.message,result.error.retryable,result.error.nextAction);
    return {reply,image:null,media:candidate};
  }
}

/** A catalog/mode refusal is different from a reference refusal. Keep every explicit
 * parameter and role; only offer a replacement whose normal owned preflight succeeds. */
export async function offerCompatibleEdit(action:Video,context:StudioDirectorContext,locale:Locale): Promise<ImageDraft|undefined> {
  if (!context.validateRevision || action.mode!=='v2v' || action.operation || action.source || action.references?.length!==1) return;
  const [{role,ref}]=action.references;
  if (role!=='source'||ref.type!=='asset'||ref.kind!=='video') return;
  const verified=context.references.find(item=>item.assetId===ref.assetId && item.mediaKind==='video');
  if (!verified) return unavailableEditSource(locale);
  const mention=context.referenceMentions?.find(item=>item.assetId===ref.assetId);
  const label=mention?studioReferenceDisplayLabel(mention.label,locale):{fr:'ta vidéo',en:'your video',es:'tu vídeo'}[locale];
  for (const model of videoEditModels) {
    if (model.id===action.modelId) continue;
    const problem=await context.validateRevision({...action,modelId:model.id});
    if (!problem) return {image:null,reply:{
      fr:`Le modèle choisi ne propose pas cette retouche avec ces réglages. Je peux reprendre la même direction avec ${model.label} sur ${label}. Veux-tu le devis ?`,
      en:`The selected model can’t do this edit with these settings. I can use ${model.label} with ${label} for the same edit. Would you like the quote?`,
      es:`El modelo elegido no admite esta edición con estos ajustes. Puedo usar ${model.label} con ${label} para la misma edición. ¿Quieres el presupuesto?`,
    }[locale]};
    if (problem.code.startsWith('REFERENCE_')) return;
  }
}
