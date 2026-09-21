import {mkdtemp,mkdir,writeFile,readFile,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {chromium} from 'playwright';
import {buildEditorialPreviewFiles} from '../../frontend/src/server/editorial/publication-content';
import {BLOG_LOCALE_MAP_PATH,buildPublicationLocaleMap} from '../../frontend/src/server/editorial/publication-locale-map';
import type {EditorialVersion} from '../../frontend/src/server/editorial/repository';
import {editorialLinks,validateEditorialCheckReport,type EditorialCheckReport} from '../../frontend/lib/editorial/checks';
import {EDITORIAL_RENDER_VERSION} from '../../frontend/lib/editorial/public-article';
import {command,verifiedMedia,publicMediaMap,checkPublicLink} from './publication-runtime';
import {validatePublishedHtml,validatePublicationSitemap} from './publication-verification';
const locales=['en','fr','es'] as const;
export const articleUrls=(record:EditorialVersion)=>locales.map(l=>`https://maxvideoai.com${l==='en'?'':`/${l}`}/blog/${record.draft.locales[l].slug}`);
async function freePort(){return new Promise<number>((resolve,reject)=>{const s=createServer();s.on('error',reject);s.listen(0,'127.0.0.1',()=>{const p=(s.address() as {port:number}).port;s.close(()=>resolve(p));});});}
export async function inspectArticleViews(record:EditorialVersion,origin:string,privateMedia?:Awaited<ReturnType<typeof verifiedMedia>>){
 const browser=await chromium.launch({headless:true});const views:EditorialCheckReport['views']=[];const urls=articleUrls(record);
 try{
  const context=await browser.newContext();
  if(privateMedia)await context.route('**/_next/image?**',async route=>{
   const original=new URL(route.request().url()).searchParams.get('url');
   const item=privateMedia.find(({asset})=>publicMediaMap(record)[asset.id]===original);
   if(item)await route.fulfill({status:200,contentType:item.asset.mime,body:item.bytes});else await route.continue();
  });
  for(const [index,locale] of locales.entries()){
   const url=origin+new URL(urls[index]).pathname;
   const initial=await context.request.get(url,{timeout:120000});
   if(!initial.ok())throw Error(`Article ${locale}: HTTP ${initial.status()}`);
   validatePublishedHtml(await initial.text(),{digest:record.digest,url:urls[index],urls});
   const sitemap=await context.request.get(`${origin}/sitemap-${locale}.xml`,{timeout:120000});
   if(!sitemap.ok())throw Error(`Sitemap ${locale}: HTTP ${sitemap.status()}`);
   validatePublicationSitemap(await sitemap.text(),urls[index],urls);
   for(const width of [360,768,1440]){
    const page=await context.newPage();await page.setViewportSize({width,height:900});
    await page.goto(url,{waitUntil:'networkidle',timeout:120000});
    // Actual lazy images must enter the viewport; no synthetic success flags.
    for(const image of await page.locator('.ed-article img').all())await image.scrollIntoViewIfNeeded();
    await page.locator('.ed-article img').evaluateAll(async images=>{await Promise.all(images.map(img=>(img as HTMLImageElement).decode().catch(()=>undefined)));});
    const view=await page.evaluate(()=>{
     const article=document.querySelector('.ed-article')??document.querySelector('[data-editorial-digest]');
     const images=Array.from(article?.querySelectorAll('img')??[]) as HTMLImageElement[];
     const failures:string[]=[];
     if(document.documentElement.scrollWidth>innerWidth+1)failures.push('Horizontal overflow');
     if(images.some(i=>!i.complete||!i.naturalWidth))failures.push('Missing illustration');
     if(Array.from(article?.querySelectorAll('.ed-prompt details')??[]).some(d=>d.hasAttribute('open')))failures.push('Prompts expanded by default');
     const schemas=Array.from(document.querySelectorAll('script[type="application/ld+json"]')).flatMap(s=>{try{const v=JSON.parse(s.textContent??'');return v['@graph']??(Array.isArray(v)?v:[v]);}catch{failures.push('Invalid JSON-LD');return [];}});
     return {failures,title:document.title,description:document.querySelector('meta[name="description"]')?.getAttribute('content')??'',canonical:document.querySelector('link[rel="canonical"]')?.getAttribute('href')??'',languages:Array.from(document.querySelectorAll('link[hreflang]')).map(e=>(e.getAttribute('hreflang')??'').split('-')[0]),schemaTypes:schemas.flatMap(s=>s['@type']??[]),h1Count:document.querySelectorAll('h1').length,imagesLoaded:images.filter(i=>i.complete&&i.naturalWidth>0).length};
    });views.push({locale,width,...view});await page.close();
   }
  }
 }finally{await browser.close();}
 return views;
}
export async function checkEditorialCandidate(record:EditorialVersion,repoRoot:string){
 const media=await verifiedMedia(record),map=publicMediaMap(record),candidate=buildEditorialPreviewFiles(record,map);
 const links=[];for(const url of editorialLinks(record.draft))links.push({url,status:await checkPublicLink(url)});
 const report:EditorialCheckReport={digest:record.digest,rendererVersion:EDITORIAL_RENDER_VERSION,checkedAt:new Date().toISOString(),links,media:media.map(({asset})=>({id:asset.id,sha256:asset.sha256!,bytes:asset.bytes,width:asset.width,height:asset.height})),views:[]};
 const parent=await mkdtemp(path.join(tmpdir(),'maxvideoai-editorial-qa-')),dir=path.join(parent,'site');let server:ReturnType<typeof spawn>|undefined;
 try{
  await command('git',['worktree','add','--detach',dir,'HEAD'],{cwd:repoRoot});
  for(const modules of ['node_modules','frontend/node_modules'])await symlink(path.join(repoRoot,modules),path.join(dir,modules));
  for(const file of candidate.files){const target=path.join(dir,file.path);await mkdir(path.dirname(target),{recursive:true});await writeFile(target,file.content,{flag:'wx'});}
  const localeMap=buildPublicationLocaleMap(await readFile(path.join(dir,BLOG_LOCALE_MAP_PATH),'utf8'),candidate.files);
  await writeFile(path.join(dir,localeMap.path),localeMap.content);
  await command(process.execPath,[path.join(repoRoot,'node_modules/tsx/dist/cli.mjs'),'--tsconfig','frontend/tsconfig.json','--test','tests/blog-language-switch.test.ts'],{cwd:dir,env:{PATH:process.env.PATH,HOME:process.env.HOME},timeout:30000});
  const port=await freePort(),origin=`http://127.0.0.1:${port}`;
  // The QA app receives no production database, storage, Git or ingestion credentials.
  server=spawn(process.execPath,[path.join(repoRoot,'frontend/node_modules/next/dist/bin/next'),'dev','--hostname','127.0.0.1','--port',String(port)],{cwd:path.join(dir,'frontend'),env:{PATH:process.env.PATH,HOME:process.env.HOME,NODE_ENV:'development',NEXT_TELEMETRY_DISABLED:'1',NEXT_PUBLIC_SUPABASE_URL:process.env.NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY:process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY},stdio:['ignore','pipe','pipe']});
  let diagnostic='';server.stdout?.on('data',d=>{diagnostic=(diagnostic+d).slice(-4000);});server.stderr?.on('data',d=>{diagnostic=(diagnostic+d).slice(-4000);});
  let ready=false;for(let i=0;i<120;i++){if(server.exitCode!==null)throw Error('QA app stopped: '+diagnostic);try{await fetch(origin,{signal:AbortSignal.timeout(1000)});ready=true;break;}catch{await new Promise(r=>setTimeout(r,500));}}
  if(!ready)throw Error('QA app did not start');
  report.views=await inspectArticleViews(record,origin,media);
  try{return validateEditorialCheckReport(record.draft,record.digest,report);}catch(error){(error as Error & {report:EditorialCheckReport}).report=report;throw error;}
 }finally{
  if(server&&server.exitCode===null){server.kill('SIGTERM');await new Promise<void>(resolve=>{const timeout=setTimeout(()=>{server?.kill('SIGKILL');resolve();},5000);server!.once('close',()=>{clearTimeout(timeout);resolve();});});}
  await command('git',['worktree','remove','--force',dir],{cwd:repoRoot}).catch(()=>undefined);await rm(parent,{recursive:true,force:true});
 }
}
