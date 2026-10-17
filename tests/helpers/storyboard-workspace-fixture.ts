import path from 'node:path';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

/** Keep the real controller, hooks and API adapters; replace host auth, transport and leaf views. */
export async function mountStoryboard(options: { userId?: string | null; loading?: boolean; holdHistory?: boolean; storage?: Record<string, string> } = {}) {
  const frontend = path.resolve('frontend');
  const stubs: Record<string, string> = {
    'next/link': `export default function Link({children}){return children;}`,
    'next/navigation': `export const useRouter=()=>({push:href=>window.navigations.push(href)});`,
    '@/components/AppSidebar': `export const AppSidebar=()=>null;`,
    '@/components/HeaderBar': `export const HeaderBar=()=>null;`,
    '@/components/ui/Card': `export const Card=({children})=>children;`,
    '@/components/ui/Button': `export const Button=({children})=>children;export const ButtonLink=Button;`,
    '@/hooks/useRequireAuth': `export const useRequireAuth=()=>window.fixtureAuth;`,
    '@/lib/i18n/I18nProvider': `export const useI18n=()=>({locale:'en',t:()=>({})});`,
    '@/content/feature-flags': `export const FEATURES={workflows:{toolsSection:true}};`,
    '@/lib/authFetch': `export const authFetch=(url,init)=>window.fixtureFetch(url,init);`,
    '@/lib/client-image-upload': `export const prepareImageFileForUpload=file=>window.prepareUpload(file);`,
    '@/lib/api': `export {runImageGeneration} from './lib/api-generation';export {saveImageToLibrary} from './lib/api-assets';export {hideJob} from './lib/api-jobs';`,
    './storyboard/_components/StoryboardBuilderPanel': `export function StoryboardBuilderPanel(p){window.builder=p;return null;}`,
    './storyboard/_components/StoryboardResultPanel': `import React from 'react';export function StoryboardResultPanel(p){window.resultPanel=p;window.frames.push({user:window.fixtureAuth.user?.id??null,subject:window.builder.prompt.subject,history:p.recentOutputs.map(x=>x.id),selected:p.selectedImage?.url??null});return <pre id="state">{JSON.stringify({subject:window.builder.prompt.subject,history:p.recentOutputs.map(x=>x.id),selected:p.selectedImage?.url??null})}</pre>;}`,
    './storyboard/_components/StoryboardReferenceLibraryModal': `export const StoryboardReferenceLibraryModal=p=>{window.referenceLibrary=p;return null;};`,
  };
  const result = await build({ absWorkingDir: frontend, bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic', write: false,
    define: { 'process.env.NODE_ENV':'"test"', 'process.env.NEXT_PUBLIC_ASSET_MAX_IMAGE_MB':'"25"' }, tsconfig: path.join(frontend,'tsconfig.json'),
    plugins: [{name:'storyboard-host',setup(b){b.onResolve({filter:/.*/},a=>a.path in stubs?{path:a.path,namespace:'fixture'}:undefined);b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:stubs[a.path],loader:'tsx',resolveDir:frontend}));}}],
    stdin: {loader:'tsx',resolveDir:frontend,contents:`
      import React,{act} from 'react';import{createRoot}from'react-dom/client';import Workspace from './src/components/tools/StoryboardWorkspace';
      window.IS_REACT_ACT_ENVIRONMENT=true;window.requests=[];window.frames=[];window.navigations=[];window.revoked=[];
      window.prepareUpload=async file=>file;
      window.fixtureFetch=async(url,init={})=>{
        const entry={url,init,owner:window.fixtureAuth.user?.id??null};
        if(url==='/api/images/estimate')return {ok:true,status:200,json:async()=>({ok:true,pricing:{totalCents:42,currency:'USD'}})};
        if(url.includes('recent-outputs')&&!window.holdHistory){window.requests.push(entry);return {ok:true,status:200,json:async()=>({ok:true,outputs:entry.owner?[{id:entry.owner+'-output',jobId:entry.owner+'-job',url:'https://example.invalid/'+entry.owner+'.png',thumbUrl:null,previewUrl:null,width:100,height:100,mime:'image/png',createdAt:null,isSaved:false}]:[]})};}
        return new Promise(resolve=>window.requests.push({...entry,resolve}));
      };
      const root=createRoot(document.getElementById('root'));window.fx={act,render:()=>root.render(<Workspace/>),unmount:()=>root.unmount()};
    `},
  });
  const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/app/tools/storyboard',runScripts:'outside-only'});
  const w=dom.window as any;
  w.MessageChannel=class {port1={onmessage:()=>{}};port2={postMessage:()=>setTimeout(()=>this.port1.onmessage(),0)};};
  w.URL.createObjectURL=(file: File)=>'blob:'+file.name;
  w.URL.revokeObjectURL=(url: string)=>w.revoked.push(url);
  const auth=(id: string|null,loading=false,token=id?'token-'+id:null)=>({loading,user:id?{id}:null,session:id?{user:{id},access_token:token}:null});
  w.fixtureAuth=auth(options.userId===undefined?'account-A':options.userId,options.loading);
  w.holdHistory=Boolean(options.holdHistory);
  for(const [key,value] of Object.entries(options.storage??{}))w.localStorage.setItem(key,value);
  w.eval(result.outputFiles[0].text);
  const tick=async()=>{for(let i=0;i<3;i++)await w.fx.act(async()=>await Promise.resolve());};
  await w.fx.act(async()=>w.fx.render());await tick();
  return {w,tick,
    auth:async(id:string|null,loading=false,token=id?'token-'+id:null)=>{await w.fx.act(async()=>{w.fixtureAuth=auth(id,loading,token);w.fx.render();});await tick();},
    respond:async(entry:any,body:unknown,status=200)=>{await w.fx.act(async()=>entry.resolve({ok:status<400,status,json:async()=>body}));await tick();},
    edit:async(text:string)=>w.fx.act(async()=>w.builder.prompt.onSubjectChange(text)),
    close:async()=>{await w.fx.act(async()=>w.fx.unmount());dom.window.close();},
  };
}
