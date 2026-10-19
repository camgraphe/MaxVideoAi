import assert from 'node:assert/strict';
import test from 'node:test';
import { mountToolFixture } from './helpers/tool-selection-fixture';

async function fixture() {
  return mountToolFixture(`
    import {CreatorVideoComparison} from './src/components/tools/creator/CreatorVideoComparison.client';
    function App(){return <CreatorVideoComparison locale="en" sourceUrl="https://private.invalid/source.mp4?signature=source" resultUrl="https://private.invalid/result.mp4?signature=result" sourceStartSec={3} sourceEndSec={9}/>}
  `, {'./creator-workspace.module.css':'export default {};'}, w => {
    w.plays=[];w.pauses=[];
    Object.defineProperty(w.HTMLMediaElement.prototype,'duration',{get(){return this.getAttribute('aria-label')==='Original' ? 12 : 8;}});
    Object.defineProperty(w.HTMLMediaElement.prototype,'readyState',{get(){return 4;}});
    Object.defineProperty(w.HTMLMediaElement.prototype,'paused',{get(){return !this.testPlaying;}});
    w.HTMLMediaElement.prototype.play=function(){this.testPlaying=true;w.plays.push(this);return Promise.resolve();};
    w.HTMLMediaElement.prototype.pause=function(){this.testPlaying=false;w.pauses.push(this);};
  });
}
const button=(f:any,label:string)=>Array.from(f.w.document.querySelectorAll('button')).find((node:any)=>node.textContent===label) as HTMLButtonElement;
async function event(f:any,node:any,type:string){await f.act(async()=>node.dispatchEvent(new f.w.Event(type,{bubbles:true})));}

test('private video comparison loads only on intent and synchronizes the selected source segment, seek, drift and shortest end',async()=>{
  const f=await fixture();try{
    const [before,after]=f.w.document.querySelectorAll('video');
    assert.equal(before.src,'https://private.invalid/source.mp4?signature=source');
    assert.equal(after.src,'https://private.invalid/result.mp4?signature=result');
    assert.equal(before.preload,'none');assert.equal(after.preload,'none');assert.equal(before.autoplay,false);assert.equal(after.autoplay,false);assert.equal(f.w.plays.length,0);
    await event(f,before,'loadedmetadata');await event(f,after,'loadedmetadata');
    assert.equal(before.currentTime,3);assert.equal(after.currentTime,0);assert.equal(before.muted,true);
    const range=f.w.document.querySelector('input[type="range"]');assert.equal(Number(range.max),6);
    await f.act(async()=>button(f,'Play both').click());assert.equal(f.w.plays.length,2);
    after.currentTime=2;before.currentTime=4;await event(f,after,'timeupdate');assert.equal(before.currentTime,5);
    await f.act(async()=>{Object.getOwnPropertyDescriptor(f.w.HTMLInputElement.prototype,'value')!.set!.call(range,'4');range.dispatchEvent(new f.w.Event('input',{bubbles:true}));});
    assert.equal(before.currentTime,7);assert.equal(after.currentTime,4);
    await f.act(async()=>button(f,'Pause').click());assert.equal(before.paused,true);assert.equal(after.paused,true);
    await f.act(async()=>button(f,'Play both').click());after.currentTime=6.1;await event(f,after,'timeupdate');
    assert.equal(before.paused,true);assert.equal(after.paused,true);assert.equal(before.currentTime,9);assert.equal(after.currentTime,6);
    await f.act(async()=>button(f,'Play both').click());assert.equal(before.currentTime,3);assert.equal(after.currentTime,0);
  }finally{await f.close();}
});
test('buffering, playback errors and hidden tabs stop both readers without changing private sources',async()=>{
  const f=await fixture();try{
    const [before,after]=f.w.document.querySelectorAll('video');await event(f,before,'loadedmetadata');await event(f,after,'loadedmetadata');
    await f.act(async()=>button(f,'Play both').click());await event(f,before,'waiting');assert.equal(before.paused,true);assert.equal(after.paused,true);
    await event(f,before,'canplay');assert.equal(before.paused,false);assert.equal(after.paused,false);
    await event(f,after,'error');assert.equal(before.paused,true);assert.equal(after.paused,true);assert.ok(f.w.document.querySelector('[role="alert"]'));assert.equal(button(f,'Play both').disabled,true);
    assert.equal(after.src,'https://private.invalid/result.mp4?signature=result');
  }finally{await f.close();}
  const hidden=await fixture();try{
    const videos=hidden.w.document.querySelectorAll('video');await hidden.act(async()=>button(hidden,'Play both').click());
    Object.defineProperty(hidden.w.document,'visibilityState',{value:'hidden',configurable:true});await event(hidden,hidden.w.document,'visibilitychange');
    assert.ok(Array.from(videos).every((node:any)=>node.paused));const count=hidden.w.plays.length;
    Object.defineProperty(hidden.w.document,'visibilityState',{value:'visible',configurable:true});await event(hidden,hidden.w.document,'visibilitychange');assert.equal(hidden.w.plays.length,count);
  }finally{await hidden.close();}
});
