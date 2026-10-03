import Image from 'next/image';
import NextLink from 'next/link';
import { ArrowRight, Check, MessageCircle, PanelsTopLeft, Sparkles } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/locales';
import type { StudioMarketingCopy } from '../_lib/studio-marketing-copy';
import styles from './studio-marketing.module.css';

// Enable only after a real, reviewed capture has been added to public/assets/studio.
const STUDIO_PREVIEW_IMAGE: string | null = null;
const icons = [MessageCircle, Sparkles, PanelsTopLeft];

export function StudioMarketingPage({ copy, locale }: { copy: StudioMarketingCopy; locale: AppLocale }) {
  return <div className={styles.page}>
    <section className={styles.hero} aria-labelledby="studio-title">
      <p className={styles.eyebrow}><span />{copy.eyebrow}</p>
      <h1 id="studio-title">{copy.title}</h1>
      <p className={styles.introduction}>{copy.introduction}</p>
      <div className={styles.actions}>
        <NextLink className={styles.primary} href="/api/studio/marketing-entry" prefetch={false}>{copy.primaryCta}<ArrowRight size={17} aria-hidden="true" /></NextLink>
        <a className={styles.secondary} href="#workflow">{copy.secondaryCta}<span aria-hidden="true">↓</span></a>
      </div>
      <p className={styles.accessNote}>{copy.accessNote}</p>
      {STUDIO_PREVIEW_IMAGE ? <figure className={styles.preview}>
        <Image src={STUDIO_PREVIEW_IMAGE} alt={copy.imageAlt} width={1440} height={1000} sizes="(max-width: 1120px) 100vw, 1120px" priority />
        <figcaption>{copy.imageCaption}</figcaption>
      </figure> : null}
    </section>
    <section className={styles.workflow} id="workflow" aria-labelledby="studio-workflow">
      <p className={styles.eyebrow}>{copy.workflow.eyebrow}</p>
      <h2 id="studio-workflow">{copy.workflow.title}</h2>
      <ol className={styles.steps}>{copy.workflow.steps.map((step, index) => <li key={step.title}>
        <span className={styles.number}>0{index + 1}</span><h3>{step.title}</h3><p>{step.body}</p>
      </li>)}</ol>
    </section>
    <section className={styles.capabilities} aria-labelledby="studio-capabilities">
      <h2 id="studio-capabilities">{copy.capabilities.title}</h2>
      <div className={styles.cards}>{copy.capabilities.items.map((item, index) => {
        const Icon = icons[index];
        return <article key={item.title}><Icon size={23} aria-hidden="true" /><h3>{item.title}</h3><p>{item.body}</p></article>;
      })}</div>
      <div className={styles.control}><Check size={22} aria-hidden="true" /><div><h3>{copy.control.title}</h3><p>{copy.control.body}</p></div></div>
    </section>
    <section className={styles.mcp} aria-labelledby="studio-mcp">
      <div><p className={styles.eyebrow}>MCP</p><h2 id="studio-mcp">{copy.mcp.title}</h2><p>{copy.mcp.body}</p></div>
      <Link href="/mcp" locale={locale} prefetch={false} className={styles.secondary}>{copy.mcp.cta}<ArrowRight size={17} aria-hidden="true" /></Link>
    </section>
    <section className={styles.faq} aria-labelledby="studio-faq"><h2 id="studio-faq">{copy.faq.title}</h2><div>
      {copy.faq.items.map(item => <details key={item.question}><summary>{item.question}<span aria-hidden="true">+</span></summary><p>{item.answer}</p></details>)}
    </div></section>
    <section className={styles.closing}><h2>{copy.closing.title}</h2><p>{copy.closing.body}</p>
      <NextLink className={styles.primary} href="/api/studio/marketing-entry" prefetch={false}>{copy.primaryCta}<ArrowRight size={17} aria-hidden="true" /></NextLink>
    </section>
  </div>;
}
