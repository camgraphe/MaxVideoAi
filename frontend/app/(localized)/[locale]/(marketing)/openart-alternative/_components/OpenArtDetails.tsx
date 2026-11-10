import Link from 'next/link';
import { ArrowUpRight, ChevronDown, CircleDollarSign, Layers3, Wallet } from 'lucide-react';
import type { AppLocale } from '@/i18n/locales';
import { localizePathFromEnglish } from '@/lib/i18n/paths';
import type { OpenArtCopy } from '../_content/types';
import { OPENART_CHECKED, openArtSources } from '../_lib/evidence';
import { PriceShotLink } from './PriceShotLink';
import styles from './openart.module.css';

export function OpenArtWorkflow({ copy, locale }: { copy: OpenArtCopy['workflow']; locale: AppLocale }) {
  return (
    <section className={styles.workflow} aria-labelledby="openart-workflow-title">
      <div className={`${styles.container} ${styles.workflowGrid}`}>
        <div className={styles.workflowIntro}>
          <p className={styles.eyebrow}>{copy.label}</p>
          <h2 id="openart-workflow-title">{copy.title}</h2>
          <p>{copy.text}</p>
          <div className={styles.workflowLinks}>
            <Link href={localizePathFromEnglish(locale, '/studio')} prefetch={false}>{copy.studio}<ArrowUpRight size={16} aria-hidden="true" /></Link>
            <Link href={localizePathFromEnglish(locale, '/mcp')} prefetch={false}>{copy.mcp}<ArrowUpRight size={16} aria-hidden="true" /></Link>
          </div>
        </div>
        <ol className={styles.workflowSteps}>
          {copy.steps.map(({ title, text }, index) => (
            <li key={title}>
              <span className={styles.stepIndex} aria-hidden="true">0{index + 1}</span>
              <div><h3>{title}</h3><p>{text}</p></div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const budgetIcons = [CircleDollarSign, Layers3, Wallet];

export function OpenArtBudget({ copy, locale }: { copy: OpenArtCopy['budget']; locale: AppLocale }) {
  return (
    <section className={styles.budget} aria-labelledby="openart-budget-title">
      <div>
        <h2 id="openart-budget-title">{copy.title}</h2>
        <p>{copy.intro}</p>
        <div className={styles.budgetLinks}>
          <Link className={styles.textLink} href={localizePathFromEnglish(locale, '/blog/ai-video-project-cost')} prefetch={false}>{copy.guide}<ArrowUpRight size={16} aria-hidden="true" /></Link>
          <Link className={styles.textLink} href={localizePathFromEnglish(locale, '/pricing')} prefetch={false}>{copy.calculator}<ArrowUpRight size={16} aria-hidden="true" /></Link>
        </div>
      </div>
      <ul className={styles.budgetItems}>
        {copy.items.map(({ title, text }, index) => {
          const Icon = budgetIcons[index];
          return <li key={title}><Icon size={22} strokeWidth={1.65} aria-hidden="true" /><div><h3>{title}</h3><p>{text}</p></div></li>;
        })}
      </ul>
    </section>
  );
}

export function OpenArtClosing({ copy, locale }: { copy: OpenArtCopy['closing']; locale: AppLocale }) {
  return (
    <section className={styles.closing} aria-labelledby="openart-closing-title">
      <div><h2 id="openart-closing-title">{copy.title}</h2><p>{copy.text}</p></div>
      <div className={styles.closingActions}>
        <PriceShotLink location="openart_footer">{copy.action}</PriceShotLink>
        <Link className={styles.textLink} href={localizePathFromEnglish(locale, '/blog/compare-ai-video-platforms')} prefetch={false}>{copy.guide}<ArrowUpRight size={16} aria-hidden="true" /></Link>
      </div>
    </section>
  );
}

export function OpenArtQuestions({ copy }: { copy: OpenArtCopy['faq'] }) {
  return (
    <section className={styles.faq} id="questions" aria-labelledby="openart-faq-title">
      <h2 id="openart-faq-title">{copy.title}</h2>
      <div className={styles.faqItems}>
        {copy.items.map(({ question, answer }) => (
          <details key={question}>
            <summary>{question}<ChevronDown size={18} aria-hidden="true" /></summary>
            <p>{answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function OpenArtSources({ copy, labels }: { copy: OpenArtCopy['evidence']; labels: OpenArtCopy['sourceLabels'] }) {
  return (
    <section id="openart-sources" className={styles.sources} aria-labelledby="openart-sources-title">
      <h2 id="openart-sources-title">{copy.title}</h2>
      <p><time dateTime={OPENART_CHECKED}>{copy.date}</time> · {copy.note}</p>
      <ol>
        {openArtSources.map(({ id, publisher, url }) => (
          <li key={id} id={`openart-source-${id}`}>
            <a href={url} rel={publisher === 'MaxVideoAI' ? undefined : 'nofollow'}>{publisher} · {labels[id]} <ArrowUpRight size={14} aria-hidden="true" /></a>
          </li>
        ))}
      </ol>
    </section>
  );
}
