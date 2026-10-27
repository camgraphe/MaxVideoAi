'use client';
import {useState} from 'react';
import type {CanonicalGenerationMultiPromptScene} from '@/server/agent-api/generation-types';

/** Edits a new conversational request. Never changes or confirms the saved quote. */
export function StudioShotPlanEditor({engineId,shots,locale,busy,onEditing,onDraft}:{
  engineId:string;shots:readonly CanonicalGenerationMultiPromptScene[];locale:'en'|'fr';busy:boolean;
  onEditing:()=>void;onDraft:(shots:CanonicalGenerationMultiPromptScene[])=>void;
}) {
  const [editing,setEditing]=useState(false);
  const [draft,setDraft]=useState(()=>shots.map(shot=>({...shot})));
  const t=(en:string,fr:string)=>locale==='fr'?fr:en;
  const v4=engineId==='kling-v4';
  const maxDuration=v4?30:15;const maxShots=v4?30:6;const minDuration=3;
  const total=draft.reduce((sum,shot)=>sum+shot.durationSec,0);
  const valid=draft.length>0&&draft.length<=maxShots&&total>=minDuration&&total<=maxDuration
    &&draft.every(shot=>shot.prompt.trim().length>0&&shot.prompt.trim().length<=512&&Number.isSafeInteger(shot.durationSec)&&shot.durationSec>=1&&shot.durationSec<=maxDuration);
  const update=(index:number,patch:Partial<CanonicalGenerationMultiPromptScene>)=>setDraft(current=>current.map((shot,i)=>i===index?{...shot,...patch}:shot));
  if(!editing)return <button type="button" disabled={busy} onClick={()=>{setEditing(true);onEditing();}}>{t('Edit shot plan','Modifier le plan de séquences')}</button>;
  return <fieldset disabled={busy} style={{display:'grid',gap:12}}>
    <legend>{t('New shot plan','Nouveau plan de séquences')}</legend>
    {draft.map((shot,index)=><div key={index} style={{display:'grid',gap:6}}>
      <label>{t('Shot','Plan')} {index+1}<textarea aria-label={`${t('Shot','Plan')} ${index+1}`} value={shot.prompt} maxLength={512} onChange={event=>update(index,{prompt:event.target.value})}/></label>
      <label>{t('Seconds','Secondes')}<input aria-label={`${t('Seconds','Secondes')} ${index+1}`} type="number" min={1} max={maxDuration} step={1} value={Number.isFinite(shot.durationSec)?shot.durationSec:''} onChange={event=>update(index,{durationSec:event.target.value===''?NaN:Number(event.target.value)})}/></label>
      <button type="button" disabled={draft.length<=1} onClick={()=>setDraft(current=>current.filter((_,i)=>i!==index))}>{t('Remove shot','Retirer le plan')} {index+1}</button>
    </div>)}
    <button type="button" disabled={draft.length>=maxShots} onClick={()=>setDraft(current=>[...current,{prompt:'',durationSec:1}])}>{t('Add shot','Ajouter un plan')}</button>
    <p aria-live="polite">{t('Total','Total')} : {Number.isFinite(total)?total:'—'} s · {minDuration}–{maxDuration} s</p>
    {!valid&&<p role="status">{t('Write each shot and use whole seconds within the total limit.','Rédigez chaque plan et utilisez des secondes entières dans la durée totale autorisée.')}</p>}
    <p>{t('Changes need a new quote and a new confirmation. Review the request in the conversation before sending.','Les changements demandent un nouveau devis et une nouvelle confirmation. Relisez la demande dans la conversation avant de l’envoyer.')}</p>
    <button type="button" disabled={!valid} onClick={()=>onDraft(draft.map(shot=>({...shot,prompt:shot.prompt.trim()})))}>{t('Use this plan in a new request','Utiliser ce plan dans une nouvelle demande')}</button>
  </fieldset>;
}
