import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import type { AppLocale } from '@/i18n/locales';
import type { buildExamplesPromptStarters } from '../_lib/examples-page-copy';
import styles from './examples-editorial.module.css';

type Props = { locale: AppLocale; starters: ReturnType<typeof buildExamplesPromptStarters> };

export function ExamplesPromptStarters({ locale, starters }: Props) {
  if (!starters.length) return null;
  const title = locale === 'fr' ? 'Un prompt, une version précise' : locale === 'es' ? 'Un prompt, una versión concreta' : 'A prompt, a specific version';
  const action = locale === 'fr' ? 'Ouvrir le prompt et les réglages' : locale === 'es' ? 'Abrir el prompt y los ajustes' : 'Open prompt & settings';
  return (
    <section className={styles.promptStarters} aria-labelledby="examples-prompt-starters-title">
      <h2 id="examples-prompt-starters-title">{title}</h2>
      <div className={styles.promptStarterGrid}>
        {starters.map(starter => (
          <article key={starter.href}>
            <h3>{starter.engineLabel}</h3>
            <p className={styles.promptStarterSettings}>{[`${starter.durationSec} s`, starter.aspectRatio].filter(Boolean).join(' · ')}{starter.hasAudio ? ` · ${locale === 'fr' ? 'avec audio' : locale === 'es' ? 'con audio' : 'with audio'}` : ''}</p>
            <blockquote>{starter.prompt}</blockquote>
            <Link href={starter.href} prefetch={false} className={styles.textAction}
              aria-label={`${action} · ${starter.engineLabel}`}
              data-analytics-event="cta_click" data-analytics-cta-name="view_example_details" data-analytics-cta-location="examples_gallery">
              {action}<ArrowUpRight size={14} aria-hidden="true" />
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
