import path from 'node:path';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

export async function mountJobsPolling(initial: Array<{id:string;surface:string}> = [{id:'one',surface:'video'}], options: { blockedStorage?: boolean } = {}) {
  const frontend=path.resolve('frontend');
  const stubs:Record<string,string>={
    '@/lib/authFetch':`export const authFetch=(url,init)=>window.fixtureFetch(url,init);`,
    '@/lib/last-known':`export const readLastKnownUserId=()=>window.actor;export const writeLastKnownUserId=id=>window.actor=id;`,
    '@/lib/supabase-session-hint':`export const hasSupabaseAuthCookie=()=>true;`,
    '@/lib/supabaseClient':`export const supabase={auth:{getSession:async()=>({data:{session:window.actor?{user:{id:window.actor}}:null}}),onAuthStateChange:fn=>{window.authCallbacks.add(fn);return {data:{subscription:{unsubscribe:()=>window.authCallbacks.delete(fn)}}}}}};`,
  };
  if(options.blockedStorage) delete stubs['@/lib/last-known'];
  const result=await build({absWorkingDir:frontend,bundle:true,format:'iife',platform:'browser',jsx:'automatic',write:false,tsconfig:path.join(frontend,'tsconfig.json'),define:{'process.env.NODE_ENV':'"test"'},
    plugins:[{name:'polling-host',setup(b){b.onResolve({filter:/.*/},a=>a.path in stubs?{path:a.path,namespace:'fixture'}:undefined);b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:stubs[a.path],loader:'ts',resolveDir:frontend}));}}],
    stdin:{loader:'tsx',resolveDir:frontend,contents:`
      import React,{act}from'react';import{createRoot}from'react-dom/client';import{SWRConfig}from'swr';import{useInfiniteJobs}from'./lib/api-jobs';
      window.IS_REACT_ACT_ENVIRONMENT=true;window.actor='account-A';window.authCallbacks=new Set();window.requests=[];window.statusResponses=[];window.feeds={};
      window.fixtureFetch=async(url)=>{
        const entry={url,actor:window.actor};window.requests.push(entry);
        if(url.startsWith('/api/jobs?')){const source=new URL(url,'http://localhost').searchParams.get('surface')||'all';return {ok:true,status:200,json:async()=>({ok:true,jobs:[{jobId:window.actor+'-'+source,engineLabel:'Fixture',durationSec:5,prompt:'Fixture',createdAt:'2026-10-17T12:00:00Z',status:'pending'}],nextCursor:null})};}
        const response=window.statusResponses.shift()??{status:'pending'};
        if(window.holdStatus)return new Promise(resolve=>entry.resolve=resolve);
        const code=typeof response==='number'?response:200;
        return {ok:code<400,status:code,json:async()=>code>=400?{ok:false,error:'fixture error'}:{ok:true,jobId:decodeURIComponent(url.split('/').pop()),progress:10,...response}};
      };
      function Feed({id,surface}){window.feeds[id]=useInfiniteJobs(12,{surface});return null}
      const root=createRoot(document.getElementById('root'));const cache=new Map();
      window.fx={act,render:consumers=>root.render(<SWRConfig value={{provider:()=>cache,shouldRetryOnError:false,revalidateOnFocus:false,revalidateOnReconnect:false}}>{consumers.map(c=><Feed key={c.id} {...c}/>)}</SWRConfig>),unmount:()=>root.unmount()};
    `},
  });
  const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/app',runScripts:'outside-only'});
  const w=dom.window as any;w.MessageChannel=class{port1={onmessage:()=>{}};port2={postMessage:()=>setTimeout(()=>this.port1.onmessage(),0)};};
  if(options.blockedStorage) {
    w.Storage.prototype.getItem=()=>{throw new w.DOMException('Storage blocked','SecurityError');};
    w.Storage.prototype.setItem=()=>{throw new w.DOMException('Storage blocked','SecurityError');};
    w.Storage.prototype.removeItem=()=>{throw new w.DOMException('Storage blocked','SecurityError');};
  }
  let now=Date.now(),id=100000;
  const timers=new Map<number,{at:number;callback:()=>void}>();
  const nativeSet=w.setTimeout.bind(w),nativeClear=w.clearTimeout.bind(w);
  w.Date.now=()=>now;
  w.setTimeout=(callback:()=>void,delay:number,...args:any[])=>{if(delay>=15000){timers.set(++id,{at:now+delay,callback:()=>callback(...args)});return id;}return nativeSet(callback,delay,...args);};
  w.clearTimeout=(key:number)=>timers.delete(key)||nativeClear(key);
  w.eval(result.outputFiles[0].text);
  const settle=async()=>{for(let i=0;i<4;i++)await w.fx.act(async()=>await Promise.resolve());};
  const render=async(consumers:typeof initial)=>{await w.fx.act(async()=>w.fx.render(consumers));await settle();};
  await render(initial);
  return {w,render,settle,
    statusRequests:()=>w.requests.filter((r:any)=>r.url.startsWith('/api/jobs/')),
    timerCount:()=>timers.size,
    advance:async(ms:number)=>{const end=now+ms;for(let i=0;i<1000;i++){
      const next=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];if(!next||next[1].at>end)break;
      now=next[1].at;timers.delete(next[0]);await w.fx.act(async()=>next[1].callback());await settle();
    }now=end;},
    auth:async(user:string|null)=>{await w.fx.act(async()=>{w.actor=user;for(const fn of w.authCallbacks)fn(user?'SIGNED_IN':'SIGNED_OUT',user?{user:{id:user}}:null);});await settle();},
    respond:async(entry:any,code:number,body:any={})=>{await w.fx.act(async()=>entry.resolve({ok:code<400,status:code,json:async()=>({ok:code<400,...body})}));await settle();},
    close:async()=>{await w.fx.act(async()=>w.fx.unmount());dom.window.close();},
  };
}
