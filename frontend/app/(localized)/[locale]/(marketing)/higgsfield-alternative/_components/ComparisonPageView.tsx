import Image from 'next/image';
import Link from 'next/link';
import { ArrowDown, ArrowRight, ArrowUpRight, Link2, Wallet, Layers3, Clock3 } from 'lucide-react';
import type { AppLocale } from '@/i18n/locales';
import { localizePathFromEnglish } from '@/lib/i18n/paths';
import type { ComparisonCopy } from '../_content/types';
import { getExperienceCopy } from '../_content/experience';
import { comparisonSources, COMPARISON_CHECKED } from '../_lib/evidence';
import { ComparisonTable } from './ComparisonTable';
import { ComparisonFilmStage } from './ComparisonFilmStage.client';
import { ProductionPace } from './ProductionPace.client';
import { ShareComparison } from './ShareComparison.client';
import styles from './comparison.module.css';

type Props = { copy: ComparisonCopy; locale: AppLocale; canonical: string };

function QuoteLink({ children, location }: { children: React.ReactNode; location: string }) {
  return <Link className={styles.button} href="/app" prefetch={false} data-analytics-event="cta_click" data-analytics-cta-name="higgsfield_price_project" data-analytics-cta-location={location} data-analytics-target-family="workspace">{children}<ArrowRight size={19} aria-hidden="true" /></Link>;
}

