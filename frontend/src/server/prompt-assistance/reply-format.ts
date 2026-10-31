import {z} from 'zod';
import {promptAssistanceReplySchema,type PromptAssistanceReply} from '@/lib/prompt-assistance/contract';

/** Private provider protocol; persist beside the call before dispatch, not in reviewInput. */
export const PROMPT_REPLY_FORMAT='destination-v1';
// Flat root, required fields and nullable string use the supported Structured Outputs subset.
// Conditional consistency belongs to the decoder; no unsupported if/then or root union.
export const promptReplyTextFormat={type:'json_schema' as const,name:'prompt_assistance_reply',strict:true,schema:{
  type:'object',additionalProperties:false,required:['kind','reply','text'],properties:{
    kind:{type:'string',enum:['conversation','replacement'],description:'conversation for advice/questions; replacement only for text intended for the selected editor target.'},
    reply:{type:'string',description:'The complete conversational answer, including advice or an external plan (up to 6000 characters); a short explanation for a replacement.'},
    text:{type:['string','null'],description:'Complete replacement for currentDraft.target only; null for conversation, including external editing plans.'},
  },
}};
const taggedReplySchema=promptAssistanceReplySchema.extend({kind:z.enum(['conversation','replacement'])}).strict()
  .refine(value=>value.kind==='conversation'?value.text===null:value.text!==null);

/** Only a truly absent marker selects legacy. Never infer a version from the output's shape. */
export function parsePromptProviderReply(output:string,context:unknown):PromptAssistanceReply {
  const value=JSON.parse(output);
  if(!context||!Object.prototype.hasOwnProperty.call(context,'replyFormat'))return promptAssistanceReplySchema.parse(value);
  if((context as {replyFormat:unknown}).replyFormat!==PROMPT_REPLY_FORMAT)throw new Error('OUTPUT_INVALID');
  const {reply,text}=taggedReplySchema.parse(value);
  return {reply,text};
}
