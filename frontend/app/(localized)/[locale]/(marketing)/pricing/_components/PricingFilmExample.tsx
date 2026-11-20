import { ArrowUpRight } from 'lucide-react';
import Image from 'next/image';
import NextLink from 'next/link';
import type { AppLocale } from '@/i18n/locales';
import styles from './pricing-opening.module.css';

const copy = {
  en: ['One clip, three frames', 'Hard Bounce · Seedance 2.5 music video', 'Watch the clip and see its settings'],
  fr: ['Un clip en trois images', 'Hard Bounce · Clip musical réalisé avec Seedance 2.5', 'Voir le clip et ses réglages'],
  es: ['Un clip en tres fotogramas', 'Hard Bounce · Vídeo musical creado con Seedance 2.5', 'Ver el clip y sus ajustes'],
};

export function PricingFilmExample({ locale }: { locale: AppLocale }) {
  const [title, description, link] = copy[locale];
  return (
    <NextLink prefetch={false} href="/video/seedance-2-5-hard-bounce-ai-music-video" className={styles.proof}>
      <div><h2>{title}</h2><p>{description}</p><span>{link} <ArrowUpRight size={15} aria-hidden="true" /></span></div>
      <Image unoptimized src="/assets/marketing/payg/seedance-contact.webp" width={520} height={454} loading="lazy" alt="" />
    </NextLink>
  );
}
