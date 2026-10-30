'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {studioAnalysisStatusSchema,type StudioAnalysisStatus} from '@/lib/studio/media-analysis-contract';

import {readAnalysisIdentity} from './prompt-chat-storage';

const inFlight=(status:StudioAnalysisStatus|null)=>!!status&&['queued','running','unknown'].includes(status.state);
/** Durable identity only in storage. Observations and private reference data stay on the server. */
export function usePromptReferenceAnalysis(scopeKey:string,onCompleted:()=>void,onBusy:(busy:boolean)=>void,legacyScopeKey?:string) {
  const storageKey=`milo-analysis:${scopeKey}`;
  const legacyStorageKey=legacyScopeKey?`milo-analysis:${legacyScopeKey}`:null;
  const owner=useMemo(()=>({key:scopeKey,active:false,busy:false,identity:readAnalysisIdentity(storageKey)??(legacyStorageKey?readAnalysisIdentity(legacyStorageKey):null)}),[scopeKey,storageKey,legacyStorageKey]);
  const current=useRef(owner);current.current=owner;
  const callbacks=useRef({onCompleted,onBusy});callbacks.current={onCompleted,onBusy};
  const completed=useRef('');
  const [view,setView]=useState({owner,status:null as StudioAnalysisStatus|null,busy:false,error:null as string|null,recover:!!owner.identity,reused:false});
  const active=()=>owner.active&&current.current===owner;
  function update(values:Partial<typeof view>){if(active())setView(previous=>({...previous,...values,owner}));}
  function save(){try{if(owner.identity)sessionStorage.setItem(storageKey,JSON.stringify(owner.identity));else sessionStorage.removeItem(storageKey);}catch{}}
  function accept(status:StudioAnalysisStatus){
    update({status,recover:false,error:null});
    if(status.state==='completed'&&completed.current!==status.quote.analysisId){completed.current=status.quote.analysisId;callbacks.current.onCompleted();}
    if(status.state==='prepared'||status.state==='completed'||status.state==='failed'){
      if(legacyStorageKey&&readAnalysisIdentity(legacyStorageKey)?.analysisId===status.quote.analysisId)try{sessionStorage.removeItem(legacyStorageKey);}catch{}
      // A server-confirmed quote has not started work. Keep it in memory for confirmation,
      // but it must not lock New chat as though usage were still unresolved.
      if(status.state==='prepared'){try{sessionStorage.removeItem(storageKey);}catch{}}
      else{owner.identity=null;save();}
    }
  }
  async function request(body?:unknown,identity=owner.identity){
    if(!active()||owner.busy||(!body&&!identity))return;
    owner.busy=true;update({busy:true,error:null});
    const controller=new AbortController(),timeout=window.setTimeout(()=>controller.abort(),30_000);
    try {
      const url='/api/prompt-assistance/analyses'+(body?'':`?sessionId=${identity!.sessionId}&analysisId=${identity!.analysisId}`);
      const response=await fetch(url,{method:body?'POST':'GET',credentials:'same-origin',headers:body?{'content-type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,signal:controller.signal});
      const data=await response.json();
      if(!response.ok||!data.ok){
        const messages:Record<string,string>={REFERENCE_DURATION_UNKNOWN:'This reference has no verified duration yet. Choose it again from Media.',REFERENCE_INVALID:'This reference is no longer available. Choose it again from Media.',SESSION_EXPIRED:'Start a new conversation, then review the analysis cost again.',INVALID_REQUEST:'Check the selected reference and time interval.',ANALYSIS_UNAVAILABLE:'Reference analysis is not available right now.',SPENDING_LIMIT_EXCEEDED:'Check your Milo credits before analyzing this reference.'};
        throw new Error(data.message??messages[data.error]??'Could not read the analysis. Check your connection and try again.');
      }
      const status=studioAnalysisStatusSchema.parse(data.result.status);
      if(!active())return;
      if(identity&&status.quote.analysisId!==identity.analysisId)throw new Error('Unexpected analysis identity.');
      if(body&&(body as {action:string}).action==='prepare'){
        owner.identity={sessionId:data.result.sessionId,analysisId:status.quote.analysisId};
        if(typeof owner.identity.sessionId!=='string')throw new Error('Invalid analysis session.');
        update({reused:!!data.result.reused});
      }
      accept(status);
    }catch(error){update({error:error instanceof Error?error.message:'Analysis is unavailable.',recover:!!owner.identity});}
    finally{window.clearTimeout(timeout);owner.busy=false;update({busy:false});}
  }
  useEffect(()=>{
    owner.active=true;
    if(owner.identity)save();
    if(owner.identity)void request();
    return()=>{owner.active=false;callbacks.current.onBusy(false);};
    // Owner fences late replies on account/workspace changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[owner]);
  const visible=view.owner===owner?view:{status:null,busy:false,error:null,recover:!!owner.identity,reused:false};
  const pending=inFlight(visible.status)||visible.recover;
  useEffect(()=>{callbacks.current.onBusy(visible.busy||pending);},[visible.busy,pending]);
  useEffect(()=>{
    if(!visible.status||!['queued','running'].includes(visible.status.state)||visible.error)return;
    const timer=window.setTimeout(()=>void request(),2000);return()=>window.clearTimeout(timer);
    // Each successful read schedules the next read. No automatic POST retries.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[visible.status,visible.error,owner]);
  return {...visible,pending,
    prepare:(body:unknown)=>{if(pending)return;owner.identity=null;void request(body);},
    confirm:()=>{
      if(!visible.status||visible.status.state!=='prepared'||!owner.identity)return;
      save();const quote=visible.status.quote;
      void request({action:'confirm',sessionId:owner.identity.sessionId,confirmation:{analysisId:quote.analysisId,maxCredits:quote.maxCredits,policyVersion:quote.policyVersion,confirmed:true}},owner.identity);
    },
    refresh:()=>void request(),
    reset:()=>{if(!owner.busy&&!pending){owner.identity=null;save();update({status:null,error:null,recover:false,reused:false});}},
  };
}
