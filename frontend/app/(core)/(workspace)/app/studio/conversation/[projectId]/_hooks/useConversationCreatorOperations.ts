'use client';

import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import type {ImageConversationTurn} from '@/lib/studio/image-conversation-contract';
import {studioCreatorOperationViewSchema,type StudioCreatorOperationView} from '@/lib/studio/conversation-creator-contract';
import {LIVE_PRICING_POLICY_REVISION,PRICING_POLICY_HEADER} from '@/lib/membership-policy';

type Input={projectId:string;accountKey:string;turn:ImageConversationTurn;onChange:()=>void|Promise<unknown>};
function attempted(key:string):boolean {
  try {return typeof window!=='undefined'&&window.sessionStorage.getItem(key)==='1';} catch {return false;}
}
function saveAttempt(key:string,value:boolean) {
  try {if(value)window.sessionStorage.setItem(key,'1');else window.sessionStorage.removeItem(key);} catch {
    // Server operation receipts remain authoritative when browser storage is unavailable.
  }
}
type LocalState={session:object;pending:boolean;uncertain:boolean;error:string|null;operation:StudioCreatorOperationView|null};
const activeStates=new Set(['queued','running','finalizing']);

/** Purchases only on an approval click. Reload, polling and recovery only reread the saved journal. */
export function useConversationCreatorOperations({projectId,accountKey,turn,onChange}:Input) {
  const quote=turn.creatorQuote;
  const operationId=quote?.operationId??turn.creatorOperation?.operationId??'';
  const toolId=quote?.toolId??turn.creatorOperation?.toolId;
  const requestId=turn.requestId;
  const session=useMemo(()=>({key:`maxvideoai.studio.creatorAttempt.${accountKey}:${projectId}:${requestId}:${operationId}`,
    confirming:false,reading:false}),[accountKey,projectId,requestId,operationId]);
  const current=useRef<typeof session|null>(session);current.current=session;
  const changed=useRef(onChange);changed.current=onChange;
  const initial=():LocalState=>({session,pending:false,uncertain:attempted(session.key),error:null,operation:null});
  const [state,setState]=useState<LocalState>(initial);
  const [clock,setClock]=useState(Date.now);
  const local=state.session===session?state:initial();
  const remote=turn.creatorOperation?.operationId===operationId&&turn.creatorOperation.toolId===toolId?turn.creatorOperation:null;
  const operation=remote&&remote.state!=='prepared'?remote:local.operation??remote;
  const expiresAt=quote?Date.parse(quote.expiresAt):Number.NaN;
  const expired=!!quote&&(!Number.isFinite(expiresAt)||expiresAt<=clock);
  const update=useCallback((next:Partial<LocalState>)=>{
    if(current.current===session)setState(previous=>({...previous,...(previous.session===session?{}:{
      pending:false,uncertain:attempted(session.key),error:null,operation:null,
    }),session,...next}));
  },[session]);
  useEffect(()=>{current.current=session;return()=>{if(current.current===session)current.current=null;};},[session]);
  useEffect(()=>{
    setClock(Date.now());
    if(!Number.isFinite(expiresAt))return;
    const remaining=expiresAt-Date.now();
    if(remaining<=0||remaining>2_147_483_647)return;
    const timer=window.setTimeout(()=>setClock(Date.now()),remaining+1);
    return()=>window.clearTimeout(timer);
  },[expiresAt]);
  const operationState=operation?.state;
  useEffect(()=>{
    if(operationState&&operationState!=='prepared'){
      saveAttempt(session.key,false);update({uncertain:false,error:null});
    }
  },[operationState,session,update]);

  const refresh=useCallback(async()=>{
    if(session.reading||current.current!==session)return;
    session.reading=true;
    try {await changed.current();} catch {update({error:'STATUS_UNAVAILABLE'});}
    finally {session.reading=false;}
  },[session,update]);
  const retrySeconds=operation?.retry.afterSeconds;
  const stateName=operation?.state;
  const needsAttention=operation?.needsAttention===true;
  useEffect(()=>{
    if(!stateName||!activeStates.has(stateName)||needsAttention||typeof retrySeconds!=='number'||retrySeconds<=0)return;
    let stopped=false;
    let timer:number;
    const poll=async()=>{
      if(stopped||current.current!==session)return;
      await refresh();
      if(!stopped&&current.current===session)timer=window.setTimeout(()=>void poll(),retrySeconds*1000);
    };
    timer=window.setTimeout(()=>void poll(),retrySeconds*1000);
    return()=>{stopped=true;window.clearTimeout(timer);};
  },[stateName,retrySeconds,needsAttention,session,refresh]);

  const confirm=useCallback(async()=>{
    if(!quote||session.confirming||local.uncertain||local.pending||expired||operation?.jobId
      ||operation?.needsAttention||operation?.confirmationEnabled===false||operation&&operation.state!=='prepared')return;
    session.confirming=true;saveAttempt(session.key,true);update({pending:true,uncertain:true,error:null});
    try {
      const response=await fetch(`/api/studio/projects/${encodeURIComponent(projectId)}/image-conversation/confirm`,{
        method:'POST',headers:{'Content-Type':'application/json',[PRICING_POLICY_HEADER]:LIVE_PRICING_POLICY_REVISION},
        body:JSON.stringify({requestId,confirmed:true,creator:{toolId:quote.toolId,operationId:quote.operationId,
          amountCents:quote.price.amountCents,currency:quote.price.currency}}),
      });
      const body=await response.json();
      if(current.current!==session)return;
      if(!response.ok||body.ok!==true){
        const definitive=response.status>=400&&response.status<500&&body.retryable!==true;
        if(definitive)saveAttempt(session.key,false);
        update({uncertain:!definitive,error:typeof body.error==='string'?body.error:'CONFIRMATION_UNAVAILABLE'});
        return;
      }
      const parsed=studioCreatorOperationViewSchema.safeParse(body.result);
      if(!parsed.success||parsed.data.operationId!==operationId||parsed.data.toolId!==toolId||parsed.data.state==='prepared'){
        update({error:'ACKNOWLEDGEMENT_UNAVAILABLE'});return;
      }
      saveAttempt(session.key,false);update({operation:parsed.data,uncertain:false,error:null});
    } catch {update({error:'ACKNOWLEDGEMENT_UNAVAILABLE'});}
    finally {
      session.confirming=false;
      if(current.current===session){update({pending:false});await refresh();}
    }
  },[quote,session,local.uncertain,local.pending,expired,operation,projectId,requestId,operationId,toolId,update,refresh]);
  return {operation,pending:local.pending,uncertain:local.uncertain,error:local.error,expired,confirm,refresh};
}
