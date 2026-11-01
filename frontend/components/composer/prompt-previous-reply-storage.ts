import {z} from 'zod';
import {promptSessionScopeSchema} from '@/lib/prompt-assistance/session';
const previousReplySchema=z.object({version:z.literal(1),scopeKey:z.string().max(1000),serverScope:z.string().max(100),sessionId:z.string().uuid(),requestId:z.string().uuid(),deadlineAt:z.string().datetime().optional(),observationStartedAt:z.string().datetime().optional(),status:z.enum(['admitting','pending','unknown','terminal'])}).strict();
export type PreviousReplyRef=z.infer<typeof previousReplySchema>;
const memory=new Map<string,PreviousReplyRef|null>();
export const previousReplyStorageKey=(accountKey:string)=>`milo-previous-reply:v1:${JSON.stringify(accountKey)}`;
export function previousReplyAccount(scopeKey:string,accountKey?:string){try{return accountKey??String(JSON.parse(scopeKey)[0]);}catch{return accountKey??scopeKey;}}
export const samePreviousReply=(left:Pick<PreviousReplyRef,'sessionId'|'requestId'>|null|undefined,right:Pick<PreviousReplyRef,'sessionId'|'requestId'>)=>left?.sessionId===right.sessionId&&left.requestId===right.requestId;
export function readPreviousReply(accountKey:string):PreviousReplyRef|null{
  if(memory.has(accountKey))return memory.get(accountKey)!;
  try{const value=previousReplySchema.safeParse(JSON.parse(sessionStorage.getItem(previousReplyStorageKey(accountKey))??'null'));if(value.success){memory.set(accountKey,value.data);return value.data;}}catch{/* Mounted recovery stays available even when storage is denied. */}
  return memory.get(accountKey)??null;
}
/** Compare identity so a late callback cannot overwrite the next account admission. */
export function writePreviousReply(accountKey:string,value:PreviousReplyRef,expected?:PreviousReplyRef|null):boolean{
  const current=readPreviousReply(accountKey);
  if(expected&&!samePreviousReply(current,expected))return false;
  if(!expected&&current&&current.status!=='terminal'&&!samePreviousReply(current,value))return false;
  value={...value,observationStartedAt:(samePreviousReply(current,value)?current?.observationStartedAt:undefined)??value.observationStartedAt??new Date(Date.now()).toISOString()};
  memory.set(accountKey,value);
  try{const serialized=JSON.stringify(value);sessionStorage.setItem(previousReplyStorageKey(accountKey),serialized);return sessionStorage.getItem(previousReplyStorageKey(accountKey))===serialized;}catch{return false;}
}
export function clearPreviousReply(accountKey:string,identity:PreviousReplyRef):boolean{
  if(!samePreviousReply(readPreviousReply(accountKey),identity))return false;
  memory.set(accountKey,null);
  try{sessionStorage.removeItem(previousReplyStorageKey(accountKey));return sessionStorage.getItem(previousReplyStorageKey(accountKey))===null;}catch{return false;}
}
export function privatePreviousReply(value:unknown,scopeKey:string):PreviousReplyRef|null{
  const pointer=value as {sessionId?:unknown;requestId?:unknown;scope?:unknown;deadlineAt?:unknown};
  if(!pointer||!promptSessionScopeSchema.safeParse(pointer.scope).success)return null;
  let originalScopeKey=scopeKey;
  try{const [account]=JSON.parse(scopeKey);originalScopeKey=JSON.stringify([account,...String(pointer.scope).split(':')]);}catch{/* Custom scope keys still retain the exact server scope and identity. */}
  const parsed=previousReplySchema.safeParse({version:1,scopeKey:originalScopeKey,serverScope:pointer.scope,sessionId:pointer.sessionId,requestId:pointer.requestId,deadlineAt:pointer.deadlineAt,status:'pending'});
  return parsed.success?parsed.data:null;
}
