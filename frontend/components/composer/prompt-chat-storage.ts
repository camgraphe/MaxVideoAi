import {z} from 'zod';
import {REVIEWABLE_GENERATION_SETTINGS} from '@/lib/prompt-assistance/application-review';
const reviewProofSchema=z.object({version:z.literal(1),requestId:z.string().uuid(),compatibilityFingerprint:z.string().regex(/^[a-f0-9]{64}$/),compatible:z.boolean(),settings:z.record(z.string(),z.union([z.string().max(5000),z.number().finite(),z.boolean(),z.null()])).refine(value=>Object.keys(value).every(key=>(REVIEWABLE_GENERATION_SETTINGS as readonly string[]).includes(key)))}).strict();
const pendingReviewSchema=reviewProofSchema.extend({draftFingerprint:z.string().regex(/^[a-f0-9]{64}$/)});
const localSchema=z.object({
  message:z.string().max(8000),
  proposal:z.object({text:z.string().max(50000),draftFingerprint:z.string().max(64),valid:z.boolean(),review:reviewProofSchema.optional().catch(undefined)}).nullable(),
  latestRequestId:z.string(),
});
const storedSchema=z.object({sessionId:z.string().uuid(),pending:z.object({sessionId:z.string().uuid(),requestId:z.string().uuid()}).nullable(),pendingReview:pendingReviewSchema.optional().catch(undefined),local:localSchema.optional(),legacy:z.boolean().optional()});
export const analysisIdentitySchema=z.object({sessionId:z.string().uuid(),analysisId:z.string().uuid()});
export type PromptChatRecord=z.infer<typeof storedSchema>;
export type PromptChatLocal=z.infer<typeof localSchema>;
export type PromptPendingReview=z.infer<typeof pendingReviewSchema>;
export const promptChatStorageKey=(scopeKey:string)=>`milo-composer:v2:${scopeKey}`;
export function readPromptChat(key:string){
  try{const saved=storedSchema.safeParse(JSON.parse(sessionStorage.getItem(key)??'null'));return saved.success?saved.data:null;}catch{return null;}
}
export function writePromptChat(key:string,value:PromptChatRecord):boolean {
  try{const serialized=JSON.stringify(value);sessionStorage.setItem(key,serialized);return sessionStorage.getItem(key)===serialized;}catch{return false;}
}

type RevocationResult={kind:'saved';record:PromptChatRecord}|{kind:'discarded'|'blocked'};
/** Bounded fallback; never discard a session needed by pending message/analysis recovery. */
export function revokePromptChatReview(key:string,value:PromptChatRecord,preserveRecoveryIdentity:boolean,revokePending=true):RevocationResult {
  const proposal=value.local?.proposal;
  const revoked:PromptChatRecord={...value,pendingReview:value.pendingReview&&revokePending?{...value.pendingReview,compatible:false}:value.pendingReview,local:value.local?{...value.local,proposal:proposal?{...proposal,review:proposal.review?{...proposal.review,compatible:false}:undefined}:null}:undefined};
  const withoutProof:PromptChatRecord={...revoked,pendingReview:undefined,local:revoked.local?{...revoked.local,proposal:revoked.local.proposal?{...revoked.local.proposal,review:undefined}:null}:undefined};
  const identity:PromptChatRecord={sessionId:value.sessionId,pending:value.pending,legacy:value.legacy};
  for(const candidate of [revoked,withoutProof,identity])if(writePromptChat(key,candidate))return {kind:'saved',record:candidate};
  if(!preserveRecoveryIdentity&&!value.pending){
    try{sessionStorage.removeItem(key);if(sessionStorage.getItem(key)===null)return {kind:'discarded'};}catch{/* Report the unresolved durable state to the mounted UI. */}
  }
  return {kind:'blocked'};
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
