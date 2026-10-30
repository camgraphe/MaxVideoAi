import {z} from 'zod';
const localSchema=z.object({
  message:z.string().max(8000),
  proposal:z.object({text:z.string().max(50000),draftFingerprint:z.string().max(64),valid:z.boolean()}).nullable(),
  latestRequestId:z.string(),
});
const storedSchema=z.object({sessionId:z.string().uuid(),pending:z.object({sessionId:z.string().uuid(),requestId:z.string().uuid()}).nullable(),local:localSchema.optional()});
export type PromptChatLocal=z.infer<typeof localSchema>;
export const promptChatStorageKey=(scopeKey:string)=>`milo-composer:v2:${scopeKey}`;
export function readPromptChat(key:string){
  try{const saved=storedSchema.safeParse(JSON.parse(sessionStorage.getItem(key)??'null'));return saved.success?saved.data:null;}catch{return null;}
}
export function writePromptChat(key:string,value:z.infer<typeof storedSchema>){
  try{sessionStorage.setItem(key,JSON.stringify(value));}catch{/* Storage-disabled browsers keep the current in-memory chat. */}
}
