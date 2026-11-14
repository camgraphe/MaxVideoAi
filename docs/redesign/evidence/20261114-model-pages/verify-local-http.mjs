import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
// Run from this checkout with candidate :3116 and clean baseline :3117 running.
const require = createRequire(new URL('../../../../package.json', import.meta.url));
const {JSDOM}=require('jsdom');
const results=[];
const walk=(value, out=[])=>{if(Array.isArray(value))value.forEach(v=>walk(v,out));else if(value&&typeof value==='object'){if(value['@type'])out.push(...[value['@type']].flat());Object.values(value).forEach(v=>walk(v,out));}return out;};
for(const slug of ['seedream-5-5','seedance-2-5-flash']){
  for(const [locale,prefix] of [['en','/models/'],['fr','/fr/modeles/'],['es','/es/modelos/']]){
    const pathname=prefix+slug;
    const response=await fetch('http://localhost:3116'+pathname);
    assert.equal(response.status,200,pathname);
    const html=await response.text();
    const doc=new JSDOM(html).window.document;
    const canonical=doc.querySelector('link[rel="canonical"]')?.href;
    assert.equal(canonical,'https://maxvideoai.com'+pathname);
    assert.equal(doc.querySelectorAll('h1').length,1);
    const hreflang=[...doc.querySelectorAll('link[rel="alternate"][hreflang]')].map(l=>({lang:l.hreflang,url:l.href}));
    for(const lang of ['en','fr','es','x-default']) assert.ok(hreflang.some(l=>l.lang===lang),pathname+' '+lang);
    const schemas=[...doc.querySelectorAll('script[type="application/ld+json"]')].map(s=>JSON.parse(s.textContent));
    const types=schemas.flatMap(s=>walk(s));
    assert.ok(types.includes('BreadcrumbList'));
    assert.ok(!types.includes('VideoObject'),'stills cannot become video schema');
    assert.ok(!types.includes('Offer'),'no database means no exact retail offer');
    const anchors=['decision-pricing','examples','prompting','specs','faq'];
    for(const id of anchors)assert.ok(doc.getElementById(id),pathname+' #'+id);
    const cta=slug.startsWith('seedream')?'/app/image?engine='+slug:'/app?engine='+slug;
    assert.ok([...doc.querySelectorAll('.cinema-hero a')].some(a=>a.href.includes(cta)));
    const visuals=[...doc.querySelectorAll('img')].map(i=>i.src).filter(src=>src.includes('model-examples'));
    assert.equal(new Set(visuals).size,visuals.length,'No repeated demonstration source');
    const originLinks=[...doc.querySelectorAll('.cinema-prompt a')].map(a=>a.href);
    assert.ok(originLinks.length>0);
    assert.ok(originLinks.every(url=>!url.includes('/_next/image')));
    results.push({pathname,status:response.status,title:doc.title,h1:doc.querySelector('h1').textContent,canonical,hreflang,types:[...new Set(types)],visuals:visuals.length,htmlBytes:Buffer.byteLength(html),originalLinks:originLinks.length});
  }
}
for(const pathname of ['/models/seedance-2-5','/models/seedream-5-0-pro']){
  const response=await fetch('http://localhost:3116'+pathname);
  const doc=new JSDOM(await response.text()).window.document;
  if(response.status!==200){
    const baseline=await fetch('http://localhost:3117'+pathname);
    assert.equal(response.status,baseline.status);
    results.push({pathname,status:response.status,baselineStatus:baseline.status,limitation:'Historical video playlist requires DATABASE_URL; same failure on clean baseline'});
  }else{
    assert.equal(doc.querySelector('.model-cinematic-page'),null);
    results.push({pathname,status:response.status,unchangedPresentation:true});
  }
}
for(const pathname of ['/en/models/seedream-5-5','/fr/models/seedance-2-5-flash']){
  const response=await fetch('http://localhost:3116'+pathname,{redirect:'manual'});
  results.push({pathname,status:response.status,location:response.headers.get('location')});
  assert.ok([301,302,307,308].includes(response.status));
}
const sitemap=await fetch('http://localhost:3116/sitemap.xml');
const sitemapText=await sitemap.text();
if(sitemapText.includes('<urlset')){
  for(const result of results.slice(0,6))assert.ok(sitemapText.includes(result.canonical),'sitemap: '+result.canonical);
  results.push({sitemap:'six localized pilot URLs present',status:sitemap.status});
}else if(sitemap.ok){
  const index=new JSDOM(sitemapText,{contentType:'text/xml'}).window.document;
  let children='';
  for(const loc of index.querySelectorAll('loc'))children+=await (await fetch('http://localhost:3116'+new URL(loc.textContent).pathname)).text();
  for(const result of results.slice(0,6))assert.ok(children.includes(result.canonical),'sitemap: '+result.canonical);
  results.push({sitemap:'six localized pilot URLs present in sitemap index children',status:sitemap.status});
}else{
  const baselineSitemap=await fetch('http://localhost:3117/sitemap.xml');
  assert.equal(sitemap.status,baselineSitemap.status);
  const modelsSitemap=await fetch('http://localhost:3116/sitemap-models.xml');
  assert.equal(modelsSitemap.status,200);
  const modelsXml=await modelsSitemap.text();
  for(const result of results.slice(0,6))assert.ok(modelsXml.includes(result.canonical),'model sitemap: '+result.canonical);
  results.push({sitemap:'Database-dependent full sitemap unavailable locally',status:sitemap.status,baselineStatus:baselineSitemap.status,modelsSitemapStatus:modelsSitemap.status,modelsSitemap:'All six localized pilot URLs present in actual /sitemap-models.xml'});
}
writeFileSync('/private/tmp/model-cinematic-http-results.json',JSON.stringify(results,null,2));
console.log(JSON.stringify(results,null,2));
