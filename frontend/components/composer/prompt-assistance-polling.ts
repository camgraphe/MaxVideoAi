import {assistanceNextActionSchema} from '@/lib/studio/assistance-contract';
import {promptAssistanceReplySchema,type PromptAssistanceResult} from '@/lib/prompt-assistance/contract';

export type PromptReplyIdentity={sessionId:string;requestId:string;deadlineAt?:string};
export class PromptReplyHttpError extends Error {
  constructor(message:string,readonly pendingRequest?:unknown){super(message);}
}
/** The browser owns only this HTTP wait. Its signal is never part of the worker payload. */
export async function promptReplyHttp(url:string,init:RequestInit,signal:AbortSignal):Promise<unknown>{
  const controller=new AbortController();
  const abort=()=>controller.abort();
  signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();
  const timeout=window.setTimeout(abort,15_000);
  try{
    const response=await fetch(url,{...init,credentials:'same-origin',cache:'no-store',signal:controller.signal});
    const payload=await response.json();
    if(controller.signal.aborted)throw new DOMException('Wait stopped','AbortError');
    if(!response.ok||!payload.ok)throw new PromptReplyHttpError(payload.error??'ASSISTANCE_UNAVAILABLE',payload.pendingRequest);
    return payload.result;
  }finally{window.clearTimeout(timeout);signal.removeEventListener('abort',abort);}
}
export function validatedPromptReply(value:unknown,identity:PromptReplyIdentity):PromptAssistanceResult{
  const result=value as PromptAssistanceResult;
  if(!result||result.sessionId!==identity.sessionId||result.requestId!==identity.requestId||!['pending','unknown','complete','failed'].includes(result.state))throw Error('INVALID_RESPONSE');
  if(result.deadlineAt!==undefined&&!Number.isFinite(Date.parse(result.deadlineAt)))throw Error('INVALID_RESPONSE');
  if(result.phase!==undefined&&!['queued','preparing','calling','recovering'].includes(result.phase))throw Error('INVALID_RESPONSE');
  if(result.state==='complete')promptAssistanceReplySchema.parse(result.reply);
  const action=assistanceNextActionSchema.safeParse(result.nextAction);
  return {...result,nextAction:action.success?action.data:undefined};
}
function pause(ms:number,signal:AbortSignal){return new Promise<void>((resolve,reject)=>{
  const abort=()=>{window.clearTimeout(timer);reject(new DOMException('Wait stopped','AbortError'));};
  const timer=window.setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},ms);
  signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();
});}
/** Serial reads; a slow GET is settled before another timer can start. Legacy requests have explicit checks. */
export async function pollPromptReply(identity:PromptReplyIdentity,signal:AbortSignal,onStatus:(result:PromptAssistanceResult)=>void,initial:PromptAssistanceResult):Promise<PromptAssistanceResult>{
  let result=validatedPromptReply(initial,identity);
  const deadline=Date.parse(identity.deadlineAt??result.deadlineAt??'');
  if(!Number.isFinite(deadline))return result;
  const controller=new AbortController();
  const abort=()=>controller.abort();signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();
  const timeout=window.setTimeout(abort,Math.max(0,deadline+30_000-Date.now()));
  try{
    while(result.state!=='complete'&&result.state!=='failed'){
      if(controller.signal.aborted)throw new DOMException('Wait stopped','AbortError');
      if(Date.now()>=deadline+30_000)throw Error('WAIT_DEADLINE');
      result=validatedPromptReply(await promptReplyHttp(`/api/prompt-assistance?sessionId=${encodeURIComponent(identity.sessionId)}&requestId=${encodeURIComponent(identity.requestId)}`,{},controller.signal),identity);
      if(Date.now()>=deadline+30_000)throw Error('WAIT_DEADLINE');
      onStatus(result);
      if(result.state==='complete'||result.state==='failed')return result;
      // Some historical unknown records have no bound; never invent a renewed budget.
      if(result.state==='unknown'&&!result.deadlineAt)return result;
      await pause(Math.min(2_000,Math.max(0,deadline+30_000-Date.now())),controller.signal);
    }
  }catch(error){if(!signal.aborted&&Date.now()>=deadline+30_000)throw Error('WAIT_DEADLINE');throw error;}
  finally{window.clearTimeout(timeout);signal.removeEventListener('abort',abort);}

  return result;
}
