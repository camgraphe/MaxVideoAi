'use client';

import {ArrowUpRight} from 'lucide-react';
import type {ConversationLocale} from '@/lib/studio/conversation-quote-presentation';
import styles from '../image-conversation.module.css';

export function ConversationWelcome({locale, onDraft, onReference,hasDraft=false}: {locale: ConversationLocale; onDraft: (value: string) => void; onReference: () => void;hasDraft?:boolean}) {
  const t = (en: string,fr: string) => locale === 'fr' ? fr : en;
  return <div className={styles.welcome} data-drafting={hasDraft}>
    <h2>{t('What shall we','Et si l’on')} <span>{t('create?','créait ?')}</span></h2>
    <p>{t('A thought, a prompt, a reference. Start anywhere.','Une idée, un prompt, une référence. Partez de ce que vous avez.')}</p>
    {!hasDraft&&<div className={styles.starters} aria-label={t('Ways to start','Pour commencer')}>
      <button onClick={() => onDraft(t('Help me develop an idea for ','Aide-moi à développer une idée pour '))}>
        <span>{t('Explore an idea','Explorer une idée')}</span><ArrowUpRight size={12} aria-hidden="true"/>
      </button>
      <button onClick={() => onDraft(t('Help me write a prompt for ','Aide-moi à écrire un prompt pour '))}>
        <span>{t('Shape a prompt','Affiner un prompt')}</span><ArrowUpRight size={12} aria-hidden="true"/>
      </button>
      <button onClick={onReference}>
        <span>{t('Start with a reference','Partir d’une référence')}</span><ArrowUpRight size={12} aria-hidden="true"/>
      </button>
    </div>}
  </div>;
}
