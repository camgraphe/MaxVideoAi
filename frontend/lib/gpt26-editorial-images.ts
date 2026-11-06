import {z} from 'zod';
import records from '../config/gpt26-editorial-images.json';
import {getRuntimeModelById} from '../config/model-runtime';

const hash=z.string().regex(/^[a-f0-9]{64}$/);
const engineId=z.enum(['gpt-image-2-6-flare','gpt-image-2-6-sunburst']);
const fileFields=z.object({
 url:z.string().url().refine(value=>{const url=new URL(value);return url.protocol==='https:'&&url.hostname==='media.maxvideoai.com'&&!url.search&&!url.hash&&!url.username&&!url.password;}),
 sha256:hash,bytes:z.number().int().positive(),width:z.number().int().positive(),height:z.number().int().positive(),mimeType:z.enum(['image/png','image/webp']),
}).strict();
const immutable=(file:z.infer<typeof fileFields>)=>new URL(file.url).pathname.endsWith(`/${file.sha256}.${file.mimeType==='image/png'?'png':'webp'}`);
const imageSchema=z.object({
 id:z.string().regex(/^gpt26-(flare|sunburst)-(generation|edit)$/),status:z.literal('accepted'),engineId,
 providerModelId:z.enum(['gpt-image-2.6-flare','gpt-image-2.6-sunburst']),role:z.enum(['hero','example']),
 promptLanguage:z.literal('en'),prompt:z.string().min(1).max(32000),
 settings:z.object({mode:z.enum(['t2i','i2i']),resolution:z.literal('1024x1024'),quality:z.literal('high'),complexity:z.literal('high'),background:z.literal('opaque'),outputFormat:z.literal('png'),numImages:z.literal(1)}).strict(),
 provenance:z.object({kind:z.literal('external_openai_images'),generatedAt:z.string().datetime(),responseSha256:hash,promptSha256:hash}).strict(),
 sourceImageId:z.string().nullable(),original:fileFields.refine(immutable),
 display:fileFields.extend({sourceSha256:hash}).strict().refine(immutable),
}).strict().superRefine((image,ctx)=>{
 if(image.providerModelId.replace('2.6','2-6')!==image.engineId)ctx.addIssue({code:'custom',message:'Wrong provider model attribution'});
 if(image.display.sourceSha256!==image.original.sha256)ctx.addIssue({code:'custom',message:'Wrong display source lineage'});
 if((image.settings.mode==='i2i')!==Boolean(image.sourceImageId))ctx.addIssue({code:'custom',message:'Edit source is required only for an edit'});
 if((image.role==='hero')!==(image.settings.mode==='t2i'))ctx.addIssue({code:'custom',message:'Generation hero and edit roles differ'});
});
export type Gpt26EditorialImage=z.infer<typeof imageSchema>;

export function parseGpt26EditorialImages(value:unknown):Gpt26EditorialImage[]{
 const images=z.array(imageSchema).parse(value);
 if(new Set(images.map(image=>image.id)).size!==images.length||new Set(images.map(image=>image.original.sha256)).size!==images.length)throw new Error('Duplicate 2.6 editorial image');
 for(const model of engineId.options){
  const selected=images.filter(image=>image.engineId===model);
  if(selected.length!==2||selected.filter(image=>image.role==='hero').length!==1)throw new Error('Each 2.6 variant needs its own generation and edit');
 }
 for(const image of images){
  if(!image.id.startsWith(`gpt26-${image.engineId.endsWith('flare')?'flare':'sunburst'}-`))throw new Error('Editorial ID and model differ');
  if(image.sourceImageId){
   const source=images.find(candidate=>candidate.id===image.sourceImageId);
   if(!source||source.settings.mode!=='t2i')throw new Error('Unknown or non-original edit source');
  }
 }
 return images;
}

/** External evidence has public editorial identity, not invented app job IDs. */
export function listGpt26EditorialImages(id:string):Gpt26EditorialImage[]{
 if(!engineId.options.some(model=>model===id)||!getRuntimeModelById(id)?.publication.model.published)return [];
 return parseGpt26EditorialImages(records).filter(image=>image.engineId===id);
}

export function gpt26EditorialSources():Gpt26EditorialImage[]{return parseGpt26EditorialImages(records);}
