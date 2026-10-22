import assert from 'node:assert/strict';
import test from 'node:test';
import {getFalEngineById} from '../frontend/src/config/falEngines';
import {imageTurnInputSchema} from '../frontend/src/lib/studio/image-conversation-contract';
import {imageSelectionSchema} from '../frontend/lib/studio/conversation-creation-contract';
import {conversationReferencePreviewsSchema} from '../frontend/lib/studio/conversation-reference-previews';
import {studioMediaIntentSchema} from '../frontend/lib/studio/conversation-media-contract';
import {requireStudioGenerationRequest} from '../frontend/src/server/agent-api/generation-actor';
import {normalizeGenerationRequest} from '../frontend/src/server/agent-api/generation-normalization';
import {studioVisualCapabilityDetails} from '../frontend/src/server/studio/conversation-capabilities';

const refs=Array.from({length:67},(_,index)=>({type:'asset' as const,kind:'image' as const,assetId:'ma_'+index.toString(16).padStart(32,'0')}));
const selected=refs.map((ref,slot)=>({ref,role:'reference' as const,slot}));
const request=(engineId:string,count:number,surface:'image'|'video'='video',mode='ref2v')=>normalizeGenerationRequest({surface,engineId,mode:mode as never,prompt:'Use each visual anchor.',settings:{},outputCount:1,references:refs.slice(0,count).map((ref,slot)=>({kind:'asset' as const,assetId:ref.assetId,role:'reference' as const,...(engineId==='flux-3-max'&&mode==='ref2v'?{slot}:{})}))});

test('Studio attaches and previews 66 exact media before model selection, with a bounded envelope',()=>{
  const input={requestId:'00000000-0000-4000-8000-000000000001',message:'Use every image.',references:refs.slice(0,66).map(ref=>ref.assetId)};
  assert.equal(imageTurnInputSchema.safeParse(input).success,true);
  assert.equal(conversationReferencePreviewsSchema.safeParse({refs:refs.slice(0,66)}).success,true);
  assert.equal(imageTurnInputSchema.safeParse({...input,references:refs.map(ref=>ref.assetId)}).success,false);
  assert.equal(conversationReferencePreviewsSchema.safeParse({refs}).success,false);
  assert.equal(imageTurnInputSchema.safeParse({...input,references:[...input.references.slice(0,9),input.references[0]]}).success,false);
});

test('ten keyframes reach video preparation while image generation keeps its existing eight limit',()=>{
  const common={prompt:'Use every image.',aspectRatio:'16:9',references:selected.slice(0,10)};
  assert.equal(studioMediaIntentSchema.safeParse({...common,action:'video.prepare',reply:'Review the quote.',modelId:'flux-3-max',mode:'ref2v',source:null}).success,true);
  assert.equal(imageSelectionSchema.safeParse({...common,modelId:'gpt-image-2',mode:'i2i',references:selected.slice(0,9)}).success,false);
});

test('direct Studio requests allow ten only for the canonically supported keyframe mode',()=>{
  assert.doesNotThrow(()=>requireStudioGenerationRequest(request('flux-3-max',10)));
  assert.throws(()=>requireStudioGenerationRequest(request('flux-3-max',11)),{code:'PARAMETER_INVALID'});
  assert.throws(()=>requireStudioGenerationRequest(request('flux-3-max',9,'video','i2v')),{code:'PARAMETER_INVALID'});
  assert.throws(()=>requireStudioGenerationRequest(request('wan-3',9)),{code:'PARAMETER_INVALID'});
  assert.throws(()=>requireStudioGenerationRequest(request('gpt-image-2',9,'image','i2i')),{code:'PARAMETER_INVALID'});
});

test('Studio model details retain canonical Max keyframe capacity and existing models remain bounded',()=>{
  const details=(id:string)=>{const entry=getFalEngineById(id)!;const result=studioVisualCapabilityDetails({engine:entry.engine,surface:'video',publicModes:entry.modes.map(mode=>mode.mode) as never,modeCaps:Object.fromEntries(entry.modes.map(mode=>[mode.mode,mode.ui]))});if(result.surface==='audio')throw new Error('Expected video details');return result;};
  const max=details('flux-3-max');
  assert.equal(max.maxReferences,10);
  assert.equal(max.modes.find(mode=>mode.mode==='ref2v')?.references[0]?.max,10);
  assert.equal(details('wan-3').maxReferences,16);
});
