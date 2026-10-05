/** Comparable localhost production-build diagnostics, never a field CWV claim. */
const {chromium}=require('../../../../node_modules/@playwright/test');
const fs=require('node:fs');const path=require('node:path');
const base=process.env.ADS_REVIEW_URL;
const label=process.argv[2];
if(!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base||'')||!['before','after'].includes(label))throw Error('Set localhost ADS_REVIEW_URL and before/after label');
const routes=['/studio','/integrations/claude'];
const devices=[['desktop',{width:1440,height:1000},1],['mobile',{width:390,height:844},4]];
(async()=>{
 const browser=await chromium.launch({headless:true});const rows=[];
 // Prime server-render/optimizer caches for both routes and devices. The browser
 // contexts below are fresh for each pair, so "cold" refers to browser cache only.
 for(const route of routes)for(const [,viewport]of devices){const p=await browser.newPage({viewport});await p.goto(base+route,{waitUntil:'networkidle'});await p.close();}
 for(const route of routes)for(const [device,viewport,cpuRate]of devices)for(let run=1;run<=3;run++){
  const context=await browser.newContext({viewport,deviceScaleFactor:1});const page=await context.newPage();
  const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:cpuRate});
  if(device==='mobile')await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:200000,uploadThroughput:93750});
  await page.addInitScript(()=>{
   window.qaLcp=[];window.qaCls=0;window.qaLongTasks=[];
   new PerformanceObserver(l=>window.qaLcp.push(...l.getEntries().map(e=>({start:e.startTime,size:e.size,tag:e.element?.tagName,url:e.url})))).observe({type:'largest-contentful-paint',buffered:true});
   new PerformanceObserver(l=>l.getEntries().forEach(e=>{if(!e.hadRecentInput)window.qaCls+=e.value})).observe({type:'layout-shift',buffered:true});
   new PerformanceObserver(l=>window.qaLongTasks.push(...l.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true});
  });
  for(const cache of ['cold','warm']){
   const errors=[];const failed=[];const onError=e=>errors.push(e.message);const onResponse=r=>{if(r.status()>=400)failed.push({url:new URL(r.url()).pathname,status:r.status()});};
   page.on('pageerror',onError);page.on('response',onResponse);
   const response=await page.goto(base+route,{waitUntil:'networkidle',timeout:120000});
   // Keep an observation window after network idle; no consent or other input.
   await page.waitForTimeout(1500);
   const data=await page.evaluate(()=>{
    const nav=performance.getEntriesByType('navigation')[0];const resources=performance.getEntriesByType('resource');
    const cta=document.querySelector('main a[href*="marketing-entry"],main a[href="#setup"]');
    return {lcp:window.qaLcp.at(-1),cls:window.qaCls,ttfb:nav.responseStart,domInteractive:nav.domInteractive,loadEnd:nav.loadEventEnd,mainCtaPresent:Boolean(cta),longTaskCount:window.qaLongTasks.length,longTaskMs:window.qaLongTasks.reduce((s,e)=>s+e.duration,0),blockingMs:window.qaLongTasks.reduce((s,e)=>s+Math.max(0,e.duration-50),0),transferBytes:resources.reduce((s,e)=>s+e.transferSize,nav.transferSize),requests:resources.map(e=>({url:new URL(e.name).pathname+new URL(e.name).search,start:e.startTime,duration:e.duration,transferBytes:e.transferSize,decodedBytes:e.decodedBodySize,initiator:e.initiatorType})),overflow:document.documentElement.scrollWidth>innerWidth};
   });
   rows.push({route,device,run,cache,status:response.status(),...data,errors,failed});
   console.log(JSON.stringify({label,route,device,run,cache,lcp:data.lcp?.start,cls:data.cls,transferBytes:data.transferBytes}));
   page.off('pageerror',onError);page.off('response',onResponse);
  }
  await context.close();
 }
 const browserVersion=browser.version();await browser.close();
 const output=path.resolve(__dirname,'../review/performance-'+label+'.json');
 fs.writeFileSync(output,JSON.stringify({date:'2026-10-05',base,source:label==='before'?'e50fb575a60b15f0350e3324e045a43f87a39306':process.env.ADS_REVIEW_SOURCE||'codex/ads-readiness-20261005 local candidate',browserVersion,protocol:'Next production builds, same machine. Fresh context/no stored consent per pair; first navigation cold browser cache, second warm browser cache. Server/optimizer caches primed for both device viewports. Desktop1440x1000 CPU1/no network throttle. Mobile390x844 CPU4, latency150ms/download200000Bps/upload93750Bps. Three pairs per route/device, observation to networkidle+1500ms. Blocking milliseconds are long-task excess above50ms, not Lighthouse TBT or field INP. External/isolated backend failures retained. Diagnostic only, not production CWV certification.',rows},null,2));
 if(rows.some(r=>r.status!==200||r.overflow||r.errors.length||!r.mainCtaPresent))process.exitCode=1;
})();
