import { ArrowUpRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import type { CharacterBuilderLandingContent } from './character-builder-landing-assets';
import styles from './CharacterStudioLanding.module.css';

export function CharacterBuilderRelatedSection({ content }: { content: CharacterBuilderLandingContent }) {
  return <section className={styles.related}><div className={styles.container}>
    <p className={styles.eyebrow}>{content.related.guidesTitle}</p>
    <div>{content.related.guideLinks.map(link => <Link key={link.href} href={link.href}>{link.label}<ArrowUpRight size={20} aria-hidden="true" /></Link>)}</div>
    <nav className={styles.workflowLinks} aria-label={content.related.workflowTitle}>{content.related.workflowLinks.map(link => <Link key={link.href} href={link.href}>{link.label}<ArrowUpRight size={14} aria-hidden="true" /></Link>)}</nav>
  </div></section>;
}

export function CharacterBuilderFinalCtaSection({ content }: { content: CharacterBuilderLandingContent }) {
  return <section className={styles.final}><div className={styles.container}>
    <p className={styles.eyebrow}>Character Studio</p><h2>{content.studio.finalTitle}</h2><p>{content.studio.finalBody}</p>
    <Link href="/app/tools/character-builder" prefetch={false} className={styles.primary}
      data-analytics-event="tool_cta_click" data-analytics-cta-name="character_builder_try_tool_final"
      data-analytics-cta-location="tool_character_builder_final" data-analytics-tool-name="character_builder"
      data-analytics-tool-surface="public" data-analytics-target-family="app_tools">
      {content.hero.primaryCta}<ArrowUpRight size={18} aria-hidden="true" />
    </Link>
  </div></section>;
}

export function CharacterBuilderFaqSection({ content }: { content: CharacterBuilderLandingContent }) {
  return <section className={styles.faq}><div className={styles.container}>
    <header><p className={styles.eyebrow}>{content.faq.eyebrow}</p><h2>{content.faq.title}</h2></header>
    <div>{content.faq.items.map(item => <details key={item.question} name="character-studio-faq"><summary>{item.question}<span aria-hidden="true">+</span></summary><p>{item.answer}</p></details>)}</div>
  </div></section>;
}
