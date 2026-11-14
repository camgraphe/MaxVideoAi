import {z} from 'zod';
import records from '../config/seedream-editorial-images.json';
import {getRuntimeModelById} from '../config/model-runtime';

const providerModels={
 'seedream-5-5':'dola-seedream-5-5-261028',
 'seedream-5-0-flash':'dola-seedream-5-0-flash-260915',
 'seedream-5-0-pro':'dola-seedream-5-0-pro-260628',
} as const;
const engineIds=['seedream-5-5','seedream-5-0-flash','seedream-5-0-pro'] as const;
const hash=z.string().regex(/^[a-f0-9]{64}$/);
const fileFields=z.object({
 url:z.string().regex(/^\/assets\/model-examples\/seedream-(?:5-5|5-0-flash|5-0-pro)\/[a-f0-9]{64}\.(?:jpg|png|webp)$/),
 sha256:hash,bytes:z.number().int().positive(),width:z.number().int().positive(),height:z.number().int().positive(),
 mimeType:z.enum(['image/jpeg','image/png','image/webp']),
}).strict();
const immutable=(file:z.infer<typeof fileFields>)=>file.url.endsWith(`/${file.sha256}.${file.mimeType==='image/jpeg'?'jpg':file.mimeType==='image/png'?'png':'webp'}`);
const imageSchema=z.object({
 id:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),status:z.literal('accepted'),engineId:z.enum(engineIds),
 providerModelId:z.string().min(1).optional(),role:z.enum(['hero','example']),promptLanguage:z.literal('en'),prompt:z.string().min(1).max(32000),
 settings:z.object({mode:z.enum(['t2i','i2i']),resolution:z.literal('2K'),aspectRatio:z.enum(['16:9','9:16','3:4']),outputFormat:z.enum(['jpeg','png']),numImages:z.literal(1),background:z.enum(['opaque','transparent']).optional()}).strict(),
 sourceImageId:z.string().optional(),sourceOriginalSha256:hash.optional(),alphaVerified:z.boolean().optional(),
 provenance:z.discriminatedUnion('kind',[
  z.object({kind:z.literal('external_byteplus_modelark'),generatedAt:z.string().datetime(),responseSha256:hash,promptSha256:hash}).strict(),
  z.object({kind:z.literal('maxvideoai_mcp_generation'),observedCompletedAt:z.string().datetime(),receiptSha256:hash,requestHash:hash,promptSha256:hash}).strict(),
  z.object({kind:z.literal('reviewed_byteplus_output'),generatedAt:z.string().datetime(),manifestSha256:hash,promptSha256:hash}).strict(),
 ]),
 original:fileFields.refine(immutable),display:fileFields.extend({sourceSha256:hash}).strict().refine(immutable),
}).strict().superRefine((image,ctx)=>{
 if(image.provenance.kind!=='maxvideoai_mcp_generation'&&providerModels[image.engineId]!==image.providerModelId)ctx.addIssue({code:'custom',message:'Wrong Seedream provider attribution'});
 if(image.provenance.kind==='maxvideoai_mcp_generation'&&image.providerModelId!==undefined)ctx.addIssue({code:'custom',message:'An MCP completion proves its quoted engine, not a raw provider response'});
 if(image.original.mimeType!==`image/${image.settings.outputFormat}`||image.display.mimeType!=='image/webp')ctx.addIssue({code:'custom',message:'Original and display roles differ'});
 if(image.settings.mode==='i2i'?!image.sourceImageId||!image.sourceOriginalSha256:Boolean(image.sourceImageId||image.sourceOriginalSha256))ctx.addIssue({code:'custom',message:'Edit source contract differs from generation mode'});
 if(image.settings.background==='transparent'&&(image.engineId!=='seedream-5-5'||image.settings.outputFormat!=='png'||image.alphaVerified!==true))ctx.addIssue({code:'custom',message:'Transparent output needs a verified native Seedream 5.5 PNG'});
 if(image.display.sourceSha256!==image.original.sha256)ctx.addIssue({code:'custom',message:'Wrong image source lineage'});
 for(const file of [image.original,image.display])if(!file.url.startsWith(`/assets/model-examples/${image.engineId}/`))ctx.addIssue({code:'custom',message:'Media path and selected model differ'});
});
export type SeedreamEditorialImage=z.infer<typeof imageSchema>;

export function parseSeedreamEditorialImages(input:unknown):SeedreamEditorialImage[]{
 const images=z.array(imageSchema).parse(input);
 if(new Set(images.map(image=>image.id)).size!==images.length||new Set(images.map(image=>image.original.sha256)).size!==images.length)throw Error('Duplicate Seedream editorial image');
 for(const image of images){
  if(!image.sourceImageId)continue;
  const source=images.find(candidate=>candidate.id===image.sourceImageId);
  if(!source||source.engineId!==image.engineId||source.id===image.id||source.original.sha256!==image.sourceOriginalSha256)throw Error('Wrong exact Seedream edit source');
  const visited=new Set([image.id]);let current:SeedreamEditorialImage|undefined=source;
  while(current){if(visited.has(current.id))throw Error('Cyclic Seedream edit source');visited.add(current.id);current=images.find(candidate=>candidate.id===current?.sourceImageId);}
 }
 for(const engineId of engineIds){
  const selected=images.filter(image=>image.engineId===engineId);
  if(selected.length&&selected.filter(image=>image.role==='hero').length!==1)throw Error('An accepted Seedream set needs one hero');
 }
 return images;
}

/** Editorial provider outputs retain their real model and never acquire an invented app job. */
export function listSeedreamEditorialImages(engineId:string):SeedreamEditorialImage[]{
 if(!engineIds.some(id=>id===engineId)||!getRuntimeModelById(engineId)?.publication.model.published)return [];
 return parseSeedreamEditorialImages(records).filter(image=>image.engineId===engineId);
}
