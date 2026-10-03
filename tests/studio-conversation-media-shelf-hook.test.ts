import assert from 'node:assert/strict';
import test from 'node:test';
import {JSDOM} from 'jsdom';
import * as React from 'react';
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {useConversationMediaShelf} from '../frontend/app/(core)/(workspace)/app/studio/conversation/[projectId]/_hooks/useConversationMediaShelf';
import {imageTurnInputSchema,type ImageConversationTurn,type ImageTurnInput} from '../frontend/src/lib/studio/image-conversation-contract';

const asset=(number:number,kind:'image'|'video'|'audio'='image')=>({assetId:'ma_'+number.toString(16).padStart(32,'0'),kind,url:'https://example.com/media'});
const requestId='a2899f64-2203-4771-9836-ec6abb8f9bdd';
function turn(referenceMentions:NonNullable<ImageTurnInput['referenceMentions']>):ImageConversationTurn {
  return {requestId,message:'Use these references',references:referenceMentions.map(item=>item.assetId),referenceMentions,
    reply:'Ready',state:'ready',retryable:false,quote:null,generation:null,createdAt:'2026-10-03T10:00:00.000Z'};
}
function deferred<T>() {
  let resolve!:(value:T)=>void;
  const promise=new Promise<T>(done=>{resolve=done;});
  return {promise,resolve};
}
type UploadResponse={ok:boolean;payload:unknown};
async function mount(initialTurns:ImageConversationTurn[]=[],mediaEnabled=true,desktop=true) {
  const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/'});
  const mediaListeners=new Set<()=>void>();
  Object.defineProperty(dom.window,'matchMedia',{value:()=>({get matches(){return desktop;},
    addEventListener:(_event:string,listener:()=>void)=>mediaListeners.add(listener),
    removeEventListener:(_event:string,listener:()=>void)=>mediaListeners.delete(listener)})});
  const old=new Map<string,PropertyDescriptor|undefined>();
  const responses:Array<()=>Promise<UploadResponse>>=[];
  const requests:Array<{url:string;options:RequestInit|undefined}>=[];
  for(const [key,value] of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,
    File:dom.window.File,FormData:dom.window.FormData,IS_REACT_ACT_ENVIRONMENT:true,
    fetch:async(url:string,options?:RequestInit)=>{
      requests.push({url,options});
      const response=await responses.shift()?.();
      if(!response)throw new Error('Unexpected upload');
      return {ok:response.ok,json:async()=>response.payload};
    }})) {
    old.set(key,Object.getOwnPropertyDescriptor(globalThis,key));
    Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});
  }
  let turns=initialTurns;
  let state!:ReturnType<typeof useConversationMediaShelf>;
  function Fixture(){state=useConversationMediaShelf(turns,'en',mediaEnabled);return null;}
  const root=createRoot(dom.window.document.getElementById('root')!);
  const render=()=>root.render(React.createElement(React.StrictMode,null,React.createElement(Fixture)));
  await act(async()=>render());
  let unmounted=false;
  return {
    get state(){return state;},requests,
    file:(name='image.png',type='image/png')=>new dom.window.File(['fixture'],name,{type}),
    queue(response:UploadResponse|(()=>Promise<UploadResponse>)){responses.push(typeof response==='function'?response:async()=>response);},
    async rerender(next:ImageConversationTurn[]){turns=next;await act(async()=>render());},
    async viewport(isDesktop:boolean){desktop=isDesktop;await act(async()=>{for(const listener of mediaListeners)listener();});},
    async unmount(){if(!unmounted){await act(async()=>root.unmount());unmounted=true;}},
    async close(){if(!unmounted)await act(async()=>root.unmount());dom.window.close();for(const [key,value] of old){if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);}},
  };
}
function currentInput(view:Awaited<ReturnType<typeof mount>>):ImageTurnInput {
  const refs=view.state.references;
  return {requestId,message:refs.map(item=>'@'+item.label).join(' '),references:refs.filter(item=>item.kind==='image'||!item.kind).map(item=>item.assetId),
    attachments:refs.flatMap(item=>item.kind==='video'||item.kind==='audio'?[{type:'asset' as const,assetId:item.assetId,kind:item.kind}]:[]),
    referenceMentions:refs.map(({assetId,label})=>({assetId,label}))};
}

