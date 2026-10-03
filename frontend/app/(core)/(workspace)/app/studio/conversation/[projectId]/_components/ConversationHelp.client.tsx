'use client';

import {useEffect,useRef,type RefObject} from 'react';
import {X,Plus,MessageCircle,SlidersHorizontal,Wallet} from 'lucide-react';
import type {ConversationLocale} from '@/lib/studio/conversation-quote-presentation';
import styles from '../image-conversation.module.css';

export function ConversationHelp({locale,editingEnabled,onClose,trigger}: {locale: ConversationLocale;editingEnabled: boolean;onClose: () => void;trigger: RefObject<HTMLButtonElement>}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const t = (en: string,fr: string) => locale === 'fr' ? fr : en;
  useEffect(() => {
    const element = dialog.current;
    const returnTarget = trigger.current;
    element?.showModal();
    return () => {element?.close();returnTarget?.focus();};
  },[trigger]);
  return <dialog ref={dialog} className={styles.help} aria-labelledby="studio-help-title" onCancel={event => {event.preventDefault();onClose();}} onClick={event => {if (event.target === event.currentTarget) {const box=event.currentTarget.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)onClose();}}}>
    <div className={styles.helpHeading}><div><span className={styles.eyebrow}>STUDIO</span><h2 id="studio-help-title">{t('Make it yours.','À vous de créer.')}</h2></div><button autoFocus onClick={onClose} aria-label={t('Close help','Fermer l’aide')}><X size={18}/></button></div>
    <p className={styles.helpIntro}>{t('Start small or think big. You decide how far to take it.','Une simple idée ou un grand projet. Vous décidez jusqu’où aller.')}</p>
    <dl>
      <div><MessageCircle size={19}/><dt>{t('Ask in your own words','Parlez naturellement')}</dt><dd>{t('Develop an idea, improve a prompt, create media or ask for an edit. Studio can recommend a model and explain its choice.','Développez une idée, affinez un prompt, créez un média ou demandez une retouche. Studio peut conseiller un modèle et expliquer son choix.')}</dd></div>
      <div><Plus size={19}/><dt>{t('Bring your references','Apportez vos références')}</dt><dd>{t('The + beside your message opens saved media, recent creations and file import. Attaching a reference does not add it to a sequence.','Le + près du message ouvre vos médias, créations récentes et l’import. Joindre une référence ne l’ajoute pas au montage.')}</dd></div>
      <div><Wallet size={19}/><dt>{t('Review before you create','Vérifiez avant de créer')}</dt><dd>{t('A quote shows the model, settings and current price. You confirm before a generation starts. Ask for a different approach or a lower-cost option whenever you need.','Un devis indique le modèle, les réglages et le prix actuel. Vous confirmez avant de générer. Demandez une autre approche ou une option moins coûteuse à tout moment.')}</dd></div>
      {editingEnabled && <div><SlidersHorizontal size={19}/><dt>{t('Keep a hand on the edit','Gardez la main sur le montage')}</dt><dd>{t('Open Timeline to arrange clips, adjust duration and sound, or preview your sequence. You can also describe the change in the conversation. Collapse it whenever you want more room.','Ouvrez Timeline pour déplacer les clips, régler leur durée et le son ou lire le montage. Vous pouvez aussi décrire la modification dans la conversation. Repliez-la pour retrouver de l’espace.')}</dd></div>}
    </dl>
    <p className={styles.helpFooter}>{t('A prompt, an image or a finished sequence — the right result is the one you asked for.','Un prompt, une image ou un montage terminé : le bon résultat est celui que vous demandez.')}</p>
  </dialog>;
}
