'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {X} from 'lucide-react';
import {isCurrentPromptAnalysisRequest,type PromptAnalysisRequest} from '@/lib/prompt-assistance/analysis-request';
import type {PromptAssistanceRequest} from '@/lib/prompt-assistance/contract';
import type {StudioAssistantModel} from '@/lib/studio/assistance-contract';
import {usePromptReferenceAnalysis} from './usePromptReferenceAnalysis';
import styles from './prompt-reference-analysis.module.css';

type Draft=PromptAssistanceRequest['draft'];
export function PromptReferenceAnalysis({scopeKey,legacyScopeKey,recoveryOnly,draft,model,session,blocked,onBusy,onCompleted,open,onOpenChange,recommendation,onSettings,onContinue}:{
  scopeKey:string;legacyScopeKey?:string;recoveryOnly?:boolean;draft:Draft;model:StudioAssistantModel;session:()=>string;blocked:boolean;
  onBusy:(busy:boolean)=>void;onCompleted:()=>void;
  open:boolean;onOpenChange:(open:boolean)=>void;recommendation?:{id:string;request:PromptAnalysisRequest};
  onSettings:()=>void;onContinue:()=>void;
}) {
  const refs=draft.references.filter(item=>item.ref&&item.ref.kind!=='image');
  const analysis=usePromptReferenceAnalysis(scopeKey,onCompleted,onBusy,legacyScopeKey);
  const [selection,setSelection]=useState(''),[modality,setModality]=useState<'visual'|'audio'>('visual');
  const [start,setStart]=useState('0'),[end,setEnd]=useState(''),[quotedContext,setQuotedContext]=useState('');
  const [suggestedReference,setSuggestedReference]=useState<PromptAnalysisRequest|null>(null);
  const [,refreshExpiry]=useState(0);
  const card=useRef<HTMLElement>(null),handledRecommendation=useRef(''),id=useId();
  const selected=refs.find(item=>`${item.fieldId}:${item.slot}`===selection)??refs[0];
  const kind=selected?.ref?.kind==='audio'?'audio':modality;
  const limit=kind==='audio'?30:60;
  const context=JSON.stringify([draft,model,selected,kind,start,end]);
  const quote=analysis.status?.quote,state=analysis.status?.state;
  const referenceChanged=!!suggestedReference&&!isCurrentPromptAnalysisRequest(suggestedReference,draft.references);
  const stale=!!quote&&(referenceChanged||context!==quotedContext||Date.parse(quote.expiresAt)<=Date.now());
  const showSelection=!quote||state==='failed'||(state==='prepared'&&stale);
  const valid=Number.isFinite(Number(start))&&Number(start)>=0&&(!end||(Number(end)>Number(start)&&Number(end)-Number(start)<=limit));
  useEffect(()=>{
    if(!recommendation||handledRecommendation.current===recommendation.id)return;
    const firstRecommendation=!handledRecommendation.current;
    handledRecommendation.current=recommendation.id;
    // A restored historical suggestion is not a new instruction. Keep the paid
    // work being recovered, including when its GET completed before chat hydration.
    if(analysis.busy||analysis.pending||(firstRecommendation&&analysis.status)){
      onOpenChange(true);return;
    }
    const request=recommendation.request;
    if(!isCurrentPromptAnalysisRequest(request,draft.references))return;
    analysis.reset();setSuggestedReference(request);setSelection(`${request.fieldId}:${request.slot}`);setModality(request.modality);
    setStart(String(request.startSec));setEnd(request.endSec===undefined?'':String(request.endSec));onOpenChange(true);
  },[recommendation,analysis,draft.references,onOpenChange]);
  useEffect(()=>{
    if(state!=='prepared'||!quote)return;
    const remaining=Date.parse(quote.expiresAt)-Date.now();
    if(remaining<=0)return;
    const timer=window.setTimeout(()=>refreshExpiry(value=>value+1),Math.min(remaining+1,2_147_483_647));
    return()=>window.clearTimeout(timer);
  },[state,quote]);
  useEffect(()=>{if(open)card.current?.scrollIntoView({block:'nearest'});},[open,state]);
  function close(){onOpenChange(false);}

  if(!refs.length&&!analysis.pending&&!analysis.status)return null;
  return <section ref={card} hidden={!open} className={styles.card} role="region" aria-labelledby={`${id}-title`} data-assistance-analysis>
      <header><h3 id={`${id}-title`}>Analyze references</h3><button type="button" aria-label="Close analysis" onClick={close}><X size={18}/></button></header>
      {!quote?<p>Images are included with your messages. For video and audio, choose an excerpt for Milo to inspect.</p>:null}
      {model==='gpt-6-luna'?<p>Choose Milo Standard or Max to analyze video and audio. <button type="button" onClick={onSettings}>Milo settings</button></p>:null}
      {referenceChanged?<p role="status">The reference Milo suggested has changed. Review the current reference before continuing. <button type="button" disabled={analysis.busy||analysis.pending} onClick={()=>{setSuggestedReference(null);analysis.reset();}}>Use current reference</button></p>:null}
      <fieldset hidden={!showSelection} disabled={analysis.busy||analysis.pending} className={styles.fields}>
        <label>Reference<select value={selected?`${selected.fieldId}:${selected.slot}`:''} onChange={event=>{setSelection(event.target.value);setSuggestedReference(null);analysis.reset();}}>{refs.map(item=><option key={`${item.fieldId}:${item.slot}`} value={`${item.fieldId}:${item.slot}`}>{item.label}</option>)}</select></label>
        {selected?.ref?.kind==='video'?<label>Inspect<select value={modality} onChange={event=>{setModality(event.target.value as typeof modality);analysis.reset();}}><option value="visual">Video visuals</option><option value="audio">Video sound</option></select></label>:null}
        <div className={styles.interval}><label>From (seconds)<input type="number" min="0" step="0.1" value={start} onChange={event=>{setStart(event.target.value);analysis.reset();}}/></label><label>To (seconds)<input type="number" min="0.1" step="0.1" value={end} placeholder={`Up to ${limit}s`} onChange={event=>{setEnd(event.target.value);analysis.reset();}}/></label></div>
      </fieldset>
      {showSelection?<p className={styles.note}>{kind==='audio'?'Up to 30 seconds of sound; timing is approximate.':'Up to 60 seconds, sampled across 12 frames; brief actions can be missed.'}</p>:null}
      {analysis.error?<p role="alert">{analysis.error==='ENGINE_UNAVAILABLE'?'This analysis is not available right now.':analysis.error}{analysis.errorCode==='SPENDING_LIMIT_EXCEEDED'&&!analysis.pending&&model!=='gpt-6-luna'?<> <button type="button" onClick={onSettings}>Milo settings</button></>:null}</p>:null}
      {state==='prepared'&&quote?<section className={styles.quote}>
        <p>{quote.startSec}–{quote.endSec} s · {quote.profile==='audio-window-v1'?'Sound':'Video visuals'}</p>
        <p><strong>{quote.maxCredits} credits maximum</strong>. Uses your existing Milo credits. Actual usage is settled after analysis.</p>
        {stale?<p>The estimate expired or the selection or Milo level changed. Review a new estimate.</p>:null}
      </section>:null}
      {(state==='queued'||state==='running')?<p role="status">Analyzing the selected excerpt… You can close this panel.</p>:null}
      {(state==='unknown'||analysis.recover)?<p role="status">Check the saved analysis before starting another. This does not repeat the analysis.</p>:null}
      {state==='failed'?<p role="alert">The analysis stopped. Recorded usage: {analysis.status?.chargedCredits??'pending'} credits.</p>:null}
      {state==='completed'&&analysis.status?.result?<section className={styles.result}>
        <p role="status">{analysis.reused?'Saved analysis reused.':'Analysis ready.'} {recoveryOnly?'Start a new chat to continue.':'Milo can use it in your next message.'}</p>
        <p>{analysis.status.result.summary}</p>
        <p className={styles.note}>{analysis.reused?'No new analysis charge.':`${analysis.status.chargedCredits??0} credits used.`} Coverage: {analysis.status.result.coverage.startSec}–{analysis.status.result.coverage.endSec} s.</p>
      </section>:null}
      <footer>
        {state==='prepared'&&!stale?<button type="button" disabled={analysis.busy} onClick={()=>analysis.reset()}>Change excerpt</button>:null}
        {analysis.pending?<button type="button" disabled={analysis.busy} onClick={analysis.refresh}>Check analysis</button>:
          state==='prepared'&&!stale?<button type="button" disabled={blocked||analysis.busy||model==='gpt-6-luna'} onClick={()=>{if(quote&&Date.parse(quote.expiresAt)>Date.now())analysis.confirm();else refreshExpiry(value=>value+1);}}>Analyze · {quote?.maxCredits} credits max</button>:
          state==='completed'?<><button type="button" disabled={blocked||analysis.busy} onClick={()=>analysis.reset()}>Analyze another reference</button><button type="button" disabled={blocked||analysis.busy||recoveryOnly} onClick={onContinue}>Continue with this analysis</button></>:
          <button type="button" disabled={blocked||analysis.busy||!selected||!valid||referenceChanged||model==='gpt-6-luna'} onClick={()=>{
            if(!selected)return;setQuotedContext(context);
            analysis.prepare({action:'prepare',sessionId:session(),requestId:crypto.randomUUID(),draft,fieldId:selected.fieldId,slot:selected.slot,modality:kind,startSec:Number(start),...(end?{endSec:Number(end)}:{})});
          }}>{analysis.busy?'Preparing…':'Review analysis cost'}</button>}
      </footer>
    </section>;
}
