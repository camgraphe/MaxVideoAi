const {chromium}=require('@playwright/test');const fs=require('node:fs');const assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({headless:true});const p=await b.newPage({viewport:{width:1280,height:900}});const out=[];
for(const [locale,prefix] of [['en','/models/'],['fr','/fr/modeles/'],['es','/es/modelos/']])for(const slug of ['seedream-5-5','seedance-2-5-flash']){
 await p.goto('http://localhost:3116'+prefix+slug,{waitUntil:'networkidle'});
 const links=await p.locator('main a[href]').evaluateAll(ns=>ns.map(n=>({href:n.getAttribute('href'),text:n.textContent.trim()})));
 const ctas=links.filter(l=>l.href.startsWith('/app'));let warnings=[];
 for(const l of ctas){const u=new URL(l.href,'https://maxvideoai.com');const eng=u.searchParams.get('engine');assert(eng===slug||eng==='gpt-image-2-6-sunburst');if((u.searchParams.has('videoPrompt')||u.searchParams.has('example')||u.searchParams.has('assistant'))&&u.searchParams.get('lang')!==locale)warnings.push({type:'language',...l})}
 const ids=await p.locator('main [id]').evaluateAll(ns=>ns.map(n=>n.id));assert(links.filter(l=>l.href.startsWith('#')).every(l=>ids.includes(l.href.slice(1))));assert.equal(await p.locator('h1').count(),1);
 out.push({locale,slug,links:links.length,ctas:ctas.length,warnings,ctaLinks:ctas});
}
fs.writeFileSync('docs/redesign/evidence/20261116-final-audit/localized-journeys.json',JSON.stringify(out,null,2));console.log(JSON.stringify(out.map(({locale,slug,links,ctas,warnings})=>({locale,slug,links,ctas,warnings}))));await b.close()})().catch(e=>{console.error(e);process.exit(1)});
