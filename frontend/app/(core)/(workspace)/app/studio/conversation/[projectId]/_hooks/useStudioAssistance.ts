'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import type {StudioAssistanceChoice,StudioAssistanceStatus} from '@/lib/studio/assistance-contract';
import {assistanceStatusSchema} from '../_lib/conversation-assistance';
export function useStudioAssistance(accountKey:string,conversationBusy:boolean,options:{endpoint?:string;enabled?:boolean;wrapChoice?:boolean}={}) {
  const endpoint=options.endpoint??'/api/studio/assistance',enabled=options.enabled??true,wrapChoice=options.wrapChoice??false;
  const session=useMemo(()=>({accountKey,active:false,status:null as StudioAssistanceStatus|null,epoch:0,mutation:false,controller:null as AbortController|null}),[accountKey]);
  const current=useRef(session);current.current=session;
  const [state,setState]=useState<{owner:typeof session;status:StudioAssistanceStatus|null;busy:boolean;error:string|null}>({owner:session,status:null,busy:false,error:null});
  const isCurrent=useCallback(()=>session.active&&current.current===session,[session]);
  const update=useCallback((values:Partial<Omit<typeof state,'owner'>>)=>{if(isCurrent()){if('status' in values)session.status=values.status??null;setState(previous=>({...previous,...values,owner:session}));}},[isCurrent,session]);
  const refresh=useCallback(async()=>{
    if(!enabled||!isCurrent()||session.mutation)return;
    const version=++session.epoch;session.controller?.abort();const request=new AbortController();session.controller=request;
    const timeout=window.setTimeout(()=>request.abort(),20_000);
    try {
      const response=await fetch(endpoint,{cache:'no-store',signal:request.signal});const body=await response.json(),parsed=assistanceStatusSchema.safeParse(body.result);
      if(!response.ok||!body.ok||!parsed.success)throw new Error(response.status===401?'AUTH_REQUIRED':'UNAVAILABLE');
      if(isCurrent()&&session.epoch===version)update({status:parsed.data,error:null});
    }catch(failure){if(isCurrent()&&session.epoch===version)update(failure instanceof Error&&failure.message==='AUTH_REQUIRED'?{error:'AUTH_REQUIRED',status:null}:{error:'UNAVAILABLE'});}finally{window.clearTimeout(timeout);}
  },[isCurrent,session,update,enabled,endpoint]);
  useEffect(()=>{session.active=true;update({status:null,busy:false,error:null});void refresh();return()=>{session.active=false;session.epoch++;session.controller?.abort();};},[refresh,session,update]);
  const wasBusy=useRef(conversationBusy);
  useEffect(()=>{if(wasBusy.current&&!conversationBusy)void refresh();wasBusy.current=conversationBusy;},[conversationBusy,refresh]);
  const choose=useCallback(async(choice:StudioAssistanceChoice)=>{
    if(!enabled||session.mutation||!isCurrent())return false;
    session.mutation=true;update({busy:true,error:null});const version=++session.epoch;session.controller?.abort();const request=new AbortController();session.controller=request;
    const timeout=window.setTimeout(()=>request.abort(),20_000);
    try {
      const response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(wrapChoice?{action:'choose',choice}:choice),signal:request.signal});
      const body=await response.json(),parsed=assistanceStatusSchema.safeParse(body.result);
      if(!response.ok||!body.ok||!parsed.success)throw new Error(response.status===401?'AUTH_REQUIRED':body.error==='INSUFFICIENT_FUNDS'?'WALLET_INSUFFICIENT':body.error==='CONFIRMATION_REQUIRED'||body.error==='PARAMETER_INVALID'?'STALE':'UNAVAILABLE');
      if(!isCurrent()||version!==session.epoch)return false;
      update({status:parsed.data});return true;
    }catch(failure){if(isCurrent()&&version===session.epoch)update({...((failure instanceof Error&&failure.message==='AUTH_REQUIRED')?{status:null}:{}),error:failure instanceof Error&&['STALE','WALLET_INSUFFICIENT','AUTH_REQUIRED'].includes(failure.message)?failure.message:'UNAVAILABLE'});return false;}
    finally{window.clearTimeout(timeout);session.mutation=false;update({busy:false});}
  },[isCurrent,session,update,enabled,endpoint,wrapChoice]);
  return {getStatus:()=>isCurrent()?session.status:null,status:state.owner===session?state.status:null,busy:state.owner===session&&state.busy,error:state.owner===session?state.error:null,refresh,choose};
}
