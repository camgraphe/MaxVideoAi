/** Public locale/keyboard/entry smoke against an isolated local build only. */
const {chromium}=require('../../../../node_modules/@playwright/test');
const fs=require('node:fs');const path=require('node:path');
const base=process.env.ADS_REVIEW_URL||'http://localhost:3017';
if(!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base))throw Error('Use isolated localhost');
(async()=>{
 const browser=await chromium.launch({headless:true});const narrow=[];const entries=[];
 for(const route of ['/studio','/mcp','/integrations/claude','/integrations/codex','/fr/studio','/fr/mcp','/fr/integrations/claude','/fr/integrations/codex','/es/studio','/es/mcp','/es/integraciones/claude','/es/integraciones/codex']){
  const context=await browser.newContext({viewport:{width:320,height:740},reducedMotion:'reduce'});const page=await context.newPage();const errors=[];
  page.on('pageerror',e=>errors.push(e.message));const response=await page.goto(base+route,{waitUntil:'networkidle'});
  const reject=page.getByRole('button',{name:/^(Reject all|Tout refuser|Rechazar todo)$/i});if(await reject.count())await reject.click();
  const data=await page.evaluate(()=>{
   const main=document.querySelector('main');const a=main.querySelector('a[href*="marketing-entry"],a[href="#setup"],a[href="#integrations"]');
   const brokenHashLinks=[...main.querySelectorAll('a[href^="#"]')].map(e=>e.getAttribute('href')).filter(href=>!document.getElementById(href.slice(1)));
   const r=a?.getBoundingClientRect();return{overflow:document.documentElement.scrollWidth>innerWidth,mainCount:document.querySelectorAll('main').length,mainCtaVisible:Boolean(r&&r.width&&r.height),brokenHashLinks};
  });
  narrow.push({route,status:response.status(),...data,errors});await context.close();
 }
 for(const lang of ['en','fr','es']){
  const context=await browser.newContext({viewport:{width:390,height:844}});const page=await context.newPage();
  const url=`${base}/api/studio/marketing-entry?starter=product-ad&lang=${lang}`;
  const response=await context.request.get(url,{maxRedirects:0});const location=response.headers().location;
  const parsed=new URL(location,base);const correctTarget=parsed.pathname==='/login'&&parsed.searchParams.get('mode')==='signup'&&parsed.searchParams.get('next')==='/app/studio?starter=product-ad'&&parsed.searchParams.get('lang')===lang;
  const localLogin=base+parsed.pathname+parsed.search;const login=await page.goto(localLogin,{waitUntil:'networkidle'});
  const mode=await page.getByRole('button',{name:lang==='fr'?'Créer un compte':lang==='es'?'Crear cuenta':'Create account',exact:true}).count();
  const passwordFields=await page.locator('form input[type=password]').count();
  entries.push({lang,status:response.status(),location:parsed.pathname+parsed.search,correctTarget,loginStatus:login.status(),signupSubmitPresent:mode>0,passwordFields,copy:(await page.locator('main').innerText()).slice(0,6000)});
  await page.screenshot({path:path.resolve(__dirname,`../review/login-studio-${lang}-mobile.jpg`),quality:85});await context.close();
 }
 const sitemapFiles=[];const sitemapRoutes=[];
 for(const lang of ['en','fr','es']){
  const sitemapResponse=await fetch(`${base}/sitemap-${lang}.xml`);const sitemap=await sitemapResponse.text();
  sitemapFiles.push({path:`/sitemap-${lang}.xml`,status:sitemapResponse.status});
  const prefix=lang==='en'?'':`/${lang}`;const integrations=lang==='es'?'integraciones':'integrations';
  for(const route of [`${prefix}/studio`,`${prefix}/mcp`,`${prefix}/${integrations}/claude`,`${prefix}/${integrations}/codex`])sitemapRoutes.push({route,present:sitemap.includes('https://maxvideoai.com'+route+'</loc>')});
 }
 const indexResponse=await fetch(base+'/sitemap.xml');
 const index={path:'/sitemap.xml',status:indexResponse.status,scope:'Dynamic index also reads database-owned video dates. Database is deliberately unavailable in this isolated fixture; no live index acceptance is claimed.'};
 await browser.close();const report={date:'2026-10-05',base,scope:'320px/reduced-motion public pages; anonymous GET-only Studio/login continuation; three owned locale sitemaps. No account submission, paid generation, payment or external host auth.',narrow,entries,sitemap:{files:sitemapFiles,rows:sitemapRoutes,index}};
 fs.writeFileSync(path.resolve(__dirname,'../review/smoke.json'),JSON.stringify(report,null,2));
 const failed=narrow.some(r=>r.status!==200||r.overflow||r.errors.length||r.mainCount!==1||!r.mainCtaVisible||r.brokenHashLinks.length)||entries.some(r=>r.status!==307||!r.correctTarget||r.loginStatus!==200||!r.signupSubmitPresent||r.passwordFields!==2)||sitemapFiles.some(r=>r.status!==200)||sitemapRoutes.some(r=>!r.present);
 console.log(JSON.stringify({routes:narrow.length,entries:entries.length,failed,entriesSummary:entries.map(({copy,...r})=>r),sitemap:report.sitemap}));if(failed)process.exitCode=1;
})();
