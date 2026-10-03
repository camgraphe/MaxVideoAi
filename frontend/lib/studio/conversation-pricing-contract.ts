import {z} from 'zod';
import {conversationSettingsSchema,conversationReferenceSchema,conversationReferencesProperties,STUDIO_CONVERSATION_MAX_REFERENCES} from './conversation-creation-contract';

export const studioPricingReadSchema=z.object({
  action:z.literal('pricing.read'),surface:z.enum(['image','video']),modelId:z.string().trim().min(1).max(128),
  mode:z.enum(['t2i','i2i','t2v','i2v']),settings:conversationSettingsSchema,
  references:z.array(conversationReferenceSchema.refine(selection=>selection.ref.type==='asset','Attach a saved library image before pricing it.')).max(STUDIO_CONVERSATION_MAX_REFERENCES),
  outputCount:z.literal(1),
}).strict();
export type StudioPricingEstimate=Readonly<{
  modelId:string;surface:'image'|'video';mode:string;settings:Readonly<Record<string,string|number|boolean|null>>;
  outputCount:1;referenceCount:number;price:Readonly<{amountCents:number;currency:string}>;estimatedAt:string;quoteRequired:true;
}>;
export const STUDIO_PRICING_DIRECTOR_TOOL={action:'pricing.read',name:'pricing_read',description:'Read the current MaxVideoAI customer estimate for ONE exact supported image/video scenario. Use settings from model_details and explicitly attached saved image references only. No quote is created/replaced, no spending or media promotion. Compare current like-for-like estimates before a budget recommendation; a fresh prepare quote and client confirmation are still required. Audio and unsaved project outputs are not supported here.',properties:{
  surface:{type:'string',enum:['image','video']},modelId:{type:'string'},mode:{type:'string',enum:['t2i','i2i','t2v','i2v']},
  settings:{type:'array',maxItems:32,items:{type:'object',additionalProperties:false,required:['name','value'],properties:{name:{type:'string'},value:{type:['string','number','boolean','null']}}}},
  references:{...conversationReferencesProperties(false),type:'array',maxItems:STUDIO_CONVERSATION_MAX_REFERENCES},outputCount:{type:'integer',enum:[1]},
}} as const;
