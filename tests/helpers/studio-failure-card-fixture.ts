import {build} from 'esbuild';
import {createServer} from 'node:http';
import {join} from 'node:path';

/** Real conversation, journal hook and quote card; unrelated panels and remote reads are isolated. */
export async function startStudioFailureCardFixture() {
  const frontend=join(process.cwd(),'frontend');
  const stubs:Record<string,string>={
    '@/lib/i18n/I18nProvider':`export const useI18n=()=>({locale:new URLSearchParams(location.search).get('locale')||'en'});`,
    '@/hooks/useThemePreference':`export const useThemePreference=()=>({resolvedTheme:'light'});`,
    './_hooks/useStudioAssistance':`const refresh=()=>{};export const useStudioAssistance=()=>({status:null,error:null,refresh});`,
    './_hooks/useConversationExtensions':`export const useConversationExtensions=()=>({errors:{},retry:()=>{}});`,
    './_hooks/useConversationExports':`const jobs=[];export const useConversationExports=()=>({jobs,refresh:()=>{}});`,
    './_hooks/useStudioMobileLayout':`export const useStudioMobileLayout=()=>false;`,
    './_hooks/useConversationMediaShelf':`const items=[],references=[];export const useConversationMediaShelf=()=>({items,references,attachedIds:[],restore:()=>{},clear:()=>{}});`,
    '@/lib/analytics-client':`export const dispatchAnalyticsEvent=()=>{};`,
    '@/lib/analytics/journey-browser':`export const readAnalyticsJourney=()=>null;`,
  };
  for(const [path,name] of [
    ['./_components/StudioAssistance.client','StudioAssistance'],
    ['./_components/ConversationExportQuote.client','ConversationExportQuote'],
    ['./_components/ConversationTask.client','ConversationTask'],
    ['./_components/ConversationAnalysis.client','ConversationAnalysis'],
    ['./_components/ImageConversationComposer.client','ImageConversationComposer'],
    ['./_components/ImageReferenceLibrary.client','ImageReferenceLibrary'],
    ['./_components/ConversationMobilePanel.client','ConversationMobilePanel'],
    ['./_components/ConversationMedia.client','ConversationMedia'],
    ['./_components/ConversationTimeline.client','ConversationTimeline'],
    ['./_components/ConversationRenderCards.client','ConversationRenderCards'],
    ['../../_components/ConversationProjects.client','ConversationProjects'],
    ['./_components/ConversationWelcome.client','ConversationWelcome'],
    ['./_components/ConversationHelp.client','ConversationHelp'],
    ['./_components/ConversationMediaShelf.client','ConversationMediaShelf'],
  ])stubs[path]=`export const ${name}=()=>null;`;
  const bundle=await build({
    absWorkingDir:frontend,bundle:true,format:'iife',platform:'browser',jsx:'automatic',write:false,minify:true,
    outfile:join(frontend,'fixture.js'),tsconfig:join(frontend,'tsconfig.json'),loader:{'.module.css':'local-css'},
    define:{'process.env.NODE_ENV':'"production"','process.env':'{}'},
    plugins:[{name:'safe-fixture-boundaries',setup(builder){
      builder.onResolve({filter:/.*/},args=>args.path in stubs?{path:args.path,namespace:'fixture'}:undefined);
      builder.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:stubs[args.path],loader:'js',resolveDir:frontend}));
    }}],
    stdin:{loader:'tsx',resolveDir:frontend,contents:`
      import React from 'react';import{createRoot}from'react-dom/client';
      import StudioImageConversation from './app/(core)/(workspace)/app/studio/conversation/[projectId]/StudioImageConversation.client';
      import{mapGenerationStatusRecordToAgent}from'./src/server/generations/agent-generation-policy';
      const publicReason='Google blocked this request during safety checks. Review the prompt and reference media before trying again.';
      const cases=[['Google moderation · confirmed wallet refund',publicReason,'refunded_wallet'],['Google moderation · no confirmed wallet refund',publicReason,'paid_wallet'],['Historical failure · reason unavailable','MaxVideoAI could not complete this render.','refunded_wallet']];
      const turns=cases.map(([label,message,payment],index)=>({
        requestId:'fixture-request-'+index,message:label,references:[],reply:null,state:'ready',retryable:false,createdAt:'2026-10-26T00:00:00Z',
        quote:{quoteId:'fixture-quote-'+index,state:'accepted',expiresAt:'2026-10-25T00:00:00Z',requestHash:'fixture-hash',summary:{schemaVersion:1,surface:'video',engineId:'gemini-omni-flash',mode:'ref2v',prompt:'Safe synthetic fixture request.',settings:{durationSec:10,resolution:'360p',aspectRatio:'16:9',audio:true},references:[],outputCount:1},price:{amountCents:45,currency:'USD'},fundingMode:'wallet',confirmationRequired:true,wallet:null,modelLabel:'Gemini Omni Flash 1.1'},
        generation:mapGenerationStatusRecordToAgent({id:index+1,job_id:'fixture-job-'+index,user_id:'fixture-user',status:'failed',progress:0,provider:'google_vertex_omni_direct',provider_job_id:'fixture-interaction-'+index,surface:'video',engine_id:'gemini-omni-flash',engine_label:'Gemini Omni Flash 1.1',duration_sec:10,prompt:'Safe synthetic fixture request.',created_at:'2026-10-26T00:00:00Z',message,payment_status:payment,final_price_cents:45,currency:'USD',settings_snapshot:{surface:'video'},render_ids:[],pricing_snapshot:null}),
      }));
      window.fixtureRequests=[];
      window.fetch=async(input,init)=>{
        const url=new URL(typeof input==='string'?input:input.url,location.href);
        const method=init?.method||'GET';window.fixtureRequests.push({path:url.pathname,method});
        const match=new RegExp('/api/studio/projects/([^/]+)/image-conversation$').exec(url.pathname);
        if(method!=='GET'||!match)throw Error('Unexpected fixture request: '+method+' '+url.pathname);
        return new Response(JSON.stringify({ok:true,result:{projectId:decodeURIComponent(match[1]),projectName:'Safe failure explanation fixture',turns}}),{status:200,headers:{'content-type':'application/json'}});
      };
      createRoot(document.getElementById('root')).render(<StudioImageConversation projectId="fixture-project" accountKey="fixture-account" projectName="Safe failure explanation fixture"/>);
    `},
  });
  const script=bundle.outputFiles.find(file=>file.path.endsWith('.js'))!.text;
  const css=bundle.outputFiles.find(file=>file.path.endsWith('.css'))!.text;
  const html=`<!doctype html><html lang="en"><meta charset="utf-8"><title>Studio failure explanations · safe fixture</title><link rel="stylesheet" href="fixture.css"><style>body{margin:0;font:16px/1.5 system-ui;background:#f7f7f3;color:#242923}.fixture-notice{padding:12px 24px;background:#fff}.fixture-notice a{margin-right:18px}#root{height:calc(100vh - 94px)}</style><header class="fixture-notice"><strong>Safe fixture · real Studio conversation and creation cards</strong><div>Synthetic records only. No customer session, media, generation or live refund.</div><nav><a href="?locale=en">EN</a><a href="?locale=fr">FR</a><a href="?locale=es">ES</a></nav></header><div id="root"></div><script src="fixture.js"></script></html>`;
  const server=createServer((request,response)=>{
    const path=new URL(request.url??'/','http://fixture.invalid').pathname;
    const body=path.endsWith('/fixture.js')?script:path.endsWith('/fixture.css')?css:html;
    response.setHeader('content-type',path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'text/html');
    response.end(body);
  });
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address();if(!address||typeof address==='string')throw Error('Fixture server unavailable');
  return {origin:`http://127.0.0.1:${address.port}`,artifacts:{html,script,css},close:()=>new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()))};
}
