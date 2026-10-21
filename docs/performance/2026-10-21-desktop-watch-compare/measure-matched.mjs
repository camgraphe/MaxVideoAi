import fs from 'node:fs';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const root=process.cwd(), out=path.resolve(process.env.CWV_PERF_OUT ?? '.reports/desktop-cwv/matched');
fs.mkdirSync(out,{recursive:true});
const require=createRequire(path.join(root,'frontend/package.json'));
const lhReq=createRequire(require.resolve('lighthouse/package.json',{paths:[require.resolve('@lhci/cli/package.json')]}));
const lighthouse=(await import(pathToFileURL(lhReq.resolve('lighthouse')))).default;
const {launch}=await import(pathToFileURL(lhReq.resolve('chrome-launcher')));
const {parseChromeFlags}=await import(pathToFileURL(lhReq.resolve('lighthouse/cli/run.js')));
const settings=createRequire(import.meta.url)(path.join(root,'scripts/performance/lighthouse-chrome-settings.cjs'));
const baselineOrigin=process.argv[2];
if(!/^https:\/\/maxvideoai-[a-z0-9]+-camgraphes-projects\.vercel\.app$/.test(baselineOrigin??''))throw Error('Explicit baseline preview origin required');
const origins={baseline:baselineOrigin,candidate:process.argv[3]};
assert.match(origins.candidate,/^https:\/\/maxvideoai-[a-z0-9]+-camgraphes-projects\.vercel\.app$/);
assert.notEqual(origins.baseline,origins.candidate,'baseline and candidate must be distinct immutable deployments');
const authByOrigin=new Map();
for(const origin of Object.values(origins)){
 const cli=spawnSync('vercel',['curl','/favicon.ico','--deployment',origin,'--scope','camgraphes-projects','--','--verbose','--silent','--max-time','30','--output','/dev/null'],{encoding:'utf8',maxBuffer:1024*1024});
 const bypass=cli.stderr?.match(/> x-vercel-protection-bypass: ([^\r\n]+)/i)?.[1];
 if(cli.status!==0||!bypass)throw Error('Owner-authenticated preview access is unavailable');
 authByOrigin.set(origin,bypass);
}
const puppeteer=(await import(pathToFileURL(lhReq.resolve('puppeteer-core')))).default;
const safeJSON=value=>[...authByOrigin.values()].reduce((text,secret)=>text.replaceAll(secret,'[redacted]'),JSON.stringify(value,(key,v)=>/^(?:cookie|set-cookie|authorization|x-vercel-protection-bypass|x-vercel-trusted-oidc-idp-token)$/i.test(key)?'[redacted]':v));
const route=process.env.CWV_PERF_ROUTE ?? '/video/seedance-2-0-fast-ecommerce-product-ad-example-storyboard-to-video-452f05f2';
assert.match(route,/^\/(video|es\/comparativa)\/[a-z0-9][a-z0-9-]*$/,'explicit canonical route required');
const watch=route.startsWith('/video/');
const profiles={desktop:{formFactor:'desktop',screenEmulation:{mobile:false,width:1440,height:900,deviceScaleFactor:1,disabled:false}},mobile:{formFactor:'mobile',screenEmulation:{mobile:true,width:390,height:844,deviceScaleFactor:1,disabled:false}}};
const throttling={requestLatencyMs:150,downloadThroughputKbps:1600,uploadThroughputKbps:750,cpuSlowdownMultiplier:4};
const repeats=Number(process.env.CWV_PERF_REPEATS??3);
assert.ok(Number.isInteger(repeats)&&repeats>=3&&repeats<=10,'three to ten paired repeats required');
const devices=process.env.CWV_PERF_DEVICE?[process.env.CWV_PERF_DEVICE]:['desktop','mobile'];
assert.ok(devices.every(device=>Object.hasOwn(profiles,device)),'valid device filter required');
const records=fs.existsSync(path.join(out,'samples.json'))?JSON.parse(fs.readFileSync(path.join(out,'samples.json'))):[];
for(const row of records){
  assert.equal(row.route,route,'never resume data from another route');
  assert.equal(row.origin,origins[row.side],'never resume data from another deployment origin');
  assert.ok(profiles[row.device],'saved device must have an explicit profile');
  assert.equal(/Android|Mobile/.test(row.settings.emulatedUserAgent),row.device==='mobile','never resume an invalid device User-Agent');
  assert.deepEqual(row.settings.screenEmulation,profiles[row.device].screenEmulation,'never resume another viewport');
  assert.equal(row.settings.formFactor,profiles[row.device].formFactor);
  assert.equal(row.settings.throttlingMethod,'devtools');
  for(const [key,value] of Object.entries(throttling))assert.equal(row.settings.throttling[key],value,'never resume other throttling');
}
const savedLighthouseVersion=records.length?JSON.parse(fs.readFileSync(path.join(out,records[0].id+'.lhr.json'))).lighthouseVersion:null;
for(let repeat=1;repeat<=repeats;repeat++) for(const device of devices) {
  const sides=repeat%2===0?['candidate','baseline']:['baseline','candidate'];
  for(const side of sides) {
    const prefix=`${device}-${repeat}-${side}`;
    if(records.some(row=>row.id===prefix+'-cold'))continue;
    const chrome=await launch({chromeFlags:[...parseChromeFlags(settings.chromeFlags),'--headless=new'],ignoreDefaultFlags:true});
    let connection;
    try { connection=await puppeteer.connect({browserURL:`http://127.0.0.1:${chrome.port}`});const page=await connection.newPage();
      await page.setRequestInterception(true);
      page.on('request',request=>{const headers=request.headers();delete headers['x-vercel-protection-bypass'];const auth=authByOrigin.get(new URL(request.url()).origin);if(auth)headers['x-vercel-protection-bypass']=auth;void request.continue({headers});});
      for(const temperature of ['cold']) {
      const id=prefix+'-'+temperature;
      const result=await lighthouse(origins[side]+route,{
        port:chrome.port,output:'json',logLevel:'error',onlyCategories:['performance'],
        ...profiles[device],emulatedUserAgent:true,throttlingMethod:'devtools',
        throttling,
        disableStorageReset:true,maxWaitForLoad:45000,
      },undefined,page);
      if(!result)throw Error('No Lighthouse result');
      const {lhr,artifacts}=result;
      // Keep unsuccessful navigations available for diagnosis instead of losing
      // their trace when the rendered-page or metric guards reject the sample.
      fs.writeFileSync(path.join(out,id+'.lhr.json'),safeJSON(lhr));
      if(artifacts.Trace)fs.writeFileSync(path.join(out,id+'.trace.json'),safeJSON(artifacts.Trace));
      if(artifacts.DevtoolsLog)fs.writeFileSync(path.join(out,id+'.devtools.json'),safeJSON(artifacts.DevtoolsLog));
      assert.equal(/Android|Mobile/.test(lhr.configSettings.emulatedUserAgent),device==='mobile','device User-Agent must match the profile');
      const lcpNode=lhr.audits['lcp-phases-insight']?.details?.items?.find(item=>item.type==='node');
      let reader;
      try {
        assert.equal(lhr.runtimeError,undefined,'Lighthouse must complete successfully');
        assert.ok(Number.isFinite(lhr.audits['largest-contentful-paint']?.numericValue),'LCP must be present');
        assert.equal(lhr.mainDocumentUrl,origins[side]+route,'the measured document must be the requested page');
        // The BFCache gatherer may reload after the measured navigation. Await
        // that post-measurement DOM only; never alter or recompute initial LCP.
        await page.waitForFunction(isWatch=>Boolean(document.querySelector(isWatch?'.video-reader-frame video':'#comparison-detail')),{timeout:15000},watch);
        reader=await page.evaluate(()=>{const frame=document.querySelector('.video-reader-frame'),video=frame?.querySelector('video'),r=frame?.getBoundingClientRect();return {title:document.querySelector('h1')?.textContent,comparison:Boolean(document.querySelector('#comparison-detail')),related:[...document.querySelectorAll('.video-reader-standalone + div a[href^=\"/video/\"]')].map(n=>n.getAttribute('href')),canonical:document.querySelector('link[rel=canonical]')?.href,frame:r?{x:r.x,y:r.y,width:r.width,height:r.height}:null,video:video?{src:video.getAttribute('src'),poster:video.getAttribute('poster'),preload:video.getAttribute('preload')}:null,quotes:[...document.querySelectorAll('.video-reader-quote')].map(n=>n.textContent)};});
        if(records.length)assert.equal(lhr.environment.hostUserAgent,records[0].browser,'browser version must match saved samples');
        if(savedLighthouseVersion)assert.equal(lhr.lighthouseVersion,savedLighthouseVersion,'Lighthouse version must match saved samples');
        assert.equal(reader.canonical,(watch?'https://maxvideoai.com':origins[side])+route,'expected canonical page must be rendered');
        if(watch)assert.ok(reader.video?.poster&&reader.frame?.width>0&&reader.frame?.height>0,'real watch reader must be rendered');else assert.ok(reader.comparison&&reader.title,'real comparison must be rendered');
        if(watch)assert.equal(reader.quotes.length,3,'complete comparison quotes must be rendered');
      } catch(error) {
        const failure={id,time:lhr.fetchTime,origin:origins[side],route,reader,lcpNode,pageUrl:page.url(),runtimeError:lhr.runtimeError,warnings:lhr.runWarnings,message:error.message,pageText:await page.evaluate(()=>document.body?.innerText?.slice(0,2000)??'').catch(()=>null)};
        fs.appendFileSync(path.join(out,'failures.ndjson'),safeJSON(failure)+'\n');
        const failureDir=path.join(out,'failed',id+'-'+Date.now());fs.mkdirSync(failureDir,{recursive:true});
        for(const suffix of ['.lhr.json','.trace.json','.devtools.json']){const file=path.join(out,id+suffix);if(fs.existsSync(file))fs.renameSync(file,path.join(failureDir,id+suffix));}
        throw error;
      }
      const a=lhr.audits;
      const row={id,side,device,temperature,repeat,time:lhr.fetchTime,route,reader,lcpSelector:lcpNode?.selector,
        ttfb:a['server-response-time']?.numericValue,fcp:a['first-contentful-paint']?.numericValue,
        lcp:a['largest-contentful-paint']?.numericValue,cls:a['cumulative-layout-shift']?.numericValue,
        tbt:a['total-blocking-time']?.numericValue,bytes:a['total-byte-weight']?.numericValue,
        score:lhr.categories.performance.score,runtimeError:lhr.runtimeError,warnings:lhr.runWarnings,
        browser:lhr.environment.hostUserAgent,origin:origins[side],settings:lhr.configSettings,documentResponse:artifacts.DevtoolsLog?.find(item=>item.method==='Network.responseReceived'&&item.params.type==='Document')?.params.response.headers};
      console.log(safeJSON({...row,settings:undefined,documentResponse:undefined}));
      {const previous=records.findIndex(item=>item.id===id);if(previous<0)records.push(row);else records[previous]=row;fs.writeFileSync(path.join(out,'samples.json'),safeJSON(records));}
    }}finally{connection?.disconnect();await chrome.kill();}
  }
}
