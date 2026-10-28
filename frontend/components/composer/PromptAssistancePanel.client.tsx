'use client';
import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react';
import { ArrowUp, ChevronDown, Sparkles } from 'lucide-react';
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
};

export function PromptAssistancePanel({ locale, modelLabel, messages, proposal, message, pending, blocked, maxLength, onMessageChange, onSend, onProposalTextChange, onApply, onCopy, references, referencesBeforeInput, messageRef }: PromptAssistancePanelProps) {
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
  return <div className={styles.panel}>
    <div className={styles.transcript} data-assistance-transcript ref={transcript} tabIndex={0} aria-label={copy.history}>
      <div className={styles.assistant}><Sparkles size={15} aria-hidden /><strong>Milo</strong><span>{modelLabel}</span></div>
      {!messages.length ? <p>{copy.intro}</p> : null}
      <div className={styles.messages} role="log" aria-live="polite" aria-relevant="additions">
        {messages.map(item => <div key={item.id} className={item.role === 'user' ? styles.user : styles.reply}>{item.text}</div>)}
      </div>
      {pending ? <p role="status">{copy.pending}</p> : null}
    </div>
    {proposal ? <section className={styles.proposal} aria-label={copy[proposal.target]}>
      <div className={styles.proposalHeader}>
        <button type="button" data-assistance-expand aria-expanded={expanded} aria-controls={proposalId} aria-label={`${expanded ? copy.collapse : copy.expand} ${copy[proposal.target]}`} onClick={() => setExpanded(value => !value)}>{copy[proposal.target]}<ChevronDown size={13} aria-hidden className={expanded ? styles.rotated : undefined} /></button>
        <button type="button" data-assistance-apply className={styles.apply} disabled={proposal.stale || pending || blocked || tooLong || !proposal.text.trim()} onClick={onApply}>{proposal.target === 'prompt' ? copy.usePrompt : copy.useScript}</button>
      </div>
      {!expanded ? <p className={styles.excerpt}>{proposal.text}</p> : null}
      <div id={proposalId} data-assistance-body hidden={!expanded}>
        {expanded ? <><label className="sr-only" htmlFor={`${proposalId}-text`}>{copy.edit}</label><textarea id={`${proposalId}-text`} data-assistance-editor className={styles.editor} rows={8} value={proposal.text} onChange={event => onProposalTextChange(event.target.value)} /><div className={styles.copyRow}><span>{maxLength ? `${proposal.text.length} / ${maxLength}` : null}</span><button type="button" onClick={onCopy}>{copy.copy}</button></div></> : null}
      </div>
      {proposal.stale || tooLong ? <p className={styles.warning} role="status">{proposal.stale ? copy.stale : `${proposal.text.length} / ${maxLength}`}</p> : null}
    </section> : null}
    {referencesBeforeInput ? references : null}
    <div className={styles.inputSurface}>
      <label htmlFor={messageId}>{copy.message}</label>
      <textarea ref={input} id={messageId} data-assistance-message rows={2} value={message} placeholder={copy.placeholder} onChange={event => onMessageChange(event.target.value)} onKeyDown={event => {
        if (event.key !== 'Enter') return;
        event.stopPropagation();
        if (event.shiftKey || event.nativeEvent.isComposing || event.keyCode === 229) return;
        event.preventDefault(); if (canSend) onSend();
      }} />
      {!referencesBeforeInput ? references : null}
      <div className={styles.sendRow}><span>{copy.sample}</span><button type="button" aria-label={copy.send} className={styles.send} disabled={!canSend} onClick={onSend}><ArrowUp size={19} aria-hidden /></button></div>
    </div>
  </div>;
}
