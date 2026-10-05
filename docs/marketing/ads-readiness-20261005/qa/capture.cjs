/** Local-only public-page review. No auth, generation, billing or production requests. */
const { chromium } = require('../../../../node_modules/@playwright/test');
const fs=require('node:fs'); const path=require('node:path');
const base=process.env.ADS_REVIEW_URL||'http://localhost:3017';
if(!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base))throw Error('Use an isolated localhost application');
const label=process.argv[2]||'after';if(!['before','after'].includes(label))throw Error('Use before or after');
const output=path.resolve(__dirname,'../review');
const englishRoutes=['/studio','/mcp','/integrations/claude','/integrations/codex'];
const routes=label==='before'?englishRoutes:[...englishRoutes,'/fr/studio','/fr/mcp','/fr/integrations/claude','/fr/integrations/codex','/es/studio','/es/mcp','/es/integraciones/claude','/es/integraciones/codex'];
(async()=>{const browser=await chromium.launch({headless:true});const rows=[];
 for(const route of routes)for(const [device,viewport]of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
  const context=await browser.newContext({viewport,deviceScaleFactor:1});const page=await context.newPage();const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const response=await page.goto(base+route,{waitUntil:'networkidle',timeout:120000});
  const name=route.split('/').filter(Boolean).join('-')+'-'+device;
  const fresh=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,mainCount:document.querySelectorAll('main').length}));
  if(label==='after'&&!route.startsWith('/fr')&&!route.startsWith('/es'))await page.screenshot({path:output+'/after-'+name+'-fresh.jpg',quality:85,fullPage:false});
  // Capture a second display state after an ordinary consent rejection.
  const reject=page.getByRole('button',{name:/^(Reject all|Tout refuser|Rechazar todo)$/i});if(label==='after'&&await reject.count())await reject.click();
  await page.screenshot({path:output+'/'+label+'-'+name+'.jpg',quality:85,fullPage:true});
  if(label==='after')await page.screenshot({path:output+'/after-'+name+'-entry.jpg',quality:85,fullPage:false});
  const data=await page.evaluate(()=>{
   const main=document.querySelector('main');
   const details=[...main.querySelectorAll('details')];const opened=details.map(e=>e.open);
   details.forEach(e=>e.open=true);const copy=main.innerText;details.forEach((e,i)=>e.open=opened[i]);
   const images=[...main.querySelectorAll('img')].filter(i=>{const r=i.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(i).visibility!=='hidden'});
   return {h1:document.querySelector('h1')?.textContent,title:document.title,canonical:document.querySelector('[rel=canonical]')?.href,robots:document.querySelector('meta[name=robots]')?.content,alternates:[...document.querySelectorAll('link[rel=alternate][hreflang]')].map(e=>({lang:e.hreflang,href:e.href})),jsonld:[...document.querySelectorAll('script[type="application/ld+json"]')].map(e=>{try{return {valid:true,type:JSON.parse(e.textContent)['@type']}}catch{return {valid:false}}}),copy,images:images.filter(i=>i.getBoundingClientRect().top<innerHeight&&(!i.complete||!i.naturalWidth)).map(i=>i.getAttribute('src')),lazyPending:images.filter(i=>i.getBoundingClientRect().top>=innerHeight&&(!i.complete||!i.naturalWidth)).map(i=>i.getAttribute('src')),links:[...main.querySelectorAll('a[href]')].map(e=>({text:e.textContent.trim(),href:e.getAttribute('href')})),overflow:document.documentElement.scrollWidth>innerWidth};
  });
  const summaries=page.locator('main summary');if(await summaries.count()){const before=await summaries.first().evaluate(e=>e.parentElement.open);await summaries.first().focus();await page.keyboard.press('Enter');data.faqKeyboard=await summaries.first().evaluate((e,before)=>e.parentElement.open!==before,before);}
  const cta=page.locator('main a[href*="marketing-entry"],main a[href="#setup"],main a[href="#integrations"]').first();if(await cta.count()){await cta.focus();data.ctaKeyboardFocus=await cta.evaluate(e=>e===document.activeElement);}
  rows.push({route,device,status:response.status(),fresh,...data,errors});console.log(name,response.status(),data.overflow?'OVERFLOW':'ok',errors.length);
  await context.close();
 }
 await browser.close();fs.writeFileSync(output+'/'+(label==='before'?'baseline':'after')+'.json',JSON.stringify({base,date:'2026-10-05',source:label==='before'?'e50fb575a60b15f0350e3324e045a43f87a39306':process.env.ADS_REVIEW_SOURCE||'local candidate',server:'Next production build',cohort:label==='before'?'Fresh no stored consent baseline':'Fresh no stored consent entry plus ordinary Reject all full-page display',copyDisclosureState:'Existing main disclosures opened for text capture then restored; screenshots preserve initial disclosure state',rows},null,2));
 if(rows.some(r=>r.status!==200||r.overflow||r.errors.length||r.images.length||r.faqKeyboard===false||r.ctaKeyboardFocus===false||r.jsonld.some(s=>!s.valid)))process.exitCode=1;
})();
