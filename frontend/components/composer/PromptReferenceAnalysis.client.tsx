'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {ScanSearch,X} from 'lucide-react';
import type {PromptAssistanceRequest} from '@/lib/prompt-assistance/contract';
import type {StudioAssistantModel} from '@/lib/studio/assistance-contract';
import {usePromptReferenceAnalysis} from './usePromptReferenceAnalysis';
import styles from './prompt-reference-analysis.module.css';

type Draft=PromptAssistanceRequest['draft'];
export function PromptReferenceAnalysis({scopeKey,draft,model,session,blocked,onBusy,onCompleted}:{
  scopeKey:string;draft:Draft;model:StudioAssistantModel;session:()=>string;blocked:boolean;
  onBusy:(busy:boolean)=>void;onCompleted:()=>void;
}) {
  const refs=draft.references.filter(item=>item.ref&&item.ref.kind!=='image');
  const analysis=usePromptReferenceAnalysis(scopeKey,onCompleted,onBusy);
  const [open,setOpen]=useState(false),[selection,setSelection]=useState(''),[modality,setModality]=useState<'visual'|'audio'>('visual');
  const [start,setStart]=useState('0'),[end,setEnd]=useState(''),[quotedContext,setQuotedContext]=useState('');
  const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null),id=useId();
  const selected=refs.find(item=>`${item.fieldId}:${item.slot}`===selection)??refs[0];
  const kind=selected?.ref?.kind==='audio'?'audio':modality;
  const limit=kind==='audio'?30:60;
  const context=JSON.stringify([draft,model,selected,kind,start,end]);
  const quote=analysis.status?.quote,state=analysis.status?.state;
  const stale=!!quote&&(context!==quotedContext||Date.parse(quote.expiresAt)<=Date.now());
  const valid=Number.isFinite(Number(start))&&Number(start)>=0&&(!end||(Number(end)>Number(start)&&Number(end)-Number(start)<=limit));
  useEffect(()=>{if(open)dialog.current?.showModal();else dialog.current?.close();},[open]);
  function close(){setOpen(false);trigger.current?.focus({preventScroll:true});}
  if(!refs.length&&!analysis.pending)return null;
  return <>
    <button ref={trigger} type="button" className={styles.trigger} aria-haspopup="dialog" onClick={()=>setOpen(true)}><ScanSearch size={14} aria-hidden/>{analysis.pending?'Reference analysis…':'Analyze references'}</button>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby={`${id}-title`} onCancel={event=>{event.preventDefault();close();}} onClose={()=>setOpen(false)}>
      <header><h3 id={`${id}-title`}>Analyze references</h3><button type="button" aria-label="Close analysis" onClick={close}><X size={18}/></button></header>
      <p>Images are included with your messages. For video and audio, choose an excerpt for Milo to inspect.</p>
      {model==='gpt-6-luna'?<p>Choose Milo Standard or Max to analyze video and audio.</p>:null}
      <fieldset disabled={analysis.busy||analysis.pending} className={styles.fields}>
        <label>Reference<select value={selected?`${selected.fieldId}:${selected.slot}`:''} onChange={event=>{setSelection(event.target.value);analysis.reset();}}>{refs.map(item=><option key={`${item.fieldId}:${item.slot}`} value={`${item.fieldId}:${item.slot}`}>{item.label}</option>)}</select></label>
        {selected?.ref?.kind==='video'?<label>Inspect<select value={modality} onChange={event=>{setModality(event.target.value as typeof modality);analysis.reset();}}><option value="visual">Video visuals</option><option value="audio">Video sound</option></select></label>:null}
        <div className={styles.interval}><label>From (seconds)<input type="number" min="0" step="0.1" value={start} onChange={event=>{setStart(event.target.value);analysis.reset();}}/></label><label>To (seconds)<input type="number" min="0.1" step="0.1" value={end} placeholder={`Up to ${limit}s`} onChange={event=>{setEnd(event.target.value);analysis.reset();}}/></label></div>
      </fieldset>
      <p className={styles.note}>{kind==='audio'?'Up to 30 seconds of sound; timing is approximate.':'Up to 60 seconds, sampled across 12 frames; brief actions can be missed.'}</p>
      {analysis.error?<p role="alert">{analysis.error==='ENGINE_UNAVAILABLE'?'This analysis is not available right now.':analysis.error}</p>:null}
      {state==='prepared'&&quote?<section className={styles.quote}>
        <p>{quote.startSec}–{quote.endSec} s · {quote.profile==='audio-window-v1'?'Sound':'Video visuals'}</p>
        <p><strong>{quote.maxCredits} credits maximum</strong>. Uses your existing Milo credits. Actual usage is settled after analysis.</p>
        {stale?<p>The selection or Milo level changed. Review a new estimate.</p>:null}
      </section>:null}
      {(state==='queued'||state==='running')?<p role="status">Analyzing the selected excerpt… You can close this panel.</p>:null}
      {(state==='unknown'||analysis.recover)?<p role="status">Check the saved analysis before starting another. This does not repeat the analysis.</p>:null}
      {state==='failed'?<p role="alert">The analysis stopped. Recorded usage: {analysis.status?.chargedCredits??'pending'} credits.</p>:null}
      {state==='completed'&&analysis.status?.result?<section className={styles.result}>
        <p role="status">{analysis.reused?'Saved analysis reused.':'Analysis ready.'} Milo can use it in your next message.</p>
        <p>{analysis.status.result.summary}</p>
        <p className={styles.note}>{analysis.reused?'No new analysis charge.':`${analysis.status.chargedCredits??0} credits used.`} Coverage: {analysis.status.result.coverage.startSec}–{analysis.status.result.coverage.endSec} s.</p>
      </section>:null}
      <footer>
        {analysis.pending?<button type="button" disabled={analysis.busy} onClick={analysis.refresh}>Check analysis</button>:
          state==='prepared'&&!stale?<button type="button" disabled={blocked||analysis.busy||model==='gpt-6-luna'} onClick={analysis.confirm}>Analyze · {quote?.maxCredits} credits max</button>:
          state==='completed'?<button type="button" onClick={close}>Done</button>:
          <button type="button" disabled={blocked||analysis.busy||!selected||!valid||model==='gpt-6-luna'} onClick={()=>{
            if(!selected)return;setQuotedContext(context);
            analysis.prepare({action:'prepare',sessionId:session(),requestId:crypto.randomUUID(),draft,fieldId:selected.fieldId,slot:selected.slot,modality:kind,startSec:Number(start),...(end?{endSec:Number(end)}:{})});
          }}>{analysis.busy?'Preparing…':'Review analysis cost'}</button>}
      </footer>
    </dialog>
  </>;
}
