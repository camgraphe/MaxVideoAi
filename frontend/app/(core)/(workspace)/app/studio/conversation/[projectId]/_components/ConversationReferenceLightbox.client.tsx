'use client';
import {useEffect,useRef,type RefObject} from 'react';
import {X} from 'lucide-react';
import type {ConversationLocale} from '@/lib/studio/conversation-quote-presentation';
import styles from '../conversation-media-shelf.module.css';

export function ConversationReferenceLightbox({url,label,locale,onClose,trigger}:{url:string;label:string;locale:ConversationLocale;onClose:()=>void;trigger:RefObject<HTMLButtonElement>}) {
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{
    const returnTarget=trigger.current;
    const element=dialog.current;element?.showModal();
    return()=>{element?.close();returnTarget?.focus();};
  },[trigger]);
  return <dialog ref={dialog} className={styles.lightbox} aria-label={label} onCancel={event=>{event.preventDefault();onClose();}} onClick={event=>{if(event.target===event.currentTarget)onClose();}}>
    <div><span>{label}</span><button autoFocus onClick={onClose} aria-label={locale==='fr'?'Fermer l’aperçu':'Close preview'}><X size={20}/></button></div>
    <img src={url} alt={label}/>
  </dialog>;
}
