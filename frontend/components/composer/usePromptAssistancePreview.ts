'use client';
import { useEffect, useReducer, useRef } from 'react';
import { canApplyProposal, canUndoProposal, createPreviewState, previewReducer } from '@/lib/prompt-assistance/preview-state';
import {PROMPT_ASSISTANCE_LIVE,type PromptAssistanceDraftContext} from '@/lib/prompt-assistance/contract';
import type {StudioAssistanceStatus} from '@/lib/studio/assistance-contract';
import {usePromptAssistanceTransport} from './usePromptAssistanceTransport';

/** Scope owns the conversation (account/workspace); context changes only invalidate suggestions. */
export type PromptAssistanceContext = { scopeKey: string; contextKey: string; live?:PromptAssistanceDraftContext };
export function usePromptAssistancePreview({ scopeKey, contextKey, live, locale='en', draftText, target, onApplyText, maxLength, blocked, perceptionRevision=0 }: PromptAssistanceContext & {
  locale?:string; perceptionRevision?:number;
  draftText: string; target: 'prompt' | 'script' | 'lyrics'; onApplyText: (text: string) => void; maxLength?: number; blocked?: boolean;
}) {
  // The request itself participates: a new control cannot accidentally bypass the stale guard.
  const fingerprintFor = (text:string) => JSON.stringify([contextKey, live, target, text, perceptionRevision]);
  const fingerprint = fingerprintFor(draftText);
  const [stored, dispatch] = useReducer(previewReducer, undefined, () => createPreviewState(scopeKey, fingerprint));
  const state = previewReducer(stored, { type: 'sync', scope: scopeKey, fingerprint });
  if (state !== stored) dispatch({ type: 'sync', scope: scopeKey, fingerprint });
  const sequence = useRef(0);
  const input = useRef<HTMLTextAreaElement>(null);
  const currentScope = useRef(scopeKey);
  currentScope.current = scopeKey;
  const sampleDraft = useRef(draftText);
  const transport=usePromptAssistanceTransport(scopeKey,PROMPT_ASSISTANCE_LIVE,(result,uiId)=>{
    if(result.state==='complete'&&result.reply){
      if(uiId!==null)dispatch({type:'reply',id:uiId,text:result.reply.text,reply:result.reply.reply});
      else dispatch({type:'restored',message:result.message,text:result.reply.text,reply:result.reply.reply});
    }else if(uiId!==null)dispatch({type:'failed',id:uiId,restore:result.safeToRetry===true});
    else if(result.safeToRetry===true)dispatch({type:'rejected',message:result.message});
  });
  // A scope change cancels the local fixture. A draft edit leaves its response stale.
  useEffect(() => {
    if (!state.pending || PROMPT_ASSISTANCE_LIVE) return;
    const id = state.pending.id;
    const timeout = window.setTimeout(() => {
      const text = sampleDraft.current || (target === 'script' ? 'Some moments stay with us. A familiar light, a memory of summer.' : 'A quiet scene in warm afternoon light. Natural textures, a clear subject and a restrained composition.');
      // Fixture copy stays natural for visual review. This development-only path never calls a model.
      dispatch({ type: 'reply', id, text, reply: 'Here’s a starting point. What would you like to refine?' });
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [state.pending, scopeKey, target]);
  const send = (selection?:Pick<StudioAssistanceStatus,'selectedModel'|'revision'>) => {
    if (!state.message.trim() || state.pending || blocked) return;
    const id=++sequence.current;
    const activeSuggestion=state.proposal?.revision===state.revision&&state.proposal.text.trim()?state.proposal.text:undefined;
    if(PROMPT_ASSISTANCE_LIVE&&(!live||!transport.send({...(selection?{assistanceModel:selection.selectedModel,assistanceRevision:selection.revision}:{}),draftRevision:state.revision,locale:locale.startsWith('fr')?'fr':locale.startsWith('es')?'es':'en',message:state.message.trim(),draft:{...live,text:draftText,target},...(activeSuggestion?{activeSuggestion}:{})},id)))return;
    sampleDraft.current = draftText;
    dispatch({ type: 'send', id, message: state.message.trim() });
  };
  const apply = () => {
    if (blocked || !canApplyProposal(state) || !state.proposal || (maxLength && state.proposal.text.length > maxLength)) return;
    onApplyText(state.proposal.text);
    dispatch({ type: 'applied', previous: draftText, fingerprint: fingerprintFor(state.proposal.text) });
  };
  const undo = () => {
    if (blocked || !canUndoProposal(state) || !state.undo) return;
    onApplyText(state.undo.text);
    dispatch({ type: 'undone', fingerprint: fingerprintFor(state.undo.text) });
  };
  const insertMention = (token: string) => {
    const field = input.current;
    const start = field?.selectionStart ?? state.message.length, end = field?.selectionEnd ?? start;
    const before = state.message.slice(0, start), after = state.message.slice(end);
    const insertion = `${before && !/\s$/.test(before) ? ' ' : ''}${token}${after && /^\s/.test(after) ? '' : ' '}`;
    dispatch({ type: 'message', text: before + insertion + after });
    requestAnimationFrame(() => {
      if (currentScope.current !== scopeKey || (field && input.current !== field)) return;
      input.current?.focus(); input.current?.setSelectionRange(start + insertion.length, start + insertion.length);
    });
  };
  return { state, dispatch, input, send, apply, undo, insertMention, canUndo: canUndoProposal(state), target,transport };
}
