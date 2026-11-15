import assert from 'node:assert/strict';
import test from 'node:test';

const actor={authMethod:'studio-session' as const,userId:'owner',projectId:'film',clientId:null};
const operationId='12345678-1234-4234-8234-123456789abc';
const source={type:'asset' as const,assetId:'ma_11111111111111111111111111111111',kind:'video' as const};
const quote={operationId,toolId:'subtitles' as const,kind:'transcribe' as const,price:{amountCents:17,currency:'USD' as const},expiresAt:new Date(Date.now()+60000).toISOString(),confirmationRequired:true as const};

async function fixture(enabled=true){
  const module=await import('../frontend/src/server/studio/conversation-creator').catch(()=>null);
  assert.ok(module?.createStudioCreatorToolsService,'Studio needs the canonical creator operation adapter');
  let state='prepared',confirms=0,prepared=0;
  const actors:unknown[]=[];
  const service=module.createStudioCreatorToolsService(actor,{enabled,attachedRefs:[source],accountUrl:'https://review.example.test',readProjectMedia:async()=>[],
    subtitles:((current:any,options:any)=>{actors.push(current);return{
      prepare:async(value:any)=>{prepared++;assert.deepEqual(value,{source,keyterms:[]});const row={id:operationId,operation_kind:'transcribe',pricing_snapshot:{totalCents:17,currency:'USD'},expires_at:quote.expiresAt,request_snapshot:{}};await options.onPrepared?.(row,{});return{operationId,kind:'transcribe',quote:{price:quote.price,expiresAt:quote.expiresAt},state};},
      status:async()=>({operationId,kind:'transcribe',state,jobId:state==='prepared'?null:'subtitle_'+operationId,quote:{price:quote.price,expiresAt:quote.expiresAt},result:state==='completed'?{documentId:'captions',revision:1}:null}),
      confirm:async()=>{confirms++;state='queued';return{operationId,state,jobId:'subtitle_'+operationId,result:null};},
    };}) as never,readAccess:async(_owner:any,value:any)=>value,
  });
  return {service,actors,counts:()=>({confirms,prepared}),setState:(value:string)=>{state=value;}};
}

test('Studio creator preparation checkpoints the owned operation without submitting or losing its exact price',async()=>{
  const {service,actors,counts}=await fixture();let checkpoint:any;
  const prepared=await service.prepare({action:'creator.prepare',reply:'Review.',toolId:'subtitles',inputs:[{role:'source',source}],settings:[],keyterms:[]},async(value)=>{checkpoint=value;});
  assert.deepEqual(prepared,quote);assert.deepEqual(checkpoint,quote);assert.deepEqual(counts(),{prepared:1,confirms:0});
  assert.ok(actors.every(value=>JSON.stringify(value)===JSON.stringify(actor)));
  await assert.rejects(service.prepare({action:'creator.prepare',reply:'Review.',toolId:'subtitles',inputs:[{role:'source',source:{...source,assetId:'unattached'}}],settings:[],keyterms:[]}),{code:'REFERENCE_INVALID'});
  assert.equal(counts().prepared,1);
});
test('Studio creator confirmation matches the saved exact price, then recovers accepted work without another dispatch',async()=>{
  const {service,counts}=await fixture();
  await assert.rejects(service.confirm(quote,{amountCents:18,currency:'USD'}),{code:'PARAMETER_INVALID'});
  assert.equal(counts().confirms,0);
  assert.equal((await service.confirm(quote,quote.price)).state,'queued');
  assert.equal((await service.confirm(quote,quote.price)).state,'queued');
  assert.equal(counts().confirms,1);
});
test('Studio creator status keeps completed document delivery and remains readable when execution closes',async()=>{
  const {service,setState,counts}=await fixture(false);setState('completed');
  const result=await service.read(quote);
  assert.equal(result.state,'completed');assert.equal(result.confirmationEnabled,false);assert.equal(result.retry.afterSeconds,null);
  assert.equal(result.result?.document?.openUrl,'/app/tools/subtitles?document=captions&revision=1');
  assert.equal(result.result?.document?.srtUrl,'/api/tools/subtitles/documents/captions/download?format=srt&revision=1');
  assert.equal(counts().confirms,0);
});
