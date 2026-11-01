import type {PromptAssistanceResult} from '@/lib/prompt-assistance/contract';
import {promptReplyHttp,validatedPromptReply,PromptReplyHttpError} from './prompt-assistance-polling';
import type {PreviousReplyRef} from './prompt-previous-reply-storage';

function pause(ms:number,signal:AbortSignal){return new Promise<void>((resolve,reject)=>{
  const abort=()=>{window.clearTimeout(timer);reject(new DOMException('Wait stopped','AbortError'));};
  const timer=window.setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},ms);
  signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();
});}

/** Observation only: never POST recovery, create an abandoned-request tombstone or settle a call. */
export async function observePreviousPromptReply(identity:PreviousReplyRef,signal:AbortSignal,onStatus:(result:PromptAssistanceResult)=>void){
  const admissionUntil=Date.parse(identity.observationStartedAt??'')+30_000;
  let deadline=Date.parse(identity.deadlineAt??'');
  let until=Number.isFinite(deadline)?deadline+30_000:admissionUntil;
  // An expired restored pointer still earns one read of real terminal evidence,
  // but never a fresh polling budget merely because it was mounted again.
  const once=!Number.isFinite(until)||until<=Date.now();
  const controller=new AbortController();
  const abort=()=>controller.abort();signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();
  let timeout:number|undefined;
  const arm=()=>{window.clearTimeout(timeout);if(!once)timeout=window.setTimeout(abort,Math.max(0,until-Date.now()));};
  arm();
  try{
    for(;;){
      let result:PromptAssistanceResult;
      try{
        result=validatedPromptReply(await promptReplyHttp(`/api/prompt-assistance?sessionId=${encodeURIComponent(identity.sessionId)}&requestId=${encodeURIComponent(identity.requestId)}`,{},controller.signal),identity);
      }catch(error){
        // Send may still be hashing or reaching admission when New chat retires
        // its HTTP wait. A missing row is uncertainty, never terminal failure.
        if(!once&&error instanceof PromptReplyHttpError&&error.message==='REQUEST_NOT_FOUND'&&Date.now()<admissionUntil){
          await pause(Math.min(2_000,admissionUntil-Date.now()),controller.signal);continue;
        }
        throw error;
      }
      if(controller.signal.aborted)throw new DOMException('Wait stopped','AbortError');
      onStatus(result);
      if(result.state==='complete'||result.state==='failed'||once||result.state==='unknown'&&!result.deadlineAt)return result;
      if(!Number.isFinite(deadline)&&result.deadlineAt){deadline=Date.parse(result.deadlineAt);until=deadline+30_000;arm();}
      if(!Number.isFinite(until)||Date.now()>=until)throw Error('WAIT_DEADLINE');
      await pause(Math.min(2_000,until-Date.now()),controller.signal);
    }
  }catch(error){if(!signal.aborted&&!once&&Date.now()>=until)throw Error('WAIT_DEADLINE');throw error;}
  finally{window.clearTimeout(timeout);signal.removeEventListener('abort',abort);}
}
