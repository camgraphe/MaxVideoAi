import {z} from 'zod';
import {conversationSettingsSchema,STUDIO_CONVERSATION_MAX_REFERENCES} from './conversation-creation-contract';
import {conversationMediaReferenceSchema,conversationMediaReferencesProperties} from './conversation-media-contract';
import {CANONICAL_GENERATION_MODES} from '@/server/agent-api/generation-types';
import type {CustomerDisplayPrice} from '@/lib/customer-price-presentation';

export const studioPricingReadSchema=z.object({
  action:z.literal('pricing.read'),surface:z.enum(['image','video']),modelId:z.string().trim().min(1).max(128),
  mode:z.enum(CANONICAL_GENERATION_MODES),settings:conversationSettingsSchema,
  references:z.array(conversationMediaReferenceSchema.refine(selection=>selection.ref.type==='asset','Attach saved library media before pricing it.')).max(STUDIO_CONVERSATION_MAX_REFERENCES),
  outputCount:z.literal(1),
}).strict();
export type StudioPricingEstimate=Readonly<{
  modelId:string;surface:'image'|'video';mode:string;settings:Readonly<Record<string,string|number|boolean|null>>;
  outputCount:1;outputDurationSec?:number;referenceCount:number;price:Readonly<CustomerDisplayPrice>;estimatedAt:string;quoteRequired:true;
}>;
export const studioPricingCompareSchema=studioPricingReadSchema.omit({action:true,modelId:true}).extend({
  action:z.literal('pricing.compare'),prompt:z.string().trim().min(1).max(3000),
  baselineModelId:z.string().trim().min(1).max(128).nullable(),
  baselineSettings:conversationSettingsSchema.nullable().default(null),
  candidateModelIds:z.array(z.string().trim().min(1).max(128)).min(1).max(32).nullable(),
}).strict();
export const STUDIO_PRICING_COMPARE_TOOL={action:'pricing.compare',name:'pricing_compare',description:'FIRST discovery action for an open image/video model or requested price alternatives. Compare up to three current compatible prices in ONE read; the server discovers models and validates capabilities, so no catalog_read or model_details is needed first. Preserve all explicit settings, attached owned references, roles and combinations; never relax requirements to get three. Defaults for unspecified settings are disclosed. Include audio true if sound is required, even for fixed-audio candidates. Price a concrete component duration for a multi-clip plan and preserve the total film duration in the explanation. Set baselineModelId only to reprice an existing model for savings; use candidateModelIds only for explicitly requested alternatives, otherwise null. No quotes, wallet reads, spending or generation. Present each model, actual settings and price briefly; fewer valid options is honest. Planning/prices end with a reply. Inspect a chosen model only before requested preparation; never substitute an explicitly chosen model. Available in the final Response, where the server returns the estimate without another assistant call.',properties:{
  surface:{type:'string',enum:['image','video']},mode:{type:'string',enum:[...CANONICAL_GENERATION_MODES]},prompt:{type:'string',minLength:1,maxLength:3000},
  settings:{type:'array',maxItems:32,description:'Explicit request constraints only; preserve durationSec, resolution, framing and audio requirements. For video include a concrete durationSec. Leave unspecified resolution out to compare disclosed supported presets. Do not invent unsupported constraints.',items:{type:'object',additionalProperties:false,required:['name','value'],properties:{name:{type:'string'},value:{type:['string','number','boolean','null']}}}},
  references:{...conversationMediaReferencesProperties(false),type:'array',maxItems:STUDIO_CONVERSATION_MAX_REFERENCES},
  baselineModelId:{type:['string','null']},baselineSettings:{type:['array','null'],maxItems:32,description:'For resolution/duration changes, preserve the original quote settings here to reprice the original configuration and calculate savings. Null uses the current scenario.',items:{type:'object',additionalProperties:false,required:['name','value'],properties:{name:{type:'string'},value:{type:['string','number','boolean','null']}}}},candidateModelIds:{type:['array','null'],minItems:1,maxItems:32,items:{type:'string'}},outputCount:{type:'integer',enum:[1]},
}} as const;
export const STUDIO_PRICING_DIRECTOR_TOOL={action:'pricing.read',name:'pricing_read',description:'Read the current MaxVideoAI customer estimate for ONE exact supported image/video scenario. Use settings from model_details and explicitly attached saved media references only, with exact kind and supported roles. No quote is created/replaced, no spending or media promotion. Compare current like-for-like estimates before a budget recommendation; a fresh prepare quote and client confirmation are still required. Audio generation and unsaved project outputs are not supported here.',properties:{
  surface:{type:'string',enum:['image','video']},modelId:{type:'string'},mode:{type:'string',enum:[...CANONICAL_GENERATION_MODES]},
  settings:{type:'array',description:'Supply an exact scenario: always include resolution from mode.resolutions in model_details. Include aspectRatio only when mode.aspectRatios is nonempty; otherwise omit it because framing comes from the source. For video, also include durationSec (seconds) from mode.duration, never duration. Include audio only when mode.audio is optional. Other setting names and values come from mode.settings. Explicit imageWidth/imageHeight also require resolution custom. Do not rely on prepare defaults for an estimate.',maxItems:32,items:{type:'object',additionalProperties:false,required:['name','value'],properties:{name:{type:'string'},value:{type:['string','number','boolean','null']}}}},
  references:{...conversationMediaReferencesProperties(false),type:'array',maxItems:STUDIO_CONVERSATION_MAX_REFERENCES},outputCount:{type:'integer',enum:[1]},
}} as const;
