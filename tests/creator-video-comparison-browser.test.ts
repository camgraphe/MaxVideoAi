import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';

test('manual private comparison decodes two videos, keeps segment offsets and makes no media request before Play',async()=>{
  const frontend=resolve('frontend');
  const bundle=await build({stdin:{contents:`import React from'react';import{createRoot}from'react-dom/client';import{CreatorVideoComparison}from'./src/components/tools/creator/CreatorVideoComparison.client';createRoot(document.getElementById('root')).render(<CreatorVideoComparison locale="en" sourceUrl="/pattern-a.mp4?signature=source" resultUrl="/pattern-b.mp4?signature=result" sourceStartSec={1} sourceEndSec={5}/>);`,loader:'tsx',resolveDir:frontend},outfile:join(frontend,'fixture.js'),bundle:true,platform:'browser',format:'iife',jsx:'automatic',write:false,tsconfig:join(frontend,'tsconfig.json'),define:{'process.env.NODE_ENV':'"production"'}});
  const js=bundle.outputFiles.find(file=>file.path.endsWith('.js'))!.text,css=bundle.outputFiles.find(file=>file.path.endsWith('.css'))!.text;
  const patterns=await Promise.all(['a','b'].map(id=>readFile(`tests/fixtures/studio-media/pattern-${id}.mp4`)));
  const requests:string[]=[];
  const server=createServer((req,res)=>{
    if(req.url?.startsWith('/pattern-')){
      requests.push(req.url);const bytes=patterns[req.url.includes('pattern-a')?0:1];const range=req.headers.range?.match(/bytes=(\d+)-(\d*)/);
      const start=range?Number(range[1]):0,end=range&&range[2]?Math.min(Number(range[2]),bytes.length-1):bytes.length-1;
      res.writeHead(range?206:200,{'content-type':'video/mp4','accept-ranges':'bytes','content-length':end-start+1,...range?{'content-range':`bytes ${start}-${end}/${bytes.length}`}:{}});res.end(bytes.subarray(start,end+1));return;
    }
    if(req.url==='/fixture.js'){res.writeHead(200,{'content-type':'application/javascript'});res.end(js);return;}
    res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{--app-line:#d9ddd6;--app-panel:#fff;--app-muted:#646b61;--app-accent:#31534a}*{box-sizing:border-box}body{margin:0;font:14px Arial;background:#fff;color:#20261f}button{cursor:pointer;font:inherit}#root{max-width:1100px;margin:24px auto}${css}</style></head><body><p>Synthetic local test patterns · not generated product results</p><div id="root"></div><script src="/fixture.js"></script></body></html>`);
  });
  await new Promise<void>(done=>server.listen(0,'127.0.0.1',done));const address=server.address();assert.ok(address&&typeof address!=='string');
  const browser=await chromium.launch({headless:true});
  try{for(const width of [390,1440]){
    const page=await browser.newPage({viewport:{width,height:1000}});const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));requests.length=0;
    try{
      await page.goto(`http://127.0.0.1:${address.port}/`);await page.getByRole('button',{name:'Play both',exact:true}).waitFor();
      await page.evaluate(`(() => { for (const video of document.querySelectorAll('video')) { const frame = (_now, metadata) => { video.dataset.presentedTime = String(metadata.mediaTime); if (video.isConnected) video.requestVideoFrameCallback(frame); }; video.requestVideoFrameCallback(frame); } })()`);
      assert.equal(requests.length,0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await page.evaluate(()=>{(window as any).mediaEvents=[];for(const video of document.querySelectorAll('video'))for(const name of ['loadedmetadata','waiting','canplay','play','pause','playing','error','seeking','seeked'])video.addEventListener(name,()=>{(window as any).mediaEvents.push({video:video.getAttribute('aria-label'),name,time:video.currentTime,ready:video.readyState});if((window as any).mediaEvents.length>60)(window as any).mediaEvents.shift();});});
      await page.getByRole('button',{name:'Play both',exact:true}).click();
      await page.waitForFunction(()=>{const [a,b]=document.querySelectorAll('video');return a&&!a.paused&&!b.paused&&b.currentTime>.4&&a.getVideoPlaybackQuality().totalVideoFrames>0&&b.getVideoPlaybackQuality().totalVideoFrames>0;},{},{timeout:8000}).catch(async error=>{console.error(await page.evaluate(()=>({events:(window as any).mediaEvents.slice(-40),videos:Array.from(document.querySelectorAll('video')).map(v=>({time:v.currentTime,paused:v.paused,error:v.error?.code,ready:v.readyState})),text:document.body.textContent})));throw error;});
      const drift=await page.evaluate(()=>{const[a,b]=document.querySelectorAll('video');return Math.abs(a.currentTime-b.currentTime-1);});assert.ok(drift<.16,`offset drift ${drift}`);
      await page.getByRole('button',{name:'Pause',exact:true}).click();
      await page.getByRole('slider',{name:'Playback position'}).evaluate((node:HTMLInputElement)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(node,'2.5');node.dispatchEvent(new Event('input',{bubbles:true}));});
      await page.waitForFunction(()=>{const[a,b]=document.querySelectorAll('video');return a.paused&&b.paused&&!a.seeking&&!b.seeking&&Math.abs(a.currentTime-3.5)<.05&&Math.abs(b.currentTime-2.5)<.05&&Math.abs(Number(a.dataset.presentedTime)-3.5)<.05&&Math.abs(Number(b.dataset.presentedTime)-2.5)<.05;});
      if(process.env.CREATOR_WORKSPACE_EVIDENCE_DIR){await mkdir(process.env.CREATOR_WORKSPACE_EVIDENCE_DIR,{recursive:true});await page.screenshot({path:join(process.env.CREATOR_WORKSPACE_EVIDENCE_DIR,`product-video-comparison-${width}.png`),fullPage:true});await writeFile(join(process.env.CREATOR_WORKSPACE_EVIDENCE_DIR,`product-video-comparison-${width}.json`),JSON.stringify(await page.locator('video').evaluateAll(nodes=>nodes.map(node=>({role:node.getAttribute('aria-label'),currentTime:node.currentTime,presentedFrameTime:Number(node.dataset.presentedTime),paused:node.paused,seeking:node.seeking}))),null,2));}
      await page.getByRole('button',{name:'Play both',exact:true}).click();
      await page.waitForFunction(()=>{const[a,b]=document.querySelectorAll('video');return a.paused&&b.paused&&Math.abs(a.currentTime-5)<.05&&Math.abs(b.currentTime-4)<.05;},{},{timeout:6000});
      assert.ok(requests.every(url=>url.includes('?signature=')));assert.deepEqual(errors,[]);
    }finally{await page.close();}
  }}finally{await browser.close();server.closeAllConnections();await new Promise<void>((done,reject)=>server.close(error=>error?reject(error):done()));}
});
