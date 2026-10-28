import assert from 'node:assert/strict';
import test from 'node:test';
import { mountToolFixture } from './helpers/tool-selection-fixture';

async function fixture(ready = 4) {
  return mountToolFixture(`
    import {useVideoBackgroundComparison} from './app/tools/video-background-changer/_components/useVideoBackgroundComparison';
    function App(){const pair=useVideoBackgroundComparison({source:{src:'https://media.invalid/source.mp4',poster:'/s.webp',width:1920,height:1080,durationSec:6},result:{src:'https://media.invalid/result.mp4',poster:'/r.webp',width:1280,height:720,durationSec:6.037007}});window.pair=pair;return <><video aria-label="source" ref={pair.source.videoRef} src="https://media.invalid/source.mp4" preload="none" {...pair.source.events}/><video aria-label="result" ref={pair.result.videoRef} src="https://media.invalid/result.mp4" preload="none" {...pair.result.events}/></>;}
  `, { '@/lib/analytics-client': 'export const dispatchAnalyticsEvent=()=>{};' }, w => {
    w.mediaReady=ready;w.plays=[];w.loads=[];
    Object.defineProperty(w.HTMLMediaElement.prototype,'duration',{get(){return this.getAttribute('aria-label')==='source'?6:6.037007;}});
    Object.defineProperty(w.HTMLMediaElement.prototype,'readyState',{get(){return w.mediaReady;}});
    Object.defineProperty(w.HTMLMediaElement.prototype,'paused',{get(){return !this.testPlaying;}});
    Object.defineProperty(w.HTMLMediaElement.prototype,'ended',{get(){return this.currentTime>=this.duration;}});
    w.HTMLMediaElement.prototype.play=function(){this.testPlaying=true;w.plays.push(this);this.dispatchEvent(new w.Event('play'));this.dispatchEvent(new w.Event('playing'));return Promise.resolve();};
    w.HTMLMediaElement.prototype.pause=function(){if(!this.testPlaying)return;this.testPlaying=false;this.dispatchEvent(new w.Event('pause'));};
    w.HTMLMediaElement.prototype.load=function(){w.loads.push(this);};
  });
}
async function event(f:any,node:any,name:string){await f.act(async()=>node.dispatchEvent(new f.w.Event(name,{bubbles:true})));}
async function metadata(f:any){for(const node of f.w.document.querySelectorAll('video'))await event(f,node,'loadedmetadata');}

test('the public pair starts only on intent, seeks both originals and exposes only one selected sound track',async()=>{
  const f=await fixture();try{
    const [source,result]=f.w.document.querySelectorAll('video');
    assert.equal(f.w.plays.length,0);assert.ok(source.muted&&result.muted);
    await metadata(f);await f.act(async()=>f.w.pair.togglePlayback());
    assert.equal(source.paused,false);assert.equal(result.paused,false);
    await f.act(async()=>f.w.pair.seek(4));assert.equal(source.currentTime,4);assert.equal(result.currentTime,4);
    await f.act(async()=>f.w.pair.setSound('source'));assert.equal(source.muted,false);assert.equal(result.muted,true);
    await f.act(async()=>f.w.pair.setSound('result'));assert.equal(source.muted,true);assert.equal(result.muted,false);
    await f.act(async()=>f.w.pair.setSound('off'));assert.ok(source.muted&&result.muted);
    await f.act(async()=>f.w.pair.togglePlayback());assert.ok(source.paused&&result.paused);
  }finally{await f.close();}
});

test('the shorter source never cuts the complete result audio tail and replay starts at zero',async()=>{
  const f=await fixture();try{
    const [source,result]=f.w.document.querySelectorAll('video');await metadata(f);
    await f.act(async()=>f.w.pair.togglePlayback());
    source.currentTime=6;source.testPlaying=false;await event(f,source,'ended');
    assert.equal(result.paused,false,'the result must finish its complete container');
    result.currentTime=6.037007;result.testPlaying=false;await event(f,result,'ended');
    assert.ok(source.paused&&result.paused);assert.equal(f.w.pair.duration,6.037007);
    await f.act(async()=>f.w.pair.togglePlayback());assert.equal(source.currentTime,0);assert.equal(result.currentTime,0);
  }finally{await f.close();}
});

