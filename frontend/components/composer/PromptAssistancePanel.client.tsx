'use client';
import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react';
import { ArrowUp, ArrowLeft, Eye, Sparkles } from 'lucide-react';
import type { PreviewMessage } from '@/lib/prompt-assistance/preview-state';
import type {ApplicationSettingChange} from '@/lib/prompt-assistance/application-review';
import {promptSettingCopy} from './prompt-assistance-settings-copy';
import { promptAssistanceCopy } from './prompt-assistance-copy';
import { composerModelLabel } from './composer-model-label';
import styles from './prompt-assistance.module.css';

export type PromptAssistancePanelProps = {
  locale: string; modelLabel: string; messages: readonly PreviewMessage[];
  proposal: { text: string; target: 'prompt' | 'script' | 'lyrics'; stale: boolean } | null;
  message: string; pending: boolean; blocked?: boolean; inputReadOnly?:boolean; sendBlocked?:boolean; showConversationControl?:boolean; maxLength?: number;
  onMessageChange: (text: string) => void; onSend: () => void;
  onProposalTextChange: (text: string) => void; onApply: () => void;
  settingsReview?: {changes:ApplicationSettingChange[];valid:boolean}; onReview?:()=>void; onApplyReviewed?:()=>void;
  onCopy: () => void; references?: ReactNode; messageRef?: RefObject<HTMLTextAreaElement>;
  modelControl?: ReactNode;
  conversationControl?: ReactNode;
  helpControl?: ReactNode;
  reasoningControl?: ReactNode;
  feedback?: ReactNode;
  inputNotice?: ReactNode;
};

