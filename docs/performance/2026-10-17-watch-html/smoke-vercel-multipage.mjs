import fs from 'node:fs';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const root=process.cwd(), report=path.join(root,'docs/performance/2026-10-17-watch-html');
const protocol=JSON.parse(fs.readFileSync(path.join(report,'multipage-protocol.json')));
const require=createRequire(path.join(root,'frontend/package.json'));
const lhReq=createRequire(require.resolve('lighthouse/package.json',{paths:[require.resolve('@lhci/cli/package.json')]}));
const {launch}=await import(pathToFileURL(lhReq.resolve('chrome-launcher')));
const {parseChromeFlags}=await import(pathToFileURL(lhReq.resolve('lighthouse/cli/run.js')));
const settings=createRequire(import.meta.url)(path.join(root,'scripts/performance/lighthouse-chrome-settings.cjs'));
const puppeteer=(await import(pathToFileURL(lhReq.resolve('puppeteer-core')))).default;
const authByOrigin=new Map();
for(const {origin} of Object.values(protocol.source)){
 const cli=spawnSync('vercel',['curl','/favicon.ico','--deployment',origin,'--scope','camgraphes-projects','--','--verbose','--silent','--max-time','30','--output','/dev/null'],{encoding:'utf8',maxBuffer:1024*1024});
 const bypass=cli.stderr?.match(/> x-vercel-protection-bypass: ([^\r\n]+)/i)?.[1];
 if(cli.status!==0||!bypass)throw Error('Owner-authenticated preview access unavailable');
 authByOrigin.set(origin,bypass);
}
const safeJSON=(value,space)=>[...authByOrigin.values()].reduce((text,secret)=>text.replaceAll(secret,'[redacted]'),JSON.stringify(value,null,space));
const records=[];
const chrome=await launch({chromeFlags:[...parseChromeFlags(settings.chromeFlags),'--headless=new'],ignoreDefaultFlags:true});
let browser;
try{
 browser=await puppeteer.connect({browserURL:`http://127.0.0.1:${chrome.port}`});
 for(const {key,route} of protocol.routes)for(const device of ['desktop','mobile'])for(const side of ['baseline','candidate']){
  const context=await browser.createBrowserContext(),page=await context.newPage();
  try{
   const profile=protocol.profiles[device],em=profile.screenEmulation;
   await page.setViewport({width:em.width,height:em.height,deviceScaleFactor:1,isMobile:device==='mobile',hasTouch:device==='mobile'});
   await page.setUserAgent(profile.emulatedUserAgent);
   await page.setRequestInterception(true);
   page.on('request',request=>{const headers=request.headers();delete headers['x-vercel-protection-bypass'];const auth=authByOrigin.get(new URL(request.url()).origin);if(auth)headers['x-vercel-protection-bypass']=auth;void request.continue({headers});});
   const media=[],pageErrors=[];
   page.on('response',response=>{if(response.request().resourceType()==='media')media.push({url:response.url(),status:response.status(),contentType:response.headers()['content-type']});});
   page.on('pageerror',error=>pageErrors.push(error.message));
   const response=await page.goto(protocol.source[side].origin+route,{waitUntil:'networkidle2',timeout:45000});
   assert.equal(response.status(),200);
   await page.waitForSelector('.video-reader-centerPlay',{visible:true,timeout:15000});
   await page.evaluate(()=>document.fonts.ready);
   const snapshot=()=>page.evaluate(()=>{const frame=document.querySelector('.video-reader-frame'),video=frame?.querySelector('video'),r=frame?.getBoundingClientRect();return {rect:r?{x:r.x,y:r.y,width:r.width,height:r.height}:null,media:video?{paused:video.paused,currentTime:video.currentTime,readyState:video.readyState,error:video.error?.code??null,src:video.currentSrc||video.src,preload:video.preload}:null,viewportWidth:innerWidth,documentWidth:document.documentElement.scrollWidth};});
   const before=await snapshot();assert.equal(before.media.paused,true);assert.equal(before.media.preload,'none');assert.ok(before.documentWidth<=before.viewportWidth+1,'no horizontal page overflow');
   const start=Date.now();
   await page.click('.video-reader-centerPlay');
   await page.waitForFunction(()=>{const v=document.querySelector('.video-reader-frame video');return v&&!v.paused&&v.currentTime>0.05&&v.readyState>=2;},{timeout:30000});
   const after=await snapshot();
   assert.equal(after.media.error,null);
   for(const dimension of ['x','y','width','height'])assert.ok(Math.abs(before.rect[dimension]-after.rect[dimension])<=1,'Play must preserve reader geometry');
   await page.evaluate(()=>document.querySelector('.video-reader-frame video').pause());
   assert.ok(media.some(row=>row.status===200||row.status===206),'real media response required');
   assert.equal(pageErrors.length,0);
   records.push({page:key,route,device,side,time:new Date().toISOString(),before,after,firstPlayElapsedMs:Date.now()-start,media,pageErrors});
   fs.writeFileSync(path.join(report,'multipage-playback.json'),safeJSON(records,2)+'\n');
   console.log(safeJSON({page:key,device,side,result:'real first Play, fixed geometry, no overflow',firstPlayElapsedMs:Date.now()-start,mediaStatus:media.map(row=>row.status)}));
  }finally{await context.close();}
 }
}finally{browser?.disconnect();await chrome.kill();}
assert.equal(records.length,12);
