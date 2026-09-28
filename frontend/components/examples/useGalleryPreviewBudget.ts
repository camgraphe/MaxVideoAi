'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { selectPreviewIds } from './examples-discovery-layout';
export function useGalleryPreviewBudget(ids: string[], suspended=false) {
  const [visible,setVisible]=useState<Set<string>>(()=>new Set());
  const [intent,setIntent]=useState<string|null>(null);
  const [budget,setBudget]=useState(0);
  const [paused,setPaused]=useState(false);
  useEffect(()=>{
    const query=window.matchMedia('(min-width: 768px)');
    const sync=()=>setBudget(query.matches?3:1);
    sync(); query.addEventListener?.('change',sync);
    return ()=>query.removeEventListener?.('change',sync);
  },[]);
  const onVisibility=useCallback((id:string,inView:boolean)=>setVisible(previous=>{
    if(previous.has(id)===inView)return previous;
    const next=new Set(previous); if(inView)next.add(id);else next.delete(id);return next;
  }),[]);
  const active=useMemo(()=>new Set(selectPreviewIds(ids,visible,intent,budget,paused||suspended)),[ids,visible,intent,budget,paused,suspended]);
  return {active,onVisibility,setIntent,paused,togglePaused:()=>setPaused(value=>!value)};
}
