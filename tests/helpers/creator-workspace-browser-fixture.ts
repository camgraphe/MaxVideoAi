import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { build } from 'esbuild';
/** Local, empty application surfaces. No provider, credentials, paid calls or fabricated results. */
export async function createCreatorWorkspaceFixture() {
  const frontend=resolve('frontend');
  const stubs: Record<string,string> = {
    '@/components/HeaderBar': `import React from 'react';export const HeaderBar=()=>React.createElement('header',{className:'fixture-header'},'MaxVideoAI · Tools');`,
    '@/components/AppSidebar': 'export const AppSidebar=()=>null;',
    '@/components/library/ToolMediaHandoff.client': 'export const ToolMediaHandoff=()=>null;',
    '@/components/library/MediaDestinationActions.client': 'export const MediaDestinationActions=()=>null;',
    '@/components/library/AssetLibraryBrowser': 'export const AssetLibraryBrowser=()=>null;',
    '@/lib/authFetch': "export const authFetch=()=>{throw Error('No API calls permitted in the empty fixture');};",
    'next/link': "import React from 'react';export default p=>React.createElement('a',{href:p.href},p.children);",
  };
  const bundle=await build({stdin:{contents:`import React from'react';import{createRoot}from'react-dom/client';import{CreatorSession}from'./src/components/tools/creator/CreatorWorkspace.client';import{SubtitleSession}from'./src/components/tools/creator/SubtitleWorkspace.client';const [locale,id]=location.pathname.slice(1).split('/');createRoot(document.getElementById('root')).render(id==='subtitles'?<SubtitleSession userId="fixture" locale={locale}/>:<CreatorSession userId="fixture" locale={locale} toolId={id}/>);`,loader:'tsx',resolveDir:frontend},outfile:join(frontend,'fixture.js'),bundle:true,platform:'browser',format:'iife',jsx:'automatic',write:false,tsconfig:join(frontend,'tsconfig.json'),define:{'process.env.NODE_ENV':'"production"','process.env':'{}'},plugins:[{name:'fixture-boundaries',setup(b){b.onResolve({filter:/.*/},a=>a.path in stubs?{path:a.path,namespace:'fixture'}:undefined);b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:stubs[a.path],loader:'js',resolveDir:frontend}));}}]});
  const js=bundle.outputFiles.find(f=>f.path.endsWith('.js'))!.text, css=bundle.outputFiles.find(f=>f.path.endsWith('.css'))!.text;
  const server=createServer(async (req,res)=>{
    if (/^\/assets\/tools\/creator-art\/[a-z-]+-(640|960|1536)\.webp$/.test(req.url ?? '')) {
      try {const bytes=await readFile(join(frontend,'public',req.url!));res.writeHead(200,{'content-type':'image/webp','cache-control':'public,max-age=3600'});res.end(bytes);} catch {res.writeHead(404);res.end();} return;
    }
    if(req.url==='/fixture-font.woff2'){res.writeHead(200,{'content-type':'font/woff2'});res.end(await readFile(join(frontend,'app/(core)/_fonts/GeistLatin.woff2')));return;}

    if(req.url==='/fixture.js'){res.writeHead(200,{'content-type':'application/javascript'});res.end(js);return;}
    res.writeHead(200,{'content-type':'text/html; charset=utf-8'});
    res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
      :root{--app-line:#d9ddd6;--app-panel:#fff;--app-muted:#646b61;--app-ink:#20261f;--app-accent:#765020;--app-accent-ink:#fff;--border:#d9ddd6;--text-primary:#20261f;--text-secondary:#646b61;--surface:#fff;--surface-2:#f3f5ef;--brand:#765020}
      @font-face{font-family:Geist;src:url('/fixture-font.woff2') format('woff2');font-weight:100 900;font-display:swap}*{box-sizing:border-box}body{margin:0;background:#faf9f6;color:#20261f;font:14px/1.5 Geist,system-ui,sans-serif}button,input,select,textarea{font:inherit;color:inherit}button{background:none;border:0;cursor:pointer}button:disabled{opacity:.45}h1,h2,p,ul{margin:0;padding:0}ul{list-style:none}a{color:inherit;text-decoration:none}.fixture-header{padding:18px 28px;border-bottom:1px solid #d9ddd6;font-weight:600}.fixture-banner{padding:8px 28px;font-size:12px;background:#20261f;color:#fff}.flex{display:flex}.flex-col{flex-direction:column}.flex-1{flex:1}.min-w-0{min-width:0}.min-h-screen{min-height:100vh}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}${css}
    </style></head><body><aside class="fixture-banner">Local application review · empty states · no generation or payment</aside><div id="root"></div><script src="/fixture.js"></script></body></html>`);
  });
  await new Promise<void>(done=>server.listen(0,'127.0.0.1',done));const address=server.address();if(!address||typeof address==='string')throw Error('Missing address');
  return {url:`http://127.0.0.1:${address.port}`,async close(){server.closeAllConnections();await new Promise<void>((done,reject)=>server.close(e=>e?reject(e):done()));}};
}
