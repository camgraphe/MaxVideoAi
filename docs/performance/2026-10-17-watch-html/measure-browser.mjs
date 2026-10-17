import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
// Run from the repository root after starting the two read-only production builds.
const root=process.cwd(), out=path.resolve(process.env.WATCH_HTML_PERF_OUT ?? '.reports/watch-html-lcp-reproduction/browser');
fs.mkdirSync(out,{recursive:true});
const require=createRequire(path.join(root,'frontend/package.json'));
const lhReq=createRequire(require.resolve('lighthouse/package.json',{paths:[require.resolve('@lhci/cli/package.json')]}));
const lighthouse=(await import(pathToFileURL(lhReq.resolve('lighthouse')))).default;
const {launch}=await import(pathToFileURL(lhReq.resolve('chrome-launcher')));
const {parseChromeFlags}=await import(pathToFileURL(lhReq.resolve('lighthouse/cli/run.js')));
const settings=createRequire(import.meta.url)(path.join(root,'scripts/performance/lighthouse-chrome-settings.cjs'));
const route='/video/seedance-2-0-fast-ecommerce-product-ad-example-storyboard-to-video-452f05f2';
const profiles={desktop:{formFactor:'desktop',screenEmulation:{mobile:false,width:1440,height:900,deviceScaleFactor:1,disabled:false}},mobile:{formFactor:'mobile',screenEmulation:{mobile:true,width:390,height:844,deviceScaleFactor:1,disabled:false}}};
const records=fs.existsSync(path.join(out,'samples.json'))?JSON.parse(fs.readFileSync(path.join(out,'samples.json'))):[];
const pilot=process.argv.includes('--pilot');
for(let repeat=1;repeat<=(pilot?1:3);repeat++) for(const device of (pilot?['desktop']:['desktop','mobile'])) {
  const sides=repeat===2?['candidate','baseline']:['baseline','candidate'];
  for(const side of (pilot?['candidate']:sides)) {
    const prefix=`${pilot?'pilot-':''}${device}-${repeat}-${side}`;
    if(!pilot&&records.some(row=>row.id===prefix+'-warm'))continue;
    const chrome=await launch({chromeFlags:[...parseChromeFlags(settings.chromeFlags),'--headless=new'],ignoreDefaultFlags:true});
    try { for(const temperature of (pilot?['cold']:['cold','warm'])) {
      const id=prefix+'-'+temperature;
      const result=await lighthouse(`http://127.0.0.1:${side==='baseline'?3127:3128}${route}`,{
        port:chrome.port,output:'json',logLevel:'error',onlyCategories:['performance'],
        ...profiles[device],emulatedUserAgent:true,throttlingMethod:'devtools',
        throttling:{requestLatencyMs:150,downloadThroughputKbps:1600,uploadThroughputKbps:750,cpuSlowdownMultiplier:4},
        disableStorageReset:true,maxWaitForLoad:45000,
      });
      if(!result)throw Error('No Lighthouse result');
      const {lhr,artifacts}=result;
      fs.writeFileSync(path.join(out,id+'.lhr.json'),JSON.stringify(lhr));
      if(artifacts.Trace)fs.writeFileSync(path.join(out,id+'.trace.json'),JSON.stringify(artifacts.Trace));
      if(artifacts.DevtoolsLog)fs.writeFileSync(path.join(out,id+'.devtools.json'),JSON.stringify(artifacts.DevtoolsLog));
      const a=lhr.audits;
      const row={id,side,device,temperature,repeat,time:lhr.fetchTime,route,
        ttfb:a['server-response-time']?.numericValue,fcp:a['first-contentful-paint']?.numericValue,
        lcp:a['largest-contentful-paint']?.numericValue,cls:a['cumulative-layout-shift']?.numericValue,
        tbt:a['total-blocking-time']?.numericValue,bytes:a['total-byte-weight']?.numericValue,
        score:lhr.categories.performance.score,runtimeError:lhr.runtimeError,warnings:lhr.runWarnings,
        browser:lhr.environment.hostUserAgent,settings:lhr.configSettings};
      console.log(JSON.stringify({...row,settings:undefined}));
      if(lhr.runtimeError||!Number.isFinite(row.lcp))throw Error('Invalid sample '+id);
      if(!pilot){const previous=records.findIndex(item=>item.id===id);if(previous<0)records.push(row);else records[previous]=row;fs.writeFileSync(path.join(out,'samples.json'),JSON.stringify(records,null,2));}
    }}finally{await chrome.kill();}
  }
}
