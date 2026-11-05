'use client';
import Link from 'next/link';
import type {PromptAssistanceResult} from '@/lib/prompt-assistance/contract';
import styles from './prompt-assistance.module.css';

export const promptAssistanceLoadingMessage=(error:string|null)=>error==='RESTORING'?'Restoring this conversation…':error==='LOADING'?'Checking Milo availability…':null;

export function PromptAssistanceFeedback({error,unavailableReferenceLabel,recovery,waiting,onRecover,onStop,onReload,onCredits,phase,localReference,onManageReference,locale='en'}: {
  phase?:PromptAssistanceResult['phase'];error:string|null;unavailableReferenceLabel?:string|null;recovery:boolean;waiting:boolean;onRecover:()=>void;onStop:()=>void;onReload?:()=>void;onCredits?:()=>void;
  localReference?:{label:string}|null;onManageReference?:()=>void;locale?:string;
}) {
  if(localReference&&!waiting&&!recovery){
    const label=localReference.label;
    const message=locale.startsWith('fr')?`La référence ${label} n’est pas prête pour Milo. Attends la fin d’un éventuel import, ou remplace ou retire cette référence. Ton message n’a pas été envoyé.`
      :locale.startsWith('es')?`La referencia ${label} aún no está disponible para Milo. Espera a que termine la carga, o sustituye o elimina esta referencia. Tu mensaje no se ha enviado.`
      :`${label} isn’t ready for Milo. Wait for any upload to finish, or replace or remove this reference. Your message has not been sent.`;
    return <div className={styles.liveFeedback} role="status"><span>{message}</span>{onManageReference?<button type="button" onClick={onManageReference}>{locale.startsWith('fr')?'Gérer':locale.startsWith('es')?'Gestionar':'Manage'} {label}</button>:null}</div>;
  }
  if(!error&&!waiting&&!recovery)return null;
  const message=waiting?(phase==='queued'?'Your request is saved and waiting to start.':phase==='preparing'?'Milo is preparing your saved request.':phase==='recovering'?'Checking the saved reply and recorded usage.':'Waiting for Milo’s saved reply. You can stop waiting or start a new chat.'):error==='RESTORING'?promptAssistanceLoadingMessage(error):error==='RESTORE_FAILED'?'Could not restore this chat. Try again before continuing.':recovery
    ? 'Check this reply before sending another message. Stopping the wait does not cancel a call already started.'
    : error==='MESSAGE_TOO_LONG'||error==='CONTEXT_TOO_LARGE'||error==='DRAFT_TOO_LONG'||error==='BODY_TOO_LARGE'
      ? 'This request is too long. Shorten the draft or message and try again.'
    : error==='REFERENCE_IMAGES_TOO_LARGE'
      ? 'These images are too large to inspect together. Remove some references and try again.'
    : error==='REFERENCE_REATTACH_REQUIRED'||error?.startsWith('REFERENCE_')||error==='MEDIA_NOT_AVAILABLE'
      ? unavailableReferenceLabel
        ? `Milo couldn’t use ${unavailableReferenceLabel} for this message. Open References to replace or remove it, then send again.`
        : 'A reference is unavailable. Open References to remove or replace it before resending.'
    : error==='ASSISTANCE_SELECTION_CHANGED'
      ? 'Milo changed in another tab. Review the selected level before sending again.'
    : error==='SPENDING_LIMIT_EXCEEDED'
      ? 'There aren’t enough Milo credits for this message’s credit reservation at the selected level. Some credits may remain. Click Milo to review your credits and available levels.'
    : error==='SESSION_EXPIRED'||error==='SESSION_FULL'||error==='SESSION_SCOPE_CHANGED'||error==='LEGACY_SESSION'
      ? 'This conversation is closed. You can still review its replies. Start a new chat to continue.'
    : error==='WAIT_DEADLINE'
      ? 'The saved waiting deadline has passed. Check the same reply to resolve its status before sending again.'
    : error==='REQUEST_PENDING'
      ? 'Another Milo request is still pending. Check it in the workspace where you sent it.'
    : error==='OUTPUT_INVALID'
      ? 'Milo could not return a usable suggestion. Recorded usage still applies; you can try a simpler request.'
    : error==='OUTPUT_INVALID_CREDITS_RESTORED'
      ? 'Milo’s reply could not be delivered. The credits charged for this request were restored. Your draft is unchanged; you can send a new message.'
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
    : error==='LOADING'?promptAssistanceLoadingMessage(error)
    : error ? 'Milo is unavailable right now. Check your connection or refresh your credits.' : null;
  return <div className={styles.liveFeedback} role="status">
    {message&&<span>{message}</span>}
    {!waiting&&!recovery&&error==='SPENDING_LIMIT_EXCEEDED'&&onCredits?<button type="button" onClick={onCredits}>Credits and levels</button>:null}
    {!waiting&&!recovery&&error==='ASSISTANCE_RECOVERY_REQUIRED'?<Link href="/contact" prefetch={false}>Contact support</Link>:null}
    {error==='RESTORE_FAILED'?<button type="button" onClick={onReload}>Retry loading chat</button>:waiting?<button type="button" onClick={onStop}>Stop waiting</button>:recovery?<button type="button" onClick={onRecover}>Check reply</button>:null}
  </div>;
}
