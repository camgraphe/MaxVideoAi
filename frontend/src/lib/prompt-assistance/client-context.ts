import type {PromptAssistanceDraftContext} from './contract';
import {buildAudioCreationRequest,AUDIO_INTENT_PACK,type AudioCreationDraft,type AudioCreationIntent} from '@/lib/audio-creation';
import {getAudioPackConfig} from '@/lib/audio-generation';
import type {AssetFieldConfig,ComposerAttachment} from '@/components/composer/composer-types';
import type {EngineCaps,Mode} from '@/types/engines';
import {buildReferenceMentions,selectedReferenceLabel} from '@/components/composer/workspace-reference-mentions';
import {assistanceSettings} from './settings';
import {assistanceReferenceRole} from './reference-role';
export {assistanceSettings,composerAssistanceSettings} from './settings';

/** Use the current, prepared owned reference identity; private media URLs stay local. */
export function composerAssistanceReferences(engine:EngineCaps,fields:AssetFieldConfig[],assets:Record<string,(ComposerAttachment|null)[]>,mode?:Mode):PromptAssistanceDraftContext['references'] {
  fields=fields.filter(({field,disabled})=>!disabled&&(!mode||!field.modes?.length||field.modes.includes(mode)));
  const mentions=buildReferenceMentions(engine,fields,assets);
  return fields.flatMap(({field})=>(assets[field.id]??[]).flatMap((asset,slot)=>{
    if(!asset)return [];
    const mention=mentions.find(item=>item.fieldId===field.id&&item.slotIndex===slot);
    const sequence=mention?Number(mention.token.match(/\d+/)?.[0]??1)+(mention.token.startsWith('<IMAGE_')?1:0):(assets[field.id]??[]).slice(0,slot+1).filter(Boolean).length;
    const role=assistanceReferenceRole(engine,field,mode);
    return [{fieldId:field.id,slot,label:role==='start'?'Start image':role==='end'?'End image':selectedReferenceLabel(engine,field,asset.kind,sequence,'en',role==='source'),
      ref:asset.status==='uploading'||asset.status==='error'||asset.excerptEditing?null:asset.ref??(asset.assetId?{type:'asset' as const,assetId:asset.assetId,kind:asset.kind}:null)}];
  }));
}
export function audioAssistanceContext(intent:AudioCreationIntent,draft:AudioCreationDraft):PromptAssistanceDraftContext {
  const request=buildAudioCreationRequest(intent,draft,'en');
  return {surface:'audio',workflow:intent,engineId:getAudioPackConfig(AUDIO_INTENT_PACK[intent]).engineId,mode:AUDIO_INTENT_PACK[intent],settings:assistanceSettings(request),...(intent==='song'?{readOnlyText:{lyrics:draft.lyrics}}:{}),references:intent==='voice'&&draft.reference?[{fieldId:'voice_sample',slot:0,label:'Audio 1',ref:draft.reference.ref??null}]:[]};
}
