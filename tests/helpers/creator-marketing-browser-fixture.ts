import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';

/** Real landing and demo; HTTP exists only in the test process, never in app routes. */
export async function createCreatorMarketingFixture() {
  const frontend = resolve('frontend'), directory = await mkdtemp(join(tmpdir(), 'creator-marketing-'));
  const require = createRequire(join(frontend, 'package.json'));
  const output = join(directory, 'render.cjs');
  await build({ stdin: {contents:`
    import React from 'react';import {renderToString} from 'react-dom/server';
    import {CreatorLandingView} from './src/components/tools/creator-marketing/CreatorLandingView';
    import {getCreatorMarketingLabels} from './src/components/tools/creator-marketing/creator-copy';
    export const render=(id,locale,released)=>({markup:renderToString(<CreatorLandingView id={id} locale={locale} publicReleased={released}/>),labels:getCreatorMarketingLabels(locale)});
  `,loader:'tsx',resolveDir:frontend},outfile:output,bundle:true,platform:'node',format:'cjs',jsx:'automatic',tsconfig:join(frontend,'tsconfig.json'),plugins:[{name:'fixture-runtime',setup(b){b.onResolve({filter:/^[^./@]|^@[^/]+\//},a=>a.path.startsWith('@/')?undefined:{path:require.resolve(a.path),external:true})}}] });
  const runtime = createRequire(import.meta.url)(output);
  const bundle = await build({stdin:{contents:`import React from 'react';import {hydrateRoot} from 'react-dom/client';import {CreatorWorkflowDemo} from './src/components/tools/creator-marketing/CreatorWorkflowDemo.client';const c=window.creatorFixture;hydrateRoot(document.querySelector('.creator-demo-container'),<CreatorWorkflowDemo id={c.id} labels={c.labels} locale={c.locale}/>,{onRecoverableError:error=>window.creatorErrors.push(error.message)});window.creatorReady=true;`,loader:'tsx',resolveDir:frontend},bundle:true,platform:'browser',format:'iife',jsx:'automatic',write:false,tsconfig:join(frontend,'tsconfig.json'),define:{'process.env.NODE_ENV':'"production"'}});
  const css = await readFile(join(frontend,'src/components/tools/creator-marketing/creator-marketing.css'),'utf8');
  const ids = ['subtitles','lip-sync','product-photo-editor','product-video-editor','motion-transfer'];
  const server = createServer(async (req,res)=>{
    if (/^\/assets\/tools\/creator-art\/[a-z-]+-(640|960|1536)\.webp$/.test(req.url ?? '')) {
      try {const bytes=await readFile(join(frontend,'public',req.url!));res.writeHead(200,{'content-type':'image/webp','cache-control':'public,max-age=3600'});res.end(bytes);} catch {res.writeHead(404);res.end();} return;
    }
    if(req.url==='/fixture-font.woff2'){res.writeHead(200,{'content-type':'font/woff2'});res.end(await readFile(join(frontend,'app/(core)/_fonts/GeistLatin.woff2')));return;}

    if(req.url === '/fixture.js'){res.writeHead(200,{'content-type':'application/javascript'});res.end(bundle.outputFiles[0].text);return;}
    const url = new URL(req.url??'/','http://localhost');
    const [locale,id] = url.pathname.slice(1).split('/');
    if(!['en','fr','es'].includes(locale)||!ids.includes(id)){res.writeHead(404);res.end();return;}
    const {markup,labels}=runtime.render(id,locale,url.searchParams.get('released')==='1');
    const data=JSON.stringify({id,labels,locale}).replace(/</g,'\\u003c');
    res.writeHead(200,{'content-type':'text/html; charset=utf-8'});
    res.end(`<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>@font-face{font-family:Geist;src:url('/fixture-font.woff2') format('woff2');font-weight:100 900;font-display:swap}*{box-sizing:border-box}body{margin:0;font-family:Geist,system-ui,sans-serif;background:#faf9f6;color:#20261f}a{color:inherit;text-decoration:none}button,input{font:inherit}button{cursor:pointer}main{display:block}.fixture-banner{padding:12px 20px;background:#20261f;color:#fff;font:12px/1.5 Arial} ${css}</style></head><body><aside class="fixture-banner">Local design review · presentation artwork · no generation or payment</aside><main>${markup}</main><script>window.creatorFixture=${data};window.creatorErrors=[];</script><script defer src="/fixture.js"></script></body></html>`);
  });
  await new Promise<void>(done=>server.listen(0,'127.0.0.1',done));
  const address=server.address();if(!address||typeof address==='string')throw new Error('Fixture address unavailable');
  return {url:`http://127.0.0.1:${address.port}`,async close(){server.closeAllConnections();await new Promise<void>((done,reject)=>server.close(error=>error?reject(error):done()));await rm(directory,{recursive:true,force:true});}};
}
