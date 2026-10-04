import {z} from 'zod';
import {editorialVariantSchema,editorialSourceSchema,sourceVideoId} from './schema';

export const EDITORIAL_RENDER_VERSION='editorial-reader-v2';
const digest=z.string().regex(/^[a-f0-9]{64}$/);
export const publicEditorialArticleSchema=z.object({
 schemaVersion:z.literal(1),canonicalSlug:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
 publication:z.object({articleId:z.string().uuid(),version:z.number().int().positive(),digest,publishedAt:z.string().datetime({offset:true})}).strict(),
 article:editorialVariantSchema,
 sources:z.array(editorialSourceSchema.pick({id:true,title:true,publisher:true,url:true,retrievedAt:true,publishedAt:true})).min(1),
 assets:z.array(z.object({id:z.string(),kind:z.enum(['generated-illustration','verified-capture']),width:z.number().int().positive(),height:z.number().int().positive(),sha256:digest,url:z.string().refine(value=>{
  try{const u=new URL(value);return u.origin==='https://media.maxvideoai.com'&&!u.search&&!u.hash&&/^\/editorial\/published\/[a-f0-9]{64}\.(webp|png|jpe?g)$/.test(u.pathname);}catch{return false;}
 },'Verified public media URL required')}).strict()).min(1).max(15),
}).strict().superRefine((a,c)=>{
 const ids=new Set(a.assets.map(m=>m.id)),sources=new Set(a.sources.map(s=>s.id));
 if(ids.size!==a.assets.length||sources.size!==a.sources.length)c.addIssue({code:'custom',message:'Duplicate public IDs'});
 for(const asset of a.assets)if(!new URL(asset.url).pathname.split('/').at(-1)?.startsWith(asset.sha256+'.'))c.addIssue({code:'custom',message:'Public media digest mismatch'});
 for(const b of a.article.blocks){
  if(b.type==='media'&&(!ids.has(b.assetId)||(!b.alt&&!b.panels)))c.addIssue({code:'custom',message:'Invalid public media reference'});
  if(b.type==='diagram'&&b.connections.length!==b.nodes.length-1)c.addIssue({code:'custom',message:'Invalid public diagram'});
  if(b.type==='video'&&sourceVideoId(a.sources.find(s=>s.id===b.sourceId)?.url??'https://invalid.test')!==b.videoId)c.addIssue({code:'custom',message:'Invalid public video source'});
  const citations=b.type==='text'?b.paragraphs.flatMap(p=>p.sourceIds):b.type==='prompt'?b.sourceIds??[]:b.type==='video'?[b.sourceId]:[];
  if(citations.some(id=>!sources.has(id)))c.addIssue({code:'custom',message:'Unknown public source'});
 }
});
export type PublicEditorialArticle=z.infer<typeof publicEditorialArticleSchema>;

/** The sibling file is data only; never allow paths out of the article directory. */
export function editorialArtifactFilename(value:unknown,slug:string){
 if(typeof value!=='string'||value!==`${slug}.article.json`||!/^[a-z0-9]+(?:-[a-z0-9]+)*\.article\.json$/.test(value))throw Error('Invalid editorial artifact filename');
 return value;
}
