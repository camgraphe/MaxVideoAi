import {z} from 'zod';
import {promptAssistanceReplySchema,type PromptAssistanceReply} from '@/lib/prompt-assistance/contract';
import {PROMPT_ASSISTANCE_TEXT_MAX_CHARS} from '@/lib/prompt-assistance/limits';
import {promptReferenceLocationSchema,promptAnalysisRequestSchema,type PromptAnalysisRequest} from '@/lib/prompt-assistance/analysis-request';
import {STUDIO_ANALYSIS_LIMITS} from '@/lib/studio/media-analysis-contract';

/** Private provider protocol; persist beside the call before dispatch, not in reviewInput. */
export const PROMPT_REPLY_FORMAT='destination-analysis-v2';
// Flat root, required fields and nullable string use the supported Structured Outputs subset.
// Conditional consistency belongs to the decoder; no unsupported if/then or root union.
export const promptReplyTextFormat={type:'json_schema' as const,name:'prompt_assistance_reply',strict:true,schema:{
  type:'object',additionalProperties:false,required:['kind','reply','text','analysisRequest'],properties:{
    kind:{type:'string',enum:['conversation','replacement'],description:'conversation for advice/questions; replacement only for text intended for the selected editor target.'},
    reply:{type:'string',description:`The complete conversational answer, including advice or an external plan (up to ${PROMPT_ASSISTANCE_TEXT_MAX_CHARS} characters); a short explanation for a replacement.`},
    text:{type:['string','null'],description:'Complete replacement for currentDraft.target only; null for conversation, including external editing plans.'},
    analysisRequest:{type:['object','null'],additionalProperties:false,required:['fieldId','slot','modality','startSec','endSec'],description:'Suggest review of an attached video/audio analysis quote only when needed. Never starts work. Null otherwise.',properties:{
      fieldId:{type:'string',description:'Exact current reference field, never a URL or media ID.'},slot:{type:'integer',minimum:0,maximum:99},
      modality:{type:'string',enum:['visual','audio']},startSec:{type:'number',minimum:0,maximum:86400},endSec:{type:['number','null'],description:'End of a positive interval within verified duration; at most60s visual or30s audio. Null lets the app choose its bounded interval.'},
    }},
  },
}};
// Historical decoders stay frozen even though the public reply can now carry an action.
const legacyReplySchema=promptAssistanceReplySchema.omit({analysisRequest:true});
const taggedReplySchema=legacyReplySchema.extend({kind:z.enum(['conversation','replacement'])}).strict()
  .refine(value=>value.kind==='conversation'?value.text===null:value.text!==null);
const actionReplySchema=legacyReplySchema.extend({kind:z.enum(['conversation','replacement']),analysisRequest:z.unknown()}).strict()
  .refine(value=>Object.prototype.hasOwnProperty.call(value,'analysisRequest'))
  .refine(value=>value.kind==='conversation'?value.text===null:value.text!==null);
const suggestionSchema=promptReferenceLocationSchema.extend({modality:z.enum(['visual','audio']),startSec:z.number().finite().min(0).max(86400),endSec:z.number().finite().positive().max(86400).nullable()}).strict();
const actionContextSchema=z.object({
  analysisAvailability:z.object({visual:z.boolean(),audio:z.boolean()}),
  references:z.array(z.object({field:z.string(),slot:z.number(),kind:z.enum(['image','video','audio']),durationSec:z.number().finite().positive().nullable()})),
});
type SubmittedReference={fieldId:string;slot:number;ref:unknown};

/** Invalid optional advice cannot invalidate an otherwise useful, paid conversational answer. */
function validatedAnalysisRequest(value:unknown,context:unknown,references:ReadonlyArray<SubmittedReference>):PromptAnalysisRequest|undefined {
  const proposed=suggestionSchema.safeParse(value),saved=actionContextSchema.safeParse(context);
  if(!proposed.success||!saved.success)return;
  const request=proposed.data,reference=saved.data.references.find(item=>item.field===request.fieldId&&item.slot===request.slot);
  if(!saved.data.analysisAvailability[request.modality]||!reference||reference.kind==='image'||request.modality==='visual'&&reference.kind!=='video'||!reference.durationSec)return;
  const limit=request.modality==='audio'?STUDIO_ANALYSIS_LIMITS.audioSeconds:STUDIO_ANALYSIS_LIMITS.videoSeconds;
  const end=request.endSec??Math.min(reference.durationSec,request.startSec+limit);
  if(end<=request.startSec||end>reference.durationSec||end-request.startSec>limit)return;
  const ref=references.find(item=>item.fieldId===request.fieldId&&item.slot===request.slot)?.ref;
  const bound=promptAnalysisRequestSchema.safeParse({...request,endSec:end,ref});
  if(bound.success&&bound.data.ref.kind===reference.kind)return bound.data;
}

/** Only a truly absent marker selects legacy. Never infer a version from the output's shape. */
export function parsePromptProviderReply(output:string,context:unknown,references:ReadonlyArray<SubmittedReference>=[]):PromptAssistanceReply {
  const value=JSON.parse(output);
  if(!context||!Object.prototype.hasOwnProperty.call(context,'replyFormat'))return legacyReplySchema.parse(value);
  const version=(context as {replyFormat:unknown}).replyFormat;
  if(version==='destination-v1'){const {reply,text}=taggedReplySchema.parse(value);return {reply,text};}
  if(version!==PROMPT_REPLY_FORMAT)throw new Error('OUTPUT_INVALID');
  const {reply,text,analysisRequest:proposed}=actionReplySchema.parse(value);
  const analysisRequest=validatedAnalysisRequest(proposed,context,references);
  return {reply,text,...(analysisRequest?{analysisRequest}:{})};
}
