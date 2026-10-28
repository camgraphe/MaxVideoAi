'use client';
import { useEffect, useReducer, useRef } from 'react';
import { canApplyProposal, canUndoProposal, createPreviewState, previewReducer } from '@/lib/prompt-assistance/preview-state';

export type PromptAssistanceContext = { scopeKey: string; contextKey: string };
export function usePromptAssistancePreview({ scopeKey, contextKey, draftText, target, onApplyText, maxLength, blocked }: PromptAssistanceContext & {
  draftText: string; target: 'prompt' | 'script' | 'lyrics'; onApplyText: (text: string) => void; maxLength?: number; blocked?: boolean;
}) {
  const fingerprint = JSON.stringify([contextKey, draftText]);
  const [stored, dispatch] = useReducer(previewReducer, undefined, () => createPreviewState(scopeKey, fingerprint));
  const state = previewReducer(stored, { type: 'sync', scope: scopeKey, fingerprint });
  if (state !== stored) dispatch({ type: 'sync', scope: scopeKey, fingerprint });
  const sequence = useRef(0);
  const input = useRef<HTMLTextAreaElement>(null);
  const sampleDraft = useRef(draftText);
  // A scope change cancels the local fixture. A draft edit leaves its response stale.
  useEffect(() => {
    if (!state.pending) return;
    const id = state.pending.id;
    const timeout = window.setTimeout(() => {
      const text = sampleDraft.current || (target === 'script' ? 'Some moments stay with us. A familiar light, a memory of summer.' : 'A quiet scene in warm afternoon light. Natural textures, a clear subject and a restrained composition.');
      dispatch({ type: 'reply', id, text, reply: 'Here is a sample suggestion using your current draft. You can edit it, apply it, or continue the conversation. This local preview does not call Milo.' });
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [state.pending, scopeKey, target]);
  const send = () => {
    if (!state.message.trim() || state.pending || blocked) return;
    sampleDraft.current = draftText;
    dispatch({ type: 'send', id: ++sequence.current, message: state.message.trim() });
  };
  const apply = () => {
    if (blocked || !canApplyProposal(state) || !state.proposal || (maxLength && state.proposal.text.length > maxLength)) return;
    onApplyText(state.proposal.text);
    dispatch({ type: 'applied', previous: draftText, fingerprint: JSON.stringify([contextKey, state.proposal.text]) });
  };
  const undo = () => {
    if (blocked || !canUndoProposal(state) || !state.undo) return;
    onApplyText(state.undo.text);
    dispatch({ type: 'undone', fingerprint: JSON.stringify([contextKey, state.undo.text]) });
  };
  const insertMention = (token: string) => {
    const field = input.current;
    const start = field?.selectionStart ?? state.message.length, end = field?.selectionEnd ?? start;
    const before = state.message.slice(0, start), after = state.message.slice(end);
    const insertion = `${before && !/\s$/.test(before) ? ' ' : ''}${token}${after && /^\s/.test(after) ? '' : ' '}`;
    dispatch({ type: 'message', text: before + insertion + after });
    requestAnimationFrame(() => { if (input.current !== field) return; field?.focus(); field?.setSelectionRange(start + insertion.length, start + insertion.length); });
  };
  return { state, dispatch, input, send, apply, undo, insertMention, canUndo: canUndoProposal(state), target };
}
