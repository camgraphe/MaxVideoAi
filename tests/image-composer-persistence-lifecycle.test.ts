import assert from 'node:assert/strict';
import test from 'node:test';
import {mountToolFixture} from './helpers/tool-selection-fixture';

const key=(owner:string)=>`maxvideoai.image.composer.v1:${owner}`;
const stored=(owner:string,aspectRatio:string)=>({version:5,engineId:'nano-banana-2-1',mode:'t2i',prompt:`Synthetic ${owner} draft`,numImages:1,aspectRatio,resolution:'1k',customImageSize:null,seed:null,outputFormat:null,quality:null,background:null,style:null,maskUrl:null,enableWebSearch:false,thinkingLevel:'medium',limitGenerations:false,watermark:false,referenceSlots:[]});
const source=`
import {useImageComposerPersistence} from './app/(core)/(workspace)/app/image/_hooks/useImageComposerPersistence';
import {listFalEngines} from './src/config/falEngines';
const entry=listFalEngines().find(x=>x.id==='nano-banana-2-1'),engines=window.emptyEngines?[]:[{id:entry.id,engineCaps:entry.engine,modes:['t2i','i2i'],aliases:[entry.id]}],references=[];
const setters=Object.fromEntries(['EngineId','Mode','NumImages','Resolution','Seed','OutputFormat','Quality','Background','Style','MaskUrl','EnableWebSearch','ThinkingLevel','LimitGenerations','Watermark','ReferenceSlots','CustomImageWidth','CustomImageHeight'].map(name=>['set'+name,noop]));
function Editor({owner}){const [aspectRatio,setAspectRatio]=useState(null),[prompt,setPrompt]=useState('');window.changeRatio=setAspectRatio;
 useImageComposerPersistence({...setters,accountId:owner,engines,engineId:entry.id,mode:'t2i',prompt,setPrompt,aspectRatio,setAspectRatio,numImages:1,resolution:'1k',customImageWidth:'',customImageHeight:'',seed:'',outputFormat:null,quality:null,background:null,style:null,maskUrl:'',enableWebSearch:false,thinkingLevel:'medium',limitGenerations:false,watermark:false,persistableReferenceSlots:references});
 return <output>{owner}:{aspectRatio}</output>;
}
function App(){const [owner,setOwner]=useState('owner-a'),[visible,setVisible]=useState(true);window.changeOwner=setOwner;window.hideEditor=()=>setVisible(false);return visible?<Editor key={owner} owner={owner}/>:null;}
`;

async function fixture(emptyEngines=false){
 return mountToolFixture(source,{},w=>{
  w.emptyEngines=emptyEngines;
  w.localStorage.setItem(key('owner-a'),JSON.stringify(stored('owner-a','1:1')));w.localStorage.setItem(key('owner-b'),JSON.stringify(stored('owner-b','9:16')));
  // Hold the browser timer boundary; lifecycle persistence must not rely on the debounce expiring.
  const timers=new Map<number,()=>void>();let next=10000;
  w.setTimeout=(fn:()=>void)=>{timers.set(++next,fn);return next;};w.clearTimeout=(id:number)=>timers.delete(id);
  w.pendingComposerTimers=timers;w.runPendingComposerTimers=()=>{const callbacks=[...timers.values()];timers.clear();callbacks.forEach(callback=>callback());};
 });
}
for(const event of ['pagehide','hidden','unmount'] as const)test(`Image persistence flushes the latest visible ratio on ${event} before its debounce`,async()=>{
 const f=await fixture();
 try{
  await f.act(()=>f.w.changeRatio('16:9'));
  assert.equal(JSON.parse(f.w.localStorage.getItem(key('owner-a'))).aspectRatio,'1:1','ordinary edits retain their debounced persistence');
  if(event==='unmount')await f.act(()=>f.w.hideEditor());else if(event==='pagehide')f.w.dispatchEvent(new f.w.Event('pagehide'));else{
   f.w.document.dispatchEvent(new f.w.Event('visibilitychange'));assert.equal(JSON.parse(f.w.localStorage.getItem(key('owner-a'))).aspectRatio,'1:1');
   Object.defineProperty(f.w.document,'visibilityState',{configurable:true,value:'hidden'});f.w.document.dispatchEvent(new f.w.Event('visibilitychange'));
  }
  const after=JSON.parse(f.w.localStorage.getItem(key('owner-a')));assert.equal(after.aspectRatio,'16:9');assert.equal(after.prompt,'Synthetic owner-a draft');assert.equal(after.customImageSize,null);
 }finally{await f.close();}
});

