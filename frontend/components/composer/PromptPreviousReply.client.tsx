'use client';
import type {PromptAssistanceResult} from '@/lib/prompt-assistance/contract';
import {PromptAssistanceFeedback} from './PromptAssistanceFeedback.client';
import styles from './prompt-assistance.module.css';

/** Deliberately receives no active-chat restore, review, application or generation callback. */
export function PromptPreviousReply({result,error,waiting,onCheck,onStop,onClose}:{result:PromptAssistanceResult|null;error:string|null;waiting:boolean;onCheck:()=>void;onStop:()=>void;onClose:()=>void}){
  return <section className={styles.previousReply} role="region" aria-label="Previous Milo reply">
    <div className={styles.previousReplyHeader}><strong>Previous Milo reply</strong><button type="button" onClick={onClose}>Close previous reply</button></div>
    <p>Read-only reply from the original chat. Your current message and prompt stay unchanged.</p>
    {result?.state==='complete'&&result.reply?<><div className={styles.previousReplyText}>{result.reply.reply}</div>{result.reply.text?<div className={styles.previousReplyText}>{result.reply.text}</div>:null}</>:<PromptAssistanceFeedback error={error??(result?.state==='unknown'?'USAGE_UNRESOLVED':result?.state==='failed'?result.error??'ASSISTANCE_UNAVAILABLE':null)} recovery={result?.state!=='failed'} waiting={waiting} phase={result?.phase} onRecover={onCheck} onStop={onStop}/>}
  </section>;
}
