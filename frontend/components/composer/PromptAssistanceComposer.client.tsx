'use client';
import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { PromptAssistancePanel } from './PromptAssistancePanel.client';
import { usePromptAssistancePreview, type PromptAssistanceContext } from './usePromptAssistancePreview';
import { promptAssistanceCopy } from './prompt-assistance-copy';
import styles from './prompt-assistance.module.css';
import { Maximize2, Minimize2, Sparkles, ChevronDown } from 'lucide-react';
import { useComposerWorkspaceControls } from './ComposerWorkspaceControls.client';
import { MILO_LEVELS, miloLevelForModel } from '@/lib/studio/assistance-contract';
import { PROMPT_ASSISTANCE_LIVE } from '@/lib/prompt-assistance/contract';
import { useStudioAssistance } from '@/app/(core)/(workspace)/app/studio/conversation/[projectId]/_hooks/useStudioAssistance';
import { StudioAssistanceCreditsDialog } from '@/app/(core)/(workspace)/app/studio/conversation/[projectId]/_components/StudioAssistanceCredits.client';
import { PromptAssistanceFeedback } from './PromptAssistanceFeedback.client';
import { PROMPT_REFERENCE_PERCEPTION } from '@/lib/prompt-assistance/analysis-contract';
import {MiloAccessNotice} from './MiloAccessNotice.client';
import {needsMiloCredits,canUseMiloLite} from '@/lib/studio/milo-funding';
import { PromptReferenceAnalysis } from './PromptReferenceAnalysis.client';

