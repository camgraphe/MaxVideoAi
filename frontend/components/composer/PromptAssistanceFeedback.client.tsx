'use client';
import styles from './prompt-assistance.module.css';

export function PromptAssistanceFeedback({error,recovery,waiting,onRecover,onStop,onReload}: {
  error:string|null;recovery:boolean;waiting:boolean;onRecover:()=>void;onStop:()=>void;onReload?:()=>void;
}) {
  if(!error&&!waiting&&!recovery)return null;
  const message=error==='RESTORING'?'Restoring this conversation…':error==='RESTORE_FAILED'?'Could not restore this chat. Try again before continuing.':recovery
    ? 'Check this reply before sending another message. Stopping the wait does not cancel a call already started.'
    : error==='CONTEXT_TOO_LARGE'||error==='DRAFT_TOO_LONG'||error==='BODY_TOO_LARGE'
      ? 'This request is too long. Shorten the draft or message and try again.'
    : error==='REFERENCE_IMAGES_TOO_LARGE'
      ? 'These images are too large to inspect together. Remove some references and try again.'
    : error==='REFERENCE_REATTACH_REQUIRED'||error?.startsWith('REFERENCE_')||error==='MEDIA_NOT_AVAILABLE'
      ? 'One reference is unavailable. Choose it again from Media before retrying.'
    : error==='ASSISTANCE_SELECTION_CHANGED'
      ? 'Milo changed in another tab. Review the selected level before sending again.'
    : error==='SPENDING_LIMIT_EXCEEDED'
      ? 'Open Milo settings to check your credits and available levels.'
    : error==='SESSION_EXPIRED'||error==='SESSION_FULL'||error==='SESSION_SCOPE_CHANGED'||error==='LEGACY_SESSION'
      ? 'This conversation is closed. You can still review its replies. Start a new chat to continue.'
    : error==='REQUEST_PENDING'
      ? 'Another Milo request is still pending. Check it in the workspace where you sent it.'
    : error==='OUTPUT_INVALID'
      ? 'Milo could not return a usable suggestion. Recorded usage still applies; you can try a simpler request.'
    : error==='OUTPUT_INCOMPLETE'||error==='OUTPUT_TOO_LONG'
      ? 'Milo could not finish a suggestion within this request’s limits. Your draft is unchanged. Recorded usage still applies.'
    : error==='OUTPUT_REFUSED'
      ? 'Milo could not help with this request. Your draft is unchanged. Recorded usage still applies.'
    : error==='MODEL_UNAVAILABLE'||error==='TARGET_UNSUPPORTED'
      ? 'Milo is not available for this model or writing mode yet.'
    : error==='ASSISTANCE_RECOVERY_REQUIRED'
      ? 'Several Milo replies could not be recovered. Their credit holds were released. Contact support before sending another message.'
    : error==='REQUEST_UNANSWERED'
      ? 'Milo could not return this reply. Your draft is unchanged and this request’s credit hold was released. You can send a new message.'
    : error==='REQUEST_DEADLINE'
      ? 'Milo took too long to prepare this request. You can send it again.'
    : error==='SUPPORT_CLOSED'
      ? 'This request was closed by support. You can send a new message.'
    : error==='REQUEST_NOT_FOUND'
      ? 'No saved request was found. You can send your message again.'
    : error==='LOADING'?'Checking Milo availability…'
    : error ? 'Milo is unavailable right now. Check your connection or refresh your credits.' : null;
  return <div className={styles.liveFeedback} role="status">
    {message&&<span>{message}</span>}
    {error==='RESTORE_FAILED'?<button type="button" onClick={onReload}>Retry loading chat</button>:waiting?<button type="button" onClick={onStop}>Stop waiting</button>:recovery?<button type="button" onClick={onRecover}>Check reply</button>:null}
  </div>;
}
