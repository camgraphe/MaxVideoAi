// Targeted cold-desktop follow-ups, declared before collection in multipage-protocol.json.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const root=process.cwd(), out=path.resolve(process.env.WATCH_HTML_PERF_OUT ?? '.reports/watch-html-lcp-reproduction/vercel-matched');
assert.ok(process.env.WATCH_HTML_PERF_OUT,'explicit separate follow-up output directory required');
fs.mkdirSync(out,{recursive:true});
const require=createRequire(path.join(root,'frontend/package.json'));
const lhReq=createRequire(require.resolve('lighthouse/package.json',{paths:[require.resolve('@lhci/cli/package.json')]}));
const lighthouse=(await import(pathToFileURL(lhReq.resolve('lighthouse')))).default;
const {launch}=await import(pathToFileURL(lhReq.resolve('chrome-launcher')));
const {parseChromeFlags}=await import(pathToFileURL(lhReq.resolve('lighthouse/cli/run.js')));
const settings=createRequire(import.meta.url)(path.join(root,'scripts/performance/lighthouse-chrome-settings.cjs'));
const baselineOrigin=process.argv[2];
if(!/^https:\/\/maxvideoai-[a-z0-9]+-camgraphes-projects\.vercel\.app$/.test(baselineOrigin??''))throw Error('Explicit baseline preview origin required');
const origins={baseline:baselineOrigin,candidate:'https://maxvideoai-7lo16j3n6-camgraphes-projects.vercel.app'};
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
const route=process.env.WATCH_HTML_PERF_ROUTE ?? '/video/minimax-h3-wildfire-lookout-rescue';
assert.match(route,/^\/video\/[a-z0-9][a-z0-9-]*$/,'explicit canonical watch route required');
const profiles={desktop:{formFactor:'desktop',screenEmulation:{mobile:false,width:1440,height:900,deviceScaleFactor:1,disabled:false}},mobile:{formFactor:'mobile',screenEmulation:{mobile:true,width:390,height:844,deviceScaleFactor:1,disabled:false}}};
const records=fs.existsSync(path.join(out,'samples.json'))?JSON.parse(fs.readFileSync(path.join(out,'samples.json'))):[];
for(const row of records){assert.equal(row.device,'desktop');assert.equal(row.temperature,'cold');assert.equal(row.route,route,'never resume data from another watch route');assert.equal(row.origin,origins[row.side],'never resume data from another deployment origin');assert.equal(/Android|Mobile/.test(row.settings.emulatedUserAgent),row.device==='mobile','never resume an invalid device profile');}
const pilot=process.argv.includes('--pilot');
const repeats=Number(process.env.WATCH_HTML_FOLLOWUP_PAIRS ?? '6');
assert.ok([3,6].includes(repeats),'follow-up must use the declared three or six pairs');
for(let repeat=1;repeat<=(pilot?1:repeats);repeat++) for(const device of ['desktop']) {
  const sides=repeat%2===0?['candidate','baseline']:['baseline','candidate'];
  for(const side of (pilot?['candidate']:sides)) {
    const prefix=`${pilot?'pilot-':''}${device}-${repeat}-${side}`;
    if(!pilot&&records.some(row=>row.id===prefix+'-cold'))continue;
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
        throttling:{requestLatencyMs:150,downloadThroughputKbps:1600,uploadThroughputKbps:750,cpuSlowdownMultiplier:4},
        disableStorageReset:true,maxWaitForLoad:45000,
      },undefined,page);
      if(!result)throw Error('No Lighthouse result');
      const {lhr,artifacts}=result;
      assert.equal(/Android|Mobile/.test(lhr.configSettings.emulatedUserAgent),device==='mobile','device User-Agent must match the profile');
      const lcpNode=lhr.audits['lcp-phases-insight']?.details?.items?.find(item=>item.type==='node');
      const reader=await page.evaluate(()=>{const frame=document.querySelector('.video-reader-frame'),video=frame?.querySelector('video'),r=frame?.getBoundingClientRect();return {canonical:document.querySelector('link[rel=canonical]')?.href,frame:r?{x:r.x,y:r.y,width:r.width,height:r.height}:null,video:video?{src:video.getAttribute('src'),poster:video.getAttribute('poster'),preload:video.getAttribute('preload')}:null,quotes:[...document.querySelectorAll('.video-reader-quote')].map(n=>n.textContent)};});
      assert.equal(reader.canonical,'https://maxvideoai.com'+route,'canonical watch page must be rendered');
      assert.ok(reader.video?.poster&&reader.frame?.width>0&&reader.frame?.height>0,'real watch reader must be rendered');
      assert.equal(reader.quotes.length,3,'complete comparison quotes must be rendered');
      fs.writeFileSync(path.join(out,id+'.lhr.json'),safeJSON(lhr));
      if(artifacts.Trace)fs.writeFileSync(path.join(out,id+'.trace.json'),safeJSON(artifacts.Trace));
      if(artifacts.DevtoolsLog)fs.writeFileSync(path.join(out,id+'.devtools.json'),safeJSON(artifacts.DevtoolsLog));
      const a=lhr.audits;
      const row={id,side,device,temperature,repeat,time:lhr.fetchTime,route,reader,lcpSelector:lcpNode?.selector,
        ttfb:a['server-response-time']?.numericValue,fcp:a['first-contentful-paint']?.numericValue,
        lcp:a['largest-contentful-paint']?.numericValue,cls:a['cumulative-layout-shift']?.numericValue,
        tbt:a['total-blocking-time']?.numericValue,bytes:a['total-byte-weight']?.numericValue,
        score:lhr.categories.performance.score,runtimeError:lhr.runtimeError,warnings:lhr.runWarnings,
        browser:lhr.environment.hostUserAgent,origin:origins[side],settings:lhr.configSettings,documentResponse:artifacts.DevtoolsLog?.find(item=>item.method==='Network.responseReceived'&&item.params.type==='Document')?.params.response.headers};
      console.log(safeJSON({...row,settings:undefined,documentResponse:undefined}));
      if(lhr.runtimeError||!Number.isFinite(row.lcp))throw Error('Invalid sample '+id);
      if(!pilot){const previous=records.findIndex(item=>item.id===id);if(previous<0)records.push(row);else records[previous]=row;fs.writeFileSync(path.join(out,'samples.json'),safeJSON(records));}
    }}finally{connection?.disconnect();await chrome.kill();}
  }
}
