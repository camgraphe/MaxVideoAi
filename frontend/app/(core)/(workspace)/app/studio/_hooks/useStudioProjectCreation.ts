'use client';

import {useCallback,useEffect,useRef,useState} from 'react';
import {authFetch} from '@/lib/authFetch';

type Attempt={name:string;idempotencyKey:string};
export function useStudioProjectCreation(accountKey:string,onCreated:(projectId:string)=>void) {
  const [busy,setBusy]=useState(false),[error,setError]=useState<'unauthorized'|'unavailable'|'error'|null>(null);
  const attempt=useRef<Attempt|null>(null),request=useRef<AbortController|null>(null),timer=useRef<number>();
  const callback=useRef(onCreated);callback.current=onCreated;
  const scope=useRef(accountKey);scope.current=accountKey;
  const storageKey=`studio-project-create:v1:${accountKey}`;
  useEffect(()=>()=>{request.current?.abort();request.current=null;window.clearTimeout(timer.current);},[accountKey]);
  const create=useCallback(async(name:string)=>{
    if(request.current)return;
    if(!attempt.current){
      try{
        const saved=JSON.parse(window.sessionStorage.getItem(storageKey)??'null');
        if(saved&&typeof saved.name==='string'&&saved.name.length<=240&&typeof saved.idempotencyKey==='string'&&/^studio-entry-[\w-]{10,100}$/.test(saved.idempotencyKey))attempt.current=saved;
      }catch{/* Storage is optional; the mounted attempt still has stable identity. */}
      attempt.current??={name,idempotencyKey:`studio-entry-${crypto.randomUUID()}`};
      try{window.sessionStorage.setItem(storageKey,JSON.stringify(attempt.current));}catch{}
    }
    const controller=new AbortController();request.current=controller;
    setBusy(true);setError(null);
    const timeout=window.setTimeout(()=>controller.abort(),20_000);timer.current=timeout;
    const current=()=>request.current===controller&&scope.current===accountKey;
    try{
      const response=await authFetch('/api/studio/conversation-projects',{method:'POST',headers:{'content-type':'application/json',Accept:'application/json'},body:JSON.stringify(attempt.current),signal:controller.signal});
      const payload=await response.json().catch(()=>null);
      if(!current())return;
      if(!response.ok||!payload?.ok||typeof payload.result?.projectId!=='string'||!payload.result.projectId.trim()){
        setError(response.status===401?'unauthorized':response.status===404?'unavailable':'error');
        request.current=null;setBusy(false);return;
      }
      try{window.sessionStorage.removeItem(storageKey);}catch{}
      callback.current(payload.result.projectId);
      // Keep this successful operation locked until navigation unmounts the owner.
    }catch{if(current()){setError('error');request.current=null;setBusy(false);}}
    finally{window.clearTimeout(timeout);}
  },[accountKey,storageKey]);
  return {busy,error,create};
}
