import Image from 'next/image';
import { ArrowDown, Clapperboard, Film, PanelsTopLeft } from 'lucide-react';
import type { OpenArtCopy } from '../_content/types';
import { OPENART_HERO } from '../_lib/evidence';
import { PriceShotLink } from './PriceShotLink';
import styles from './openart.module.css';

export function OpenArtHero({ copy }: { copy: OpenArtCopy['hero'] }) {
  return (
    <section className={styles.hero} aria-labelledby="openart-title">
      <div className={styles.heroCopy}>
        <p className={styles.eyebrow}>MaxVideoAI <span aria-hidden="true">/</span> OpenArt</p>
        <h1 id="openart-title">{copy.title}</h1>
        <p className={styles.lead}>{copy.lead}</p>
        <div className={styles.actions}>
          <PriceShotLink location="openart_hero">{copy.action}</PriceShotLink>
          <a className={styles.textLink} href="#openart-decision">{copy.compare}<ArrowDown size={16} aria-hidden="true" /></a>
        </div>
        <p className={styles.heroNote}>{copy.note}</p>
      </div>
      <figure className={styles.storyboard}>
        <div className={styles.storyboardFrame}>
          <Image
            src={OPENART_HERO.src}
            width={OPENART_HERO.width}
            height={OPENART_HERO.height}
            alt={copy.imageAlt}
            priority
            sizes="(max-width: 760px) 94vw, (max-width: 1440px) 51vw, 750px"
          />
        </div>
        <figcaption><Film size={16} aria-hidden="true" />{copy.imageCaption}</figcaption>
      </figure>
    </section>
  );
}

const decisionBrands = [
  { name: 'MaxVideoAI', Icon: Clapperboard },
  { name: 'OpenArt Director', Icon: PanelsTopLeft },
] as const;

export function OpenArtDecision({ copy }: { copy: OpenArtCopy['decision'] }) {
  return (
    <section id="openart-decision" className={styles.decision} aria-labelledby="openart-decision-title">
      <p className={styles.eyebrow}>{copy.label}</p>
      <h2 id="openart-decision-title">{copy.title}</h2>
      <div className={styles.decisionCards}>
        {decisionBrands.map(({ name, Icon }, index) => {
          const option = copy.options[index];
          return (
            <div className={styles.decisionCard} key={name}>
              <p className={styles.brand}><Icon size={21} strokeWidth={1.65} aria-hidden="true" />{name}</p>
              <h3>{option.title}</h3>
              <p>{option.text}</p>
              <ol className={styles.steps}>{option.steps.map((step) => <li key={step}>{step}</li>)}</ol>
            </div>
          );
        })}
      </div>
    </section>
  );
}
