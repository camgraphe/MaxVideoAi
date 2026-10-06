'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {studioAnalysisStatusSchema,type StudioPreparedAnalysis,type StudioAnalysisStatus} from '@/lib/studio/media-analysis-contract';

export function useConversationAnalysis(projectId:string,accountKey:string,quote:StudioPreparedAnalysis){
  const session=useMemo(()=>({scope:`${accountKey}:${projectId}:${quote.analysisId}`,active:false,version:0,mutation:false,reading:false,controller:null as AbortController|null}),[projectId,accountKey,quote.analysisId]);
  const current=useRef(session);current.current=session;
  const [state,setState]=useState<{owner:typeof session;status:StudioAnalysisStatus|null;busy:boolean;error:string|null}>({owner:session,status:null,busy:false,error:null});
  const isCurrent=useCallback(()=>session.active&&current.current===session,[session]);
  const update=useCallback((value:Partial<Omit<typeof state,'owner'>>)=>{if(isCurrent())setState(previous=>({...previous,...value,owner:session}));},[isCurrent,session]);
  const endpoint=`/api/studio/projects/${encodeURIComponent(projectId)}/analyses/${encodeURIComponent(quote.analysisId)}`;
  const request=useCallback(async(confirm:boolean)=>{
    if(!isCurrent()||session.mutation||session.reading&&!confirm)return false;
    if(confirm){session.mutation=true;session.controller?.abort();update({busy:true,error:null});}else session.reading=true;
    const version=++session.version;const controller=new AbortController();session.controller=controller;
    const timeout=window.setTimeout(()=>controller.abort(),20_000);
    try{
      const response=await fetch(endpoint,confirm?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({analysisId:quote.analysisId,maxCredits:quote.maxCredits,policyVersion:quote.policyVersion,confirmed:true}),signal:controller.signal}:{cache:'no-store',signal:controller.signal});
      const body=await response.json(),parsed=studioAnalysisStatusSchema.safeParse(body.result);
      if(!response.ok||!body.ok||!parsed.success||parsed.data.quote.analysisId!==quote.analysisId)throw new Error(typeof body.message==='string'?body.message:'Analysis status unavailable. Refresh before trying again.');
      if(!isCurrent()||version!==session.version)return false;
      update({status:parsed.data,error:null});return true;
    }catch(error){if(isCurrent()&&version===session.version)update({error:error instanceof Error?error.message:'Analysis unavailable.'});return false;}
    finally{window.clearTimeout(timeout);if(confirm){session.mutation=false;update({busy:false});}else session.reading=false;}
  },[endpoint,isCurrent,quote.analysisId,quote.maxCredits,quote.policyVersion,session,update]);
  useEffect(()=>{session.active=true;update({status:null,busy:false,error:null});void request(false);return()=>{session.active=false;session.version++;session.controller?.abort();};},[request,session,update]);
  const status=state.owner===session?state.status:null;
  const analysisState=status?.state;
  useEffect(()=>{if(!analysisState||!['queued','running'].includes(analysisState))return;const timer=window.setInterval(()=>{void request(false);},3000);return()=>window.clearInterval(timer);},[request,analysisState]);
  return {status,busy:state.owner===session&&state.busy,error:state.owner===session?state.error:null,refresh:()=>request(false),confirm:()=>request(true)};
}
