'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { selectPreviewIds } from './examples-discovery-layout';
export function useGalleryPreviewBudget(ids: string[], suspended=false) {
  const [visible,setVisible]=useState<Set<string>>(()=>new Set());
  const [intent,setIntent]=useState<string|null>(null);
  const [budget,setBudget]=useState(0);
  const [userPaused,setUserPaused]=useState(false);
  const [mobileActivated,setMobileActivated]=useState(false);
  useEffect(()=>{
    const query=window.matchMedia('(min-width: 768px)');
    const sync=()=>setBudget(query.matches?3:1);
    sync(); query.addEventListener?.('change',sync);
    return ()=>query.removeEventListener?.('change',sync);
  },[]);
  useEffect(()=>{
    if(budget!==1||mobileActivated)return;
    const activate=()=>setMobileActivated(true);
    window.addEventListener('touchmove',activate,{passive:true});
    window.addEventListener('wheel',activate,{passive:true});
    return ()=>{
      window.removeEventListener('touchmove',activate);
      window.removeEventListener('wheel',activate);
    };
  },[budget,mobileActivated]);
  const onVisibility=useCallback((id:string,inView:boolean)=>setVisible(previous=>{
    if(previous.has(id)===inView)return previous;
    const next=new Set(previous); if(inView)next.add(id);else next.delete(id);return next;
  }),[]);
  const paused=userPaused||(budget===1&&!mobileActivated);
  const active=useMemo(()=>new Set(selectPreviewIds(ids,visible,intent,budget,paused||suspended)),[ids,visible,intent,budget,paused,suspended]);
  const togglePaused=useCallback(()=>{
    if(budget===1&&!mobileActivated){setMobileActivated(true);setUserPaused(false);return;}
    setUserPaused(value=>!value);
  },[budget,mobileActivated]);
  return {active,onVisibility,setIntent,paused,togglePaused};
}
