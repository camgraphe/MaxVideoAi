import {z} from 'zod';
const localSchema=z.object({
  message:z.string().max(8000),
  proposal:z.object({text:z.string().max(50000),draftFingerprint:z.string().max(64),valid:z.boolean()}).nullable(),
  latestRequestId:z.string(),
});
const storedSchema=z.object({sessionId:z.string().uuid(),pending:z.object({sessionId:z.string().uuid(),requestId:z.string().uuid()}).nullable(),local:localSchema.optional(),legacy:z.boolean().optional()});
export const analysisIdentitySchema=z.object({sessionId:z.string().uuid(),analysisId:z.string().uuid()});
export type PromptChatLocal=z.infer<typeof localSchema>;
export const promptChatStorageKey=(scopeKey:string)=>`milo-composer:v2:${scopeKey}`;
export function readPromptChat(key:string){
  try{const saved=storedSchema.safeParse(JSON.parse(sessionStorage.getItem(key)??'null'));return saved.success?saved.data:null;}catch{return null;}
}
export function writePromptChat(key:string,value:z.infer<typeof storedSchema>){
  try{sessionStorage.setItem(key,JSON.stringify(value));}catch{/* Storage-disabled browsers keep the current in-memory chat. */}
}

/** The deployed client used one broad chat per surface (one per intent for audio). */
export function legacyPromptScopeKey(scopeKey:string){
  try{
    const [account,surface,workflow]=JSON.parse(scopeKey);
    if(!account||!['video','image','audio'].includes(surface))return scopeKey;
    return JSON.stringify(surface==='audio'?[account,workflow]:[account,surface]);
  }catch{return scopeKey;}
}
export function readAnalysisIdentity(key:string){
  try{const parsed=analysisIdentitySchema.safeParse(JSON.parse(sessionStorage.getItem(key)??'null'));return parsed.success?parsed.data:null;}catch{return null;}
}
export function readLegacyPromptRecovery(scopeKey:string){
  const legacyScope=legacyPromptScopeKey(scopeKey);
  const chat=readPromptChat(`milo-composer:${legacyScope}`);
  const analysis=readAnalysisIdentity(`milo-analysis:${legacyScope}`);
  // Only unfinished identities cross the rollout; never import broad old chat history.
  if(chat?.pending)return {...chat,local:undefined,legacy:true};
  if(analysis)return {sessionId:analysis.sessionId,pending:null,local:undefined,legacy:true};
  return null;
}
export function clearLegacyPromptRecovery(scopeKey:string,requestId:string){
  const key=`milo-composer:${legacyPromptScopeKey(scopeKey)}`;
  if(readPromptChat(key)?.pending?.requestId===requestId)try{sessionStorage.removeItem(key);}catch{}
}
