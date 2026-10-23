import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { build } from 'esbuild';
import { resolve, join } from 'node:path';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import ffmpeg from '../frontend/node_modules/@ffmpeg-installer/ffmpeg';
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
   await page.waitForTimeout(50);
   assert.equal(mediaRequests.filter(url=>url==='https://playback.invalid/full').length,0,'opening alone must not fetch full-source bytes');
   if(action==='Apply'){
    await dialog.getByRole('spinbutton',{name:'Start (seconds)',exact:true}).fill('1');
    await dialog.getByRole('spinbutton',{name:'End (seconds)',exact:true}).fill('5');
   }
   if(action==='Apply')await dialog.getByRole('button',{name:'Use excerpt',exact:true}).click();else if(action==='Cancel')await dialog.getByRole('button',{name:'Cancel',exact:true}).click();else await page.keyboard.press('Escape');
   mediaRequests.splice(0);
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
   let dialog=page.getByRole('dialog');await dialog.locator('video').waitFor();mediaRequests.length=0;
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
  assert.deepEqual(mediaRequests.filter(url=>url!=='https://playback.invalid/full'&&(density!=='default'||url!=='https://preview.invalid/short')),[],`${density}: preview intent uses only the owned full source`);
  mediaRequests.length=0;
  }
  assert.deepEqual(pageErrors,[],'no browser runtime exceptions');
 }finally{await browser.close();server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
});


