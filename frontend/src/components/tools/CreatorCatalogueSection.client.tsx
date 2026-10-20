'use client';
import Link from 'next/link';
import { CREATOR_TOOLBOX, type ToolMediaKind } from '@/lib/toolbox/catalogue';
import { isCreatorToolPublic } from '@/lib/toolbox/creator-availability';
import { CreatorToolMark } from './creator-marketing/CreatorIllustrations';
import { getCreatorMarketingCopy } from './creator-marketing/creator-copy';
import styles from './tools-catalogue.module.css';

export default function CreatorCatalogueSection({ locale, filter, onSelect }: {
  locale: string; filter: ToolMediaKind | 'all'; onSelect?: (id: string, kind?: ToolMediaKind) => void;
}) {
  const language = locale.startsWith('fr') ? 'fr' : locale.startsWith('es') ? 'es' : 'en';
  const tools = CREATOR_TOOLBOX.filter(tool => isCreatorToolPublic(tool.id) && (filter === 'all' || tool.inputKinds.includes(filter)));
  if (!tools.length) return null;
  return <section className={styles.workshopSection}>
    <div className={styles.sectionBar}><h2>{language === 'fr' ? 'Créer et retoucher' : language === 'es' ? 'Crear y editar' : 'Create and edit'}</h2></div>
    <ul className={styles.workshopGrid}>{tools.map(tool => {
      const copy = getCreatorMarketingCopy(language, tool.id);
      const content = <><div className={styles.workshopArt}><CreatorToolMark id={tool.id} /></div>
        <div className={styles.workshopCaption}><h3>{copy.name}</h3><p>{copy.input}</p></div></>;
      return <li key={tool.id}>{onSelect
        ? <button type="button" className={styles.workshop} onClick={() => onSelect(tool.id, filter === 'all' ? undefined : filter)}>{content}</button>
        : <Link href={tool.href} prefetch={false} className={styles.workshop}>{content}</Link>}</li>;
    })}</ul>
  </section>;
}
