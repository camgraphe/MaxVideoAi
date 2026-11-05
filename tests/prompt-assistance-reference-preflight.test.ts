import assert from 'node:assert/strict';
import test from 'node:test';
import {mountToolFixture} from './helpers/tool-selection-fixture';

const source=`import {usePromptAssistanceTransport} from './components/composer/usePromptAssistanceTransport';
function App(){const transport=usePromptAssistanceTransport('reference-preflight',true,(result)=>window.results.push(result));window.probe=transport;return <output>{transport.referencePreflight?.label??''}</output>;}`;
const valid={type:'job-output',jobId:'owned-job',outputId:'owned-output',kind:'image'};
const request=(surface='image',references:any[]=[]):any=>({draftRevision:0,locale:'en',message:'Keep this unsent instruction.',draft:{surface,engineId:'fixture',mode:'fixture',target:'prompt',text:'Original draft',settings:{resolution:'2k'},references}});
const mount=()=>mountToolFixture(source,{},w=>{w.fetch=w.fixtureFetch;w.results=[];});

for(const [surface,kind,label]of [['image','image','Image 1'],['video','video','Video 1'],['audio','audio','Audio 1']])test(`${surface} null identity is local, while optional absence and canonical references remain admissible`,async()=>{
 const f=await mount();try{
  const broken={fieldId:'references',slot:0,label,ref:null},kept={fieldId:'references',slot:1,label:'Image 2',ref:valid};
  let accepted=true;
  await f.act(()=>{accepted=f.w.probe.send(request(surface,[broken,kept]),1);});
  assert.equal(accepted,false);assert.equal(f.w.requests.length,0);assert.equal(f.w.results.length,0);
  assert.equal(f.w.probe.referencePreflight.label,label);assert.equal(f.w.probe.error,null);assert.equal(f.w.probe.recovery,false);assert.equal(f.w.probe.waiting,false);
  assert.equal([...Array(f.w.sessionStorage.length)].some((_,i)=>JSON.parse(f.w.sessionStorage.getItem(f.w.sessionStorage.key(i))).pending),false);
  for(const references of [[],[{fieldId:'references',slot:0,label,ref:{type:'asset',assetId:'ma_'+'b'.repeat(32),kind}}]]){
   await f.act(()=>{accepted=f.w.probe.send(request(surface,references),2);});
   assert.equal(accepted,true);const call=f.w.requests.at(-1),sent=JSON.parse(call.init.body).request;
   assert.deepEqual(sent.draft.references,references);
   await f.respond(call,{ok:true,result:{sessionId:sent.sessionId,requestId:sent.requestId,state:'complete',reply:{reply:'Ready.',text:null}}});
  }
 }finally{await f.close();}
});

test('a reference becoming null never blocks recovery or replaces the identity of a previously sent request',async()=>{
 const f=await mount();try{
  const original=request('image',[{fieldId:'image_urls',slot:0,label:'Image 1',ref:valid}]);
  await f.act(()=>{assert.equal(f.w.probe.send(original,1),true);});
  const sent=JSON.parse(f.w.requests[0].init.body).request;
  await f.act(()=>{f.w.requests[0].reject(new TypeError('Lost acknowledgement'));});
  assert.equal(f.w.probe.recovery,true);
  await f.act(()=>{assert.equal(f.w.probe.send(request('image',[{fieldId:'image_urls',slot:0,label:'Image 1',ref:null}]),2),false);f.w.probe.recover();});
  assert.equal(f.w.requests.length,2);assert.equal(f.w.probe.referencePreflight,null);
  const recovery=JSON.parse(f.w.requests[1].init.body);
  assert.deepEqual(recovery,{action:'recover',sessionId:sent.sessionId,requestId:sent.requestId});
  await f.respond(f.w.requests[1],{ok:true,result:{sessionId:sent.sessionId,requestId:sent.requestId,state:'complete',reply:{reply:'Recovered once.',text:null}}});
  assert.equal(f.w.results.length,1);assert.equal(f.w.probe.recovery,false);
 }finally{await f.close();}
});
