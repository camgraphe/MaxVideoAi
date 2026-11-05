import type {PromptAssistanceDraftContext} from './contract';
import {buildAudioCreationRequest,AUDIO_INTENT_PACK,type AudioCreationDraft,type AudioCreationIntent} from '@/lib/audio-creation';
import {getAudioPackConfig} from '@/lib/audio-generation';
import type {AssetFieldConfig,ComposerAttachment} from '@/components/composer/composer-types';
import type {EngineCaps,EngineInputField,Mode} from '@/types/engines';
import {buildReferenceMentions,selectedReferenceLabel} from '@/components/composer/workspace-reference-mentions';
import {assistanceSettings} from './settings';
import {assistanceReferenceRole} from './reference-role';
export {assistanceSettings,composerAssistanceSettings} from './settings';

export function composerAssistanceReferenceField(engine:EngineCaps,field:EngineInputField,mode?:Mode) {
  return field.id==='reference_images'&&(mode==='t2i'||mode==='i2i')
    ?[...engine.inputSchema?.required??[],...engine.inputSchema?.optional??[]].find(candidate=>candidate.type==='image'
      &&(!candidate.modes?.length||candidate.modes.includes(mode))&&assistanceReferenceRole(engine,candidate,mode)!=='mask')??field
    :field;
}

function activeReferenceFields(fields:AssetFieldConfig[],mode?:Mode) {
  return fields.filter(({field,disabled})=>!disabled&&(!mode||!field.modes?.length||field.modes.includes(mode)));
}

export function hasResolvingAssistanceReferences(fields:AssetFieldConfig[],assets:Record<string,(ComposerAttachment|null)[]>,mode?:Mode):boolean {
  return activeReferenceFields(fields,mode).some(({field})=>(assets[field.id]??[]).some(asset=>asset?.identityResolving&&asset.status==='ready'));
}

/** Use the current, prepared owned reference identity; private media URLs stay local. */
export function composerAssistanceReferences(engine:EngineCaps,fields:AssetFieldConfig[],assets:Record<string,(ComposerAttachment|null)[]>,mode?:Mode):PromptAssistanceDraftContext['references'] {
  fields=activeReferenceFields(fields,mode);
  const mentions=buildReferenceMentions(engine,fields,assets);
  return fields.flatMap(({field})=>(assets[field.id]??[]).flatMap((asset,slot)=>{
    if(!asset)return [];
    const mention=mentions.find(item=>item.fieldId===field.id&&item.slotIndex===slot);
    const sequence=mention?Number(mention.token.match(/\d+/)?.[0]??1)+(mention.token.startsWith('<IMAGE_')?1:0):(assets[field.id]??[]).slice(0,slot+1).filter(Boolean).length;
    // The dedicated Image composer has one UI reference list; Milo uses the model's native field.
    const nativeField=composerAssistanceReferenceField(engine,field,mode);
    const role=assistanceReferenceRole(engine,nativeField??field,mode);
    return [{fieldId:nativeField?.id??field.id,slot,label:role==='start'?'Start image':role==='end'?'End image':selectedReferenceLabel(engine,field,asset.kind,sequence,'en',role==='source'),
      ref:asset.status==='uploading'||asset.status==='error'||asset.excerptEditing?null:asset.ref??(asset.assetId?{type:'asset' as const,assetId:asset.assetId,kind:asset.kind}:null)}];
  }));
}
export function audioAssistanceContext(intent:AudioCreationIntent,draft:AudioCreationDraft):PromptAssistanceDraftContext {
  const request=buildAudioCreationRequest(intent,draft,'en');
  return {surface:'audio',workflow:intent,engineId:getAudioPackConfig(AUDIO_INTENT_PACK[intent]).engineId,mode:AUDIO_INTENT_PACK[intent],settings:assistanceSettings(request),...(intent==='song'?{readOnlyText:{lyrics:draft.lyrics}}:{}),references:intent==='voice'&&draft.reference?[{fieldId:'voice_sample',slot:0,label:'Audio 1',ref:draft.reference.ref??null}]:[]};
}
