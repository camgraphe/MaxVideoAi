import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { build } from 'esbuild';
import { resolve, join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import tailwindConfig from '../frontend/tailwind.config';
import { chromium } from '@playwright/test';

test('excerpt cancel restores keyboard focus after lazy opening and owned-preview resolution', async()=>{
 const frontend=resolve('frontend');
 const bundle=await build({stdin:{contents:`
 import React from 'react';import {createRoot} from 'react-dom/client';
 import {Composer} from './components/Composer';
 import {I18nProvider} from './lib/i18n/I18nProvider';
 import {getBaseEngineIncludingHidden} from './src/lib/engines';
 const asset={id:'source',assetId:'owned',url:'https://canonical.invalid/original',previewUrl:'https://preview.invalid/short',kind:'video',name:'ma_22222222222222222222222222222222.mp4',size:100,type:'video/mp4',durationSec:60,status:'ready'};
 createRoot(document.getElementById('root')).render(<I18nProvider locale="en" dictionary={{}} fallback={{}}><main className="app-experience" style={{padding:16}}><Composer density="workspace" engine={getBaseEngineIncludingHidden('luma-ray-3-2')} activeManualMode="v2v" prompt="Edit" onPromptChange={()=>{}} price={null} currency="USD" isLoading={false} promptRequired assetFields={[{field:{id:'video_url',type:'video',maxCount:1},required:true}]} assets={{video_url:[asset]}} onAssetRemove={()=>{}} onPrepareVideoExcerpt={async()=>{}} onVideoExcerptEditorChange={async(_f,_i,open)=>open?'https://playback.invalid/full':undefined}/></main></I18nProvider>);
 `,loader:'tsx',resolveDir:frontend},bundle:true,platform:'browser',format:'iife',write:false,define:{'process.env':'{}','process.env.NODE_ENV':'"production"'},jsx:'automatic',tsconfig:resolve(frontend,'tsconfig.json')});
 const requireFrontend=createRequire(join(frontend,'package.json'));
 const styles=await Promise.all(['app/globals.css','src/styles/tokens.css','src/styles/app-experience.css'].map(path=>readFile(join(frontend,path),'utf8')));
 const css=await requireFrontend('postcss')([requireFrontend('tailwindcss')({...tailwindConfig,content:tailwindConfig.content.map(pattern=>join(frontend,pattern))})]).process(styles.join('\n').replace(/@(?:import|config)[^;]+;/g,''),{from:join(frontend,'app/globals.css')});
 const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/app.js'?'text/javascript':'text/html');res.end(req.url==='/app.js'?bundle.outputFiles[0].text:'<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><style>'+css.css+'</style><div id="root"></div><script src="/app.js"></script>');});
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
 const address=server.address();assert.ok(address&&typeof address!=='string');
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage();page.on('pageerror',error=>console.error(error.message));const mediaRequests:string[]=[];
  await page.route('https://**.invalid/**',route=>{mediaRequests.push(route.request().url());return route.abort();});
  await page.goto(`http://127.0.0.1:${address.port}`);
  for(const width of [1440,390,320]){
  await page.setViewportSize({width,height:1000});
  for(const action of ['Cancel','Escape']){
   const opener=page.getByRole('button',{name:'Choose excerpt',exact:true});
   const box=await opener.boundingBox();assert.ok(box);
   assert.equal(await opener.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),true,'excerpt action must not be covered by Remove');
   await opener.focus();await page.keyboard.press('Enter');
   const dialog=page.getByRole('dialog');await dialog.locator('video').waitFor();
   assert.equal(await dialog.locator('video').getAttribute('src'),'https://playback.invalid/full');
   assert.equal(await dialog.locator('video').getAttribute('preload'),'none');
   assert.equal(await dialog.getByRole('button',{name:'Use excerpt',exact:true}).isDisabled(),true);
   if(action==='Cancel')await dialog.getByRole('button',{name:'Cancel',exact:true}).click();else await page.keyboard.press('Escape');
   await dialog.waitFor({state:'hidden'});
   assert.equal(await opener.evaluate(el=>document.activeElement===el),true,'closing returns focus to the actual initiating action');
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  }
  assert.deepEqual(mediaRequests,[],'opening a selector must not fetch either short preview or original video before Play');
 }finally{await browser.close();server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
});
