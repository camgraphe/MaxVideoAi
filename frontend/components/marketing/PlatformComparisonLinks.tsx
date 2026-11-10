import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import type { AppLocale } from '@/i18n/locales';
import { localizePathFromEnglish } from '@/lib/i18n/paths';
import styles from './platform-comparison-links.module.css';

const paths = ['/higgsfield-alternative', '/openart-alternative', '/blog/compare-ai-video-platforms', '/blog/ai-video-project-cost'] as const;
const copy = {
  en: { title: 'Keep comparing what matters to your project.', labels: ['MaxVideoAI & Higgsfield', 'MaxVideoAI & OpenArt', 'Choose a video platform', 'Budget for your attempts'] },
  fr: { title: 'Comparez ce qui compte pour votre projet.', labels: ['MaxVideoAI et Higgsfield', 'MaxVideoAI et OpenArt', 'Choisir une plateforme vidéo', 'Prévoir le budget des essais'] },
  es: { title: 'Compara lo que importa para tu proyecto.', labels: ['MaxVideoAI e Higgsfield', 'MaxVideoAI y OpenArt', 'Elegir una plataforma de vídeo', 'Prever el coste de los intentos'] },
};

export function PlatformComparisonLinks({ locale, current }: { locale: AppLocale; current: typeof paths[number] }) {
  return <nav className={styles.nav} aria-label={copy[locale].title}>
    <p>{copy[locale].title}</p>
    <ul>{paths.map((path, i) => path === current ? null : <li key={path}><Link href={localizePathFromEnglish(locale, path)} prefetch={false}>{copy[locale].labels[i]}<ArrowUpRight size={17} aria-hidden="true" /></Link></li>)}</ul>
  </nav>;
}
