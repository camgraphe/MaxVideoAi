'use client';
import { useId, useState, type ReactNode } from 'react';
import { PromptAssistancePanel } from './PromptAssistancePanel.client';
import { usePromptAssistancePreview, type PromptAssistanceContext } from './usePromptAssistancePreview';
import { promptAssistanceCopy } from './prompt-assistance-copy';
import styles from './prompt-assistance.module.css';

export function PromptAssistanceComposer({ context, locale, modelLabel, draftText, onApplyText, children, renderReferences, referencesBeforeInput, target = 'prompt', maxLength, blocked, disabledReason }: {
  context: PromptAssistanceContext; locale: string; modelLabel: string; draftText: string;
  onApplyText: (text: string) => void; children: ReactNode;
  renderReferences?: (insert?: (token: string) => void) => ReactNode;
  referencesBeforeInput?: boolean;
  target?: 'prompt' | 'script' | 'lyrics'; maxLength?: number; blocked?: boolean; disabledReason?: string;
}) {
  const controller = usePromptAssistancePreview({ ...context, draftText, onApplyText, target, maxLength, blocked });
  const { state, dispatch } = controller;
  const copy = promptAssistanceCopy(locale);
  const id = useId();
  const [copied, setCopied] = useState(false);
  const milo = state.mode === 'milo' && !disabledReason;
  const manualReferences = !milo ? renderReferences?.(target === 'script' ? token => { dispatch({ type: 'mode', mode: 'milo' }); controller.insertMention(token); } : undefined) : null;
  return <div className={styles.root} data-prompt-assistance-preview>
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
    {disabledReason ? <p className={styles.warning}>{disabledReason}</p> : null}
    <div id={`${id}-manual`} role="tabpanel" aria-labelledby={`${id}-prompt-tab`} hidden={milo}>
      {referencesBeforeInput ? manualReferences : null}
      <div className={styles.manualSurface} data-assistance-manual-input>{children}{!referencesBeforeInput && manualReferences ? <div className={styles.manualReferences}>{manualReferences}</div> : null}</div>
    </div>
    <div id={`${id}-milo`} role="tabpanel" aria-labelledby={`${id}-milo-tab`} hidden={!milo}>
      {milo ? <PromptAssistancePanel key={context.scopeKey} referencesBeforeInput={referencesBeforeInput} locale={locale} modelLabel={modelLabel} messages={state.messages} proposal={state.proposal ? { text: state.proposal.text, target, stale: state.proposal.revision !== state.revision } : null}
        message={state.message} pending={Boolean(state.pending)} blocked={blocked} maxLength={maxLength} messageRef={controller.input}
        onMessageChange={text => dispatch({ type: 'message', text })} onSend={controller.send} onProposalTextChange={text => dispatch({ type: 'edit', text })} onApply={controller.apply}
        onCopy={() => { if (state.proposal) void navigator.clipboard?.writeText(state.proposal.text).then(() => setCopied(true)).catch(() => setCopied(false)); }} references={renderReferences?.(controller.insertMention)} /> : null}
    </div>
    {state.undo ? <div className={styles.undo}><span>{copy.applied}</span><button type="button" disabled={!controller.canUndo || blocked} onClick={controller.undo}>{copy.undo}</button></div> : null}
    {copied ? <span role="status" className="sr-only">{copy.copied}</span> : null}
  </div>;
}
