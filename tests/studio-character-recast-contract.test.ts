import assert from 'node:assert/strict';
import test from 'node:test';
import {actionFromTool} from '../frontend/lib/studio/conversation-action-contract';
import {imageDraftSchema, draftSurface, hasDraftCreation} from '../frontend/src/lib/studio/image-conversation-contract';
import {imageConfirmationPayload} from '../frontend/src/lib/studio/image-quote-ui';
import {projectStudioQuoteDirections} from '../frontend/src/server/studio/conversation-history-facts';
import type {StoredImageTurn} from '../frontend/src/server/studio/image-conversation-repository';
import {createStudioConversationDirector, type StudioDirectorResponse} from '../frontend/src/server/studio/conversation-director';

const image = {type:'asset',kind:'image',assetId:'ma_11111111111111111111111111111111'};
const video = {type:'asset',kind:'video',assetId:'ma_22222222222222222222222222222222'};
const audio = {type:'job-output',kind:'audio',jobId:'job-audio',outputId:'output-audio'};
const recast = {
  reply:'Review the exact Character Recast quote before rendering.',
  portrait:{characterId:'4',lookId:'12'},
  product:image,
  video:{ref:video,range:{startSec:2.25,endSec:7}},
  audio:{ref:audio,range:{startSec:10,endSec:12.5}},
  direction:'Slow push in with a product close-up.',
  dialogue:'Ça marche.',
  seconds:7,resolution:'1080p',aspectRatio:'9:16',
} as const;

test('strict Character tools preserve selected look, independent ranges and the durable video draft', () => {
  assert.deepEqual(actionFromTool('character_list',{name:'Vesper',cursor:null}),{action:'character.list',name:'Vesper',cursor:null});
  assert.deepEqual(actionFromTool('character_get',{characterId:'4',lookName:'Late night',lookCursor:null}),{action:'character.get',characterId:'4',lookName:'Late night',lookCursor:null});
  const intent=actionFromTool('recast_prepare',recast);
  assert.deepEqual(intent,{action:'recast.prepare',...recast});
  const draft=imageDraftSchema.parse({reply:recast.reply,image:null,recast:intent});
  assert.equal(draftSurface(draft),'video');
  assert.equal(hasDraftCreation(draft),true);
  assert.deepEqual(draft.recast,intent);
  for(const invalid of [
    {...recast,projectId:'foreign'},
    {...recast,portrait:{...recast.portrait,assetId:image.assetId}},
    {...recast,audio:{...recast.audio,ref:video}},
    {...recast,video:{...recast.video,range:{startSec:9,endSec:8}}},
  ]) assert.throws(()=>actionFromTool('recast_prepare',invalid));
});

test('the director discovers an exact named look, prepares a dedicated quote and exposes no confirmation tool',async()=>{
  const calls=[['character_list',{name:'Vesper',cursor:null}],['character_get',{characterId:'4',lookName:'Late night',lookCursor:null}],['recast_prepare',recast]] as const;
  let index=0;
  const director=createStudioConversationDirector({mediaEnabled:true,characterEnabled:true,createResponse:async params=>{
    const [name,args]=calls[index++];
    const names=params.tools?.filter(tool=>tool.type==='function').map(tool=>tool.name);
    assert.ok(names?.includes(name));
    assert.ok(!names?.some(name=>name.includes('confirm')));
    return {id:'response-'+index,model:'gpt-6.1-sol',status:'completed',service_tier:'default',usage:null,output_text:'',output:[{type:'function_call',name,call_id:'character-'+index,arguments:JSON.stringify(args)}]} as StudioDirectorResponse;
  }});
  const result=await director({message:'Recast this with Vesper in her Late night look for 7 seconds.',history:[],references:[],
    project:{name:'Film',revision:0,memory:{revision:0,brief:'',decisions:[]}},
    checkpoint:async (_,create)=>create(),execute:async(_,action)=>{
      if(action.action==='character.list')return {ok:true,action:action.action,data:{characters:[{id:'4',name:'Vesper',lookCount:2}],nextCursor:null}};
      if(action.action==='character.get')return {ok:true,action:action.action,data:{id:'4',name:'Vesper',looks:[{id:'12',name:'Late night'}],nextLookCursor:null}};
      assert.equal(action.action,'recast.prepare');
      return {ok:true,action:action.action,data:{quoteId:'dedicated-quote',confirmationRequired:true}} as never;
    },
  });
  assert.equal(index,3);
  assert.deepEqual(result.recast,{action:'recast.prepare',...recast});
});

test('Recast confirmation carries the exact displayed USD amount and existing confirmations stay compatible',()=>{
  assert.deepEqual(imageConfirmationPayload('request','quote',{amountCents:218,currency:'USD'}),{requestId:'request',quoteId:'quote',confirmed:true,amountCents:218,currency:'USD'});
  assert.deepEqual(imageConfirmationPayload('request','quote'),{requestId:'request',quoteId:'quote',confirmed:true});
});


test('bounded Recast history retains exact dialogue and source selections when direction is truncated',()=>{
  const direction='Préserver le mouvement. '.repeat(80).trim();
  const dialogue='« Oui, j’arrive à 19 h. »';
  const requestId='123e4567-e89b-42d3-a456-426614174000';
  const quoteId='123e4567-e89b-42d3-a456-426614174001';
  const draft=imageDraftSchema.parse({reply:recast.reply,image:null,recast:{...recast,action:'recast.prepare',direction,dialogue}});
  const saved:StoredImageTurn={request_id:requestId,quote_id:quoteId,state:'ready',draft_json:draft,
    request_hash:'fixture',input_json:{requestId,message:'Prepare Recast.',references:[]},draft_reference_fingerprint:'fixture',
    model_attempts:1,lease_id:requestId,lease_expires_at:new Date(0),created_at:new Date(0)};
  const projected=projectStudioQuoteDirections([{...saved,state:'failed'},saved]);
  assert.equal(projected.length,1);
  const [fact]=projected;
  assert.ok('recast' in fact);
  assert.equal(fact.truncated,true);
  assert.equal(fact.recast.direction+direction.slice(fact.recast.direction.length),direction);
  assert.equal(fact.recast.direction.length+fact.recast.dialogue.length,1600);
  assert.equal(fact.recast.dialogue,dialogue);
  assert.deepEqual(fact.recast.portrait,recast.portrait);
  assert.deepEqual(fact.recast.audio,recast.audio);
  assert.deepEqual(fact.recast.video,recast.video);
});
