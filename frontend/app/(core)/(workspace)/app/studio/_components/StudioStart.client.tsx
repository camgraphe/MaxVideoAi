'use client';

import {useEffect,useRef} from 'react';
import {useRouter} from 'next/navigation';
import {useI18n} from '@/lib/i18n/I18nProvider';
import {useThemePreference} from '@/hooks/useThemePreference';
import {useStudioProjectCreation} from '../_hooks/useStudioProjectCreation';
import {studioConversationEntryCopy} from '../_lib/studio-conversation-entry';
import {ConversationWelcome} from '../conversation/[projectId]/_components/ConversationWelcome.client';
import {ImageConversationComposer} from '../conversation/[projectId]/_components/ImageConversationComposer.client';
import styles from '../conversation/[projectId]/image-conversation.module.css';

export function StudioStart({accountKey,unavailable=false,starter,continuationToken}:{accountKey:string;unavailable?:boolean;starter?:string;continuationToken?:string}) {
  const router=useRouter(),{locale}=useI18n(),{resolvedTheme}=useThemePreference();
  const copy=studioConversationEntryCopy(locale);
  const query=new URLSearchParams();
  if(starter)query.set('starter',starter);
  if(continuationToken)query.set('continueDraft',continuationToken);
  const creation=useStudioProjectCreation(accountKey,projectId=>router.replace('/app/studio/conversation/'+encodeURIComponent(projectId)+(query.size?'?'+query.toString():'')));
  const {create}=creation;
  const libraryTrigger=useRef<HTMLButtonElement>(null);
  useEffect(()=>{if(!unavailable)void create(copy.projectName);},[create,copy.projectName,unavailable]);
  return <section className={styles.studio} data-tone={resolvedTheme==='light'?'olive':'charcoal'} aria-label={locale==='fr'?'Studio conversationnel':'Conversational Studio'}>
    <header className={styles.header}><div><h1>Studio<span className={styles.headerDot}>.</span></h1></div></header>
    <div className={styles.canvas}><div className={styles.conversation} data-empty="true">
      <div className={styles.log}><ConversationWelcome locale={locale==='fr'?'fr':'en'} hasDraft onDraft={()=>{}} onReference={()=>{}}/></div>
      <ImageConversationComposer text="" onTextChange={()=>{}} onSend={()=>{}} blocked readOnly libraryTrigger={libraryTrigger} onOpenLibrary={()=>{}} locale={locale==='fr'?'fr':'en'}/>
      {unavailable||creation.error?<div className={styles.error} role="alert"><p>{unavailable?copy.unavailable:copy[creation.error!]}</p><button onClick={()=>unavailable?router.refresh():void create(copy.projectName)}>{copy.retry}</button></div>:<p className={styles.footnote} role="status">{copy.opening}</p>}
    </div></div>
  </section>;
}
