import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
const req=createRequire(path.resolve('frontend/package.json'));
const lhReq=createRequire(req.resolve('lighthouse/package.json',{paths:[req.resolve('@lhci/cli/package.json')]}));
const puppeteer=(await import(pathToFileURL(lhReq.resolve('puppeteer-core')))).default;
const {launch}=await import(pathToFileURL(lhReq.resolve('chrome-launcher')));
const {parseChromeFlags}=await import(pathToFileURL(lhReq.resolve('lighthouse/cli/run.js')));
const settings=req(path.resolve('scripts/performance/lighthouse-chrome-settings.cjs'));
const origins={baseline:process.argv[2],candidate:process.argv[3]};
for(const origin of Object.values(origins))assert.match(origin??'',/^https:\/\/maxvideoai-[a-z0-9]+-camgraphes-projects\.vercel\.app$/,'explicit immutable preview required');
assert.notEqual(origins.baseline,origins.candidate);
const auth=new Map();
for(const origin of Object.values(origins)){
 const cli=spawnSync('vercel',['curl','/favicon.ico','--deployment',origin,'--scope','camgraphes-projects','--','--verbose','--silent','--max-time','30','--output','/dev/null'],{encoding:'utf8'});
 const key=cli.stderr.match(/> x-vercel-protection-bypass: ([^\r\n]+)/i)?.[1];assert.ok(key&&cli.status===0);auth.set(origin,key);
}
const out=path.resolve(process.env.CWV_VERIFY_OUT??'.reports/desktop-cwv/functional');fs.mkdirSync(out,{recursive:true});const results=[];
const routes={watch:'/video/seedance-2-0-fast-ecommerce-product-ad-example-storyboard-to-video-452f05f2',compare:'/es/comparativa/kling-3-pro-vs-veo-3-1',landscape:'/video/wan-3-prime-ai-match-cut-transitions',compare2:'/es/comparativa/kling-2-5-turbo-vs-ltx-2-3-fast'};
for(const [name,route] of Object.entries(routes))for(const device of ['desktop','mobile'])for(const [side,origin] of Object.entries(origins)){
 const chrome=await launch({chromeFlags:[...parseChromeFlags(settings.chromeFlags),'--headless=new'],ignoreDefaultFlags:true});let browser;
 try {
  browser=await puppeteer.connect({browserURL:`http://127.0.0.1:${chrome.port}`});const page=await browser.newPage();
  await page.setViewport(device==='mobile'?{width:390,height:844,isMobile:true,hasTouch:true}:{width:1440,height:900});
  if(device==='mobile')await page.setUserAgent('Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36');
  const media=[];await page.setRequestInterception(true);page.on('request',request=>{if(request.resourceType()==='media')media.push(request.url());const headers=request.headers();delete headers['x-vercel-protection-bypass'];const key=auth.get(new URL(request.url()).origin);if(key)headers['x-vercel-protection-bypass']=key;void request.continue({headers});});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const response=await page.goto(origin+route,{waitUntil:'networkidle2',timeout:60000});assert.equal(response.status(),200);
  const data=await page.evaluate(()=>({canonical:document.querySelector('link[rel=canonical]')?.href,title:document.querySelector('h1')?.textContent,robots:document.querySelector('meta[name=robots]')?.content,hreflang:[...document.querySelectorAll('link[hreflang]')].map(n=>[n.hreflang,n.href]),schema:[...document.querySelectorAll('script[type="application/ld+json"]')].map(n=>JSON.parse(n.textContent)),reader:document.querySelector('.video-reader-standalone')?.textContent,related:[...document.querySelectorAll('article + div a[href^="/video/"]')].map(n=>n.getAttribute('href')),prices:document.querySelector('#pricing')?.textContent,gallery:[...document.querySelectorAll('.compare-gallery-video')].map(n=>n.getAttribute('href')),frame:(()=>{const r=document.querySelector('.video-reader-frame')?.getBoundingClientRect();return r?{x:r.x,y:r.y,width:r.width,height:r.height}:null})(),video:(()=>{const v=document.querySelector('.video-reader-frame video');return v?{src:v.getAttribute('src'),poster:v.getAttribute('poster'),preload:v.preload}:null})()}));
  assert.equal(data.canonical,(route.startsWith('/video/')?'https://maxvideoai.com':origin)+route);assert.equal(media.length,0,'manual media stays unloaded before user interaction');
  await page.screenshot({path:path.join(out,`${name}-${device}-${side}.png`)});
  const normalized=JSON.parse(JSON.stringify(data).replaceAll(origin,'https://maxvideoai.com'));
  const baseline=results.find(r=>r.name===name&&r.device===device&&r.side==='baseline');if(side==='candidate')assert.deepEqual(normalized,baseline.data,'visible content, prices, canonical, schema, links and geometry must match');
  for(const button of await page.$$('button'))if(['Reject all','Rechazar todo'].includes(await button.evaluate(n=>n.textContent.trim())))await button.click();
  if(route.startsWith('/video/'))await page.click('.video-reader-centerPlay');
  else {await page.click('.compare-gallery-video');await page.waitForSelector('.compare-video-dialog video');await page.focus('.compare-video-dialog video');await page.keyboard.press('Space');}
  const selector=route.startsWith('/video/')?'.video-reader-frame video':'.compare-video-dialog video';
  await page.waitForFunction(s=>{const v=document.querySelector(s);return v&&!v.paused&&v.currentTime>.1;},{timeout:30000},selector);
  const playing=await page.$eval(selector,v=>({currentTime:v.currentTime,src:v.currentSrc,readyState:v.readyState}));
  if(!route.startsWith('/video/')){await page.keyboard.press('Escape');assert.equal(await page.$('.compare-video-dialog'),null);}
  assert.deepEqual(errors,[],'no browser exceptions');
  results.push({name,device,side,data:normalized,playing});fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify({name,device,side,play:true,parity:side==='candidate',related:data.related?.length,gallery:data.gallery?.length}));
 }finally{browser?.disconnect();await chrome.kill();}
}
