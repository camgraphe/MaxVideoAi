'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import type {ImageConversationTurn} from '@/lib/studio/image-conversation-contract';

/** Complete only the already-confirmed, server-frozen edit; no chat call or paid action. */
export function useConversationExtensions(projectId:string,accountKey:string,turns:ImageConversationTurn[],enabled:boolean,onChanged:()=>Promise<unknown>) {
  const session=useMemo(()=>({projectId,accountKey,attempted:new Set<string>()}),[projectId,accountKey]);
  const current=useRef<typeof session|null>(session);current.current=session;
  const changed=useRef(onChanged);changed.current=onChanged;
  const [state,setState]=useState<{session:typeof session;errors:Record<string,string>}>({session,errors:{}});
  const [retryVersion,setRetryVersion]=useState(0);
  useEffect(()=>{current.current=session;return()=>{if(current.current===session)current.current=null;};},[session]);
  useEffect(()=>{
    if(!enabled)return;
    for(const turn of turns){
      if(turn.extensionAssembly?.state!=='pending'||turn.generation?.status!=='completed'||session.attempted.has(turn.requestId))continue;
      session.attempted.add(turn.requestId);
      void(async()=>{
        try{
          // Providers may complete the job before projecting its ready output.
          // Retry only that explicit state, for at most 56 seconds; never resubmit generation.
          const delays=[1000,3000,7000,15000,30000];
          for(let attempt=0;;attempt++){
            if(current.current!==session)return;
            const response=await fetch(`/api/studio/projects/${encodeURIComponent(projectId)}/conversation-timeline/extension`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({requestId:turn.requestId})});
            const payload=await response.json();
            if(response.ok&&payload.ok)break;
            if(payload.error==='EXTENSION_NOT_READY'&&payload.retryable===true&&attempt<delays.length){
              await new Promise(resolve=>setTimeout(resolve,delays[attempt]));
              continue;
            }
            throw new Error(typeof payload.error==='string'?payload.error:'EXTENSION_ASSEMBLY_FAILED');
          }
          if(current.current!==session)return;
          setState(previous=>({session,errors:Object.fromEntries(Object.entries(previous.session===session?previous.errors:{}).filter(([id])=>id!==turn.requestId))}));
          await changed.current();
        }catch(error){if(current.current===session)setState(previous=>({session,errors:{...(previous.session===session?previous.errors:{}),[turn.requestId]:error instanceof Error?error.message:'EXTENSION_ASSEMBLY_FAILED'}}));}
      })();
    }
  },[enabled,projectId,session,turns,retryVersion]);
  return {errors:state.session===session?state.errors:{},retry:(requestId:string)=>{session.attempted.delete(requestId);setRetryVersion(value=>value+1);}};
}