test('real frames, mouse/touch trim, seek, zoom and exact reset work at desktop and short mobile viewports', async () => {
 const frontend=resolve('frontend');
 const dir=await mkdtemp(join(tmpdir(),'excerpt-timeline-'));
 await promisify(execFile)(ffmpeg.path,['-v','error','-f','lavfi','-i','testsrc=size=160x90:rate=10:duration=60','-pix_fmt','yuv420p','-c:v','libx264','-threads','1','-movflags','+faststart','-y',join(dir,'source.mp4')],{timeout:30000});
 const bytes=await readFile(join(dir,'source.mp4'));
 const bundle=await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {VideoExcerptSelector} from './components/media/VideoExcerptSelector.client';createRoot(document.getElementById('root')).render(<VideoExcerptSelector previewUrl="/source.mp4" durationSec={60} limits={{sourceFieldId:'video_url',minDurationSec:null,maxDurationSec:18,maxSizeMB:100,durationPolicy:'source_video'}} locale="en" onCancel={()=>{}} onApply={async range=>{window.applied=range;}}/>);`,loader:'tsx',resolveDir:frontend},bundle:true,platform:'browser',format:'iife',write:false,define:{'process.env.NODE_ENV':'"production"'},jsx:'automatic',tsconfig:join(frontend,'tsconfig.json')});
 let mediaRequests=0;
 const server=createServer((req,res)=>{
  if(req.url==='/source.mp4'){mediaRequests++;res.setHeader('Content-Type','video/mp4');res.setHeader('Accept-Ranges','bytes');const match=req.headers.range?.match(/bytes=(\d+)-(\d*)/);const start=match?Number(match[1]):0,end=match?.[2]?Math.min(Number(match[2]),bytes.length-1):bytes.length-1;if(match)res.writeHead(206,{'Content-Range':`bytes ${start}-${end}/${bytes.length}`,'Content-Length':end-start+1});else res.setHeader('Content-Length',bytes.length);res.end(bytes.subarray(start,end+1));return;}
  if(req.url==='/app.js'){res.setHeader('Content-Type','text/javascript');res.end(bundle.outputFiles[0].text);return;}
  res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;font-family:Arial}button{color:inherit;font:inherit}button{border:0}.app-reference-modal-layer{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#0006}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}p{margin:0}</style><div id="root"></div><script src="/app.js"></script>');
 });
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
 const address=server.address();assert.ok(address&&typeof address!=='string');
 const browser=await chromium.launch({headless:true});
 try {
  const context=await browser.newContext({hasTouch:true});const page=await context.newPage();
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  for(const [width,height] of [[1440,1000],[390,667],[320,568]]){
   await page.setViewportSize({width,height});mediaRequests=0;
   await page.goto(`http://127.0.0.1:${address.port}`);await page.waitForTimeout(150);
   assert.equal(mediaRequests,0,'opening alone never fetches source or thumbnails');
   const dialog=page.getByRole('dialog'), start=dialog.getByRole('spinbutton',{name:'Start (seconds)',exact:true}), end=dialog.getByRole('spinbutton',{name:'End (seconds)',exact:true});
   assert.equal(await dialog.getByRole('button',{name:'Use excerpt',exact:true}).isDisabled(),true);
   const track=dialog.locator('.video-excerpt-track');await track.scrollIntoViewIfNeeded();
   let box=await track.boundingBox();assert.ok(box);
   let grip=await dialog.locator('.video-excerpt-handle-start').boundingBox();assert.ok(grip);
   await page.mouse.move(grip.x+grip.width/2,grip.y+grip.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/3,grip.y+grip.height/2,{steps:4});await page.mouse.up();
   assert.ok(Math.abs(Number(await start.inputValue())-20)<.1);
   const initialStart=Number(await start.inputValue());
   grip=await dialog.locator('.video-excerpt-handle-start').boundingBox();assert.ok(grip);
   await page.mouse.move(grip.x+grip.width/2-15,grip.y+grip.height/2);await page.mouse.down();await page.mouse.move(grip.x+grip.width/2-14,grip.y+grip.height/2);await page.mouse.up();
   assert.equal(Number(await start.inputValue()),Number((initialStart+60/box.width).toFixed(2)),'off-center mouse grab preserves offset');
   await end.fill('25');
   await dialog.getByRole('button',{name:'Zoom to excerpt',exact:true}).click();
   const beforeRange=[await start.inputValue(),await end.inputValue()];
   assert.equal(await dialog.getByRole('button',{name:'Full view'}).getAttribute('aria-pressed'),'true');
   assert.deepEqual([await start.inputValue(),await end.inputValue()],beforeRange);
   await page.waitForFunction(()=>document.querySelectorAll('.video-excerpt-frames img').length===10);
   const frames=await dialog.locator('.video-excerpt-frames img').evaluateAll(nodes=>nodes.map(node=>(node as HTMLImageElement).src));
   assert.ok(new Set(frames).size>1,'filmstrip contains changing real decoded frames');
   assert.equal(await dialog.locator('video').getAttribute('crossorigin'),null);
   const stageBox=await dialog.locator('.video-excerpt-stage').boundingBox(),videoBox=await dialog.locator('video').boundingBox();assert.ok(stageBox&&videoBox);
   assert.ok(videoBox.height<=stageBox.height+1,'decoded video stays within its stage geometry');
   const selected=dialog.locator('.video-excerpt-selection');await selected.focus();await page.keyboard.press('Shift+ArrowRight');
   assert.ok(Math.abs(Number(await end.inputValue())-Number(await start.inputValue())-(Number(beforeRange[1])-Number(beforeRange[0])))<.1);
   await track.scrollIntoViewIfNeeded();box=await track.boundingBox();assert.ok(box);
   const ruler=await dialog.locator('.video-excerpt-seek').boundingBox();assert.ok(ruler);
   await page.touchscreen.tap(box.x+box.width*.45,ruler.y+10);
   await page.waitForFunction(()=>{const video=document.querySelector('video')!;return video.readyState>=2&&video.currentTime>19;});
   assert.equal(await dialog.locator('video').evaluate(node=>node.paused),true,'scrubbing does not start playback');
   const cdp=await context.newCDPSession(page);
   grip=await dialog.locator('.video-excerpt-handle-end').boundingBox();assert.ok(grip);
   const scrollBefore=await dialog.evaluate(node=>node.scrollTop);
   const beforeTouchEnd=Number(await end.inputValue());
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:grip.x+grip.width/2+15,y:grip.y+grip.height/2}]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:grip.x+grip.width/2,y:grip.y+grip.height/2}]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   await cdp.detach();
   assert.equal(await dialog.evaluate(node=>node.scrollTop),scrollBefore,'touch trim does not scroll dialog');
   const viewSpan=Number(beforeRange[1])-Number(beforeRange[0])+2;
   assert.equal(Number(await end.inputValue()),Number((beforeTouchEnd-15/box.width*viewSpan).toFixed(2)),'off-center touch grab preserves offset');
   assert.ok(Number(await start.inputValue())<Number(await end.inputValue()));
   await dialog.getByRole('button',{name:'Whole video',exact:true}).click();
   assert.equal(await start.inputValue(),'0');assert.equal(await end.inputValue(),'60');
   const apply=dialog.getByRole('button',{name:'Use excerpt',exact:true});await apply.scrollIntoViewIfNeeded();
   const actionBox=await apply.boundingBox();assert.ok(actionBox);assert.ok(actionBox.y>=0&&actionBox.y+actionBox.height<=height);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   assert.equal(await dialog.evaluate(node=>node.scrollWidth>node.clientWidth+1),false);
  }
  assert.deepEqual(errors,[]);
 } finally {await browser.close();server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));await rm(dir,{recursive:true,force:true});}
});
