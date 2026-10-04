import {z} from 'zod';
import type {EditorialDraft} from './schema';
import {EDITORIAL_RENDER_VERSION} from './public-article';
import {buildMetaTitle,buildMetaDescription} from '@/lib/seo/meta';
export const editorialCheckReportSchema=z.object({
 digest:z.string().regex(/^[a-f0-9]{64}$/),rendererVersion:z.literal(EDITORIAL_RENDER_VERSION),checkedAt:z.string().datetime({offset:true}),
 links:z.array(z.object({url:z.string().max(2000),status:z.number().int()}).strict()).max(200),
 media:z.array(z.object({id:z.string(),sha256:z.string().regex(/^[a-f0-9]{64}$/),bytes:z.number().int().positive(),width:z.number().int().positive(),height:z.number().int().positive()}).strict()).max(15),
 views:z.array(z.object({locale:z.enum(['en','fr','es']),width:z.number().int(),failures:z.array(z.string()),title:z.string(),description:z.string(),canonical:z.string(),languages:z.array(z.string()),schemaTypes:z.array(z.string()),h1Count:z.number().int(),imagesLoaded:z.number().int()}).strict()).max(30),
}).strict();
export type EditorialCheckReport=z.infer<typeof editorialCheckReportSchema>;
export function editorialLinks(draft:EditorialDraft){
 const urls=new Set(draft.sources.map(s=>s.url));
 for(const a of Object.values(draft.locales))for(const b of a.blocks){
  if(b.type==='text')for(const p of b.paragraphs)for(const s of p.spans??[])if(s.href)urls.add(s.href);
  if(b.type==='conclusion'&&b.cta)urls.add(b.cta.href);
 }
 return [...urls];
}
export function validateEditorialCheckReport(draft:EditorialDraft,digest:string,input:unknown):EditorialCheckReport{
 const r=editorialCheckReportSchema.parse(input);if(r.digest!==digest)throw Error('Checks digest mismatch');
 if(editorialLinks(draft).some(url=>!r.links.some(l=>{
  if(l.url!==url)return false;
  if(l.status>=200&&l.status<300)return true;
  // Robot denial is an explicit uncertainty, not evidence of a broken source.
  // Only cited external sources qualify; internal links and product CTAs must work.
  return [401,403,429].includes(l.status)&&draft.sources.some(s=>s.url===url)&&new URL(url,'https://maxvideoai.com').origin!=='https://maxvideoai.com';
 })))throw Error('Link checks incomplete');
 for(const asset of draft.assets){const m=r.media.find(a=>a.id===asset.id);if(!asset.sha256||!m||m.sha256!==asset.sha256||m.bytes!==asset.bytes||m.width!==asset.width||m.height!==asset.height)throw Error('Media checks incomplete');}
 for(const locale of ['en','fr','es'] as const)for(const width of [360,768,1440]){
  const v=r.views.find(v=>v.locale===locale&&v.width===width),a=draft.locales[locale];
  if(!v||v.failures.length||v.title!==buildMetaTitle(`${a.title} — MaxVideo AI`)||v.description!==buildMetaDescription(a.description)||v.h1Count!==1||v.imagesLoaded<draft.assets.length||v.canonical!==`https://maxvideoai.com${locale==='en'?'':`/${locale}`}/blog/${a.slug}`||['en','fr','es'].some(l=>!v.languages.includes(l))||!v.schemaTypes.includes('Article')||!v.schemaTypes.includes('BreadcrumbList'))throw Error('Rendered article checks incomplete');
 }
 return r;
}
