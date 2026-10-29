import type {PromptAssistanceDraftContext} from './contract';
import {buildAudioCreationRequest,AUDIO_INTENT_PACK,type AudioCreationDraft,type AudioCreationIntent} from '@/lib/audio-creation';
import {getAudioPackConfig} from '@/lib/audio-generation';
import type {AssetFieldConfig,ComposerAttachment} from '@/components/composer/composer-types';
import type {EngineCaps} from '@/types/engines';
import {buildReferenceMentions,selectedReferenceLabel} from '@/components/composer/workspace-reference-mentions';

/** Only scalar controls cross this boundary; drafts and private media URLs have explicit owners. */
export function assistanceSettings(values:object):PromptAssistanceDraftContext['settings']{
  return Object.fromEntries(Object.entries(values).filter(([key,value])=>!/url|token|secret|password|account|userId|^(prompt|script|lyrics)$/i.test(key)&&/^[a-zA-Z][a-zA-Z0-9_]*$/.test(key)&&(value===null||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value)||typeof value==='string'&&value.length<=5000)));
}
export function composerAssistanceReferences(engine:EngineCaps,fields:AssetFieldConfig[],assets:Record<string,(ComposerAttachment|null)[]>):PromptAssistanceDraftContext['references'] {
  const mentions=buildReferenceMentions(engine,fields,assets);
  return fields.flatMap(({field})=>(assets[field.id]??[]).flatMap((asset,slot)=>{
    if(!asset)return [];
    const mention=mentions.find(item=>item.fieldId===field.id&&item.slotIndex===slot);
    const sequence=mention?Number(mention.token.match(/\d+/)?.[0]??1)+(mention.token.startsWith('<IMAGE_')?1:0):slot+1;
    return [{fieldId:field.id,slot,label:selectedReferenceLabel(engine,field,asset.kind,sequence,'en',field.id==='video_url'),
      ref:asset.status==='uploading'||asset.status==='error'?null:asset.ref??(asset.assetId?{type:'asset' as const,assetId:asset.assetId,kind:asset.kind}:null)}];
  }));
}
export function audioAssistanceContext(intent:AudioCreationIntent,draft:AudioCreationDraft):PromptAssistanceDraftContext {
  const request=buildAudioCreationRequest(intent,draft,'en');
  return {surface:'audio',engineId:getAudioPackConfig(AUDIO_INTENT_PACK[intent]).engineId,mode:AUDIO_INTENT_PACK[intent],settings:assistanceSettings(request),references:draft.reference?[{fieldId:'voice_sample',slot:0,label:'Audio 1',ref:draft.reference.ref??null}]:[]};
}
