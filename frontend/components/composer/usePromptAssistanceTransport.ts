'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {promptAssistanceReplySchema,type PromptAssistanceRequest,type PromptAssistanceResult} from '@/lib/prompt-assistance/contract';

type Pending={sessionId:string;requestId:string;uiId:number|null};
export function usePromptAssistanceTransport(scopeKey:string,enabled:boolean,onResult:(result:PromptAssistanceResult,uiId:number|null)=>void){
  const owner=useMemo(()=>({key:scopeKey,active:false,sessionId:'',pending:null as Pending|null,controller:null as AbortController|null,waiting:false}),[scopeKey]);
  const current=useRef(owner);current.current=owner;
  const callback=useRef(onResult);callback.current=onResult;
  const [view,setView]=useState({owner,waiting:false,recovery:false,error:null as string|null});
  const storageKey=`milo-composer:${scopeKey}`;
  const active=()=>owner.active&&current.current===owner;
  const update=(values:Partial<Omit<typeof view,'owner'>>)=>{if(active())setView(previous=>({...previous,...values,owner}));};
  function save(){try{sessionStorage.setItem(storageKey,JSON.stringify({sessionId:owner.sessionId,pending:owner.pending?{sessionId:owner.pending.sessionId,requestId:owner.pending.requestId}:null}));}catch{/* Storage may be disabled; in-memory replay remains available. */}}
  useEffect(()=>{
    owner.active=true;
    if(enabled)try{const saved=JSON.parse(sessionStorage.getItem(storageKey)??'null');if(saved?.pending&&typeof saved.sessionId==='string'&&/^[a-f0-9-]{36}$/.test(saved.sessionId)&&/^[a-f0-9-]{36}$/.test(saved.pending.requestId)){owner.sessionId=saved.sessionId;owner.pending={sessionId:owner.sessionId,requestId:saved.pending.requestId,uiId:null};}}catch{}
    setView({owner,waiting:false,recovery:!!owner.pending,error:owner.pending?'RECOVERY_AVAILABLE':null});
    return()=>{owner.active=false;owner.controller?.abort();};
  },[owner,enabled,storageKey]);
  async function perform(body:unknown,pending:Pending){
    if(!active()||owner.waiting)return;
    owner.waiting=true;owner.controller=new AbortController();update({waiting:true,error:null});
    const timeout=window.setTimeout(()=>owner.controller?.abort(),100_000);
    try{
      const response=await fetch('/api/prompt-assistance',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:owner.controller.signal});
      const payload=await response.json();
      if(!response.ok||!payload.ok){
        // These route/claim rejections happen before this identity can reserve or dispatch a call.
        const rejected=['INVALID_REQUEST','BODY_TOO_LARGE','SAME_ORIGIN_REQUIRED','AUTH_REQUIRED','EMAIL_VERIFICATION_REQUIRED','ASSISTANCE_DISABLED','SESSION_EXPIRED','SESSION_FULL','SESSION_SCOPE_CHANGED','REQUEST_CLOSED','REQUEST_PENDING'].includes(payload.error);
        if(rejected&&active()){
          owner.pending=null;
          if(['SESSION_EXPIRED','SESSION_FULL','SESSION_SCOPE_CHANGED'].includes(payload.error))owner.sessionId='';
          save();update({recovery:false,error:payload.error});
          callback.current({sessionId:pending.sessionId,requestId:pending.requestId,draftRevision:0,target:'prompt',message:'',state:'failed',error:payload.error} as PromptAssistanceResult,pending.uiId);
          return;
        }
        throw new Error(payload.error??'ASSISTANCE_UNAVAILABLE');
      }
      const result=payload.result as PromptAssistanceResult;
      if(result.sessionId!==pending.sessionId||result.requestId!==pending.requestId||!['pending','unknown','complete','failed'].includes(result.state))throw new Error('INVALID_RESPONSE');
      if(result.state==='complete')promptAssistanceReplySchema.parse(result.reply);
      if(!active())return;
      if(result.state==='complete'||result.state==='failed'){
        // Reloads recover the outstanding reply, then start fresh: never send hidden old chat history.
        if(pending.uiId===null)owner.sessionId='';
        owner.pending=null;save();update({recovery:false,error:result.state==='failed'?result.error??'ASSISTANCE_UNAVAILABLE':null});callback.current(result,pending.uiId);
      }else update({recovery:true,error:result.state==='unknown'?'USAGE_UNRESOLVED':'REQUEST_PENDING'});
    }catch(error){if(active())update({recovery:true,error:error instanceof Error&&error.name==='AbortError'?'WAIT_STOPPED':error instanceof Error?error.message:'ASSISTANCE_UNAVAILABLE'});}
    finally{window.clearTimeout(timeout);owner.waiting=false;update({waiting:false});}
  }
  function send(request:Omit<PromptAssistanceRequest,'sessionId'|'requestId'>,uiId:number){
    if(!enabled||!active()||owner.pending||owner.waiting)return false;
    owner.sessionId ||= crypto.randomUUID();
    const pending={sessionId:owner.sessionId,requestId:crypto.randomUUID(),uiId};owner.pending=pending;save();update({recovery:false,error:null});
    void perform({action:'message',request:{...request,sessionId:pending.sessionId,requestId:pending.requestId}},pending);return true;
  }
  function recover(){if(owner.pending)void perform({action:'recover',sessionId:owner.pending.sessionId,requestId:owner.pending.requestId},owner.pending);}
  return {send,recover,stop:()=>owner.controller?.abort(),waiting:view.owner===owner&&view.waiting,recovery:view.owner===owner&&view.recovery,error:view.owner===owner?view.error:null};
}
