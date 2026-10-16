import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import type { AppLocale } from '@/i18n/locales';
import type { buildExamplesPromptStarters } from '../_lib/examples-page-copy';
import styles from './examples-editorial.module.css';

type Props = { locale: AppLocale; starters: ReturnType<typeof buildExamplesPromptStarters> };

export function ExamplesPromptStarters({ locale, starters }: Props) {
  if (!starters.length) return null;
  const title = locale === 'fr' ? 'Ouvrir une vidéo et son prompt complet :' : locale === 'es' ? 'Abre un video y su prompt completo:' : 'Open a video and its full prompt:';
  const action = locale === 'fr' ? 'Voir la vidéo et son prompt complet' : locale === 'es' ? 'Ver el video y su prompt completo' : 'View video and full prompt';
  return (
    <nav className={styles.promptStarters} aria-labelledby="examples-prompt-starters-title">
      <p id="examples-prompt-starters-title">{title}</p>
      <ul>
        {starters.map(starter => (
          <li key={starter.href}>
            <Link href={starter.href} prefetch={false} className={styles.textAction}
              aria-label={`${action} · ${starter.engineLabel}`}
              data-analytics-event="cta_click" data-analytics-cta-name="view_example_details" data-analytics-cta-location="examples_gallery">
              {starter.engineLabel}<ArrowUpRight size={14} aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
