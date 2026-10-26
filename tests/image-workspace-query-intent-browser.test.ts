import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';
import { getFalEngineById } from '../frontend/src/config/falEngines';

const frontend = join(process.cwd(), 'frontend');
const fields = ['prompt','mode','numImages','aspectRatio','resolution','customImageWidth','customImageHeight','seed',
  'quality','outputFormat','background','style','maskUrl','enableWebSearch','thinkingLevel','maxOutputTokens',
  'limitGenerations','watermark','selectedPreviewImageIndex'];
const fixture = `
import {createRoot} from 'react-dom/client';
import ImageWorkspace from './app/(core)/(workspace)/app/image/ImageWorkspace';
import {I18nProvider} from './lib/i18n/I18nProvider';
createRoot(document.getElementById('root')).render(<I18nProvider locale="en" dictionary={globalThis.fixture.dictionary} fallback={{}}>
  <ImageWorkspace accountId={null} engines={globalThis.fixture.engines}/>
</I18nProvider>);
`;

test('the actual image route fences every later editable setting while an unchanged job still hydrates once', async t => {
  // Only presentation and external history/library readers are replaced. Route state,
  // action guards, schema defaults, persistence and query hydration stay real.
  const stubs: Record<string,string> = {
    ImageWorkspaceComposerSurface: `export function ImageWorkspaceComposerSurface(props){globalThis.workspaceProps=props;return null;}`,
    ImageWorkspaceShell: `export function ImageWorkspaceShell({children}){return children;}`,
    ImageWorkspaceRuntimeModals: `export function ImageWorkspaceRuntimeModals(){return null;}`,
    'ImageMediaHandoff.client': `export function ImageMediaHandoff(){return null;}`,
    useImagePreviewActions: `export function useImagePreviewActions(){return {};}`,
    useImageWorkspaceHistory: `import {useState} from 'react'; const empty=[]; const mutateJobs=async()=>{}; const isImageJob=()=>true;
      export function useImageWorkspaceHistory(){const [pendingGroups,setPendingGroups]=useState(empty);
        return {historyEntries:empty,pendingGroups,setPendingGroups,mutateJobs,isImageJob};}`,
    useImageWorkspaceRouteContext: `import {useState,useEffect} from 'react'; import {DEFAULT_COPY} from './app/(core)/(workspace)/app/image/_lib/image-workspace-copy';
      export function useImageWorkspaceRouteContext(){const [searchParams,setSearchParams]=useState(()=>new URLSearchParams(location.search));
        useEffect(()=>{const changed=()=>setSearchParams(new URLSearchParams(location.search));addEventListener('popstate',changed);return()=>removeEventListener('popstate',changed);},[]);return {advancedSettingsTitle:'Advanced',loginRedirectTarget:location.pathname+location.search,
        resolvedCopy:DEFAULT_COPY,searchParams,toolsEnabled:false};}`,
  };
  const bundle = await build({stdin:{contents:fixture,loader:'tsx',resolveDir:frontend},write:false,bundle:true,platform:'browser',format:'iife',
    jsx:'automatic',tsconfig:join(frontend,'tsconfig.json'),define:{'process.env.NODE_ENV':'"production"','process.env':'{}'},
    plugins:[{name:'presentation-and-external-read-boundaries',setup(build){
      build.onLoad({filter:/\.(?:tsx?|client\.tsx)$/},args=>{
        const name=args.path.split('/').at(-1)!.replace(/\.tsx?$/,'');
        return stubs[name] ? {contents:stubs[name],loader:'tsx',resolveDir:frontend} : undefined;
      });
      build.onResolve({filter:/supabaseClient$/},()=>({path:'auth',namespace:'fixture'}));
      build.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const supabase={auth:{getSession:async()=>({data:{session:null}})}};',loader:'js'}));
    }}]});
  const base = getFalEngineById('gpt-image-2')!.engine;
  const engine = {...base,id:'legacy-intent-fixture',modes:['t2i'],inputSchema:{required:[{id:'prompt',type:'text'}],optional:[
    {id:'num_images',type:'number',min:1,max:4,default:1},
    {id:'aspect_ratio',type:'enum',values:['1:1','16:9'],default:'1:1'},
    {id:'resolution',type:'enum',values:['custom'],default:'custom'},
    {id:'image_width',type:'number',default:1024},{id:'image_height',type:'number',default:1024},
    {id:'seed',type:'number'}, {id:'quality',type:'enum',values:['low','high'],default:'low'},
    {id:'output_format',type:'enum',values:['jpeg','png'],default:'jpeg'},
    {id:'background',type:'enum',values:['auto','transparent'],default:'auto'},
    {id:'style',type:'enum',values:['natural','vivid'],default:'natural'}, {id:'mask_url',type:'text'},
    {id:'enable_web_search',type:'boolean'}, {id:'limit_generations',type:'boolean'}, {id:'watermark',type:'boolean'},
  ]}};
  const engines = [{id:engine.id,name:'Synthetic legacy settings',modes:['t2i'],aliases:[],engineCaps:engine,prompts:[],currency:'USD'}];
  const dictionary=JSON.parse(await readFile(join(frontend,'messages/en.json'),'utf8'));
  const pending=new Map<string,ServerResponse>(),counts=new Map<string,number>();
  const snapshot={schemaVersion:1,surface:'image',engineId:engine.id,inputMode:'t2i',prompt:'Hydrated unchanged request',core:{numImages:1,
    aspectRatio:'16:9',resolution:'custom',customImageSize:{width:1536,height:512},seed:42,quality:'low',outputFormat:'jpeg',
    background:'auto',style:'natural',maskUrl:'',enableWebSearch:false,limitGenerations:false,watermark:false},refs:{imageUrls:[]}};
  const server=createServer((req,res)=>{
    const path=new URL(req.url??'/','http://fixture').pathname;
    if(path==='/fixture.js'){res.setHeader('content-type','text/javascript');res.end(bundle.outputFiles[0].text);return;}
    if(path.startsWith('/api/jobs/')){const id=path.slice('/api/jobs/'.length);pending.set(id,res);counts.set(id,(counts.get(id)??0)+1);return;}
    if(path.startsWith('/api/')){res.statusCode=503;res.setHeader('content-type','application/json');res.end('{"ok":false,"error":"fixture_no_price"}');return;}
    res.setHeader('content-type','text/html');res.end('<!doctype html><div id="root"></div><script src="/fixture.js"></script>');
  });
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address();assert.ok(address&&typeof address!=='string');
  const url=`http://127.0.0.1:${address.port}`,browser=await chromium.launch({headless:true});
  const edits=[['quality','setQuality','high'],['seed','setSeed','777'],['customImageWidth','setCustomImageWidth','1792'],
    ['customImageHeight','setCustomImageHeight','768'],['outputFormat','setOutputFormat','png'],['background','setBackground','transparent'],
    ['style','setStyle','vivid'],['maskUrl','setMaskUrl','https://example.com/human-mask.png'],['enableWebSearch','setEnableWebSearch',true],
    ['limitGenerations','setLimitGenerations',true],['watermark','setWatermark',true],['selectedPreviewImageIndex','setSelectedPreviewImageIndex',2]] as const;
  try {
    await t.test('authoritative recipe intent suppresses guest starter before hydration',async()=>{
      const page=await browser.newPage();
      await page.route('**/*',route=>route.request().url().startsWith(url)?route.continue():route.abort());
      await page.addInitScript(config=>{(globalThis as unknown as {fixture:unknown}).fixture=config;},{engines,dictionary});
      try{
        await page.goto(`${url}/?recipe=nano21-unknown`);
        await page.waitForFunction(()=>String((globalThis as unknown as {workspaceProps:{composerError?:string}}).workspaceProps?.composerError).includes('unavailable'));
        const props=await page.evaluate(()=>{const p=(globalThis as unknown as {workspaceProps:Record<string,unknown>}).workspaceProps;return {prompt:p.prompt,starter:p.starterPreview};});
        assert.deepEqual(props,{prompt:'',starter:null});
      }finally{await page.close();}
    });
    await t.test('normal guest starter remains available but its visual clears on same-mounted recipe navigation',async()=>{
      const page=await browser.newPage();
      await page.route('**/*',route=>route.request().url().startsWith(url)?route.continue():route.abort());
      await page.addInitScript(config=>{(globalThis as unknown as {fixture:unknown}).fixture=config;},{engines,dictionary});
      try{
        await page.goto(url);
        await page.waitForFunction(()=>Boolean((globalThis as unknown as {workspaceProps:{starterPreview?:unknown}}).workspaceProps?.starterPreview));
        const before=await page.evaluate(()=>{const p=(globalThis as unknown as {workspaceProps:{prompt:string;starterPreview:{id:string}}}).workspaceProps;return {prompt:p.prompt,id:p.starterPreview.id};});
        assert.equal(before.id,'night-shift');assert.match(before.prompt,/^A realistic raccoon waiting in a worn laundromat/);
        await page.evaluate(()=>{history.pushState(null,'','?recipe=nano21-unknown');dispatchEvent(new PopStateEvent('popstate'));});
        await page.waitForFunction(()=>String((globalThis as unknown as {workspaceProps:{composerError?:string}}).workspaceProps?.composerError).includes('unavailable'));
        const after=await page.evaluate(()=>{const p=(globalThis as unknown as {workspaceProps:Record<string,unknown>}).workspaceProps;return {prompt:p.prompt,starter:p.starterPreview};});
        assert.deepEqual(after,{prompt:before.prompt,starter:null});
      }finally{await page.close();}
    });
    for(const edit of [null,...edits]) await t.test(edit?.[0]??'unchanged hydration',async()=>{
      const id=edit?.[0]??'unchanged',page=await browser.newPage();
      const failures:string[]=[];page.on('pageerror',error=>failures.push(error.message));
      await page.route('**/*',route=>route.request().url().startsWith(url)?route.continue():route.abort());
      await page.addInitScript(config=>{(globalThis as unknown as {fixture:unknown}).fixture=config;},{engines,dictionary});
      try {
        const requested=page.waitForRequest(request=>request.url()===`${url}/api/jobs/${id}`);
        await page.goto(`${url}/?job=${id}`);await requested;
        await page.waitForFunction(()=>Boolean((globalThis as unknown as {workspaceProps:unknown}).workspaceProps));
        while(!pending.has(id)) await new Promise(resolve=>setTimeout(resolve,5));
        if(edit) await page.evaluate(([,setter,value])=>{
          const props=(globalThis as unknown as {workspaceProps:Record<string,unknown>}).workspaceProps;
          (props[setter] as (value:unknown)=>void)(value);
        },edit);
        if(edit) await page.waitForFunction(([field,value])=>(globalThis as unknown as {workspaceProps:Record<string,unknown>}).workspaceProps[field]===value,[edit[0],edit[2]]);
        const read=()=>page.evaluate(keys=>Object.fromEntries(keys.map(key=>[key,(globalThis as unknown as {workspaceProps:Record<string,unknown>}).workspaceProps[key]])),fields);
        const before=await read();
        const response=page.waitForResponse(`${url}/api/jobs/${id}`);
        pending.get(id)!.setHeader('content-type','application/json');pending.get(id)!.end(JSON.stringify({ok:true,settingsSnapshot:snapshot}));
        await response;await page.waitForTimeout(100);
        const after=await read();
        if(edit) assert.deepEqual(after,before,`${edit[0]} must fence the complete pending snapshot`);
        else assert.deepEqual([after.prompt,after.seed,after.quality,after.customImageWidth,after.customImageHeight],['Hydrated unchanged request','42','low','1536','512']);
        assert.equal(counts.get(id),1,'editing does not refetch the job');assert.deepEqual(failures,[]);
      }finally{await page.close();}
    });
  }finally{await browser.close();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
