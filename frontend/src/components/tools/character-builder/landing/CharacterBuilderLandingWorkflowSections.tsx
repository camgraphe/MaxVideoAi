import { PublicVideoPlayer } from '@/components/media/PublicVideoPlayer.client';
import type { CharacterStudioMarketingFilm } from './character-studio-marketing-assets';
import Image from 'next/image';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import type { CharacterBuilderLandingContent } from './character-builder-landing-assets';
import { CHARACTER_STUDIO_ART as art } from './character-studio-marketing-assets';
import styles from './CharacterStudioLanding.module.css';

export function CharacterBuilderOutputsWorkflowSection({ content, films = [], locale = 'en' }: { content: CharacterBuilderLandingContent; films?: CharacterStudioMarketingFilm[]; locale?: string }) {
  const c = content.studio;
  return <>
    <section className={styles.looksSection} id="looks"><div className={`${styles.container} ${styles.split}`}>
      <div className={styles.sectionHeading}><p className={styles.eyebrow}>02 / {c.nav[1]}</p><h2>{c.looksTitle}</h2><p>{c.looksBody}</p><Link className={styles.textLink} prefetch={false} href="/app/tools/character-builder">{content.hero.primaryCta}<ArrowUpRight size={17} aria-hidden="true" /></Link></div>
      <figure><div className={styles.looksPair}>
        <div><div className={styles.lookImage}><Image src={art.dixie} alt={`Dixie Trouble — ${c.identity}`} fill sizes="(max-width: 700px) 44vw, 26vw" className={styles.cover} loading="lazy" /></div><p>{c.identity}</p></div>
        <ArrowRight className={styles.lookArrow} size={22} aria-hidden="true" />
        <div><div className={styles.lookImage}><Image src={art.dixiePop} alt={`Dixie Trouble — ${c.newLook}`} fill sizes="(max-width: 700px) 44vw, 26vw" className={styles.cover} loading="lazy" /></div><p>{c.newLook}</p></div>
      </div><figcaption className={styles.note}>{c.looksNote}</figcaption></figure>
    </div></section>
    <section className={styles.section} id="outputs"><div className={styles.container}>
      <header className={styles.sectionHeading}><p className={styles.eyebrow}>03 / {c.nav[2]}</p><h2>{c.outputsTitle}</h2><p>{c.outputsBody}</p></header>
      <div className={styles.outputs}>
        <figure><div className={styles.portraitOutput}><Image src={art.portrait} alt={c.portrait} fill sizes="(max-width: 700px) 90vw, 25vw" className={styles.contain} loading="lazy" /></div><figcaption><h3>{c.portrait}</h3><p>{c.portraitBody}</p></figcaption></figure>
        <figure><div className={styles.sheetOutput}><Image src={art.sheet} alt={c.sheetAlt} fill sizes="(max-width: 700px) 90vw, 62vw" className={styles.contain} loading="lazy" /></div><figcaption><h3>{c.sheet}</h3><p>{c.sheetBody}</p></figcaption></figure>
      </div>
    </div></section>
    <section className={styles.recastSection} id="recast"><div className={styles.container}>
      <header className={styles.sectionHeading}><p className={styles.eyebrow}>{c.recastEyebrow}</p><h2>{c.recastTitle}</h2><p>{c.recastBody}</p></header>
      <div className={styles.recastLayout}>
        <div className={styles.recastFrames}>{[art.dixieRecast, art.vesperRecast].map((src, i) => { const film = films.find(item => item.key === (i === 0 ? 'dixie' : 'vesper')); return <figure key={src}>
          <div className={styles.recastFrame}>{film ? <PublicVideoPlayer src={film.video} poster={film.poster} title={c.filmLabels[i]} locale={locale} deferPoster className={styles.film} /> : <><Image src={src} alt={c.filmDescriptions[i]} fill loading="lazy" sizes="(max-width: 700px) 44vw, 25vw" className={styles.contain} /><span>{c.frameLabel}</span></>}</div>
          <figcaption><h3>{c.filmLabels[i]}</h3><p>{c.filmDescriptions[i]}</p></figcaption>
        </figure>; })}</div>
        <div className={styles.recastGuide}>
          <ol>{c.recastSteps.map((step, i) => <li key={step}><span>0{i + 1}</span>{step}</li>)}</ol>
          <Link className={styles.primary} href="/app/tools/character-builder?mode=recast" prefetch={false} data-analytics-event="tool_cta_click" data-analytics-cta-location="tool_character_builder_recast" data-analytics-tool-name="character_builder" data-analytics-tool-surface="public">{c.recastCta}<ArrowUpRight size={18} aria-hidden="true" /></Link>
          <p className={styles.note}>{c.recastNote}</p>
        </div>
      </div>
    </div></section>
    <section className={styles.priceSection}><div className={`${styles.container} ${styles.priceLayout}`}><div><p className={styles.eyebrow}>Character Studio / Recast</p><h2>{c.priceTitle}</h2></div><div><p>{c.priceBody}</p><Link href="/pay-as-you-go-ai-video-generator" className={styles.textLink}>{c.priceLink}<ArrowUpRight size={17} aria-hidden="true" /></Link></div></div></section>
  </>;
}