test('duplicate media stays one exact attachment; eight is enforced and detach/reattach retains its label',async()=>{
  const view=await mount();
  try {
    await act(async()=>{view.state.attach(asset(1));view.state.attach({...asset(1),name:'renamed.png'});});
    assert.equal(view.state.references.length,1);
    assert.equal(view.state.items.length,1);
    assert.equal(view.state.references[0].label,'Image 1');
    await act(async()=>{for(let index=2;index<=8;index++)view.state.attach(asset(index));});
    await act(async()=>{assert.equal(view.state.attach(asset(9)),null);});
    assert.equal(view.state.references.length,8);
    assert.equal(view.state.items.length,8);
    assert.match(view.state.error??'',/eight/);
    await act(async()=>{view.state.detach(asset(1).assetId);view.state.attach(asset(1));});
    assert.equal(view.state.references.at(-1)?.label,'Image 1');
    assert.equal(view.state.items.length,8);
    assert.equal(imageTurnInputSchema.safeParse(currentInput(view)).success,true);
  }finally{await view.close();}
});

test('mobile attachments keep the conversation visible and resizing narrower collapses the shelf',async()=>{
  const view=await mount([],true,false);
  try {
    assert.equal(view.state.expanded,false);
    await act(async()=>view.state.attach(asset(1)));
    assert.equal(view.state.expanded,false);
    await view.viewport(true);
    await act(async()=>view.state.attach(asset(2)));
    assert.equal(view.state.expanded,true);
    await view.viewport(false);
    assert.equal(view.state.expanded,false);
    assert.equal(view.state.references.length,2);
  }finally{await view.close();}
});

test('late history with a reused label cannot create two current targets for the same mention',async()=>{
  const view=await mount();
  try {
    await act(async()=>{view.state.attach(asset(1));});
    await view.rerender([turn([{assetId:asset(2).assetId,label:'Image 1'}])]);
    await act(async()=>{view.state.attach(asset(2));});
    assert.deepEqual(view.state.references.map(item=>[item.assetId,item.label]),[[asset(1).assetId,'Image 1'],[asset(2).assetId,'Image 2']]);
    assert.equal(new Set(view.state.items.map(item=>item.label)).size,view.state.items.length);
    assert.equal(imageTurnInputSchema.safeParse(currentInput(view)).success,true);
  }finally{await view.close();}
});

test('restoring a pending draft preserves its exact aliases and safely relabels other shelf media',async()=>{
  const view=await mount([turn([{assetId:asset(1).assetId,label:'Image 1'},{assetId:asset(2).assetId,label:'Image 7'}])]);
  try {
    const saved:ImageTurnInput={requestId,message:'Brighten @Image 7',references:[asset(1).assetId],referenceMentions:[{assetId:asset(1).assetId,label:'Image 7'}]};
    await act(async()=>view.state.restore(saved));
    assert.deepEqual(view.state.references.map(({assetId,label})=>({assetId,label})),saved.referenceMentions);
    assert.equal(view.state.items.find(item=>item.assetId===asset(2).assetId)?.label,'Image 8');
    await act(async()=>view.state.attach(asset(2)));
    assert.equal(imageTurnInputSchema.safeParse(currentInput(view)).success,true);
    assert.equal(new Set(view.state.items.map(item=>item.label)).size,view.state.items.length);
  }finally{await view.close();}
});

test('reloading turn aliases reuses the latest label and keeps image/video/audio identity distinct',async()=>{
  const history=[turn([{assetId:asset(1).assetId,label:'Image 1'}]),turn([{assetId:asset(1).assetId,label:'Image 7'},{assetId:asset(2).assetId,label:'Video 3'},{assetId:asset(3).assetId,label:'Audio 2'}])];
  const view=await mount(history);
  try {
    await act(async()=>{view.state.attach(asset(1));view.state.attach(asset(2,'video'));view.state.attach(asset(3,'audio'));});
    assert.deepEqual(view.state.references.map(item=>item.label),['Image 7','Video 3','Audio 2']);
    assert.equal(imageTurnInputSchema.safeParse(currentInput(view)).success,true);
    assert.equal(view.requests.length,0);
  }finally{await view.close();}
});

test('an unsupported or over-cap upload batch fails before importing any file',async()=>{
  const view=await mount();
  try {
    await act(async()=>view.state.attach(asset(1)));
    await act(async()=>view.state.upload([view.file(),view.file('vector.svg','image/svg+xml')]));
    assert.equal(view.requests.length,0);
    assert.deepEqual(view.state.references.map(item=>item.assetId),[asset(1).assetId]);
    assert.match(view.state.error??'',/supported/);
    await act(async()=>view.state.upload(Array.from({length:8},()=>view.file())));
    assert.equal(view.requests.length,0);
    assert.match(view.state.error??'',/eight/);
    assert.equal(view.state.uploading,false);
  }finally{await view.close();}
});

