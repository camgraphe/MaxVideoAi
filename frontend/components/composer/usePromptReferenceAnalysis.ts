'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {STUDIO_ANALYSIS_PILOT_HEADER,studioAnalysisStatusSchema,type StudioAnalysisStatus} from '@/lib/studio/media-analysis-contract';
import {readAnalysisIdentity} from './prompt-chat-storage';

type StartRequest={action:'prepare'|'startRecommended';sessionId:string;requestId:string};
const inFlight=(status:StudioAnalysisStatus|null)=>!!status&&['queued','running','unknown'].includes(status.state);
class AnalysisResponseError extends Error {
  constructor(message:string,readonly code:string|null,readonly status:number){super(message);}
}
/** A request key can recover a sponsored admission even when its acknowledgement is lost. */
export function usePromptReferenceAnalysis(scopeKey:string,onCompleted:()=>void,onBusy:(busy:boolean)=>void,legacyScopeKey?:string) {
  const storageKey=`milo-analysis:${scopeKey}`;
  const legacyStorageKey=legacyScopeKey?`milo-analysis:${legacyScopeKey}`:null;
  const owner=useMemo(()=>({
    active:false,busy:false,startRequest:null as StartRequest|null,
    identity:readAnalysisIdentity(storageKey)??(legacyStorageKey?readAnalysisIdentity(legacyStorageKey):null),
  }),[storageKey,legacyStorageKey]);
  const current=useRef(owner);current.current=owner;
  const callbacks=useRef({onCompleted,onBusy});callbacks.current={onCompleted,onBusy};
  const completed=useRef('');
  const initialView=()=>({owner,status:null as StudioAnalysisStatus|null,busy:false,error:null as string|null,errorCode:null as string|null,recover:!!owner.identity&&!owner.identity.nonBlocking,reused:false});
  const [view,setView]=useState(initialView);
  const active=()=>owner.active&&current.current===owner;
  function update(values:Partial<typeof view>){if(active())setView(previous=>({...previous,...values,owner}));}
  function save(){try{if(owner.identity)sessionStorage.setItem(storageKey,JSON.stringify(owner.identity));else sessionStorage.removeItem(storageKey);}catch{}}
  function accept(status:StudioAnalysisStatus){
    const terminal=status.state==='completed'||status.state==='failed';
    if(!status.quote.confirmationRequired&&owner.identity&&(terminal||status.state==='unknown')){
      owner.identity={sessionId:owner.identity.sessionId,analysisId:status.quote.analysisId,nonBlocking:true};
    }
    if(status.state==='prepared'||terminal){
      if(legacyStorageKey&&readAnalysisIdentity(legacyStorageKey)?.analysisId===status.quote.analysisId)try{sessionStorage.removeItem(legacyStorageKey);}catch{}
      if(terminal&&status.quote.confirmationRequired)owner.identity=null;
    }
    if(status.state==='prepared'){try{sessionStorage.removeItem(storageKey);}catch{}}
    else save();
    update({status,recover:false,error:null,errorCode:null});
    if(status.state==='completed'&&completed.current!==status.quote.analysisId){
      completed.current=status.quote.analysisId;callbacks.current.onCompleted();
    }
  }
  async function request(body?:unknown,identity=owner.identity){
    if(!active()||owner.busy||(!body&&!identity))return;
    const action=(body as {action?:string}|undefined)?.action;
    const preparedConfirmation=action==='confirm'&&view.owner===owner&&view.status?.state==='prepared'&&view.status.quote.analysisId===identity?.analysisId?view.status:null;
    owner.busy=true;update({busy:true,error:null,errorCode:null});
    const controller=new AbortController(),timeout=window.setTimeout(()=>controller.abort(),30_000);
    try {
      const search=identity?new URLSearchParams({
        sessionId:identity.sessionId,
        ...(identity.analysisId?{analysisId:identity.analysisId}:{requestId:identity.requestId!}),
      }):null;
      const url='/api/prompt-assistance/analyses'+(!body&&search?'?'+search:'');
      const headers={[STUDIO_ANALYSIS_PILOT_HEADER]:'1',...(body?{'content-type':'application/json'}:{})};
      const response=await fetch(url,{method:body?'POST':'GET',credentials:'same-origin',headers,body:body?JSON.stringify(body):undefined,signal:controller.signal});
      const data=await response.json();
      if(!response.ok||!data.ok){
        const messages:Record<string,string>={REFERENCE_DURATION_UNKNOWN:'Milo could not verify this reference’s duration. No analysis started. Keep the original selected and retry verification, or choose another saved original.',REFERENCE_INVALID:'This reference is no longer available. Choose it again from Media.',SESSION_EXPIRED:'Start a new conversation, then review the analysis cost again.',INVALID_REQUEST:'Check the selected reference and time interval.',ANALYSIS_UNAVAILABLE:'Reference analysis is not available right now.',SPENDING_LIMIT_EXCEEDED:'Check your Milo credits before analyzing this reference.'};
        throw new AnalysisResponseError(data.message??messages[data.error]??'Could not read the analysis. Check your connection and try again.',typeof data.error==='string'?data.error:null,response.status);
      }
      if(!active())return;
      if(data.result.status===null&&identity?.requestId&&!body){
        update({error:'No saved analysis was found for this request.',errorCode:'ANALYSIS_NOT_SAVED',recover:true});
        return;
      }
      const status=studioAnalysisStatusSchema.parse(data.result.status);
      if(identity?.analysisId&&status.quote.analysisId!==identity.analysisId)throw new Error('Unexpected analysis identity.');
      if(action==='prepare'||action==='startRecommended'||identity?.requestId){
        const sessionId=data.result.sessionId;
        if(typeof sessionId!=='string'||identity&&sessionId!==identity.sessionId)throw new Error('Invalid analysis session.');
        owner.identity={sessionId,analysisId:status.quote.analysisId};
        owner.startRequest=null;
        update({reused:!!data.result.reused});
      }
      accept(status);
    }catch(error){
      if(!active())return;
      const fundingRejected=preparedConfirmation&&error instanceof AnalysisResponseError&&error.code==='SPENDING_LIMIT_EXCEEDED'&&[402,409].includes(error.status);
      if(fundingRejected)accept(preparedConfirmation);
      // Only explicit pre-admission rejection can clear a pending request key.
      if(body&&identity?.requestId&&error instanceof AnalysisResponseError&&[400,401,403,404,409].includes(error.status)){
        owner.identity=null;owner.startRequest=null;save();
      }
      update({error:error instanceof Error?error.message:'Analysis is unavailable.',errorCode:error instanceof AnalysisResponseError?error.code:null,recover:!fundingRejected&&!!owner.identity&&!owner.identity.nonBlocking});
    }
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
  const visible=view.owner===owner?view:initialView();
  const pending=inFlight(visible.status)||visible.recover;
  const blocking=visible.busy||pending&&!owner.identity?.nonBlocking;
  useEffect(()=>{callbacks.current.onBusy(blocking);},[blocking]);
  useEffect(()=>{
    if(!visible.status||!['queued','running'].includes(visible.status.state)||visible.error)return;
    const timer=window.setTimeout(()=>void request(),2000);return()=>window.clearTimeout(timer);
    // Each successful read schedules the next read. No automatic POST retries.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[visible.status,visible.error,owner]);
  const missing=visible.errorCode==='ANALYSIS_NOT_SAVED';
  const retry=owner.startRequest??(owner.identity?.recommended&&owner.identity.requestId
    ?{action:'startRecommended',sessionId:owner.identity.sessionId,requestId:owner.identity.requestId}:null);
  function clear(){
    owner.identity=null;owner.startRequest=null;save();
    update({status:null,error:null,errorCode:null,recover:false,reused:false});
  }
  return {...visible,pending,missing,
    prepare:<T extends StartRequest>(body:T,sponsored=false)=>{
      if(pending||owner.busy)return;
      owner.startRequest=sponsored?body:null;
      owner.identity=sponsored?{sessionId:body.sessionId,requestId:body.requestId,...(body.action==='startRecommended'?{recommended:true}:{})}:null;
      save();
      void request(body);
    },
    retry:missing&&retry?()=>void request(retry):null,
    clearMissing:()=>{if(missing&&!owner.busy)clear();},
    confirm:()=>{
      if(!visible.status||visible.status.state!=='prepared'||!owner.identity)return;
      save();const quote=visible.status.quote;
      void request({action:'confirm',sessionId:owner.identity.sessionId,confirmation:{analysisId:quote.analysisId,maxCredits:quote.maxCredits,policyVersion:quote.policyVersion,confirmed:true}},owner.identity);
    },
    refresh:()=>void request(),
    reset:()=>{if(!owner.busy&&!pending)clear();},
  };
}
