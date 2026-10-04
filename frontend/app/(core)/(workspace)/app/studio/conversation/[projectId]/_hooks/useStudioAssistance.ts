'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import type {StudioAssistanceChoice,StudioAssistanceStatus} from '@/lib/studio/assistance-contract';
import {assistanceStatusSchema} from '../_lib/conversation-assistance';
export function useStudioAssistance(accountKey:string,conversationBusy:boolean) {
  const session=useMemo(()=>({accountKey,active:false,epoch:0,mutation:false,controller:null as AbortController|null}),[accountKey]);
  const current=useRef(session);current.current=session;
  const [state,setState]=useState<{owner:typeof session;status:StudioAssistanceStatus|null;busy:boolean;error:string|null}>({owner:session,status:null,busy:false,error:null});
  const isCurrent=useCallback(()=>session.active&&current.current===session,[session]);
  const update=useCallback((values:Partial<Omit<typeof state,'owner'>>)=>{if(isCurrent())setState(previous=>({...previous,...values,owner:session}));},[isCurrent,session]);
  const refresh=useCallback(async()=>{
    if(!isCurrent()||session.mutation)return;
    const version=++session.epoch;session.controller?.abort();const request=new AbortController();session.controller=request;
    const timeout=window.setTimeout(()=>request.abort(),20_000);
    try {
      const response=await fetch('/api/studio/assistance',{cache:'no-store',signal:request.signal});const body=await response.json(),parsed=assistanceStatusSchema.safeParse(body.result);
      if(!response.ok||!body.ok||!parsed.success)throw new Error('UNAVAILABLE');
      if(isCurrent()&&session.epoch===version)update({status:parsed.data,error:null});
    }catch{if(isCurrent()&&session.epoch===version)update({error:'UNAVAILABLE'});}finally{window.clearTimeout(timeout);}
  },[isCurrent,session,update]);
  useEffect(()=>{session.active=true;update({status:null,busy:false,error:null});void refresh();return()=>{session.active=false;session.epoch++;session.controller?.abort();};},[refresh,session,update]);
  const wasBusy=useRef(conversationBusy);
  useEffect(()=>{if(wasBusy.current&&!conversationBusy)void refresh();wasBusy.current=conversationBusy;},[conversationBusy,refresh]);
  const choose=useCallback(async(choice:StudioAssistanceChoice)=>{
    if(session.mutation||!isCurrent())return false;
    session.mutation=true;update({busy:true,error:null});const version=++session.epoch;session.controller?.abort();const request=new AbortController();session.controller=request;
    const timeout=window.setTimeout(()=>request.abort(),20_000);
    try {
      const response=await fetch('/api/studio/assistance',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(choice),signal:request.signal});
      const body=await response.json(),parsed=assistanceStatusSchema.safeParse(body.result);
      if(!response.ok||!body.ok||!parsed.success)throw new Error(body.error==='CONFIRMATION_REQUIRED'?'STALE':'UNAVAILABLE');
      if(!isCurrent()||version!==session.epoch)return false;
      update({status:parsed.data});return true;
    }catch(failure){if(isCurrent()&&version===session.epoch)update({error:failure instanceof Error&&failure.message==='STALE'?'STALE':'UNAVAILABLE'});return false;}
    finally{window.clearTimeout(timeout);session.mutation=false;update({busy:false});}
  },[isCurrent,session,update]);
  return {status:state.owner===session?state.status:null,busy:state.owner===session&&state.busy,error:state.owner===session?state.error:null,refresh,choose};
}