export function ComparisonPageView({ copy, locale, canonical }: Props) {
  const path = (href: string) => localizePathFromEnglish(locale, href);
  const experience = getExperienceCopy(locale);
  const methodIcons = [Wallet, Layers3, Clock3];
  return (
    <article className={styles.page}>
      <section className={styles.hero} aria-labelledby="comparison-heading">
        <div className={styles.heroCopy}>
          <span className={styles.heroLabel}>MaxVideoAI <span aria-hidden="true">/</span> Higgsfield</span>
          <h1 id="comparison-heading">{copy.hero.title}</h1>
          <p className={styles.lead}>{copy.hero.description}</p>
          <div className={styles.actions}><QuoteLink location="comparison_hero">{copy.hero.action}</QuoteLink><a className={styles.textLink} href="#comparison">{copy.hero.compare}<ArrowDown size={18} aria-hidden="true" /></a></div>
          <p className={styles.heroNote}>{copy.hero.note}</p>
        </div>
        <div className={styles.heroFilm}><ComparisonFilmStage locale={locale} /></div>
      </section>
      <section id="comparison" className={`${styles.container} ${styles.comparison}`} aria-labelledby="terms-title">
        <ProductionPace locale={locale} />
        <div className={styles.sectionHead}><h2 id="terms-title">{copy.matrix.title}</h2><p>{copy.matrix.scope} · <time dateTime={COMPARISON_CHECKED}>{copy.matrix.checked}</time><a href="#sources">{copy.matrix.sources}<ArrowDown size={16} aria-hidden="true" /></a></p></div>
        <ComparisonTable rows={copy.matrix.rows} copy={copy.matrix} caption={copy.matrix.caption} />
        <p className={styles.scopeNote}>{copy.matrix.note} <a href="#source-higgs-api">[13]</a></p>
        <aside className={styles.fair} id="competitor-fit"><h3>{copy.matrix.fairTitle}</h3><div><p>{copy.matrix.fairText}</p><a className={styles.inlineLink} href="https://higgsfield.ai/blog/cinema-studio-4-0-complete-guide">{copy.matrix.fairLink}<ArrowUpRight size={16} aria-hidden="true" /></a></div></aside>
      </section>

      <section className={styles.workflow} aria-labelledby="workflow-title">
        <div className={`${styles.container} ${styles.workflowGrid}`}>
          <div className={styles.workflowCopy}>
            <span className={styles.chapterLabel}>{experience.workflowLabel}</span>
            <h2 id="workflow-title">{copy.workflow.title}</h2><p className={styles.workflowLead}>{copy.workflow.description}</p>
            <p className={styles.workflowNote}>{copy.workflow.note}</p>
            <Link className={styles.workflowLink} href={path('/studio')}>{copy.workflow.studio}<ArrowUpRight size={18} aria-hidden="true" /></Link>
          </div>
          <div>
            <ol className={styles.steps}>{copy.workflow.steps.map((step, index) => <li key={step}><span aria-hidden="true">{index + 1}</span><strong>{step}</strong></li>)}</ol>
            <figure className={styles.studioFrame}><Link href={path('/studio')} prefetch={false}><Image src="/assets/studio/studio-milo-preview.webp" alt={copy.workflow.imageAlt} width={1354} height={832} sizes="(min-width: 900px) 58vw, 100vw" /></Link><figcaption>{copy.workflow.imageCaption}</figcaption></figure>
            <div className={styles.workflowDetails}>{experience.workflowDetails.map((detail, index) => <p key={detail}><span>{String(index + 1).padStart(2, '0')}</span>{detail}</p>)}</div>
          </div>
          <div className={styles.mcpBridge}><Link2 size={21} aria-hidden="true" /><Link href={path('/mcp')}>{copy.workflow.mcp}<ArrowUpRight size={18} aria-hidden="true" /></Link><a href="#assistant-comparison">{experience.assistantLink}<ArrowDown size={17} aria-hidden="true" /></a></div>
        </div>
      </section>

      <div className={styles.container}>
        <section className={styles.assistantSection} id="assistant-comparison" aria-labelledby="assistant-title">
          <div className={styles.assistantHead}><h2 id="assistant-title">{copy.matrix.assistantTitle}</h2><p>{copy.matrix.assistantNote} <a href="#source-higgs-trial">[11]</a></p></div>
          <ComparisonTable rows={copy.matrix.assistantRows} copy={copy.matrix} caption={copy.matrix.assistantTitle} />
        </section>
        <section className={styles.methodology} id="methodology" aria-labelledby="method-title">
          <figure className={styles.productFrame}><Link href={path('/models/luma-uni-1-max')} prefetch={false}><Image src="/assets/model-examples/luma-uni-1-max/hero-product.webp" width={2464} height={1696} alt={copy.workflow.productAlt} sizes="(min-width: 900px) 42vw, 100vw" /></Link><figcaption>{copy.workflow.product}</figcaption></figure>
          <div className={styles.methodCopy}><h2 id="method-title">{copy.methodology.title}</h2><p className={styles.methodIntro}>{copy.methodology.intro}</p><ol>{copy.methodology.items.map((item, index) => { const Icon = methodIcons[index]; return <li key={item.title}><Icon size={22} strokeWidth={1.6} aria-hidden="true" /><details><summary>{item.title}</summary><p>{item.text}</p></details></li>; })}</ol></div>
        </section>
        <ShareComparison copy={copy.share} locale={locale} canonical={canonical} />
        <section className={styles.final}><div><h2>{copy.final.title}</h2><p>{copy.final.description}</p></div><div className={styles.finalActions}><QuoteLink location="comparison_footer">{copy.final.action}</QuoteLink><Link className={styles.textLink} href={path('/pay-as-you-go-ai-video-generator')}>{copy.final.secondary}<ArrowUpRight size={18} aria-hidden="true" /></Link></div></section>
        <section className={styles.faq} id="questions" aria-labelledby="questions-title"><h2 id="questions-title">{copy.faq.title}</h2><div>{copy.faq.items.map((item) => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div></section>
        <section className={styles.evidence} id="sources" aria-labelledby="sources-title"><div className={styles.evidenceHead}><h2 id="sources-title">{copy.evidence.title}</h2><p>{copy.evidence.publisher}</p></div><p>{copy.evidence.scope} <time dateTime={COMPARISON_CHECKED}>{copy.evidence.date}</time></p><ol>{comparisonSources.map((source) => <li key={source.id} id={`source-${source.id}`}><a href={source.url}><strong>{source.publisher}</strong><span>{source.label}<ArrowUpRight size={14} aria-hidden="true" /></span></a></li>)}</ol><p>{copy.evidence.correction} <Link className={styles.inlineLink} href={path('/contact')}>{copy.evidence.contact}<ArrowUpRight size={16} aria-hidden="true" /></Link></p></section>
      </div>
    </article>
  );
}
