'use client';
import { useEffect, useLayoutEffect,useReducer, useRef, useState } from 'react';
import { canApplyProposal, canUndoProposal, canReviewProposal,canApplyReviewedProposal, createPreviewState, previewReducer,type PreviewMessage } from '@/lib/prompt-assistance/preview-state';
import {PROMPT_ASSISTANCE_LIVE,type PromptAssistanceDraftContext} from '@/lib/prompt-assistance/contract';
import type {StudioAssistanceStatus} from '@/lib/studio/assistance-contract';
import {usePromptAssistanceTransport} from './usePromptAssistanceTransport';
import {proposalApplicationContext,applicationSettingChanges,draftWithReviewSettings,applicationReviewKey} from '@/lib/prompt-assistance/application-review';
import {canonicalPromptDraft,promptSessionScope,lastCompletedPromptRequestId} from '@/lib/prompt-assistance/session';

/** Scope owns the conversation (account/workspace); context changes only invalidate suggestions. */
export type PromptAssistanceContext = { accountKey?:string; scopeKey: string; reviewKey?:string; contextKey: string; live?:PromptAssistanceDraftContext };
export function usePromptAssistancePreview({ accountKey, scopeKey, reviewKey, contextKey, live, locale='en', draftText, target, onApplyText, maxLength, blocked, perceptionRevision=0 }: PromptAssistanceContext & {
  locale?:string; perceptionRevision?:number;
  draftText: string; target: 'prompt' | 'script' | 'lyrics'; onApplyText: (text: string) => void; maxLength?: number; blocked?: boolean;
}) {
  // The request itself participates: a new control cannot accidentally bypass the stale guard.
  const applicationContext=proposalApplicationContext({accountKey,scopeKey,reviewKey,live,text:draftText,target,perceptionRevision});
  const fingerprintFor = (text:string) => JSON.stringify([contextKey, reviewKey, live, target, text, perceptionRevision]);
  const fingerprint = fingerprintFor(draftText);
  const [stored, dispatch] = useReducer(previewReducer, undefined, () => createPreviewState(scopeKey, fingerprint,applicationContext));
  const previousAccount=useRef(accountKey);
  const sync={ type: 'sync' as const, scope: scopeKey, fingerprint,applicationContext,keepMode:accountKey!==undefined&&accountKey===previousAccount.current };
  const state = previewReducer(stored, sync);
  if (state !== stored) dispatch(sync);
  previousAccount.current=accountKey;
  // An explicit application is a separate permission from having a working proposal.
  // Text is checked independently so qualified scalar settings (including ratio) stay compatible.
  const generationContext = proposalApplicationContext({accountKey,scopeKey,reviewKey,live,text:'',target,perceptionRevision})?.compatibilityKey
    ?? applicationReviewKey({accountKey,scopeKey,contextKey,live,target,perceptionRevision});
  const [appliedPrompt, setAppliedPrompt] = useState<{text:string;context:string;chat:string}|null>(null);
  const sequence = useRef(0);
  const input = useRef<HTMLTextAreaElement>(null);
  const currentScope = useRef(scopeKey);
  currentScope.current = scopeKey;
  const sampleDraft = useRef(draftText);
  const draft=live?{...live,text:draftText,target}:null;
  const currentDraft=draft?canonicalPromptDraft(draft):'';
  const hash=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),byte=>byte.toString(16).padStart(2,'0')).join('');
  const currentDraftRef=useRef({draft,currentDraft,fingerprint,applicationContext,compatibilityRevision:state.compatibilityRevision});currentDraftRef.current={draft,currentDraft,fingerprint,applicationContext,compatibilityRevision:state.compatibilityRevision};
  const transport=usePromptAssistanceTransport(scopeKey,PROMPT_ASSISTANCE_LIVE,(result,uiId)=>{
    if(result.state==='complete'&&result.reply){
      if(uiId!==null)dispatch({type:'reply',id:uiId,text:result.reply.text,reply:result.reply.reply,requestId:result.requestId});
      else dispatch({type:'restored',message:result.message,text:result.reply.text,reply:result.reply.reply,requestId:result.requestId});
    }else if(uiId!==null)dispatch({type:'failed',id:uiId,restore:result.safeToRetry===true});
    else if(result.safeToRetry===true)dispatch({type:'rejected',message:result.message});
  },live?.workflow?{scope:promptSessionScope(live),onRestore:async(snapshot,local,pendingReview)=>{
    const expected=currentDraftRef.current;
    const draftFingerprint=await hash(expected.currentDraft);
    const latestRequestId=lastCompletedPromptRequestId(snapshot);
    const edited=local?.latestRequestId===latestRequestId?local.proposal:undefined;
    const proposal=edited??snapshot?.proposal;
    const proof=edited?edited.review:pendingReview;
    const originalDraft=proof&&expected.draft?draftWithReviewSettings(expected.draft,proof.settings):null;
    const reviewContext=proof?.compatible&&proof.requestId===latestRequestId&&expected.applicationContext&&expected.draft&&snapshot?.proposal
      &&originalDraft
      &&proof.compatibilityFingerprint===await hash(expected.applicationContext.compatibilityKey)
      &&snapshot.proposal.draftFingerprint===await hash(canonicalPromptDraft(originalDraft))
      ?{...expected.applicationContext,settings:proof.settings}:undefined;
    const valid=!!proposal&&proposal.draftFingerprint===draftFingerprint&&(!edited||edited.valid);
    return ()=>dispatch({type:'hydrate',scope:scopeKey,fingerprint:expected.fingerprint,compatibilityRevision:expected.compatibilityRevision,message:local?.message??'',
      messages:snapshot?.turns.flatMap<PreviewMessage>(turn=>turn.reply===null
        ?[{id:`${turn.requestId}-user`,role:'user',text:turn.message,deliveryFailed:true}]
        :[{id:`${turn.requestId}-user`,role:'user',text:turn.message},{id:`${turn.requestId}-assistant`,role:'assistant',text:turn.reply}])??[],
      proposal:proposal?{text:proposal.text,valid,applicationContext:reviewContext,requestId:latestRequestId}:null});
  }}:undefined);
  const appliedPromptCurrent = Boolean(appliedPrompt && appliedPrompt.text === draftText
    && appliedPrompt.context === generationContext && appliedPrompt.chat === transport.chatKey
    && appliedPrompt.text === state.proposal?.text);
  useLayoutEffect(() => {
    // Reverting an edit or a context must never resurrect a permission already revoked.
    if (appliedPrompt && !appliedPromptCurrent) setAppliedPrompt(null);
  }, [appliedPrompt, appliedPromptCurrent]);
  const rememberApplication = (text:string) => setAppliedPrompt({text,context:generationContext,chat:transport.chatKey});
  const previousCompatibility=useRef({scope:scopeKey,revision:state.compatibilityRevision});
  useLayoutEffect(()=>{
    // Revoke durable proof before hashing or painting a hard-context change.
    // The transport epoch also fences digest completions from earlier renders.
    const previous=previousCompatibility.current;
    const hardChange=previous.scope===scopeKey&&previous.revision!==state.compatibilityRevision;
    if(hardChange||state.proposal&&(!state.proposal.applicationContext||state.proposal.compatibilityRevision!==state.compatibilityRevision))transport.revokeReviewProof(hardChange);
    previousCompatibility.current={scope:scopeKey,revision:state.compatibilityRevision};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[scopeKey,state.proposal,state.compatibilityRevision,transport.chatId]);
  useEffect(()=>{
    if(!PROMPT_ASSISTANCE_LIVE||transport.loading||transport.loadError)return;
    let cancelled=false;
    const localEpoch=transport.localEpoch();
    // Cache only the local input and suggestion edit; raw context and reference URLs stay off storage.
    void Promise.all([hash(currentDraft),state.proposal?.applicationContext?hash(state.proposal.applicationContext.compatibilityKey):null]).then(([draftFingerprint,compatibilityFingerprint])=>{if(!cancelled)transport.saveLocal({message:state.message,proposal:state.proposal?{text:state.proposal.text,draftFingerprint,valid:state.proposal.revision===state.revision,...(compatibilityFingerprint&&state.proposal.applicationContext&&state.proposal.requestId?{review:{version:1 as const,requestId:state.proposal.requestId,compatibilityFingerprint,settings:state.proposal.applicationContext.settings,compatible:state.proposal.compatibilityRevision===state.compatibilityRevision}}:{})}:null},localEpoch);});
    return()=>{cancelled=true;};
    // The transport view changes without changing the local draft; avoid a save/render cycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[scopeKey,currentDraft,state.message,state.proposal,state.revision,state.compatibilityRevision,transport.loading,transport.loadError,transport.chatId]);
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
    const review=applicationContext?async()=>{const [draftFingerprint,compatibilityFingerprint]=await Promise.all([hash(currentDraft),hash(applicationContext.compatibilityKey)]);return {version:1 as const,draftFingerprint,compatibilityFingerprint,compatible:true,settings:applicationContext.settings};}:undefined;
    if(PROMPT_ASSISTANCE_LIVE&&(!live||!transport.send({...(selection?{assistanceModel:selection.selectedModel,assistanceRevision:selection.revision}:{}),draftRevision:state.revision,locale:locale.startsWith('fr')?'fr':locale.startsWith('es')?'es':'en',message:state.message.trim(),draft:{...live,text:draftText,target},...(activeSuggestion?{activeSuggestion}:{})},id,review)))return;
    setAppliedPrompt(null);
    sampleDraft.current = draftText;
    dispatch({ type: 'send', id, message: state.message.trim() });
  };
  const apply = () => {
    if (blocked || transport.loading || transport.recovery || !canApplyProposal(state) || !state.proposal || (maxLength && state.proposal.text.length > maxLength)) return;
    rememberApplication(state.proposal.text);
    onApplyText(state.proposal.text);
    dispatch({ type: 'applied', previous: draftText, fingerprint: fingerprintFor(state.proposal.text) });
  };
  const applyReviewed=()=>{
    if(blocked||transport.cacheError||transport.loading||transport.loadError||transport.waiting||transport.recovery||transport.analysisPending||!canApplyReviewedProposal(state)||!state.proposal||(maxLength&&state.proposal.text.length>maxLength))return;
    rememberApplication(state.proposal.text);
    onApplyText(state.proposal.text);dispatch({type:'appliedReviewed',previous:draftText,fingerprint:fingerprintFor(state.proposal.text)});
  };
  const undo = () => {
    if (blocked || !canUndoProposal(state) || !state.undo) return;
    setAppliedPrompt(null);
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
  const newChat=()=>{if(!PROMPT_ASSISTANCE_LIVE||transport.newChat()){setAppliedPrompt(null);dispatch({type:'newChat',message:transport.exhausted?state.message:undefined});return true;}return false;};
  return { state, dispatch, input, send, apply, applyReviewed, appliedPromptCurrent,beginReview:()=>{if(!transport.cacheError)dispatch({type:'review'});},canReview:!transport.cacheError&&canReviewProposal(state),canApplyReviewed:!transport.cacheError&&canApplyReviewedProposal(state),settingChanges:state.proposal?.applicationContext&&state.applicationContext?applicationSettingChanges(state.proposal.applicationContext,state.applicationContext):[], undo, insertMention, newChat, canUndo: canUndoProposal(state), target,transport };
}
