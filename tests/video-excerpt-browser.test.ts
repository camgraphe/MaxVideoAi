import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { build } from 'esbuild';
import { resolve, join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import tailwindConfig from '../frontend/tailwind.config';
import { chromium } from '@playwright/test';

test('both shared excerpt surfaces restore keyboard focus after Apply, Cancel and Escape', async()=>{
 const frontend=resolve('frontend');
 const bundle=await build({stdin:{contents:`
 import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
 import {Composer} from './components/Composer';
 import {I18nProvider} from './lib/i18n/I18nProvider';
 import {getBaseEngineIncludingHidden} from './src/lib/engines';
 const asset={id:'source',assetId:'owned',ref:{type:'asset',assetId:'owned',kind:'video'},url:'https://canonical.invalid/original',previewUrl:'https://preview.invalid/short',kind:'video',name:'ma_22222222222222222222222222222222.mp4',size:100,type:'video/mp4',durationSec:60,status:'ready'};
 function Main(){const [selected,setSelected]=useState(asset);const [engineId,setEngineId]=useState('luma-ray-3-2');const [owner,setOwner]=useState('A');
 window.fixture={replace:(kind)=>{if(kind==='source')setSelected({...asset,id:'replacement',url:'https://canonical.invalid/replacement'});if(kind==='model')setEngineId('kling-o3-standard');if(kind==='account')setOwner('B');}};
 return <I18nProvider locale="en" dictionary={{}} fallback={{}}><main className="app-experience" style={{padding:16}}><Composer key={owner} density={new URLSearchParams(location.search).get('density')||'workspace'} engine={getBaseEngineIncludingHidden(engineId)} activeManualMode="v2v" prompt="Edit" onPromptChange={()=>{}} price={null} currency="USD" isLoading={false} promptRequired assetFields={[{field:{id:'video_url',type:'video',maxCount:1},required:true}]} assets={{video_url:[selected]}} onAssetRemove={()=>{}} onPrepareVideoExcerpt={async()=>{if(window.holdPreparation){await new Promise(resolve=>window.finishPreparation=resolve);return;}setSelected({...asset,id:'prepared',url:'https://canonical.invalid/prepared-'+Date.now(),durationSec:4,excerptSource:asset,excerptRange:{startSec:1,endSec:5}});}} onVideoExcerptEditorChange={async(_f,_i,open)=>open?'https://playback.invalid/full':undefined}/></main></I18nProvider>;}createRoot(document.getElementById('root')).render(<Main/>);
 `,loader:'tsx',resolveDir:frontend},bundle:true,platform:'browser',format:'iife',write:false,define:{'process.env':'{}','process.env.NODE_ENV':'"production"'},jsx:'automatic',tsconfig:resolve(frontend,'tsconfig.json')});
 const requireFrontend=createRequire(join(frontend,'package.json'));
 const styles=await Promise.all(['app/globals.css','src/styles/tokens.css','src/styles/app-experience.css'].map(path=>readFile(join(frontend,path),'utf8')));
 const css=await requireFrontend('postcss')([requireFrontend('tailwindcss')({...tailwindConfig,content:tailwindConfig.content.map(pattern=>join(frontend,pattern))})]).process(styles.join('\n').replace(/@(?:import|config)[^;]+;/g,''),{from:join(frontend,'app/globals.css')});
 const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/app.js'?'text/javascript':'text/html');res.end(req.url==='/app.js'?bundle.outputFiles[0].text:'<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><style>'+css.css+'</style><div id="root"></div><script src="/app.js"></script>');});
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
 const address=server.address();assert.ok(address&&typeof address!=='string');
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage();const pageErrors:string[]=[];page.on('pageerror',error=>pageErrors.push(error.message));const mediaRequests:string[]=[];
  await page.route('https://**.invalid/**',route=>{mediaRequests.push(route.request().url());return route.abort();});
  for(const density of ['workspace','default']){
  await page.goto(`http://127.0.0.1:${address.port}/?density=${density}`);
  await page.waitForLoadState('networkidle');
  const surfaceMedia=mediaRequests.splice(0);
  assert.deepEqual(surfaceMedia,density==='default'?['https://preview.invalid/short']:[], 'only the existing default source card may request its preview');
  for(const width of [1440,390,320]){
  await page.setViewportSize({width,height:1000});
  for(const action of ['Cancel','Escape','Apply']){
   const opener=page.getByRole('button',{name:'Choose excerpt',exact:true});
   const box=await opener.boundingBox();assert.ok(box);
   assert.equal(await opener.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),true,'excerpt action must not be covered by Remove');
   await opener.focus();await page.keyboard.press('Enter');
   const dialog=page.getByRole('dialog');await dialog.locator('video').waitFor();
   await page.waitForFunction(()=>document.querySelector('[role=dialog]')?.contains(document.activeElement));
   assert.equal(await dialog.locator('video').getAttribute('src'),'https://playback.invalid/full');
   assert.equal(await dialog.locator('video').getAttribute('preload'),'none');
   if(action==='Apply'){
    await dialog.getByRole('spinbutton',{name:'Start (seconds)',exact:true}).fill('1');
    await dialog.getByRole('spinbutton',{name:'End (seconds)',exact:true}).fill('5');
   }
   if(action==='Apply')await dialog.getByRole('button',{name:'Use excerpt',exact:true}).click();else if(action==='Cancel')await dialog.getByRole('button',{name:'Cancel',exact:true}).click();else await page.keyboard.press('Escape');
   await dialog.waitFor({state:'hidden',timeout:5000}).catch(async error=>{throw new Error(`${density}/${width}/${action}: ${await dialog.textContent()} / page errors ${pageErrors.join('; ')} / ${error}`);});
   assert.equal(await opener.evaluate(el=>document.activeElement===el),true,`${density}/${width}/${action}: closing returns focus to the current source action`);
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  }
  for(const change of ['source','model','account']){
   await page.reload();await page.waitForLoadState('networkidle');mediaRequests.length=0;
   await page.evaluate(()=>{(window as any).holdPreparation=true;});
   let opener=page.getByRole('button',{name:'Choose excerpt',exact:true});
   await opener.focus();await page.keyboard.press('Enter');
   let dialog=page.getByRole('dialog');await dialog.locator('video').waitFor();
   await dialog.getByRole('spinbutton',{name:'Start (seconds)',exact:true}).fill('1');
   await dialog.getByRole('spinbutton',{name:'End (seconds)',exact:true}).fill('5');
   await dialog.getByRole('button',{name:'Use excerpt',exact:true}).click();
   await page.waitForFunction(()=>Boolean((window as any).finishPreparation));
   await page.evaluate(change=>(window as any).fixture.replace(change),change);
   await dialog.waitFor({state:'hidden'});
   opener=page.getByRole('button',{name:'Choose excerpt',exact:true});
   await opener.focus();await page.keyboard.press('Enter');
   dialog=page.getByRole('dialog');await dialog.locator('video').waitFor();
   await page.waitForFunction(()=>document.querySelector('[role=dialog]')?.contains(document.activeElement));
   await page.evaluate(async()=>{(window as any).finishPreparation();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
   assert.equal(await dialog.isVisible(),true,`${density}/${change}: a late Apply must not close the replacement session`);
   assert.equal(await dialog.evaluate(el=>el.contains(document.activeElement)),true,`${density}/${change}: a stale Apply must not steal focus`);
   await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
   assert.equal(await opener.evaluate(el=>el===document.activeElement),true);
  }
  assert.deepEqual(mediaRequests.filter(url=>density!=='default'||url!=='https://preview.invalid/short'),[],`${density}: the selector must not fetch full source media before Play`);
  mediaRequests.length=0;
  }
  assert.deepEqual(pageErrors,[],'no browser runtime exceptions');
 }finally{await browser.close();server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
});