test('paused seeking before metadata is retained and does not start either video',async()=>{
  const f=await fixture(0);try{
    const [source,result]=f.w.document.querySelectorAll('video');
    await f.act(async()=>f.w.pair.seek(3.2));assert.equal(f.w.loads.length,2);assert.equal(f.w.plays.length,0);
    f.w.mediaReady=4;await metadata(f);
    assert.equal(source.currentTime,3.2);assert.equal(result.currentTime,3.2);assert.ok(source.paused&&result.paused);
  }finally{await f.close();}
});

test('buffering pauses the pair, errors stay retryable and hidden tabs never resume automatically',async()=>{
  const f=await fixture();try{
    const [source,result]=f.w.document.querySelectorAll('video');await metadata(f);await f.act(async()=>f.w.pair.togglePlayback());
    await event(f,source,'waiting');assert.ok(source.paused&&result.paused);
    await event(f,source,'canplay');assert.equal(source.paused,false);assert.equal(result.paused,false);
    await event(f,result,'error');assert.ok(source.paused&&result.paused);assert.equal(f.w.pair.failed,true);
    await f.act(async()=>f.w.pair.togglePlayback());assert.equal(source.paused,false);assert.equal(result.paused,false);
    Object.defineProperty(f.w.document,'visibilityState',{value:'hidden',configurable:true});await event(f,f.w.document,'visibilitychange');assert.ok(source.paused&&result.paused);
    const n=f.w.plays.length;Object.defineProperty(f.w.document,'visibilityState',{value:'visible',configurable:true});await event(f,f.w.document,'visibilitychange');assert.equal(f.w.plays.length,n);
    assert.equal(source.src,'https://media.invalid/source.mp4');assert.equal(result.src,'https://media.invalid/result.mp4');
  }finally{await f.close();}
});

test('a rejected play request pauses the other track and leaves an explicit retry state',async()=>{
  const f=await fixture();try{
    const [source,result]=f.w.document.querySelectorAll('video');await metadata(f);
    result.play=()=>Promise.reject(new Error('play denied'));
    await f.act(async()=>f.w.pair.togglePlayback());
    assert.ok(source.paused&&result.paused);assert.equal(f.w.pair.failed,true);
  }finally{await f.close();}
});

test('natural completion keeps the final media state instead of seeking the finished result again',async()=>{
  const f=await fixture();try{
    const [source,result]=f.w.document.querySelectorAll('video');await metadata(f);await f.act(async()=>f.w.pair.togglePlayback());
    source.currentTime=6;source.testPlaying=false;await event(f,source,'ended');
    let end=true, time=6.037007;
    Object.defineProperty(result,'currentTime',{configurable:true,get:()=>time,set:value=>{time=value;end=false;}});
    Object.defineProperty(result,'ended',{configurable:true,get:()=>end});result.testPlaying=false;
    await event(f,result,'ended');
    assert.equal(result.ended,true,'seeking a completed file clears its natural ended state in the browser');
  }finally{await f.close();}
});

test('play after a paused seek does not restart the same pending browser seek',async()=>{
  const f=await fixture();try{
    const nodes=Array.from(f.w.document.querySelectorAll('video')) as any[];await metadata(f);
    const seeks:number[]=[];
    for(const node of nodes){let time=0;Object.defineProperty(node,'currentTime',{configurable:true,get:()=>time,set:value=>{time=value;seeks.push(value);}});}
    await f.act(async()=>f.w.pair.seek(5.8));
    const completedRequests=seeks.length;
    await f.act(async()=>f.w.pair.togglePlayback());
    assert.equal(seeks.length,completedRequests,'a second same-time seek can cancel the in-flight range request');
  }finally{await f.close();}
});
