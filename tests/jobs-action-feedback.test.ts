import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { build } from 'esbuild';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
const require = createRequire(import.meta.url);
const frontendRequire = createRequire(resolve('frontend/package.json'));
async function compile(directory:string,name:string,source:string,mocks:Record<string,string>){
  const outfile=join(directory,name+'.cjs');
  const result=await build({stdin:{contents:source,resolveDir:process.cwd(),loader:'tsx'},outfile,bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',tsconfig:'frontend/tsconfig.json',packages:'external',loader:{'.css':'empty','.module.css':'empty'},plugins:[{name:'audit-boundaries',setup(b){
    b.onResolve({filter:/.*/},args=>{
      if(args.path in mocks)return {path:args.path,namespace:'fixture'};
      if(args.path==='react'||args.path.startsWith('react/'))return {path:require.resolve(args.path),external:true};
      if(!args.path.startsWith('.')&&!args.path.startsWith('/')&&!args.path.startsWith('@/'))return {path:frontendRequire.resolve(args.path),external:true};
    });
    b.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:mocks[args.path],loader:'tsx',resolveDir:process.cwd()}));
  }}]});await writeFile(outfile,result.outputFiles[0].contents);return require(outfile);
}
const sharedMocks={
  '@/hooks/useRequireAuth':`export const useRequireAuth=()=>({user:{id:globalThis.jobsFeedbackFixture.owner}});`,
  '@/lib/i18n/I18nProvider':`export const useI18n=()=>({locale:'en',t:(_,fallback)=>fallback});`,
  '@/hooks/useResultProvider':`export const useResultProvider=()=>({});`,
  '@/components/HeaderBar':`export const HeaderBar=()=>null;`,
  '@/components/AppSidebar':`export const AppSidebar=()=>null;`,
  '@/components/FirstCreationState.client':`export const FirstCreationState=()=>null;`,
  '@/components/groups/GroupViewerModal':`export const GroupViewerModal=()=>null;`,
  'next/dynamic':`export default ()=>()=>null;`,
  '@/components/ui/Button':`export const Button=({children,variant,size,...rest})=><button {...rest}>{children}</button>;`,
  '@/components/GroupedJobCard':`export const GroupedJobCard=({group,onAction,savingToLibrary})=><div><button onClick={()=>onAction(group,'save-to-library')} disabled={savingToLibrary}>Save main output</button><button onClick={()=>onAction(group,'remove')}>Remove from history</button></div>;`,
};
test('Activity displays save/remove errors and supports retry without duplicate requests',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'jobs-action-feedback-'));
  const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/jobs'});
  const job={jobId:'audio-1',surface:'audio',engineId:'seed-audio',engineLabel:'Seed Audio',status:'completed',createdAt:'2026-10-18T00:00:00Z',prompt:'A seven second voice',audioUrl:'https://fixture.example/original.wav',durationSec:7};
  const review:any={owner:'owner-a',jobs:[job],requests:[],logs:[],fail:true,mutations:0,defer:false,pending:[]};
  const globals:any={window:dom.window,document:dom.window.document,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,CustomEvent:dom.window.CustomEvent,React,IS_REACT_ACT_ENVIRONMENT:true,jobsFeedbackFixture:review};
  const old=new Map(Object.keys(globals).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
  for(const[k,v]of Object.entries(globals))Object.defineProperty(globalThis,k,{configurable:true,writable:true,value:v});
  const originalError=console.error;console.error=(...v)=>review.logs.push(String(v[0]));
  const root=createRoot(dom.window.document.getElementById('root')!);
  try{
    const {Page}=await compile(directory,'jobs',`import {useJobsPageController} from './frontend/app/(core)/jobs/_hooks/useJobsPageController';import {JobsPageShell} from './frontend/app/(core)/jobs/_components/JobsPageShell';export function Page(){const state=useJobsPageController();globalThis.jobsFeedbackFixture.state=state;return <JobsPageShell {...state}/>;}`,{...sharedMocks,
      '@/lib/api':`import {saveAssetToLibrary} from '${resolve('frontend/lib/api-assets.ts')}';export {saveAssetToLibrary};export const getJobStatus=async()=>({});export const hideJob=async()=>{globalThis.jobsFeedbackFixture.requests.push({operation:'hide'});if(globalThis.jobsFeedbackFixture.fail)throw Error('NETWORK_FAILED')};export const useEngines=()=>({data:{engines:[]}});const mutate=()=>{globalThis.jobsFeedbackFixture.mutations++};export const useInfiniteJobs=()=>({data:[{jobs:globalThis.jobsFeedbackFixture.jobs,nextCursor:null}],stableJobs:globalThis.jobsFeedbackFixture.jobs,isLoading:false,isValidating:false,mutate});`,
      '@/lib/authFetch':`export const authFetch=async(input,init)=>{const body=JSON.parse(init.body);globalThis.jobsFeedbackFixture.requests.push({operation:'save',body});if(globalThis.jobsFeedbackFixture.defer) await new Promise(resolve=>globalThis.jobsFeedbackFixture.pending.push(resolve));return new Response(JSON.stringify(globalThis.jobsFeedbackFixture.fail?{ok:false,error:'SAVE_FAILED'}:{ok:true,asset:{id:'saved-audio',url:body.url}}),{status:globalThis.jobsFeedbackFixture.fail?500:200});};`,
    });
    await act(async()=>root.render(React.createElement(Page)));
    const click=async(text:string)=>act(async()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent===text);assert.ok(b,text);b.click()});
    await click('Save main output');
    assert.ok(document.querySelector('[role=alert]')?.textContent?.includes('Could not save'), 'failed save must be explained');
    await click('Remove from history');
    assert.equal(review.requests.length,2);
    assert.ok(document.querySelector('[role=alert]')?.textContent?.includes('Could not remove'), 'failed removal must be explained');
    assert.equal(review.state.error,undefined);assert.equal(review.state.savingImageGroupIds.size,0);assert.equal(review.mutations,0);
    review.fail=false;await click('Retry');
    assert.equal(document.querySelector('[role=alert]'),null);
    assert.ok(document.querySelector('[role=status]')?.textContent?.includes('Removed from history'));
    assert.equal(review.mutations,1);
    await click('Dismiss');assert.equal(document.querySelector('[role=status]'),null);
    review.fail=true;await click('Save main output');
    const beforeRetry=review.requests.length;
    review.jobs=[];await act(async()=>root.render(React.createElement(Page)));
    review.fail=false;await click('Retry');
    assert.equal(review.requests.length,beforeRetry+1,'retry retains its target after a feed refresh removes the card');
    assert.equal(review.requests.at(-1).body.url,job.audioUrl);
    assert.ok(document.querySelector('[role=status]')?.textContent?.includes('Saved to Media'));
    review.jobs=[job];await act(async()=>root.render(React.createElement(Page)));
    review.defer=true;
    const before=review.requests.length;
    await act(async()=>{const group=review.state.groups[0];review.state.onGroupAction(group,'save-to-library');review.state.onGroupAction(group,'save-to-library');review.state.onGroupAction(group,'remove');});
    assert.equal(review.requests.length,before+1,'same group allows only one pending mutation');
    assert.ok(document.querySelector('[role=status]')?.textContent?.includes('Saving to Media'));
    await act(async()=>review.pending.shift()());
    assert.ok(document.querySelector('[role=status]')?.textContent?.includes('Saved to Media'));
    await click('Save main output');
    const beforeFilter=review.requests.length;
    await act(async()=>review.state.onSourceChange('audio'));
    await click('Save main output');
    assert.equal(review.requests.length,beforeFilter,'source changes preserve the account mutation lock');
    await act(async()=>review.state.onSourceChange('all'));
    await act(async()=>review.pending.shift()());
    assert.equal(document.querySelector('[role=status]'),null,'retired filter feedback stays retired');
    for(const transition of ['account','source','unmount']) {
      await click('Save main output');const finish=review.pending.shift();
      if(transition==='account'){await act(async()=>{review.owner='owner-b';root.render(React.createElement(Page))});await act(async()=>{review.owner='owner-a';root.render(React.createElement(Page))});}
      if(transition==='source'){await act(async()=>review.state.onSourceChange('audio'));await act(async()=>review.state.onSourceChange('all'));}
      if(transition==='unmount'){await act(async()=>root.render(null));await act(async()=>root.render(React.createElement(Page)));}
      review.fail=true;await act(async()=>finish());
      assert.equal(document.querySelector('[role=alert]'),null,'late errors do not cross scope lifetimes');
      assert.equal(document.querySelector('[role=status]'),null,'late success or busy states do not cross scope lifetimes');
      review.fail=false;
    }


  }finally{
    await act(async()=>root.unmount());dom.window.close();console.error=originalError;
    for(const[k,v]of old){if(v)Object.defineProperty(globalThis,k,v);else Reflect.deleteProperty(globalThis,k)}
    await rm(directory,{recursive:true,force:true});
  }
});
