import Image from 'next/image';
import { ArrowDown, ArrowUpRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import type { CharacterBuilderLandingContent } from './character-builder-landing-assets';
import { CHARACTER_STUDIO_ART } from './character-studio-marketing-assets';
import styles from './CharacterStudioLanding.module.css';

export function CharacterBuilderHeroSection({ content }: { content: CharacterBuilderLandingContent }) {
  const c = content.studio;
  return <section className={styles.hero}>
    <div className={styles.container}>
      <nav className={styles.breadcrumb} aria-label={content.breadcrumb.tools}>
        <Link href="/">{content.breadcrumb.home}</Link><span>/</span><Link href="/tools">{content.breadcrumb.tools}</Link><span>/</span><span>Character Studio</span>
      </nav>
      <div className={styles.heroLayout}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>MaxVideoAI / Character Studio</p>
          <h1>{content.hero.title}</h1>
          <p className={styles.intro}>{content.hero.body}</p>
          <div className={styles.actions}>
            <Link href="/app/tools/character-builder" prefetch={false} className={styles.primary}
              data-analytics-event="tool_cta_click" data-analytics-cta-name="character_builder_try_tool_hero"
              data-analytics-cta-location="tool_character_builder_hero" data-analytics-tool-name="character_builder"
              data-analytics-tool-surface="public" data-analytics-target-family="app_tools">
              {content.hero.primaryCta}<ArrowUpRight size={18} aria-hidden="true" />
            </Link>
            <a href="#recast" className={styles.secondary}>{c.secondaryCta}<ArrowDown size={17} aria-hidden="true" /></a>
          </div>
          <ul className={styles.proofs}>{content.hero.proofs.map(text => <li key={text}>{text}</li>)}</ul>
        </div>
        <figure className={styles.casting}>
          <div className={styles.castingImages}>
            <div className={styles.castSide}><Image src={CHARACTER_STUDIO_ART.marcel} alt="Marcel" fill sizes="(max-width: 700px) 28vw, 15vw" className={styles.cover} /><span>Marcel<small>{c.roles[0]}</small></span></div>
            <div className={styles.castMain}><Image src={CHARACTER_STUDIO_ART.dixiePop} alt="Dixie Trouble" fill priority sizes="(max-width: 700px) 36vw, 20vw" className={styles.cover} /><span>Dixie<small>{c.roles[1]}</small></span></div>
            <div className={styles.castSide}><Image src={CHARACTER_STUDIO_ART.vesper} alt="Vesper Velours" fill sizes="(max-width: 700px) 28vw, 15vw" className={styles.cover} /><span>Vesper<small>{c.roles[2]}</small></span></div>
          </div>
          <figcaption>{c.castingCaption}<span aria-hidden="true">01 — 03</span></figcaption>
        </figure>
      </div>
      <nav className={styles.sectionNav} aria-label={content.hero.badge}>
        {['create', 'looks', 'outputs', 'recast'].map((id, i) => <a key={id} href={`#${id}`}><span>0{i + 1}</span>{c.nav[i]}<ArrowDown size={13} aria-hidden="true" /></a>)}
      </nav>
    </div>
  </section>;
}

export function CharacterBuilderHowItWorksSection({ content }: { content: CharacterBuilderLandingContent }) {
  return <section className={styles.section} id="create"><div className={styles.container}>
    <header className={styles.sectionHeading}><p className={styles.eyebrow}>01 / {content.studio.nav[0]}</p><h2>{content.studio.castingTitle}</h2><p>{content.studio.castingBody}</p></header>
    <ol className={styles.steps}>{content.howItWorks.steps.map((step, i) => <li key={step.title} id={`step-${i + 1}`}><span>0{i + 1}</span><div><h3>{step.title}</h3><p>{step.body}</p></div></li>)}</ol>
  </div></section>;
}
