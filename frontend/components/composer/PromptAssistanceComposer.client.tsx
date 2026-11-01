'use client';
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { PromptAssistancePanel } from './PromptAssistancePanel.client';
import { usePromptAssistancePreview, type PromptAssistanceContext } from './usePromptAssistancePreview';
import { promptAssistanceCopy } from './prompt-assistance-copy';
import styles from './prompt-assistance.module.css';
import { isMiloEntry } from '@/lib/prompt-assistance/marketing-entry';
import { Maximize2, Minimize2, SquarePen, Sparkles, ChevronDown, CircleHelp } from 'lucide-react';
import { useComposerWorkspaceControls } from './ComposerWorkspaceControls.client';
import { MILO_LEVELS, miloLevelForModel } from '@/lib/studio/assistance-contract';
import { PROMPT_ASSISTANCE_LIVE } from '@/lib/prompt-assistance/contract';
import { useStudioAssistance } from '@/app/(core)/(workspace)/app/studio/conversation/[projectId]/_hooks/useStudioAssistance';
import { StudioAssistanceCreditsDialog } from '@/app/(core)/(workspace)/app/studio/conversation/[projectId]/_components/StudioAssistanceCredits.client';
import { PromptAssistanceFeedback,promptAssistanceLoadingMessage } from './PromptAssistanceFeedback.client';
import { PROMPT_REFERENCE_PERCEPTION } from '@/lib/prompt-assistance/analysis-contract';
import {MiloAccessNotice} from './MiloAccessNotice.client';
import {needsMiloCredits,canUseMiloLite} from '@/lib/studio/milo-funding';
import {PromptPreviousReply} from './PromptPreviousReply.client';
import { PromptReferenceAnalysis } from './PromptReferenceAnalysis.client';

export type PromptAssistanceGenerationState = { blocked:boolean; hint:string|null };

