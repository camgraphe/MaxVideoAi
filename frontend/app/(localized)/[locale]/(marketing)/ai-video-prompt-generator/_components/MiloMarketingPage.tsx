import NextLink from 'next/link';
import { ArrowRight, ImageIcon, SlidersHorizontal, Sparkles, Check, Layers3, MessageCircle } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/locales';
import { miloEntryHref } from '@/lib/prompt-assistance/marketing-entry';
import type { MiloCopy } from '../_lib/milo-copy';
import { MiloWalkthrough } from './MiloWalkthrough.client';
import styles from './milo-marketing.module.css';

export function MiloMarketingPage({copy,locale}:{copy:MiloCopy;locale:AppLocale}) {
  const entry=miloEntryHref(locale);
  const icons=[Layers3,ImageIcon,SlidersHorizontal];
  return <div className={styles.page}>
    <section className={styles.hero} aria-labelledby="milo-title">
      <div className={styles.heroCopy}>
        <p className={styles.eyebrow}><Sparkles size={19} aria-hidden/>{copy.eyebrow}</p>
        <h1 id="milo-title">{copy.title}</h1><p className={styles.intro}>{copy.intro}</p>
        <div className={styles.actions}><NextLink href={entry} prefetch={false} className={styles.primary} data-analytics-event="cta_click" data-analytics-cta-name="milo_try" data-analytics-cta-location="milo_hero">{copy.cta}<ArrowRight size={19} aria-hidden/></NextLink><a href="#walkthrough" className={styles.textLink}>{copy.see}<span aria-hidden>↗</span></a></div>
        <p className={styles.access}>{copy.access}</p>
        <div className={styles.heroSketch} aria-hidden><span>{copy.steps[0]}</span><span>↗</span><strong>Milo</strong><span>→</span><span>{copy.steps[2]}</span></div>
      </div>
      <MiloWalkthrough copy={copy}/>
    </section>
    <section className={styles.contextSection} aria-labelledby="milo-context"><h2 id="milo-context">{copy.contextTitle}</h2><div className={styles.contextGrid}>{copy.context.map((item,index)=>{const Icon=icons[index];return <article key={item.title}><Icon size={25} strokeWidth={1.5} aria-hidden/><h3>{item.title}</h3><p>{item.body}</p></article>;})}</div></section>
    <section className={styles.control}><div className={styles.controlMark} aria-hidden><Check size={48} strokeWidth={1}/></div><div><h2>{copy.controlTitle}</h2><p>{copy.controlBody}</p></div></section>
    <section className={styles.levelsSection} aria-labelledby="milo-levels"><h2 id="milo-levels">{copy.levelsTitle}</h2><p>{copy.levelsIntro}</p><div className={styles.levels}>{copy.levels.map((level,index)=><article key={level.name}><span className={styles.levelNumber}>0{index+1}</span><div><h3>Milo {level.name}</h3><span className={styles.levelLabel}>{level.label}</span></div><p>{level.body}</p></article>)}</div><div className={styles.creditNote}><p>{copy.credits}</p><Link href="/pricing" locale={locale} prefetch={false} className={styles.textLink}>{copy.pricing}<ArrowRight size={17} aria-hidden/></Link></div></section>
    <section className={styles.paths} aria-labelledby="milo-paths"><h2 id="milo-paths">{copy.pathsTitle}</h2><div><article><MessageCircle size={25} strokeWidth={1.5} aria-hidden/><h3>{copy.studioTitle}</h3><p>{copy.studioBody}</p><Link href="/studio" locale={locale} prefetch={false} className={styles.textLink}>Studio<ArrowRight size={17} aria-hidden/></Link></article><article><Layers3 size={25} strokeWidth={1.5} aria-hidden/><h3>{copy.mcpTitle}</h3><p>{copy.mcpBody}</p><Link href="/mcp" locale={locale} prefetch={false} className={styles.textLink}>MCP<ArrowRight size={17} aria-hidden/></Link></article></div><Link href="/models" locale={locale} prefetch={false} className={styles.textLink}>{copy.modelLinks}<ArrowRight size={17} aria-hidden/></Link></section>
    <section className={styles.faq} aria-labelledby="milo-faq"><h2 id="milo-faq">{copy.faqTitle}</h2><div>{copy.faq.map(item=><details key={item.question}><summary>{item.question}<span aria-hidden>+</span></summary><p>{item.answer}</p></details>)}</div></section>
    <section className={styles.closing}><Sparkles size={32} aria-hidden/><h2>{copy.closing}</h2><NextLink href={entry} prefetch={false} className={styles.primary} data-analytics-event="cta_click" data-analytics-cta-name="milo_try" data-analytics-cta-location="milo_closing">{copy.cta}<ArrowRight size={19} aria-hidden/></NextLink><p>{copy.access}</p></section>
  </div>;
}
