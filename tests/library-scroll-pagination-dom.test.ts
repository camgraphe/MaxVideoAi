import assert from 'node:assert/strict';
import test from 'node:test';
import { bundleClientFlow, createClientFlowDom } from './helpers/client-flow-dom';

const bundle = bundleClientFlow(`
import React,{act,useRef}from'react';import{createRoot}from'react-dom/client';
import{useLibraryScrollPagination}from'./components/library/useLibraryScrollPagination';
function Scene(){const ref=useRef(null);const owner=window.props.scopeKey;
const result=useLibraryScrollPagination({...window.props,scrollRef:ref,onLoadMore:()=>window.calls.push(owner)});
return <><div id="scroll" ref={ref}><div role="presentation"/></div><output>{result.manualRequired?'manual':'auto'}</output></>}
const root=createRoot(document.getElementById('root'));window.IS_REACT_ACT_ENVIRONMENT=true;
window.fx={act,render:()=>root.render(<Scene/>),unmount:()=>root.unmount()};
`, {});

async function fixture(height = 3000) {
  const dom = createClientFlowDom('/app/library'), w = dom.window as any;
  w.props = { scopeKey:'owner-A:all', progress:'12', layoutKey:'mosaic:128', enabled:true, busy:false, failed:false };
  w.calls=[];
  let frameId=0,timerId=100_000,scrollHeight=height;
  const frames=new Map<number,()=>void>(),timers=new Map<number,()=>void>();
  const realTimeout=w.setTimeout.bind(w),realClear=w.clearTimeout.bind(w);
  w.requestAnimationFrame=(callback:()=>void)=>{frames.set(++frameId,callback);return frameId;};
  w.cancelAnimationFrame=(id:number)=>frames.delete(id);
  w.setTimeout=(callback:()=>void,delay:number,...args:unknown[])=>{
    if(delay===15_000){timers.set(++timerId,callback);return timerId;}
    return realTimeout(callback,delay,...args);
  };
  w.clearTimeout=(id:number)=>{timers.delete(id);realClear(id);};
  w.eval(await bundle);
  await w.fx.act(async()=>w.fx.render());
  const element=w.document.getElementById('scroll');
  Object.defineProperties(element,{clientHeight:{get:()=>600},scrollHeight:{get:()=>scrollHeight}});
  const flush=async()=>w.fx.act(async()=>{const callbacks=[...frames.values()];frames.clear();for(const callback of callbacks)callback();});
  return {w,element,timers,flush,
    async render(patch:Record<string,unknown>){await w.fx.act(async()=>{Object.assign(w.props,patch);w.fx.render();});},
    async scroll(top:number){element.scrollTop=top;element.dispatchEvent(new w.Event('scroll'));await flush();},
    setHeight(value:number){scrollHeight=value;},
    async close(){await w.fx.act(async()=>w.fx.unmount());dom.window.close();},
  };
}

test('scroll pagination reads one next page near the end and waits for real progress',async()=>{
  const f=await fixture();
  try{
    await f.flush();assert.equal(f.w.calls.length,0,'initial browsing does not fetch every page');
    await f.scroll(2300);assert.equal(f.w.calls.length,1);
    await f.scroll(2350);await f.scroll(2400);assert.equal(f.w.calls.length,1,'same-frame/end events are deduplicated before loading is published');
    await f.render({busy:true});await f.scroll(2400);assert.equal(f.w.calls.length,1);
    f.setHeight(5000);await f.render({busy:false,progress:'24'});await f.flush();
    assert.equal(f.w.calls.length,1,'appending a page does not eagerly drain the remaining library');
    await f.scroll(4350);assert.equal(f.w.calls.length,2);
    await f.render({enabled:false,progress:'36'});await f.scroll(4400);assert.equal(f.w.calls.length,2,'the final cursor stops loading');
  }finally{await f.close();}
});

test('short pages fill the viewport, stalled pages expose manual recovery and retired scopes cannot load',async()=>{
  const f=await fixture(400);
  try{
    await f.flush();assert.equal(f.w.calls.length,1,'an underfilled viewport requests its next page');
    await f.render({busy:true});await f.render({busy:false});await f.flush();
    assert.equal(f.w.calls.length,1,'a page without new records never creates a request loop');
    const oldTimer=[...f.timers.values()][0];assert.ok(oldTimer);
    await f.w.fx.act(async()=>oldTimer());assert.equal(f.w.document.querySelector('output').textContent,'manual');
    await f.render({scopeKey:'owner-B:collection',progress:'12'});await f.flush();
    assert.equal(f.w.calls.join(','),'owner-A:all,owner-B:collection');
    assert.equal(f.w.document.querySelector('output').textContent,'auto');
    await f.w.fx.act(async()=>oldTimer());assert.equal(f.w.document.querySelector('output').textContent,'auto','retired fallback cannot affect the new account');
    Object.defineProperty(f.w.document,'visibilityState',{configurable:true,value:'hidden'});
    await f.render({scopeKey:'owner-B:audio'});await f.flush();assert.equal(f.w.calls.length,2);
    Object.defineProperty(f.w.document,'visibilityState',{configurable:true,value:'visible'});
    Object.defineProperty(f.w.navigator,'onLine',{configurable:true,value:false});
    await f.scroll(0);assert.equal(f.w.calls.length,2);
    Object.defineProperty(f.w.navigator,'onLine',{configurable:true,value:true});
    f.w.dispatchEvent(new f.w.Event('online'));await f.flush();assert.equal(f.w.calls.at(-1),'owner-B:audio');
    await f.render({failed:true});await f.scroll(0);
    assert.equal(f.w.document.querySelector('output').textContent,'manual');assert.equal(f.w.calls.length,3,'errors do not retry themselves');
  }finally{await f.close();}
});
