'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {studioExportAcknowledgementSchema,type StudioPreparedExport} from '@/lib/studio/conversation-export-contract';
import type {TimelineExportJobResponse} from '@/server/timeline-exports/contracts';
import {LIVE_PRICING_POLICY_REVISION,PRICING_POLICY_HEADER} from '@/lib/membership-policy';
const attemptKey=(quote:StudioPreparedExport)=>`maxvideoai.studio.exportAttempt.${quote.projectId}.${quote.quoteId}`;
function savedAttempt(key:string){try{return typeof window!=='undefined'&&window.sessionStorage.getItem(key)==='1';}catch{return false;}}
function storeAttempt(key:string,pending:boolean){try{if(pending)window.sessionStorage.setItem(key,'1');else window.sessionStorage.removeItem(key);}catch{/* Server receipts remain authoritative when browser storage is unavailable. */}}
export function usePreparedConversationExport(quote:StudioPreparedExport,jobs:TimelineExportJobResponse[],onChange:()=>void|Promise<void>){
  const key=attemptKey(quote);
  const [localJob,setLocalJob]=useState<TimelineExportJobResponse|null>(null);
  const [pending,setPending]=useState(false);
  const [uncertain,setUncertain]=useState(()=>savedAttempt(key));
  const [error,setError]=useState<string|null>(null);
  const [clock,setClock]=useState(Date.now);
  const inFlight=useRef(false);
  const job=jobs.find(candidate=>candidate.id===quote.exportId)??localJob;
  const expired=new Date(quote.expiresAt).getTime()<=clock;
  useEffect(()=>{setLocalJob(null);setUncertain(savedAttempt(key));setError(null);},[key]);
  useEffect(()=>{const timer=window.setInterval(()=>setClock(Date.now()),30000);return()=>window.clearInterval(timer);},[]);
  useEffect(()=>{if(job){storeAttempt(key,false);setUncertain(false);setError(null);}},[job,key]);
  const confirm=useCallback(async()=>{
    if(inFlight.current||job||(expired&&!uncertain))return;
    inFlight.current=true;setPending(true);setError(null);setUncertain(true);storeAttempt(key,true);
    try{
      const response=await fetch(`/api/studio/projects/${encodeURIComponent(quote.projectId)}/conversation-exports`,{method:'POST',headers:{'Content-Type':'application/json',[PRICING_POLICY_HEADER]:LIVE_PRICING_POLICY_REVISION},body:JSON.stringify({quoteId:quote.quoteId,confirmed:true})});
      const body=await response.json();
      if(!response.ok||!body.ok){
        const code=typeof body.error==='string'?body.error:'STUDIO_EXPORT_UNAVAILABLE';
        setError(code);
        // A definitive rejected quote cannot authorize an automatic replacement.
        if(response.status<500){storeAttempt(key,false);setUncertain(false);}
        return;
      }
      const acknowledged=studioExportAcknowledgementSchema.safeParse(body);
      if(!acknowledged.success||acknowledged.data.result.export.id!==quote.exportId){
        setError('ACKNOWLEDGEMENT_UNAVAILABLE');
        return;
      }
      setLocalJob(acknowledged.data.result.export);storeAttempt(key,false);setUncertain(false);
    }catch{setError('ACKNOWLEDGEMENT_UNAVAILABLE');}
    finally{inFlight.current=false;setPending(false);await onChange();}
  },[expired,uncertain,job,key,quote,onChange]);
  return {pending,uncertain,error,expired,job,confirm};
}
