const {chromium}=require('@playwright/test');const fs=require('node:fs');const path=require('node:path');
const base='http://localhost:3116';const dir='docs/redesign/evidence/20261116-final-audit';
(async()=>{const browser=await chromium.launch({headless:true});const report=[];
for(const slug of ['seedream-5-5','seedance-2-5-flash','seedream-5-0-pro','seedance-2-5']){
 const p=await browser.newPage({viewport:{width:1280,height:900}});let videos=[];p.on('request',r=>{if(/\.mp4(?:\?|$)/.test(r.url()))videos.push(r.url())});
 const response=await p.goto(base+'/models/'+slug,{waitUntil:'networkidle',timeout:90000});
 const data=await p.evaluate(()=>{const root=document.querySelector('main');return {title:document.title,description:document.querySelector('meta[name=description]')?.content,canonical:document.querySelector('link[rel=canonical]')?.href,robots:document.querySelector('meta[name=robots]')?.content,headings:[...root.querySelectorAll('h1,h2,h3')].map(n=>({tag:n.tagName,text:n.textContent.trim()})),links:[...root.querySelectorAll('a[href]')].map(a=>({text:a.textContent.trim(),href:a.getAttribute('href'),hidden:!a.getClientRects().length,cta:a.dataset.analyticsCtaName})),anchors:[...root.querySelectorAll('[id]')].map(n=>n.id),images:[...root.querySelectorAll('img')].map(n=>({alt:n.alt,src:n.getAttribute('src'),loading:n.loading,width:n.width,height:n.height,loaded:n.complete&&n.naturalWidth>0})),schemas:[...document.querySelectorAll('script[type="application/ld+json"]')].map(s=>JSON.parse(s.textContent)),text:root.innerText,fullText:root.textContent}});
 data.slug=slug;data.status=response.status();data.initialMp4=videos.length;data.missingAnchors=data.links.filter(l=>l.href.startsWith('#')&&!data.anchors.includes(decodeURIComponent(l.href.slice(1))));
 fs.writeFileSync(path.join(dir,slug+'-text.txt'),data.fullText);delete data.fullText;
 if(slug==='seedream-5-5'||slug==='seedance-2-5-flash'){
  for(const section of ['.cinema-hero','#examples','#prompting','#specs','.cinema-next-band','#faq']){
   const node=p.locator(section).first();if(await node.count()){await node.scrollIntoViewIfNeeded();await p.waitForTimeout(250);await node.screenshot({path:path.join(dir,slug+'-'+section.replace(/[^a-z0-9]/g,'')+'.jpg'),timeout:20000})}
  }
  await p.setViewportSize({width:390,height:844});await p.goto(base+'/models/'+slug,{waitUntil:'networkidle'});data.mobileOverflow=await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth);await p.screenshot({path:path.join(dir,slug+'-mobile-hero.jpg')});
  for(const section of ['#prompting','#specs']){await p.locator(section).scrollIntoViewIfNeeded();await p.waitForTimeout(250);await p.locator(section).screenshot({path:path.join(dir,slug+'-mobile-'+section.slice(1)+'.jpg')})}
 }
 report.push(data);await p.close();
}
fs.writeFileSync(path.join(dir,'pages.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report.map(({slug,status,initialMp4,missingAnchors,mobileOverflow,headings})=>({slug,status,initialMp4,missingAnchors,mobileOverflow,headingCount:headings.length}))));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
