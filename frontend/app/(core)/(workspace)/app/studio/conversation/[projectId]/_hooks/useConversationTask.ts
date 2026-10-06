'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {studioTaskStatusSchema,type StudioTaskStatus} from '@/lib/studio/task-budget-contract';
export function useConversationTask(projectId:string,accountKey:string,task:StudioTaskStatus,onChanged:()=>void) {
  const session=useMemo(()=>({scope:`${accountKey}:${projectId}:${task.requestId}`,active:false,mutation:false,version:0,controller:null as AbortController|null}),[projectId,accountKey,task.requestId]);
  const current=useRef(session);current.current=session;
  const changed=useRef(onChanged);changed.current=onChanged;
  const [state,setState]=useState({owner:session,busy:false,error:null as string|null});
  const isCurrent=useCallback(()=>session.active&&current.current===session,[session]);
  useEffect(()=>{session.active=true;return()=>{session.active=false;session.version++;session.controller?.abort();};},[session]);
  const mutate=useCallback(async(action:'continue'|'extend'|'recover'|'cancel',maxCredits?:number)=>{
    if(!isCurrent()||session.mutation)return false;
    session.mutation=true;const version=++session.version,controller=new AbortController();session.controller=controller;
    setState({owner:session,busy:true,error:null});
    const key=`studio-task-approval:${accountKey}:${projectId}:${task.requestId}:${task.revision}:${action}:${maxCredits??0}`;
    const financial=action==='continue'||action==='extend';
    let approvalId=crypto.randomUUID();
    if(financial)try{const saved=sessionStorage.getItem(key);if(saved&&/^[\da-f-]{36}$/i.test(saved))approvalId=saved;else sessionStorage.setItem(key,approvalId);}catch{}
    const body={requestId:task.requestId,expectedRevision:task.revision,action,policyVersion:task.policyVersion,confirmed:true,...(financial?{approvalId,maxCredits}: {})};
    const timeout=window.setTimeout(()=>controller.abort(),20_000);
    try{
      const response=await fetch(`/api/studio/projects/${encodeURIComponent(projectId)}/conversation-tasks/${task.requestId}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:controller.signal});
      const payload=await response.json(),result=studioTaskStatusSchema.safeParse(payload.result);
      if(!response.ok||!payload.ok||!result.success||result.data.requestId!==task.requestId)throw new Error(payload.error??'STUDIO_TASK_UNAVAILABLE');
      if(!isCurrent()||version!==session.version)return false;
      setState({owner:session,busy:false,error:null});changed.current();return true;
    }catch(error){if(isCurrent()&&version===session.version)setState({owner:session,busy:false,error:error instanceof Error?error.message:'STUDIO_TASK_UNAVAILABLE'});return false;}
    finally{window.clearTimeout(timeout);if(version===session.version){session.mutation=false;if(isCurrent())setState(previous=>({...previous,busy:false}));}}
  },[accountKey,projectId,task.requestId,task.revision,task.policyVersion,isCurrent,session]);
  return {busy:state.owner===session&&state.busy,error:state.owner===session?state.error:null,mutate};
}