export function PromptAssistancePanel({ locale, modelLabel, messages, proposal, message, pending, blocked, inputReadOnly, sendBlocked, showConversationControl, maxLength, settingsReview,onReview,onApplyReviewed,onMessageChange, onSend, onProposalTextChange, onApply, onCopy, references, messageRef, modelControl, conversationControl, helpControl, reasoningControl, feedback, inputNotice }: PromptAssistancePanelProps) {
  const copy = promptAssistanceCopy(locale);
  const [expanded, setExpanded] = useState(false);
  const [reviewMode,setReviewMode]=useState(false);
  const transcript = useRef<HTMLDivElement>(null);
  const proposalEditor = useRef<HTMLTextAreaElement>(null);
  const ownInput = useRef<HTMLTextAreaElement>(null);
  const input = messageRef ?? ownInput;
  const proposalId = useId(), messageId = useId();
  const previousMessages = useRef(messages.length);
  useEffect(() => {
    if (messages.length <= previousMessages.current) return;
    previousMessages.current = messages.length;
    if (transcript.current) transcript.current.scrollTop = transcript.current.scrollHeight;
    if (messages.at(-1)?.role === 'assistant') { setExpanded(false);setReviewMode(false); input.current?.focus({ preventScroll: true }); }
  }, [messages, input]);
  useEffect(()=>{if(!proposal){setExpanded(false);setReviewMode(false);}},[proposal]);
  useEffect(() => {
    if (expanded) proposalEditor.current?.focus({ preventScroll: true });
  }, [expanded]);
  const canSend = Boolean(message.trim()) && !pending && !blocked && !sendBlocked;
  const tooLong = Boolean(proposal && maxLength && proposal.text.length > maxLength);
  const hasConversation = messages.length > 0 || pending || Boolean(proposal);
  const reviewLabel = proposal?.target === 'script' ? copy.reviewScript : proposal?.target === 'lyrics' ? copy.reviewLyrics : copy.review;
  const proposalStatus = proposal?.stale ? settingsReview?copy.settingsReviewReady:copy.updateNeeded : tooLong && proposal ? `${proposal.text.length} / ${maxLength}` : copy.ready;
  const review=()=>{setExpanded(true);setReviewMode(true);onReview?.();};
  const togglePrompt=()=>{if(expanded){setExpanded(false);setReviewMode(false);}else if(settingsReview)review();else setExpanded(true);};
  return <div className={styles.panel} data-assistance-empty={!hasConversation || undefined}>
    <div className={styles.assistant}><div className={styles.assistantIdentity}>{reasoningControl ?? <><Sparkles size={15} aria-hidden /><strong>Milo</strong></>}<span className={styles.assistantModel} title={modelLabel}>{copy.forModel} {composerModelLabel(modelLabel)}</span></div><span className={styles.assistanceActions}>{helpControl}{hasConversation||showConversationControl ? conversationControl : null}</span></div>
    <div className={`${styles.conversationStage}${reviewMode&&expanded?` ${styles.reviewStage}`:''}`} hidden={!hasConversation}>
      <div className={styles.transcript} data-assistance-transcript hidden={expanded} ref={transcript} tabIndex={0} aria-label={copy.history}>
        <div className={styles.messages} role="log" aria-live="polite" aria-relevant="additions">
          {messages.map(item => <div key={item.id} className={item.role === 'user' ? styles.user : styles.reply}>{item.text}</div>)}
        </div>
        {pending ? <p role="status">{copy.pending}</p> : null}
      </div>
      {expanded && proposal ? <div id={proposalId} className={styles.proposalBody} data-assistance-body>
        {reviewMode?<div className={styles.settingsReview} role="status">
          <p>{settingsReview?copy.settingsChanged:copy.reviewUnavailable}</p>
          {settingsReview?<dl data-assistance-settings-changes>{settingsReview.changes.map(change=>{const item=promptSettingCopy(change,locale);return <div key={change.key}><dt>{item.label}</dt><dd><span className="sr-only">{copy.previousSetting}: </span>{item.before}<span aria-hidden> → </span><span className="sr-only"> {copy.currentSetting}: </span><strong>{item.current}</strong></dd></div>;})}</dl>:null}
        </div>:null}
        <label className="sr-only" htmlFor={`${proposalId}-text`}>{copy.edit}</label><textarea ref={proposalEditor} id={`${proposalId}-text`} data-assistance-editor className={styles.editor} value={proposal.text} onChange={event => onProposalTextChange(event.target.value)} />
        <div className={styles.copyRow}><span>{maxLength ? `${proposal.text.length} / ${maxLength}` : null}</span><button type="button" onClick={onCopy}>{copy.copy}</button></div>
        {reviewMode?<div className={styles.settingsReviewActions}>
          {settingsReview&&!settingsReview.valid?<><p role="status">{copy.settingsChangedAgain}</p><button type="button" disabled={pending||blocked} onClick={onReview}>{copy.reviewChanges}</button></>:null}
          <button type="button" className={styles.confirmSettings} disabled={!settingsReview?.valid||pending||blocked||tooLong||!proposal.text.trim()} onClick={onApplyReviewed}>{copy.useCurrentSettings}</button>
        </div>:null}
      </div> : null}
      {proposal ? <section className={styles.proposal} data-assistance-proposal aria-label={copy[proposal.target]}>
        <div className={styles.proposalHeader}>
          {expanded ? <span className={styles.proposalStatus} title={proposal.stale ? settingsReview?copy.settingsChanged:copy.stale : undefined}>{proposalStatus}</span> : <button type="button" data-assistance-preview-open className={styles.proposalPreview} aria-label={`${reviewLabel}: ${copy[proposal.target]}`} aria-expanded={false} aria-controls={proposalId} title={proposal.stale ? settingsReview?copy.settingsChanged:copy.stale : undefined} onClick={togglePrompt}>
            <span className={styles.proposalStatus}>{proposalStatus}</span>
            <span className={styles.proposalExcerpt} data-assistance-preview>{proposal.text.replace(/\s+/g, ' ').trim()}</span>
          </button>}
          <button type="button" data-assistance-expand className={expanded ? undefined : styles.review} aria-label={expanded ? copy.back : reviewLabel} aria-expanded={expanded} aria-controls={proposalId} onClick={togglePrompt}>{expanded ? <><ArrowLeft size={13} aria-hidden />{copy.back}</> : <><Eye size={14} aria-hidden /><span className={styles.reviewLabel}>{reviewLabel}</span></>}</button>
          <button type="button" data-assistance-apply className={styles.apply} disabled={(proposal.stale&&!settingsReview) || pending || blocked || tooLong || !proposal.text.trim()} onClick={proposal.stale&&settingsReview?review:onApply}>{proposal.stale&&settingsReview?copy.reviewUse:proposal.target === 'prompt' ? copy.usePrompt : copy.useScript}</button>
        </div>
      </section> : null}
    </div>
    <div className={styles.inputSurface} data-assistance-input>
      <div className={styles.messageField} data-assistance-input-notice={inputNotice ? true : undefined}>
      <label htmlFor={messageId}>{copy.message}</label>
      {inputNotice}
      <textarea ref={input} id={messageId} data-assistance-message readOnly={inputReadOnly} rows={2} value={message} placeholder={inputNotice ? undefined : copy.placeholder} onChange={event => onMessageChange(event.target.value)} onKeyDown={event => {
        if (event.key !== 'Enter') return;
        event.stopPropagation();
        if (event.shiftKey || event.nativeEvent.isComposing || event.keyCode === 229) return;
        event.preventDefault(); if (canSend) onSend();
      }} />
      </div>
      <div className={styles.sendRow}><div className={styles.inputReferences}>{modelControl}{references}</div><button type="button" aria-label={copy.send} className={styles.send} disabled={!canSend} onClick={onSend}><ArrowUp size={19} aria-hidden /></button></div>
      {feedback}
    </div>
  </div>;
}