export function PromptAssistanceComposer({ context, locale, modelLabel, draftText, onApplyText, children, renderReferences, modeControl, target = 'prompt', maxLength, blocked, disabledReason, onGenerationStateChange }: {
  context: PromptAssistanceContext; locale: string; modelLabel: string; draftText: string;
  onApplyText: (text: string) => void; children: ReactNode;
  renderReferences?: (insert?: (token: string) => void) => ReactNode;
  modeControl?: ReactNode;
  target?: 'prompt' | 'script' | 'lyrics'; maxLength?: number; blocked?: boolean; disabledReason?: string;
  onGenerationStateChange?: (state:PromptAssistanceGenerationState) => void;
}) {
  const [perceptionRevision, setPerceptionRevision] = useState(0);
  const [analysisBusy, setAnalysisBusy] = useState(false);
  const controller = usePromptAssistancePreview({ ...context, locale, draftText, onApplyText, target, maxLength, blocked, perceptionRevision });
  const { state, dispatch } = controller;
  const entryDismissed = useRef(false);
  useEffect(() => {
    if (!disabledReason && !entryDismissed.current && isMiloEntry(window.location.search)) dispatch({ type: 'mode', mode: 'milo' });
  }, [context.scopeKey, disabledReason, dispatch]);
  const helpLabel = locale.startsWith('fr') ? 'Découvrir Milo' : locale.startsWith('es') ? 'Conocer a Milo' : 'Meet Milo';
  const helpHref = `${locale.startsWith('fr') ? '/fr' : locale.startsWith('es') ? '/es' : ''}/ai-video-prompt-generator`;
  const credits = useStudioAssistance(JSON.stringify([context.accountKey??null,context.scopeKey]), controller.transport.waiting || controller.transport.previousWaiting, { onPendingRequest:PROMPT_ASSISTANCE_LIVE?controller.transport.observePendingRequest:undefined, endpoint: PROMPT_ASSISTANCE_LIVE ? '/api/prompt-assistance' : '/api/studio/assistance', wrapChoice: PROMPT_ASSISTANCE_LIVE });
  const [creditsOpen, setCreditsOpen] = useState(false);
  const creditsTrigger = useRef<HTMLButtonElement>(null);
  const liveBusy = controller.transport.waiting || controller.transport.recovery || controller.transport.loading || controller.transport.loadError || analysisBusy || controller.transport.analysisPending;
  const authRequired=credits.error==='AUTH_REQUIRED'||['UNAUTHORIZED','AUTH_REQUIRED'].includes(controller.transport.error??'');
  // Display only: admission always uses the fresh credits status/revision below.
  const knownLevel=useRef<{accountKey:string;label:string}|null>(null);
  if(!context.accountKey||knownLevel.current?.accountKey!==context.accountKey||authRequired)knownLevel.current=null;
  const levelVerified=Boolean(credits.status&&!credits.error&&!authRequired);
  if(levelVerified&&context.accountKey)knownLevel.current={accountKey:context.accountKey,label:MILO_LEVELS[miloLevelForModel(credits.status!.selectedModel)].label};
  const levelLabel=levelVerified?MILO_LEVELS[miloLevelForModel(credits.status!.selectedModel)].label:knownLevel.current?.label;
  const fundingBlocked=PROMPT_ASSISTANCE_LIVE&&!controller.transport.recovery&&!controller.transport.waiting&&needsMiloCredits(credits.status,credits.status?.revision===controller.transport.fundingRevision?controller.transport.nextAction:null);
  const liveBlocked = PROMPT_ASSISTANCE_LIVE && (!context.live || fundingBlocked || authRequired || !credits.status?.enabled || !!credits.error || credits.busy || liveBusy || controller.transport.accountPending || !!credits.status.unresolvedCalls);
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
  const generationBlocked = milo && (!controller.appliedPromptCurrent || liveBusy || Boolean(state.pending));
  const generationHint = generationBlocked ? state.proposal && !state.pending ? copy.generateUsePrompt : copy.generateContinue : null;
  useLayoutEffect(() => {
    onGenerationStateChange?.({blocked:generationBlocked,hint:generationHint});
  }, [generationBlocked,generationHint,onGenerationStateChange]);
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
  const accessNotice = PROMPT_ASSISTANCE_LIVE && (authRequired || fundingBlocked)
    ? <MiloAccessNotice authRequired={authRequired} placement={authRequired ? 'input' : 'feedback'} canUseLite={canUseMiloLite(credits.status)} busy={liveBusy || credits.busy} onLite={() => void sendWithLite()} onCredits={() => { setCreditsOpen(true); void credits.refresh(); }} />
    : null;
  const feedbackError=controller.transport.loading?'RESTORING':(controller.transport.nextAction&&credits.status?.revision!==controller.transport.fundingRevision?null:controller.transport.error)??credits.error??(!credits.status?'LOADING':!credits.status.enabled?'ASSISTANCE_DISABLED':credits.status.unresolvedCalls?'USAGE_UNRESOLVED':null);
  const loadingStatus=PROMPT_ASSISTANCE_LIVE&&!controller.transport.recovery&&!controller.transport.waiting?promptAssistanceLoadingMessage(feedbackError):null;
  return <div ref={frame} className={`${styles.root}${expandedConversation && milo ? ` ${styles.expandedConversation}` : ''}`} data-prompt-assistance-preview>
    <div className={styles.header}>
    <div className={styles.tabs} role="tablist" aria-label="Writing mode" onKeyDown={event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 'prompt' : event.key === 'End' ? 'milo' : milo ? 'prompt' : 'milo';
      if (next === 'milo' && disabledReason) return;
      entryDismissed.current = true; dispatch({ type: 'mode', mode: next }); document.getElementById(`${id}-${next}-tab`)?.focus();
    }}>
      <button type="button" id={`${id}-prompt-tab`} role="tab" aria-selected={!milo} aria-controls={`${id}-manual`} tabIndex={milo ? -1 : 0} onClick={() => { entryDismissed.current = true; dispatch({ type: 'mode', mode: 'prompt' }); }}>{copy.manual}</button>
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
      {milo ? <PromptAssistancePanel key={context.scopeKey} modelControl={controls?.modelControl} locale={locale} modelLabel={modelLabel} inputReadOnly={controller.transport.loading || controller.transport.loadError} sendBlocked={!!controller.transport.exhausted} showConversationControl={!!controller.transport.exhausted || controller.transport.recovery || !!controller.transport.error || controller.transport.previousAvailable || controller.transport.loading} messages={state.messages} proposal={state.proposal ? { text: state.proposal.text, target, stale: state.proposal.revision !== state.revision } : null}
        reasoningControl={<button type="button" ref={creditsTrigger} className={styles.miloTrigger} aria-label="Milo settings and credits" aria-haspopup="dialog" aria-expanded={creditsOpen} onClick={() => { setCreditsOpen(true); void credits.refresh(); }}><Sparkles size={15} aria-hidden/><strong>Milo</strong><span className={styles.miloLevel} data-assistance-level data-verified={levelVerified} aria-busy={Boolean(loadingStatus)} title={levelVerified?undefined:loadingStatus??'Milo availability is unverified.'}><span>{levelLabel??'…'}</span></span><ChevronDown size={12} aria-hidden/></button>}
        identityStatus={loadingStatus}
        helpControl={<a className={styles.helpLink} href={helpHref} target="_blank" rel="noopener noreferrer" aria-label={helpLabel} title={helpLabel}><CircleHelp size={15} aria-hidden/></a>}
        conversationControl={<><button type="button" className={styles.expandConversation} aria-label={copy.newChat} title={copy.newChat} disabled={analysisBusy || controller.transport.analysisPending || blocked} onClick={() => { if(controller.newChat()){setExpandedConversation(false);setPerceptionRevision(0);} }}><SquarePen size={14} aria-hidden/><span>{copy.newChat}</span></button><button className={styles.expandConversation} type="button" aria-label={expandedConversation ? copy.collapse : copy.expand} title={expandedConversation ? copy.collapse : copy.expand} aria-expanded={expandedConversation} onClick={() => setExpandedConversation(value => !value)}>{expandedConversation ? <Minimize2 size={14} aria-hidden /> : <Maximize2 size={14} aria-hidden />}<span>{expandedConversation ? copy.collapse : copy.expand}</span></button></>}
        message={state.message} pending={PROMPT_ASSISTANCE_LIVE ? controller.transport.waiting : Boolean(state.pending)} blocked={blocked || liveBlocked} maxLength={maxLength} messageRef={controller.input}
        inputNotice={authRequired ? accessNotice : null}
        feedback={PROMPT_ASSISTANCE_LIVE ? <>{controller.transport.persistenceError?<p role="alert" data-assistance-persistence-warning className={styles.warning}>This browser could not save reply recovery. Keep this tab open to check the original reply. Navigation remains available.</p>:null}{controller.transport.previousAvailable?<div className={styles.liveFeedback}><span>{controller.transport.accountPending?'Milo is still working on a reply in another chat. You can write here; check that reply before sending.':'A previous reply is available to read.'}</span><button type="button" onClick={()=>void controller.transport.checkPreviousReply()}>Check previous reply</button></div>:null}{controller.transport.previousOpen?<PromptPreviousReply result={controller.transport.previousResult} error={controller.transport.previousError} waiting={controller.transport.previousWaiting} onCheck={()=>void controller.transport.checkPreviousReply()} onStop={controller.transport.stopPreviousReply} onClose={controller.transport.closePreviousReply}/>:null}{controller.transport.cacheError?<p role="alert" data-assistance-cache-warning className={styles.warning}>{copy.cacheUnavailable}</p>:null}{authRequired ? null : accessNotice ?? (loadingStatus?null:<PromptAssistanceFeedback phase={controller.transport.phase} error={feedbackError} recovery={controller.transport.recovery} waiting={controller.transport.waiting} onRecover={controller.transport.recover} onStop={controller.transport.stop} onReload={controller.transport.reload} />)}
          {PROMPT_REFERENCE_PERCEPTION && context.live && credits.status && !controller.transport.loading && !controller.transport.loadError ? <PromptReferenceAnalysis key={controller.transport.chatKey} scopeKey={controller.transport.chatKey} legacyScopeKey={controller.transport.legacyScopeKey} recoveryOnly={!!controller.transport.exhausted} draft={{...context.live,text:draftText,target}} model={credits.status.selectedModel} session={controller.transport.session} blocked={Boolean(blocked || controller.transport.waiting || controller.transport.recovery || credits.busy || !credits.status.enabled || credits.error || authRequired || fundingBlocked || controller.transport.exhausted)} onBusy={setAnalysisBusy} onCompleted={()=>{setPerceptionRevision(value=>value+1);void credits.refresh();}}/> : null}
        </> : null}
        onMessageChange={text => dispatch({ type: 'message', text })} onSend={() => { if (!liveBlocked) controller.send(credits.status??undefined); }} onProposalTextChange={text => dispatch({ type: 'edit', text })} onApply={controller.apply} settingsReview={controller.canReview?{changes:controller.settingChanges,valid:controller.canApplyReviewed}:undefined} onReview={()=>{if(!blocked&&!liveBlocked)controller.beginReview();}} onApplyReviewed={()=>{if(!blocked&&!liveBlocked)controller.applyReviewed();}}
        onCopy={() => { if (state.proposal) void navigator.clipboard?.writeText(state.proposal.text).then(() => setCopied(true)).catch(() => setCopied(false)); }} references={renderReferences?.(controller.insertMention)} /> : null}
    </div>
    {state.undo ? <div className={styles.undo}><span>{copy.applied}</span><button type="button" disabled={!controller.canUndo || blocked} onClick={controller.undo}>{copy.undo}</button></div> : null}
    {copied ? <span role="status" className="sr-only">{copy.copied}</span> : null}
    {creditsOpen ? <StudioAssistanceCreditsDialog key={context.scopeKey} context="composer" {...credits} locale={locale.startsWith('fr') ? 'fr' : 'en'} conversationBusy={liveBusy} onChoice={() => {}} trigger={creditsTrigger} onClose={() => setCreditsOpen(false)} /> : null}
  </div>;
}
