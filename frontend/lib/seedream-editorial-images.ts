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
 url:z.string().regex(/^\/assets\/model-examples\/seedream-(?:5-5|5-0-flash|5-0-pro)\/[a-f0-9]{64}\.(?:jpg|webp)$/),
 sha256:hash,bytes:z.number().int().positive(),width:z.number().int().positive(),height:z.number().int().positive(),
 mimeType:z.enum(['image/jpeg','image/webp']),
}).strict();
const immutable=(file:z.infer<typeof fileFields>)=>file.url.endsWith(`/${file.sha256}.${file.mimeType==='image/jpeg'?'jpg':'webp'}`);
const imageSchema=z.object({
 id:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),status:z.literal('accepted'),engineId:z.enum(engineIds),
 providerModelId:z.string().min(1).optional(),role:z.enum(['hero','example']),promptLanguage:z.literal('en'),prompt:z.string().min(1).max(32000),
 settings:z.object({mode:z.literal('t2i'),resolution:z.literal('2K'),aspectRatio:z.literal('16:9'),outputFormat:z.literal('jpeg'),numImages:z.literal(1)}).strict(),
 provenance:z.discriminatedUnion('kind',[
  z.object({kind:z.literal('external_byteplus_modelark'),generatedAt:z.string().datetime(),responseSha256:hash,promptSha256:hash}).strict(),
  z.object({kind:z.literal('maxvideoai_mcp_generation'),observedCompletedAt:z.string().datetime(),receiptSha256:hash,requestHash:hash,promptSha256:hash}).strict(),
 ]),
 original:fileFields.refine(immutable),display:fileFields.extend({sourceSha256:hash}).strict().refine(immutable),
}).strict().superRefine((image,ctx)=>{
 if(image.provenance.kind==='external_byteplus_modelark'&&providerModels[image.engineId]!==image.providerModelId)ctx.addIssue({code:'custom',message:'Wrong Seedream provider attribution'});
 if(image.provenance.kind==='maxvideoai_mcp_generation'&&image.providerModelId!==undefined)ctx.addIssue({code:'custom',message:'An MCP completion proves its quoted engine, not a raw provider response'});
 if(image.original.mimeType!=='image/jpeg'||image.display.mimeType!=='image/webp')ctx.addIssue({code:'custom',message:'Original and display roles differ'});
 if(image.display.sourceSha256!==image.original.sha256)ctx.addIssue({code:'custom',message:'Wrong image source lineage'});
 for(const file of [image.original,image.display])if(!file.url.startsWith(`/assets/model-examples/${image.engineId}/`))ctx.addIssue({code:'custom',message:'Media path and selected model differ'});
});
export type SeedreamEditorialImage=z.infer<typeof imageSchema>;

export function parseSeedreamEditorialImages(input:unknown):SeedreamEditorialImage[]{
 const images=z.array(imageSchema).parse(input);
 if(new Set(images.map(image=>image.id)).size!==images.length||new Set(images.map(image=>image.original.sha256)).size!==images.length)throw Error('Duplicate Seedream editorial image');
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
