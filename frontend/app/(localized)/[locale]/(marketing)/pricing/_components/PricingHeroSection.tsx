import type { ReactNode } from 'react';
import { ArrowDown, ArrowUpRight, AudioLines, Film, Image as ImageIcon, SlidersHorizontal, Volume2, VolumeX } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import Image from 'next/image';
import NextLink from 'next/link';
import type { AppLocale } from '@/i18n/locales';
import type { OpeningRow } from '../_lib/pricing-opening';
import { pricingOpeningCopy, pricingCitation, pricingMinuteEstimate } from '../_lib/pricing-opening-copy';
import { formatCurrencyForLocale } from '../_lib/pricingPageContent';
import { getPricingHubCopy } from '../_lib/pricingHubCopy';
import styles from './pricing-opening.module.css';

type Props = {
  locale: AppLocale;
  hero: { title: string; subtitle: string; primaryCta: string; badges: string[] };
  rows: OpeningRow[];
  filmPrice: string | null;
  quotedOn: string;
  children: ReactNode;
};

export function PricingHeroSection({ locale, hero, rows, filmPrice, quotedOn, children }: Props) {
  const copy = pricingOpeningCopy[locale];
  const { tabs } = getPricingHubCopy(locale).video;
  const surfaces = [
    { href: '#video-pricing', label: tabs.video, icon: Film },
    { href: '#image-pricing', label: tabs.image, icon: ImageIcon },
    { href: '#audio-pricing', label: tabs.audio, icon: AudioLines },
    { href: '#tool-pricing', label: copy.tools, icon: SlidersHorizontal },
  ];
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(quotedOn));

  const standard = rows.find(row => row.id === 'kling-3-standard');
  const [silent, audio] = standard?.prices ?? [];
  const filmHref = '/video/kling-3-standard-rainy-neon-street-multi-shot-example-99e0f0fa';

  return (
    <header className={styles.opening}>
      <div className={styles.inner}>
        <div className={styles.intro}>
          <div className={styles.lead}>
            <h1>{hero.title}</h1>
            <p>{hero.subtitle}</p>
            {filmPrice && <div className={styles.casePrice}>
              <span>{copy.filmLabel} <time dateTime={quotedOn}>{date}</time></span>
              <strong>{filmPrice}</strong>
              <p><b>Kling 3 Standard</b><br />{copy.filmSpecs}</p>
            </div>}
          </div>
          <NextLink href={filmHref} prefetch={false} className={styles.scene}>
            <span className={styles.stills}>
              <Image unoptimized aria-hidden="true" alt="" className={styles.backStill} src="/assets/pricing/kling-night-run-crossing.webp" width={440} height={248} />
              <Image unoptimized aria-hidden="true" alt="" className={styles.midStill} src="/assets/pricing/kling-night-run-splash.webp" width={440} height={248} />
              <Image unoptimized priority className={styles.frontStill} alt={copy.filmAlt} src="/assets/pricing/kling-night-run-portrait.webp" width={840} height={472} />
            </span>
            <span className={styles.sceneLink}>{copy.watch} <ArrowUpRight size={15} aria-hidden="true" /></span>
          </NextLink>
        </div>
        <nav aria-label={copy.nav} className={styles.nav}>
          {surfaces.map(({ href, label, icon: Icon }) => <Link href={href} key={href}><Icon size={19} aria-hidden="true" /><span>{label}</span><ArrowDown size={14} aria-hidden="true" /></Link>)}
        </nav>
        <section id="video-quote" aria-labelledby="video-quote-title" className={styles.compare}>
          <div className={styles.heading}>
            <h2 id="video-quote-title">{copy.question}</h2>
            <p>{copy.format} <span aria-hidden="true">/</span> {copy.unit}</p>
          </div>
          <div className={styles.figures}>
          {rows.length > 0 ? (
            <table className={styles.table} aria-labelledby="video-quote-title">
              <thead><tr>
                <th scope="col">{copy.model}</th>
                <th scope="col"><VolumeX aria-hidden="true" /> {copy.silent}</th>
                <th scope="col"><Volume2 aria-hidden="true" /> {copy.audio}</th>
              </tr></thead>
              <tbody>{rows.map(row => (
                <tr key={row.id}>
                  <th scope="row"><Link href={`#${row.id}-pricing`}>{row.name}</Link></th>
                  {row.prices.map((price, index) => <td key={index}>
                    {price ? <Link href={price.href} prefetch={false}
                      aria-label={`${copy.openQuote} · ${row.name} · 10 s · 1080p · ${index ? copy.audio : copy.silent} · ${price.display}`}
                      data-analytics-event="cta_click" data-analytics-cta-name="pricing_quote"
                      data-analytics-cta-location="pricing_hero" data-analytics-target-family="workspace">
                      {price.display}<ArrowUpRight aria-hidden="true" />
                    </Link> : <span aria-label={copy.fallback}>—</span>}
                  </td>)}
                </tr>
              ))}</tbody>
            </table>
          ) : <p>{copy.fallback}</p>}
          <div className={styles.sources}>
            <a href="#video-pricing">{copy.full}<ArrowDown size={14} aria-hidden="true" /></a>
            {rows.length > 0 && <small>MaxVideoAI · {copy.checked} <time dateTime={quotedOn}>{date}</time></small>}
          </div>
          {rows.some(row => row.prices.every(Boolean)) && (
            <details className={styles.citations}>
              <summary>{copy.cite}</summary>
              {rows.map(row => {
                const [silent, audio] = row.prices;
                if (!silent || !audio) return null;
                return <p key={row.id}>{pricingCitation[locale](row.name, silent.display, audio.display, date)}{' '}
                  <a href={`#${row.id}-pricing`}>{copy.source}</a></p>;
              })}
            </details>
          )}
          </div>
        </section>
        {standard && silent && audio && silent.currency === audio.currency && (
          <aside className={styles.budget} aria-labelledby="pricing-minute-budget">
            <h3 id="pricing-minute-budget">{copy.budgetTitle}</h3>
            <p>{pricingMinuteEstimate[locale](standard.name,
              formatCurrencyForLocale(locale, silent.currency, 6 * silent.amountCents / 100),
              formatCurrencyForLocale(locale, audio.currency, 6 * audio.amountCents / 100))}{' '}
              <a href="#kling-3-standard-pricing">{copy.source}</a></p>
          </aside>
        )}
      </div>
      {children}
      <div className={styles.terms}>
        <ul>{hero.badges.map(badge => <li key={badge}>{badge === hero.badges.at(-1) ? <NextLink href="/return-policy" prefetch={false}>{badge}</NextLink> : badge}</li>)}</ul>
        <Link href="/app" prefetch={false}>{hero.primaryCta} <ArrowUpRight size={15} aria-hidden="true" /></Link>
      </div>
    </header>
  );
}
