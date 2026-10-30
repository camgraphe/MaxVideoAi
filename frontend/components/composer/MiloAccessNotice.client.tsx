'use client';
import styles from './prompt-assistance.module.css';

/** Application feedback: never represented as an assistant reply or a purchase. */
export function MiloAccessNotice({authRequired=false,canUseLite=true,busy=false,onLite,onCredits,liteLabel='Send with Lite',placement='feedback'}:{authRequired?:boolean;canUseLite?:boolean;busy?:boolean;onLite:()=>void;onCredits:()=>void;liteLabel?:string;placement?:'feedback'|'input'}) {
  if(authRequired) {
    const signIn = <a href={`/login?next=${encodeURIComponent(typeof window==='undefined'?'/app':window.location.pathname+window.location.search)}`}>Sign in to chat</a>;
    return placement === 'input'
      ? <div className={styles.inputNotice} role="status">{signIn} with Milo. Lite is free.</div>
      : <div className={styles.liveFeedback} role="status"><span>Sign in to chat with Milo. Lite is free.</span>{signIn}</div>;
  }
  return <div className={styles.liveFeedback} role="status">
    <span>{canUseLite?'Not enough credits for this message. Continue for free with Milo Lite.':'Not enough credits for this message. Free Lite is unavailable right now.'}</span>
    {canUseLite&&<button type="button" disabled={busy} onClick={onLite}>{liteLabel}</button>}
    <button type="button" disabled={busy} onClick={onCredits}>Add credits</button>
  </div>;
}
