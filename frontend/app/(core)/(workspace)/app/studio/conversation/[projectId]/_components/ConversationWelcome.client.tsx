'use client';

import {ArrowUpRight} from 'lucide-react';
import type {ConversationLocale} from '@/lib/studio/conversation-quote-presentation';
import styles from '../image-conversation.module.css';

export function ConversationWelcome({locale, onDraft,hasDraft=false}: {locale: ConversationLocale; onDraft: (value: string) => void;hasDraft?:boolean}) {
  const t = (en: string,fr: string) => locale === 'fr' ? fr : en;
  return <div className={styles.welcome} data-drafting={hasDraft}>
    <h2>{t('What would you like to','Qu’avez-vous envie de')} <span>{t('do?','faire ?')}</span></h2>
    <p>{t('Just describe your idea. Milo handles the prompts and tools.','Décrivez simplement votre idée. Milo s’occupe des prompts et des outils.')}</p>
    {!hasDraft&&<div className={styles.starters} aria-label={t('Ways to start','Pour commencer')}>
      <button onClick={() => onDraft(t('I’d like to create a video of ','J’aimerais créer une vidéo de '))}>
        <span>{t('Create a video','Créer une vidéo')}</span><ArrowUpRight size={12} aria-hidden="true"/>
      </button>
      <button onClick={() => onDraft(t('Help me develop an idea for ','Aide-moi à développer une idée pour '))}>
        <span>{t('Develop an idea','Développer une idée')}</span><ArrowUpRight size={12} aria-hidden="true"/>
      </button>
      <button onClick={() => onDraft(t('I’d like to extend a clip. ','J’aimerais prolonger un clip. '))}>
        <span>{t('Extend a clip','Prolonger un clip')}</span><ArrowUpRight size={12} aria-hidden="true"/>
      </button>
      <button onClick={() => onDraft(t('I’d like to edit an image. ','J’aimerais modifier une image. '))}>
        <span>{t('Edit an image','Modifier une image')}</span><ArrowUpRight size={12} aria-hidden="true"/>
      </button>
    </div>}
  </div>;
}