test('image-only Studio refuses a video upload before network work',async()=>{
  const view=await mount([],false);
  try {
    await act(async()=>view.state.upload([view.file('clip.mp4','video/mp4')]));
    assert.equal(view.requests.length,0);
    assert.match(view.state.error??'',/PNG, JPEG or WebP/);
  }finally{await view.close();}
});

test('image-only Studio cannot reattach historical video or audio and submit an unbound mention',async()=>{
  const view=await mount([turn([{assetId:asset(2).assetId,label:'Video 3'},{assetId:asset(3).assetId,label:'Audio 2'}])],false);
  try {
    await act(async()=>view.state.attach(asset(1)));
    for(const item of [asset(2,'video'),asset(3,'audio')]) {
      await act(async()=>{assert.equal(view.state.attach(item),null);});
      assert.ok(view.state.error);
    }
    assert.deepEqual(view.state.references.map(item=>item.assetId),[asset(1).assetId]);
    const input=currentInput(view);
    delete input.attachments;
    assert.equal(imageTurnInputSchema.safeParse(input).success,true);
  }finally{await view.close();}
});

test('restored unsupported references keep their exact aliases until removed and then clear their warning',async()=>{
  const view=await mount([],false);
  try {
    const saved:ImageTurnInput={requestId,message:'Use @Video 3',references:[],attachments:[{type:'asset',assetId:asset(2).assetId,kind:'video'}],referenceMentions:[{assetId:asset(2).assetId,label:'Video 3'}]};
    await act(async()=>view.state.restore(saved));
    assert.deepEqual(view.state.references.map(({assetId,label})=>({assetId,label})),saved.referenceMentions);
    assert.match(view.state.error??'',/Remove the video or audio references/);
    await act(async()=>view.state.detach(asset(2).assetId));
    assert.deepEqual(view.state.references,[]);
    assert.equal(view.state.items.length,1);
    assert.equal(view.state.error,null);
  }finally{await view.close();}
});

test('a partial upload failure retains prior and completed attachments and visibly stops the batch',async()=>{
  const view=await mount();
  try {
    await act(async()=>view.state.attach(asset(1)));
    view.queue({ok:true,payload:{ok:true,asset:asset(2)}});
    view.queue({ok:false,payload:{ok:false}});
    await act(async()=>view.state.upload([view.file('one.png'),view.file('two.png'),view.file('three.png')]));
    assert.equal(view.requests.length,2);
    assert.deepEqual(view.state.references.map(item=>item.assetId),[asset(1).assetId,asset(2).assetId]);
    assert.match(view.state.error??'',/import did not finish/);
    assert.equal(view.state.uploading,false);
    assert.equal(imageTurnInputSchema.safeParse(currentInput(view)).success,true);
  }finally{await view.close();}
});

test('an upload completing after history refresh uses current aliases without collisions',async()=>{
  const view=await mount();
  const response=deferred<UploadResponse>();
  try {
    view.queue(()=>response.promise);
    let upload!:Promise<void>;
    await act(async()=>{upload=view.state.upload([view.file()]);});
    assert.equal(view.state.uploading,true);
    await view.rerender([turn([{assetId:asset(1).assetId,label:'Image 1'}])]);
    await act(async()=>{response.resolve({ok:true,payload:{ok:true,asset:asset(2)}});await upload;});
    await act(async()=>view.state.attach(asset(1)));
    assert.deepEqual(view.state.references.map(item=>[item.assetId,item.label]),[[asset(2).assetId,'Image 2'],[asset(1).assetId,'Image 1']]);
    assert.equal(imageTurnInputSchema.safeParse(currentInput(view)).success,true);
  }finally{await view.close();}
});

test('unmount during an upload prevents attaching its result or uploading the remaining files',async()=>{
  const view=await mount();
  const response=deferred<UploadResponse>();
  try {
    view.queue(()=>response.promise);
    let upload!:Promise<void>;
    await act(async()=>{upload=view.state.upload([view.file('one.png'),view.file('two.png')]);});
    await view.unmount();
    response.resolve({ok:true,payload:{ok:true,asset:asset(1)}});
    await upload;
    assert.equal(view.requests.length,1);
    assert.deepEqual(view.state.references,[]);
  }finally{await view.close();}
});
