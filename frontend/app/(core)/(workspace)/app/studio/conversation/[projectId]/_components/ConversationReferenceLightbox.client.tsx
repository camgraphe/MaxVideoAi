'use client';
import {useEffect,useRef} from 'react';
import {X} from 'lucide-react';
import type {ConversationLocale} from '@/lib/studio/conversation-quote-presentation';
import styles from '../conversation-media-shelf.module.css';

export function ConversationReferenceLightbox({url,label,locale,onClose}:{url:string;label:string;locale:ConversationLocale;onClose:()=>void}) {
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{
    const returnTarget=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const element=dialog.current;element?.showModal();
    return()=>{element?.close();returnTarget?.focus();};
  },[]);
  return <dialog ref={dialog} className={styles.lightbox} aria-label={label} onCancel={event=>{event.preventDefault();onClose();}} onClick={event=>{if(event.target===event.currentTarget)onClose();}}>
    <div><span>{label}</span><button autoFocus onClick={onClose} aria-label={locale==='fr'?'Fermer l’aperçu':'Close preview'}><X size={20}/></button></div>
    <img src={url} alt={label}/>
  </dialog>;
}
