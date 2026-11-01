'use client';
import {useCallback,useLayoutEffect,useRef,useState} from 'react';
import type {ComposerProps} from './composer-types';
import type {PromptAssistanceGenerationState} from './PromptAssistanceComposer.client';

type Options=Pick<ComposerProps,'onGenerate'|'onGenerationPermissionChange'>&{
  enabled:boolean; disabled:boolean; onStart:()=>void;
};

/** Shares the committed Milo permission with the action and asynchronous submission owners. */
export function useComposerGenerationGate({enabled,disabled,onStart,onGenerate,onGenerationPermissionChange}:Options){
  const [state,setState]=useState<PromptAssistanceGenerationState>({blocked:false,hint:null});
  const update=useCallback((next:PromptAssistanceGenerationState)=>setState(previous=>previous.blocked===next.blocked&&previous.hint===next.hint?previous:next),[]);
  const blocked=enabled&&state.blocked;
  const continuation=useRef(true);
  useLayoutEffect(()=>{
    continuation.current=!blocked;
    onGenerationPermissionChange?.(!disabled&&!blocked);
  },[disabled,blocked,onGenerationPermissionChange]);
  useLayoutEffect(()=>()=>{continuation.current=false;},[]);
  const generate=useCallback(()=>{
    if(disabled||blocked)return;
    onStart();
    onGenerate?.(()=>continuation.current);
  },[disabled,blocked,onStart,onGenerate]);
  return {blocked,hint:blocked?state.hint:null,update,generate};
}
