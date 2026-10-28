'use client';
import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react';
import { ArrowUp, ArrowLeft, Sparkles } from 'lucide-react';
import type { PreviewMessage } from '@/lib/prompt-assistance/preview-state';
import { promptAssistanceCopy } from './prompt-assistance-copy';
import styles from './prompt-assistance.module.css';

export type PromptAssistancePanelProps = {
  locale: string; modelLabel: string; messages: readonly PreviewMessage[];
  proposal: { text: string; target: 'prompt' | 'script' | 'lyrics'; stale: boolean } | null;
  message: string; pending: boolean; blocked?: boolean; maxLength?: number;
  onMessageChange: (text: string) => void; onSend: () => void;
  onProposalTextChange: (text: string) => void; onApply: () => void;
  onCopy: () => void; references?: ReactNode; referencesBeforeInput?: boolean; messageRef?: RefObject<HTMLTextAreaElement>;
  modelControl?: ReactNode;
  conversationControl?: ReactNode;
};

export function PromptAssistancePanel({ locale, modelLabel, messages, proposal, message, pending, blocked, maxLength, onMessageChange, onSend, onProposalTextChange, onApply, onCopy, references, referencesBeforeInput, messageRef, modelControl, conversationControl }: PromptAssistancePanelProps) {
  const copy = promptAssistanceCopy(locale);
  const [expanded, setExpanded] = useState(false);
  const transcript = useRef<HTMLDivElement>(null);
  const ownInput = useRef<HTMLTextAreaElement>(null);
  const input = messageRef ?? ownInput;
  const proposalId = useId(), messageId = useId();
  const previousMessages = useRef(messages.length);
  useEffect(() => {
    if (messages.length <= previousMessages.current) return;
    previousMessages.current = messages.length;
    if (transcript.current) transcript.current.scrollTop = transcript.current.scrollHeight;
    if (messages.at(-1)?.role === 'assistant') { setExpanded(false); input.current?.focus({ preventScroll: true }); }
  }, [messages, input]);
  const canSend = Boolean(message.trim()) && !pending && !blocked;
  const tooLong = Boolean(proposal && maxLength && proposal.text.length > maxLength);
  const hasConversation = messages.length > 0 || pending || Boolean(proposal);
  return <div className={styles.panel}>
    <div className={styles.assistant}><div className={styles.assistantIdentity}><Sparkles size={15} aria-hidden /><strong>Milo</strong><span>{copy.forModel} {modelLabel}</span></div>{hasConversation ? conversationControl : null}</div>
    <div className={styles.conversationStage} hidden={!hasConversation}>
      <div className={styles.transcript} data-assistance-transcript hidden={expanded} ref={transcript} tabIndex={0} aria-label={copy.history}>
        <div className={styles.messages} role="log" aria-live="polite" aria-relevant="additions">
          {messages.map(item => <div key={item.id} className={item.role === 'user' ? styles.user : styles.reply}>{item.text}</div>)}
        </div>
        {pending ? <p role="status">{copy.pending}</p> : null}
      </div>
      {expanded && proposal ? <div id={proposalId} className={styles.proposalBody} data-assistance-body>
        <label className="sr-only" htmlFor={`${proposalId}-text`}>{copy.edit}</label><textarea id={`${proposalId}-text`} data-assistance-editor className={styles.editor} value={proposal.text} onChange={event => onProposalTextChange(event.target.value)} />
        <div className={styles.copyRow}><span>{maxLength ? `${proposal.text.length} / ${maxLength}` : null}</span><button type="button" onClick={onCopy}>{copy.copy}</button></div>
      </div> : null}
      {proposal ? <section className={styles.proposal} aria-label={copy[proposal.target]}>
        <div className={styles.proposalHeader}>
          <span className={styles.proposalStatus} title={proposal.stale ? copy.stale : undefined}>{proposal.stale ? copy.updateNeeded : tooLong ? `${proposal.text.length} / ${maxLength}` : copy.ready}</span>
          <button type="button" data-assistance-expand aria-expanded={expanded} aria-controls={proposalId} onClick={() => setExpanded(value => !value)}>{expanded ? <><ArrowLeft size={13} aria-hidden />{copy.back}</> : copy.review}</button>
          <button type="button" data-assistance-apply className={styles.apply} disabled={proposal.stale || pending || blocked || tooLong || !proposal.text.trim()} onClick={onApply}>{proposal.target === 'prompt' ? copy.usePrompt : copy.useScript}</button>
        </div>
      </section> : null}
    </div>
    {referencesBeforeInput ? <div className={styles.sourceReferences}>{references}</div> : null}
    <div className={styles.inputSurface} data-assistance-input>
      <label htmlFor={messageId}>{copy.message}</label>
      <textarea ref={input} id={messageId} data-assistance-message rows={2} value={message} placeholder={copy.placeholder} onChange={event => onMessageChange(event.target.value)} onKeyDown={event => {
        if (event.key !== 'Enter') return;
        event.stopPropagation();
        if (event.shiftKey || event.nativeEvent.isComposing || event.keyCode === 229) return;
        event.preventDefault(); if (canSend) onSend();
      }} />
      <div className={styles.sendRow}><div className={styles.inputReferences}>{!referencesBeforeInput ? references : null}{modelControl}</div><button type="button" aria-label={copy.send} className={styles.send} disabled={!canSend} onClick={onSend}><ArrowUp size={19} aria-hidden /></button></div>
    </div>
  </div>;
}
