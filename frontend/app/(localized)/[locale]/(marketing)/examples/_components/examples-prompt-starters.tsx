import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import type { AppLocale } from '@/i18n/locales';
import type { ExamplesVersionLink } from '../_lib/examples-version-links';
import styles from './examples-editorial.module.css';

type Props = { locale: AppLocale; starters: ExamplesVersionLink[] };

export function ExamplesPromptStarters({ locale, starters }: Props) {
  if (!starters.length) return null;
  const title = locale === 'fr' ? 'Vidéos et prompts par version' : locale === 'es' ? 'Videos y prompts por versión' : 'Videos and prompts by version';
  const action = locale === 'fr' ? 'Voir la vidéo et son prompt complet' : locale === 'es' ? 'Ver el video y su prompt completo' : 'View video and full prompt';
  return (
    <nav className={styles.promptStarters} aria-labelledby="examples-prompt-starters-title">
      <p id="examples-prompt-starters-title">{title}</p>
      {[true, false].map(current => {
        const links = starters.filter(starter => starter.current === current);
        if (!links.length) return null;
        const group = current
          ? locale === 'fr' ? 'Versions récentes' : locale === 'es' ? 'Versiones actuales' : 'Current versions'
          : locale === 'fr' ? 'Versions historiques' : locale === 'es' ? 'Versiones anteriores' : 'Earlier versions';
        return (
          <div key={group} className={styles.promptVersionGroup}>
            <span>{group}</span>
            <ul aria-label={group}>
              {links.map(starter => (
                <li key={starter.href}>
                  <Link href={starter.href} prefetch={false} className={styles.textAction}
                    aria-label={`${action} · ${starter.engineLabel}`}
                    data-analytics-event="cta_click" data-analytics-cta-name="view_example_details" data-analytics-cta-location="examples_gallery">
                    {starter.engineLabel}<ArrowUpRight size={14} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