test('a successful Image lifecycle flush cancels its queued save and later edits still debounce normally',async()=>{
 const f=await fixture();
 try{
  await f.act(()=>f.w.changeRatio('16:9'));assert.ok(f.w.pendingComposerTimers.size>0);
  f.w.dispatchEvent(new f.w.Event('pagehide'));assert.equal(f.w.pendingComposerTimers.size,0);
  await f.act(()=>f.w.changeRatio('3:2'));assert.equal(JSON.parse(f.w.localStorage.getItem(key('owner-a'))).aspectRatio,'16:9');
  f.w.runPendingComposerTimers();assert.equal(JSON.parse(f.w.localStorage.getItem(key('owner-a'))).aspectRatio,'3:2');
 }finally{await f.close();}
});

test('leaving Image before catalogue hydration cannot overwrite its stored draft with unhydrated defaults',async()=>{
 const f=await fixture(true);
 try{
  const before=f.w.localStorage.getItem(key('owner-a'));f.w.dispatchEvent(new f.w.Event('pagehide'));await f.act(()=>f.w.hideEditor());
  assert.equal(f.w.localStorage.getItem(key('owner-a')),before);assert.equal(f.w.pendingComposerTimers.size,0);
 }finally{await f.close();}
});

test('retiring an Image account flushes its own draft and cannot write the next account payload into it',async()=>{
 const f=await fixture();
 try{
  await f.act(()=>f.w.changeRatio('16:9'));await f.act(()=>f.w.changeOwner('owner-b'));
  assert.equal(JSON.parse(f.w.localStorage.getItem(key('owner-a'))).aspectRatio,'16:9');assert.equal(f.w.document.querySelector('output').textContent,'owner-b:9:16');
  await f.act(()=>f.w.changeRatio('3:2'));f.w.dispatchEvent(new f.w.Event('pagehide'));
  const a=JSON.parse(f.w.localStorage.getItem(key('owner-a'))),b=JSON.parse(f.w.localStorage.getItem(key('owner-b')));
  assert.equal(a.aspectRatio,'16:9');assert.equal(a.prompt,'Synthetic owner-a draft');assert.equal(b.aspectRatio,'3:2');assert.equal(b.prompt,'Synthetic owner-b draft');
 }finally{await f.close();}
});

for(const refusal of ['throw','no-effect'] as const)test(`an ineffective Image lifecycle write (${refusal}) can retry the latest draft on a later lifecycle event`,async()=>{
 const f=await fixture();
 try{
  await f.act(()=>f.w.changeRatio('16:9'));const write=f.w.Storage.prototype.setItem;
  f.w.Storage.prototype.setItem=()=>{if(refusal==='throw')throw new Error('Synthetic storage refusal');};assert.doesNotThrow(()=>f.w.dispatchEvent(new f.w.Event('pagehide')));
  assert.equal(JSON.parse(f.w.localStorage.getItem(key('owner-a'))).aspectRatio,'1:1');
  f.w.Storage.prototype.setItem=write;f.w.dispatchEvent(new f.w.Event('pagehide'));assert.equal(JSON.parse(f.w.localStorage.getItem(key('owner-a'))).aspectRatio,'16:9');
 }finally{await f.close();}
});
