'use client';

import {useCallback,useEffect,useRef} from 'react';
import {useRouter} from 'next/navigation';
import {useI18n} from '@/lib/i18n/I18nProvider';
import {useThemePreference} from '@/hooks/useThemePreference';
import {consumeGuestCreationFromLocation,peekGuestCreation} from '@/lib/guest-creation-continuation';
import {useStudioProjectCreation} from '../_hooks/useStudioProjectCreation';
import {studioConversationEntryCopy} from '../_lib/studio-conversation-entry';
import {parseStudioGuestDraft} from '../_lib/studio-guest-draft';
import {ConversationWelcome} from '../conversation/[projectId]/_components/ConversationWelcome.client';
import {ImageConversationComposer} from '../conversation/[projectId]/_components/ImageConversationComposer.client';
import styles from '../conversation/[projectId]/image-conversation.module.css';

export function StudioStart({accountKey,unavailable=false,starter,continuationToken,recentProjectId}:{accountKey:string;unavailable?:boolean;starter?:string;continuationToken?:string;recentProjectId?:string}) {
  const router=useRouter(),{locale}=useI18n(),{resolvedTheme}=useThemePreference();
  const copy=studioConversationEntryCopy(locale);
  const verifiedToken=useRef<string>();
  const creation=useStudioProjectCreation(accountKey,projectId=>{
    const query=new URLSearchParams();
    if(starter)query.set('starter',starter);
    if(verifiedToken.current)query.set('continueDraft',verifiedToken.current);
    router.replace('/app/studio/conversation/'+encodeURIComponent(projectId)+(query.size?'?'+query.toString():''));
  });
  const {create}=creation;
  const libraryTrigger=useRef<HTMLButtonElement>(null);
  const open=useCallback(()=>{
    if(unavailable)return;
    let draft:string|null=null;
    try{draft=parseStudioGuestDraft(peekGuestCreation(window.sessionStorage,'/app/studio',continuationToken??null));}catch{/* Optional same-tab storage may be unavailable. */}
    verifiedToken.current=draft?continuationToken:undefined;
    if(continuationToken&&!draft){
      consumeGuestCreationFromLocation('/app/studio');
      if(recentProjectId&&!starter){router.replace('/app/studio/conversation/'+encodeURIComponent(recentProjectId));return;}
    }
    void create(copy.projectName);
  },[unavailable,continuationToken,recentProjectId,starter,router,create,copy.projectName]);
  useEffect(()=>{open();},[open]);
  return <section className={styles.studio} data-tone={resolvedTheme==='light'?'olive':'charcoal'} aria-label={locale==='fr'?'Studio conversationnel':'Conversational Studio'}>
    <header className={styles.header}><div><h1>Studio<span className={styles.headerDot}>.</span></h1></div></header>
    <div className={styles.canvas}><div className={styles.conversation} data-empty="true">
      <div className={styles.log}><ConversationWelcome locale={locale==='fr'?'fr':'en'} hasDraft onDraft={()=>{}} onReference={()=>{}}/></div>
      <ImageConversationComposer text="" onTextChange={()=>{}} onSend={()=>{}} blocked readOnly libraryTrigger={libraryTrigger} onOpenLibrary={()=>{}} locale={locale==='fr'?'fr':'en'}/>
      {unavailable||creation.error?<div className={styles.error} role="alert"><p>{unavailable?copy.unavailable:copy[creation.error!]}</p><button onClick={()=>unavailable?router.refresh():open()}>{copy.retry}</button></div>:<p className={styles.footnote} role="status">{copy.opening}</p>}
    </div></div>
  </section>;
}
