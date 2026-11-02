import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';

test('real watch and gallery playback separates opens and plays without preloading, retries or consent leaks', async () => {
  const frontend = resolve('frontend');
  const sdk = process.env.VERCEL_ANALYTICS_SDK_FIXTURE ? await readFile(process.env.VERCEL_ANALYTICS_SDK_FIXTURE, 'utf8') : null;
  const bundle = await build({ stdin: { contents: `
    import React,{useState} from 'react';import{createRoot}from'react-dom/client';
    import{DiscoveryVideoPlayer}from'./components/examples/DiscoveryVideoPlayer.client';
    import{PublicVideoAnalytics}from'./components/analytics/PublicVideoAnalytics.client';
    import{createVercelAnalyticsBeforeSend}from'./lib/analytics/vercel-context';
    import{readerCopy}from'./components/examples/example-reader-copy';
    import{inject}from'@vercel/analytics';
    const sanitize=createVercelAnalyticsBeforeSend();window.sent=[];
    if(USE_REAL_SDK){
      const originalFetch=window.fetch.bind(window);
      window.fetch=(url,options)=>{if(String(url).startsWith('/_vercel/insights/')){
        const body=JSON.parse(options.body);window.sent.push({type:body.en?'event':'pageview',url:body.o,name:body.en,data:body.ed});
        return Promise.resolve(new Response('',{status:202}));}return originalFetch(url,options);};
      inject({beforeSend:sanitize,scriptSrc:'/sdk.js',mode:'production'});
    }else{
      // Deployed SDK semantics: pageview.path is a sticky pathname override,
      // not a full URL. Explicit current-location views must omit it entirely.
      let path=null;
      window.va=(kind,value)=>{if(kind!=='pageview'&&kind!=='event')return;
        if(kind==='pageview'&&value?.path)path=value.path;
        const url=new URL(location.href);if(path&&url.pathname!==path){url.pathname=path;url.search='';}
        const event=sanitize({type:kind==='event'?'event':'pageview',url:url.href,payload:kind==='event'?value:undefined});
        if(event)window.sent.push({...event,...(kind==='event'?value:{})});};
    }
    if(!location.search.includes('denied'))localStorage.setItem('mv-consent-analytics','granted');
    const detail=(slug)=>({id:slug,title:slug,watchHref:'/video/'+slug,analyticsPath:slug==='unapproved'?null:'/video/'+slug,
      videoUrl:slug==='broken'?'/broken.mp4':'/pattern.mp4',posterUrl:null,aspectRatio:'16:9',durationSec:4,hasAudio:false});
    function Fixture(){const[id,setId]=useState('first-public-video');const[loading,setLoading]=useState(false);
      const go=(next)=>{history.pushState(null,'','/video/'+next);setLoading(true);window.va('pageview',{});
        setTimeout(()=>{setId(next);setLoading(false);},50);};
      return <><button onClick={()=>go('second-public-video')}>Next</button><button onClick={()=>go('unapproved')}>Unapproved</button>
        <button onClick={()=>go('broken')}>Broken</button><button onClick={()=>go('first-public-video')}>First</button>
        {!loading&&<React.Fragment key={id}><PublicVideoAnalytics watchPath={detail(id).watchHref} analyticsPath={detail(id).analyticsPath}/>
        <DiscoveryVideoPlayer detail={detail(id)} copy={readerCopy('en')} surface={id==='first-public-video'?'watch':'gallery'}/></React.Fragment>}</>;}
    createRoot(document.getElementById('root')).render(<React.StrictMode><Fixture/></React.StrictMode>);
  `, loader: 'tsx', resolveDir: frontend }, outfile: join(frontend, 'fixture.js'), bundle: true,
    platform: 'browser', format: 'iife', jsx: 'automatic', write: false, tsconfig: join(frontend, 'tsconfig.json'),
    define: { 'process.env.NODE_ENV': '"production"', USE_REAL_SDK: sdk ? 'true' : 'false' } });
  const js = bundle.outputFiles.find(file => file.path.endsWith('.js'))!.text;
  const video = await readFile('tests/fixtures/studio-media/pattern-a.mp4');
  const requests: string[] = [];
  const server = createServer((req, res) => {
    if (req.url === '/sdk.js' && sdk) { setTimeout(() => { res.writeHead(200, { 'content-type': 'application/javascript' }); res.end(sdk); }, 100); return; }
    if (req.url === '/pattern.mp4') {
      requests.push(req.url);
      const range = req.headers.range?.match(/bytes=(\d+)-(\d*)/);
      const start = range ? Number(range[1]) : 0;
      const end = range?.[2] ? Math.min(Number(range[2]), video.length - 1) : video.length - 1;
      res.writeHead(range ? 206 : 200, { 'content-type': 'video/mp4', 'accept-ranges': 'bytes', 'content-length': end - start + 1,
        ...(range ? { 'content-range': `bytes ${start}-${end}/${video.length}` } : {}) });
      res.end(video.subarray(start, end + 1)); return;
    }
    if (req.url === '/broken.mp4') { res.writeHead(404); res.end(); return; }
    if (req.url === '/fixture.js') { res.writeHead(200, { 'content-type': 'application/javascript' }); res.end(js); return; }
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>video{display:block;width:300px;height:180px}</style><div id="root"></div><script src="/fixture.js"></script>');
  });
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [390, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 }, userAgent: 'Mozilla/5.0 Chrome/130.0.0.0 Safari/537.36' });
      // Exercise the real SDK against a local intercepted transport, including its bot guard.
      await page.addInitScript("Object.defineProperty(navigator, 'webdriver', { get: () => false });");
      const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
      const sent = () => page.evaluate(() => (window as any).sent);
      const plays = async () => (await sent()).filter((entry: any) => entry.name === 'public_video_play');
      const views = async () => (await sent()).filter((entry: any) => entry.type === 'pageview');
      const play = () => page.getByRole('button', { name: /^Play(?: video)?$/ }).first().click();
      const pause = () => page.getByRole('button', { name: /^Pause(?: video)?$/ }).click();
      try {
        requests.length = 0;
        await page.goto(`http://127.0.0.1:${address.port}/video/first-public-video?denied`);
        await page.locator('video').waitFor();
        await page.waitForFunction(() => (window as any).sent.some((event: any) => event.type === 'pageview'), {}, { timeout: 5000 }).catch(async error => { console.error(await page.evaluate(() => ({ webdriver: navigator.webdriver, userAgent: navigator.userAgent, va: String((window as any).va), queue: (window as any).vaq?.map((x:any)=>x[0]), scripts: Array.from(document.scripts).map(s=>s.src), marker: document.querySelector('[data-video-watch-path]')?.outerHTML, sent: (window as any).sent })), errors); throw error; });
        assert.equal(requests.length, 0, 'opening the measured reader must not request video');
        assert.equal(await page.locator('video').getAttribute('preload'), 'none');
        await page.evaluate(() => (window as any).va('pageview', {}));
        assert.equal((await views()).length, 1, 'automatic view after detail-ready does not duplicate');
        await play(); await page.waitForFunction(() => document.querySelector('video')!.currentTime > .1);
        assert.equal((await plays()).length, 0, 'denied consent blocks plays');
        await pause(); await page.evaluate(() => localStorage.setItem('mv-consent-analytics', 'granted'));
        await play(); await page.waitForFunction(() => (window as any).sent.some((event: any) => event.name === 'public_video_play'));
        assert.deepEqual((await plays())[0].data, { video_slug: 'first-public-video', surface: 'watch' });
        await pause(); await play();
        assert.equal((await plays()).length, 1, 'resume does not inflate plays');
        await page.getByRole('button', { name: 'Next', exact: true }).click();
        await page.locator('video[aria-label="second-public-video"]').waitFor();
        assert.equal((await views()).length, 2, 'pending navigation produces only the resolved view');
        assert.match((await views())[1].url, /\/video\/second-public-video$/);
        await play(); await page.waitForFunction(() => (window as any).sent.filter((event: any) => event.name === 'public_video_play').length === 2);
        assert.deepEqual((await plays())[1].data, { video_slug: 'second-public-video', surface: 'gallery' });
        await page.getByRole('button', { name: 'Unapproved', exact: true }).click();
        await page.locator('video[aria-label="unapproved"]').waitFor(); await play();
        await page.waitForFunction(() => document.querySelector('video')!.currentTime > .1);
        assert.equal((await plays()).length, 2); assert.match((await views()).at(-1).url, /\/video\/:video$/);
        await page.getByRole('button', { name: 'Broken', exact: true }).click();
        await page.locator('video[aria-label="broken"]').waitFor(); await play();
        await page.waitForFunction(() => !!document.querySelector('video')!.error);
        assert.equal((await plays()).length, 2, 'failed Play is not a successful start');
        await page.evaluate(() => { (window as any).__mvaiCommercialAnalyticsExcluded = true; });
        await page.getByRole('button', { name: 'First', exact: true }).click();
        await page.locator('video[aria-label="first-public-video"]').waitFor(); await play();
        await page.waitForFunction(() => document.querySelector('video')!.currentTime > .1);
        assert.equal((await plays()).length, 2, 'admin traffic remains excluded');
        await page.evaluate(() => { (window as any).__mvaiCommercialAnalyticsExcluded = false; history.pushState(null, '', '/pricing'); (window as any).va('pageview', {}); });
        assert.match((await views()).at(-1).url, /\/pricing$/, 'reader measurement must not override later navigation');
        assert.deepEqual(errors, []);
      } finally { await page.close(); }
    }
  } finally {
    await browser.close(); server.closeAllConnections();
    await new Promise<void>((done, reject) => server.close(error => error ? reject(error) : done()));
  }
});
