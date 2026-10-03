'use client';

import {ArrowUpRight, Lightbulb, PenLine, ImagePlus, Sparkles} from 'lucide-react';
import type {ConversationLocale} from '@/lib/studio/conversation-quote-presentation';
import styles from '../image-conversation.module.css';

export function ConversationWelcome({locale, onDraft, onReference}: {locale: ConversationLocale; onDraft: (value: string) => void; onReference: () => void}) {
  const t = (en: string,fr: string) => locale === 'fr' ? fr : en;
  return <div className={styles.welcome}>
    <div className={styles.eyebrow}><Sparkles size={15} aria-hidden="true"/>{t('A little direction. Endless possibilities.','Un peu de direction. Toutes les possibilités.')}</div>
    <h2>{t('What would you like','Que souhaitez-vous')}<br/><span>{t('to create?','créer ?')}</span></h2>
    <p>{t('Explore an idea, shape a prompt, or make something new.','Explorez une idée, affinez un prompt ou créez quelque chose.')}<br/>{t('Start wherever you are. We’ll work on it together.','Partez de ce que vous avez. Créons ensemble.')}</p>
    <div className={styles.starters} aria-label={t('Ways to start','Pour commencer')}>
      <button onClick={() => onDraft(t('Help me develop an idea for ','Aide-moi à développer une idée pour '))}>
        <Lightbulb size={18} aria-hidden="true"/><span><strong>{t('Explore an idea','Explorer une idée')}</strong><small>{t('Find the right direction','Trouver une direction')}</small></span><ArrowUpRight size={15} aria-hidden="true"/>
      </button>
      <button onClick={() => onDraft(t('Help me write a prompt for ','Aide-moi à écrire un prompt pour '))}>
        <PenLine size={18} aria-hidden="true"/><span><strong>{t('Shape a prompt','Affiner un prompt')}</strong><small>{t('Give your vision detail','Préciser votre vision')}</small></span><ArrowUpRight size={15} aria-hidden="true"/>
      </button>
      <button onClick={onReference}>
        <ImagePlus size={18} aria-hidden="true"/><span><strong>{t('Start with a reference','Partir d’une référence')}</strong><small>{t('Bring something of your own','Apporter vos médias')}</small></span><ArrowUpRight size={15} aria-hidden="true"/>
      </button>
    </div>
  </div>;
}