export function PromptAssistanceComposer({ context, locale, modelLabel, draftText, onApplyText, children, renderReferences, modeControl, target = 'prompt', maxLength, blocked, disabledReason }: {
  context: PromptAssistanceContext; locale: string; modelLabel: string; draftText: string;
  onApplyText: (text: string) => void; children: ReactNode;
  renderReferences?: (insert?: (token: string) => void) => ReactNode;
  modeControl?: ReactNode;
  target?: 'prompt' | 'script' | 'lyrics'; maxLength?: number; blocked?: boolean; disabledReason?: string;
}) {
  const [perceptionRevision, setPerceptionRevision] = useState(0);
  const [analysisBusy, setAnalysisBusy] = useState(false);
  const controller = usePromptAssistancePreview({ ...context, locale, draftText, onApplyText, target, maxLength, blocked, perceptionRevision });
  const { state, dispatch } = controller;
  const credits = useStudioAssistance(context.scopeKey, controller.transport.waiting, { endpoint: PROMPT_ASSISTANCE_LIVE ? '/api/prompt-assistance' : '/api/studio/assistance', wrapChoice: PROMPT_ASSISTANCE_LIVE });
  const [creditsOpen, setCreditsOpen] = useState(false);
  const creditsTrigger = useRef<HTMLButtonElement>(null);
  const liveBusy = controller.transport.waiting || controller.transport.recovery || analysisBusy;
  const authRequired=credits.error==='AUTH_REQUIRED'||['UNAUTHORIZED','AUTH_REQUIRED'].includes(controller.transport.error??'');
  const fundingBlocked=PROMPT_ASSISTANCE_LIVE&&!controller.transport.recovery&&!controller.transport.waiting&&needsMiloCredits(credits.status,credits.status?.revision===controller.transport.fundingRevision?controller.transport.nextAction:null);
  const liveBlocked = PROMPT_ASSISTANCE_LIVE && (!context.live || fundingBlocked || authRequired || !credits.status?.enabled || !!credits.error || credits.busy || liveBusy || !!credits.status.unresolvedCalls);
  const liteSending=useRef(false);
  const latest=useRef({controller,scope:context.scopeKey});latest.current={controller,scope:context.scopeKey};
  async function sendWithLite(){
    if(liteSending.current||liveBusy||credits.busy||!state.message.trim()||!canUseMiloLite(credits.status))return;
    liteSending.current=true;
    try{
      const accepted=await credits.choose({action:'select_luna',expectedRevision:credits.status!.revision});
      const fresh=credits.getStatus();
      if(accepted&&fresh?.selectedModel==='gpt-6-luna'&&fresh.canContinue&&canUseMiloLite(fresh)&&latest.current.scope===context.scopeKey)latest.current.controller.send(fresh);
    }finally{liteSending.current=false;}
  }
  const copy = promptAssistanceCopy(locale);
  const id = useId();
  const [copied, setCopied] = useState(false);
  const [expandedConversation, setExpandedConversation] = useState(false);
  const controls = useComposerWorkspaceControls();
  const milo = state.mode === 'milo' && !disabledReason;
  const frame = useRef<HTMLDivElement>(null);
  const manualWriting = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = manualWriting.current;
    if (!element || milo) return;
    const syncHeight = () => {
      const height = element.getBoundingClientRect().height;
      if (height > 0) frame.current?.style.setProperty('--manual-writing-height', `${height}px`);
    };
    syncHeight();
    const observer = new ResizeObserver(syncHeight);
    observer.observe(element);
    return () => observer.disconnect();
  }, [milo]);
  const manualReferences = !milo ? renderReferences?.(target === 'script' ? token => { dispatch({ type: 'mode', mode: 'milo' }); controller.insertMention(token); } : undefined) : null;
  return <div ref={frame} className={`${styles.root}${expandedConversation && milo ? ` ${styles.expandedConversation}` : ''}`} data-prompt-assistance-preview>
    <div className={styles.header}>
    <div className={styles.tabs} role="tablist" aria-label="Writing mode" onKeyDown={event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 'prompt' : event.key === 'End' ? 'milo' : milo ? 'prompt' : 'milo';
      if (next === 'milo' && disabledReason) return;
      dispatch({ type: 'mode', mode: next }); document.getElementById(`${id}-${next}-tab`)?.focus();
    }}>
      <button type="button" id={`${id}-prompt-tab`} role="tab" aria-selected={!milo} aria-controls={`${id}-manual`} tabIndex={milo ? -1 : 0} onClick={() => dispatch({ type: 'mode', mode: 'prompt' })}>{copy.manual}</button>
      <button type="button" id={`${id}-milo-tab`} role="tab" aria-selected={milo} aria-controls={`${id}-milo`} tabIndex={milo ? 0 : -1} disabled={Boolean(disabledReason)} onClick={() => dispatch({ type: 'mode', mode: 'milo' })}>{copy.assistant}</button>
    </div>
    {modeControl}
    </div>
    {disabledReason ? <p className={styles.warning}>{disabledReason}</p> : null}
    <div id={`${id}-manual`} role="tabpanel" aria-labelledby={`${id}-prompt-tab`} hidden={milo}>
      <div className={styles.manualSurface} data-assistance-manual-input>
        <div ref={manualWriting}>{children}</div>
        <div className={styles.manualReferences}><div className={styles.sendRow}>
          <div className={styles.inputReferences}>{!milo ? controls?.modelControl : null}{manualReferences}</div>
          <span className={styles.sendPlaceholder} aria-hidden />
        </div></div>
      </div>
    </div>
    <div id={`${id}-milo`} role="tabpanel" aria-labelledby={`${id}-milo-tab`} hidden={!milo}>
      {milo ? <PromptAssistancePanel key={context.scopeKey} modelControl={controls?.modelControl} locale={locale} modelLabel={modelLabel} messages={state.messages} proposal={state.proposal ? { text: state.proposal.text, target, stale: state.proposal.revision !== state.revision } : null}
        reasoningControl={<button type="button" ref={creditsTrigger} className={styles.miloTrigger} aria-label="Milo settings and credits" aria-haspopup="dialog" aria-expanded={creditsOpen} onClick={() => { setCreditsOpen(true); void credits.refresh(); }}><Sparkles size={15} aria-hidden/><strong>Milo</strong>{credits.status ? <span>{MILO_LEVELS[miloLevelForModel(credits.status.selectedModel)].label}</span> : null}<ChevronDown size={12} aria-hidden/></button>}
        conversationControl={<button className={styles.expandConversation} type="button" aria-label={expandedConversation ? copy.collapse : copy.expand} title={expandedConversation ? copy.collapse : copy.expand} aria-expanded={expandedConversation} onClick={() => setExpandedConversation(value => !value)}>{expandedConversation ? <Minimize2 size={14} aria-hidden /> : <Maximize2 size={14} aria-hidden />}<span>{expandedConversation ? copy.collapse : copy.expand}</span></button>}
        message={state.message} pending={PROMPT_ASSISTANCE_LIVE ? controller.transport.waiting : Boolean(state.pending)} blocked={blocked || liveBlocked} maxLength={maxLength} messageRef={controller.input}
        feedback={PROMPT_ASSISTANCE_LIVE ? <>{authRequired||fundingBlocked?<MiloAccessNotice authRequired={authRequired} canUseLite={canUseMiloLite(credits.status)} busy={liveBusy||credits.busy} onLite={()=>void sendWithLite()} onCredits={()=>{setCreditsOpen(true);void credits.refresh();}}/>:<PromptAssistanceFeedback error={(controller.transport.nextAction&&credits.status?.revision!==controller.transport.fundingRevision?null:controller.transport.error) ?? credits.error ?? (!credits.status ? 'LOADING' : !credits.status.enabled ? 'ASSISTANCE_DISABLED' : credits.status.unresolvedCalls ? 'USAGE_UNRESOLVED' : null)} recovery={controller.transport.recovery} waiting={controller.transport.waiting} onRecover={controller.transport.recover} onStop={controller.transport.stop} />}
          {PROMPT_REFERENCE_PERCEPTION && context.live && credits.status ? <PromptReferenceAnalysis key={context.scopeKey} scopeKey={context.scopeKey} draft={{...context.live,text:draftText,target}} model={credits.status.selectedModel} session={controller.transport.session} blocked={Boolean(blocked || controller.transport.waiting || controller.transport.recovery || credits.busy || !credits.status.enabled || credits.error || authRequired || fundingBlocked)} onBusy={setAnalysisBusy} onCompleted={()=>{setPerceptionRevision(value=>value+1);void credits.refresh();}}/> : null}
        </> : null}
        onMessageChange={text => dispatch({ type: 'message', text })} onSend={() => { if (!liveBlocked) controller.send(credits.status??undefined); }} onProposalTextChange={text => dispatch({ type: 'edit', text })} onApply={controller.apply}
        onCopy={() => { if (state.proposal) void navigator.clipboard?.writeText(state.proposal.text).then(() => setCopied(true)).catch(() => setCopied(false)); }} references={renderReferences?.(controller.insertMention)} /> : null}
    </div>
    {state.undo ? <div className={styles.undo}><span>{copy.applied}</span><button type="button" disabled={!controller.canUndo || blocked} onClick={controller.undo}>{copy.undo}</button></div> : null}
    {copied ? <span role="status" className="sr-only">{copy.copied}</span> : null}
    {creditsOpen ? <StudioAssistanceCreditsDialog key={context.scopeKey} context="composer" {...credits} locale={locale.startsWith('fr') ? 'fr' : 'en'} conversationBusy={liveBusy} onChoice={() => {}} trigger={creditsTrigger} onClose={() => setCreditsOpen(false)} /> : null}
  </div>;
}
