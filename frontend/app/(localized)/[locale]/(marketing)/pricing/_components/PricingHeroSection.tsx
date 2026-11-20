import { ArrowDown, ArrowUpRight, Play, AudioLines, Film, Image as ImageIcon, SlidersHorizontal } from 'lucide-react';
import Image from 'next/image';
import NextLink from 'next/link';
import type { AppLocale } from '@/i18n/locales';
import type { OpeningRow } from '../_lib/pricing-opening';
import { pricingOpeningCopy } from '../_lib/pricing-opening-copy';
import { PricingCopy } from './PricingCopy.client';
import styles from './pricing-feature.module.css';

const comparisonStills = {
  'seedance-2-0-mini': { src: '/assets/pricing/seedance-mini-last-light.webp', alt: 'miniStill' },
  'kling-v4': { src: '/assets/pricing/kling-4-concert.webp', alt: 'klingStill' },
  'seedance-2-5': { src: '/assets/model-examples/seedance-2-5/ca3df1e9a0bc552a6300c6097f2c6d97803b489f90b3a6050f3431725a81c3c3.webp', alt: 'seedanceStill' },
} as const satisfies Record<OpeningRow['id'], { src: string; alt: keyof typeof pricingOpeningCopy.en }>;

type Props = {
  locale: AppLocale;
  hero: { title: string };
  rows: OpeningRow[];
  quotedOn: string;
  canonical: string;
};

function cite(locale: AppLocale, row: OpeningRow, date: string) {
  if (locale === 'fr') return `Le ${date}, MaxVideoAI proposait à ${row.price} un plan de 5 secondes en 720p au format 16:9 avec ${row.name}, à partir de texte, avec son et sans référence.`;
  if (locale === 'es') return `El ${date}, MaxVideoAI cotizó en ${row.price} un plano de 5 segundos en 720p, formato 16:9, con ${row.name}, generado a partir de texto, con audio y sin referencias.`;
  return `On ${date}, MaxVideoAI quoted ${row.price} USD for one 5-second, 720p, 16:9 text-to-video shot with ${row.name}, audio on and no references.`;
}

export function PricingHeroSection({ locale, hero, rows, quotedOn, canonical }: Props) {
  const copy = pricingOpeningCopy[locale];
  const main = rows.find(row => row.id === 'seedance-2-0-mini');
  const quotedRows = rows.filter(row => row.price !== null);
  const app = '/app?mode=t2v&lang=' + locale;
  const watch = '/video/job_d9481a70-db5c-4072-8ab7-adc82a8a5100';
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(quotedOn));
  const navigation = [
    { href: '#video-pricing', label: copy.video, Icon: Film },
    { href: '#image-pricing', label: copy.image, Icon: ImageIcon },
    { href: '#audio-pricing', label: 'Audio', Icon: AudioLines },
    { href: '#tool-pricing', label: copy.tools, Icon: SlidersHorizontal },
  ];
  return <header className={styles.opening}>
    <div className={styles.cover}><div className={styles.hero}>
      <div className={styles.lead}>
        <h1>{hero.title}</h1>

        {main && <div className={styles.offer}><a className={styles.engine} href={'#' + main.anchor}>{main.name.replace(/^Dreamina /, '')}</a>
          <strong>{main.price ?? copy.check}</strong><span className={styles.promise}>{copy.intro}</span><span className={styles.spec}>{copy.heroSpec}</span></div>}
        <a href={main?.href ?? app} className={styles.cta}
          data-analytics-event="cta_click" data-analytics-cta-name="pricing_quote" data-analytics-cta-location="pricing_hero" data-analytics-target-family="workspace">
          {copy.try}<ArrowUpRight size={17} aria-hidden="true" /></a>
        {main && <p className={styles.hint}>{copy.prefill}</p>}
      </div>
      <figure><NextLink href={watch} prefetch={false}><Image priority src="/assets/pricing/seedance-mini-metro.webp" width={1280} height={720} sizes="(max-width: 720px) 100vw, 70vw" alt={copy.pic} /></NextLink>
        <figcaption><span>{copy.caption}</span><NextLink href={watch} prefetch={false}><Play size={13} fill="currentColor" aria-hidden="true" />{copy.watch}</NextLink></figcaption>
      </figure>
    </div></div>
    <div className={styles.body}>
      <nav aria-label={copy.nav} className={styles.nav}>{navigation.map(({ href, label, Icon }) =>
        <a key={href} href={href}><Icon size={18} aria-hidden="true" />{label}<ArrowDown size={14} aria-hidden="true" /></a>)}</nav>
      <section id="video-quote" aria-labelledby="video-quote-title" className={styles.comparison}>
        <div className={styles.compareTitle}>
          <h2 id="video-quote-title">{rows.length ? copy.compare : copy.examples}</h2>
          <div className={styles.conditions}>
            <p>{copy.meta}</p>
            <p>{copy.conditions}</p>
            {quotedRows.length > 0 && <p>{copy.quotedOn} <time dateTime={quotedOn}>{date}</time></p>}
          </div>
        </div>
        {rows.length > 0 && <ul className={styles.choices} role="list">
          {rows.map(row => {
            const still = comparisonStills[row.id];
            return <li key={row.id} className={styles.choice}>
              <Image className={styles.modelStill} src={still.src} alt={copy[still.alt]} width={720} height={405}
                sizes="(max-width: 720px) 88px, (max-width: 1240px) 30vw, 366px" loading="lazy" />
              <h3 className={styles.model}><a href={'#' + row.anchor}>{row.name.replace(/^Dreamina /, '')}</a></h3>
              <strong className={styles.price}>{row.price ?? copy.check}</strong>
              <div className={styles.actions}>
                <a href={row.href} data-estimate={row.id} aria-label={copy.quote + ' · ' + row.name}
                  data-analytics-event="cta_click" data-analytics-cta-name="pricing_quote" data-analytics-cta-location="pricing_hero" data-analytics-target-family="workspace">
                  {copy.quote}<ArrowUpRight size={14} aria-hidden="true" />
                </a>
                {row.price && <a href={'#quote-' + row.id} aria-label={copy.source + ' · ' + row.name}>{copy.source}</a>}
              </div>
            </li>;
          })}
        </ul>}
        {quotedRows.length > 0 && <details className={styles.citations}><summary>{copy.cite}</summary>
          <time dateTime={quotedOn}>{date}</time>
          {quotedRows.map(row => {
            const sentence = cite(locale, row, date);
            const source = canonical + '#quote-' + row.id;
            return <div key={row.id} id={'quote-' + row.id}><p>{sentence} <a href={'#quote-' + row.id}>{copy.source}</a></p>
              <PricingCopy label={copy.copy} text={sentence + ' ' + source} copied={copy.copied} manual={copy.manual} /></div>;
          })}</details>}
        <a className={styles.secondary} href={app} data-analytics-event="cta_click" data-analytics-cta-name="pricing_simulator" data-analytics-cta-location="pricing_hero" data-analytics-target-family="workspace">{copy.otherSim} ↗</a>
      </section>
    </div>
  </header>;
}
