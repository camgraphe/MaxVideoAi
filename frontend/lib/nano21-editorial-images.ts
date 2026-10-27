import { z } from 'zod';
import records from '../config/nano21-editorial-images.json';
import { getRuntimeModelById } from '../config/model-runtime';

const hash=z.string().regex(/^[a-f0-9]{64}$/);
const fileFields=z.object({
  url:z.string().url().refine(value=>{const url=new URL(value);return url.protocol==='https:'&&url.hostname==='media.maxvideoai.com'&&!url.search&&!url.hash&&!url.username&&!url.password;}),
  sha256:hash,bytes:z.number().int().positive(),width:z.number().int().positive(),height:z.number().int().positive(),
  mimeType:z.enum(['image/png','image/webp']),
}).strict();
const immutableFile=(value:z.infer<typeof fileFields>)=>new URL(value.url).pathname.endsWith(`/${value.sha256}.${value.mimeType==='image/png'?'png':'webp'}`);
const file=fileFields.refine(immutableFile,'Image URL must identify its immutable bytes');
const derivative=fileFields.extend({sourceSha256:hash}).strict().refine(immutableFile,'Display URL must identify its immutable bytes');
export const nano21EditorialImageSchema=z.object({
  id:z.string().regex(/^nano21-[a-z0-9]+(?:-[a-z0-9]+)*$/),status:z.literal('accepted'),
  engineId:z.literal('nano-banana-2-1'),providerModelId:z.literal('gemini-nano-banana-2.1'),
  role:z.enum(['hero','example']),title:z.string().min(1),promptLanguage:z.literal('en'),prompt:z.string().min(1).max(12000),
  settings:z.object({mode:z.literal('t2i'),resolution:z.literal('1k'),aspectRatio:z.literal('16:9'),thinkingLevel:z.literal('medium'),maxOutputTokens:z.literal(32768)}).strict(),
  provenance:z.object({kind:z.literal('external_vertex'),location:z.literal('global'),generatedAt:z.string().datetime(),responseSha256:hash,promptSha256:hash}).strict(),
  original:file,display:derivative,variants:z.array(derivative).length(3),
}).strict().superRefine((value,ctx)=>{
  for(const derivative of [value.display,...value.variants]){
    if(derivative.sourceSha256!==value.original.sha256)ctx.addIssue({code:'custom',message:'Wrong source image lineage'});
  }
});
export type Nano21EditorialImage=z.infer<typeof nano21EditorialImageSchema>;

/** Public stills have an editorial identity, never a fabricated application job. */
export function listNano21EditorialImages(engineId:string):Nano21EditorialImage[]{
  if(engineId!=='nano-banana-2-1'||!getRuntimeModelById(engineId)?.publication.model.published)return [];
  const images=records.map(record=>nano21EditorialImageSchema.parse(record));
  if(new Set(images.map(image=>image.id)).size!==images.length||new Set(images.map(image=>image.original.sha256)).size!==images.length)throw Error('Duplicate Nano21 editorial image');
  if(images.filter(image=>image.role==='hero').length!==1)throw Error('Nano21 editorial hero must be unique');
  return images;
}
