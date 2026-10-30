'use client';
import { useEffect, useReducer, useRef } from 'react';
import { canApplyProposal, canUndoProposal, createPreviewState, previewReducer } from '@/lib/prompt-assistance/preview-state';
import {PROMPT_ASSISTANCE_LIVE,type PromptAssistanceDraftContext} from '@/lib/prompt-assistance/contract';
import type {StudioAssistanceStatus} from '@/lib/studio/assistance-contract';
import {usePromptAssistanceTransport} from './usePromptAssistanceTransport';
import {canonicalPromptDraft,promptSessionScope} from '@/lib/prompt-assistance/session';

/** Scope owns the conversation (account/workspace); context changes only invalidate suggestions. */
export type PromptAssistanceContext = { accountKey?:string; scopeKey: string; contextKey: string; live?:PromptAssistanceDraftContext };
export function usePromptAssistancePreview({ accountKey, scopeKey, contextKey, live, locale='en', draftText, target, onApplyText, maxLength, blocked, perceptionRevision=0 }: PromptAssistanceContext & {
  locale?:string; perceptionRevision?:number;
  draftText: string; target: 'prompt' | 'script' | 'lyrics'; onApplyText: (text: string) => void; maxLength?: number; blocked?: boolean;
}) {
  // The request itself participates: a new control cannot accidentally bypass the stale guard.
  const fingerprintFor = (text:string) => JSON.stringify([contextKey, live, target, text, perceptionRevision]);
  const fingerprint = fingerprintFor(draftText);
  const [stored, dispatch] = useReducer(previewReducer, undefined, () => createPreviewState(scopeKey, fingerprint));
  const previousAccount=useRef(accountKey);
  const sync={ type: 'sync' as const, scope: scopeKey, fingerprint,keepMode:accountKey!==undefined&&accountKey===previousAccount.current };
  const state = previewReducer(stored, sync);
  if (state !== stored) dispatch(sync);
  previousAccount.current=accountKey;
  const sequence = useRef(0);
  const input = useRef<HTMLTextAreaElement>(null);
  const currentScope = useRef(scopeKey);
  currentScope.current = scopeKey;
  const sampleDraft = useRef(draftText);
  const currentDraft=live?canonicalPromptDraft({...live,text:draftText,target}):'';
  const hash=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),byte=>byte.toString(16).padStart(2,'0')).join('');
  const currentDraftRef=useRef({currentDraft,fingerprint});currentDraftRef.current={currentDraft,fingerprint};
  const transport=usePromptAssistanceTransport(scopeKey,PROMPT_ASSISTANCE_LIVE,(result,uiId)=>{
    if(result.state==='complete'&&result.reply){
      if(uiId!==null)dispatch({type:'reply',id:uiId,text:result.reply.text,reply:result.reply.reply});
      else dispatch({type:'restored',message:result.message,text:result.reply.text,reply:result.reply.reply});
    }else if(uiId!==null)dispatch({type:'failed',id:uiId,restore:result.safeToRetry===true});
    else if(result.safeToRetry===true)dispatch({type:'rejected',message:result.message});
  },live?.workflow?{scope:promptSessionScope(live),onRestore:async(snapshot,local)=>{
    const expected=currentDraftRef.current;
    const draftFingerprint=await hash(expected.currentDraft);
    const latestRequestId=snapshot?.turns.at(-1)?.requestId??'';
    const edited=local?.latestRequestId===latestRequestId?local.proposal:undefined;
    const proposal=edited??snapshot?.proposal;
    const valid=!!proposal&&proposal.draftFingerprint===draftFingerprint&&(!edited||edited.valid);
    return ()=>dispatch({type:'hydrate',scope:scopeKey,fingerprint:expected.fingerprint,message:local?.message??'',
      messages:snapshot?.turns.flatMap(turn=>[{id:`${turn.requestId}-user`,role:'user' as const,text:turn.message},{id:`${turn.requestId}-assistant`,role:'assistant' as const,text:turn.reply}])??[],
      proposal:proposal?{text:proposal.text,valid}:null});
  }}:undefined);
  useEffect(()=>{
    if(!PROMPT_ASSISTANCE_LIVE||transport.loading||transport.loadError)return;
    let cancelled=false;
    // Cache only the local input and suggestion edit; raw context and reference URLs stay off storage.
    void hash(currentDraft).then(draftFingerprint=>{if(!cancelled)transport.saveLocal({message:state.message,proposal:state.proposal?{text:state.proposal.text,draftFingerprint,valid:state.proposal.revision===state.revision}:null});});
    return()=>{cancelled=true;};
    // The transport view changes without changing the local draft; avoid a save/render cycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[scopeKey,currentDraft,state.message,state.proposal,state.revision,transport.loading,transport.loadError,transport.chatId]);
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
    if (blocked || transport.loading || transport.recovery || !canApplyProposal(state) || !state.proposal || (maxLength && state.proposal.text.length > maxLength)) return;
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
  const newChat=()=>{if(!PROMPT_ASSISTANCE_LIVE||transport.newChat()){dispatch({type:'newChat'});return true;}return false;};
  return { state, dispatch, input, send, apply, undo, insertMention, newChat, canUndo: canUndoProposal(state), target,transport };
}
