import Image from 'next/image';
import { ArrowDown, ArrowUpRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import type { CinematicPresentation } from '../_lib/model-page-cinematic-data';
import type { ModelDecisionData } from '../_lib/model-page-decision-data';
import { ModelCinematicPrompt } from './ModelCinematicAsset';

export function ModelCinematicHero({ presentation: { content, hero, ui }, decision, modelName, modelsLabel, modelsHref }: {
  presentation: CinematicPresentation; decision: ModelDecisionData; modelName: string; modelsLabel: string; modelsHref: string;
}) {
  return <>
    <nav className="cinema-breadcrumb" aria-label={modelsLabel}>
      <Link href={modelsHref} prefetch={false}>{modelsLabel}</Link><span aria-hidden="true">/</span><span>{modelName}</span>
    </nav>
    <section id="top" className={`cinema-hero cinema-hero--${content.variant}`} aria-labelledby="cinema-model-title">
      <div className="cinema-hero-art">
        <Image src={hero.display.url} width={hero.display.width} height={hero.display.height} alt={hero.title}
          priority sizes="(min-width: 1440px) 1360px, 100vw" className="cinema-hero-image" />
      </div>
      <div className="cinema-hero-copy">
        <p className="cinema-eyebrow">{decision.hero.eyebrow}</p>
        <h1 id="cinema-model-title">{decision.hero.title}</h1>
        <p className="cinema-headline">{content.headline.map(line => <span key={line}>{line}</span>)}</p>
        <p className="cinema-intro">{content.intro}</p>
        <div className="cinema-actions">
          <Link href={decision.hero.primaryCta.href} prefetch={false} className="cinema-button">{decision.hero.primaryCta.label}<ArrowUpRight size={17} aria-hidden="true" /></Link>
          <a href="#examples" className="cinema-text-link">{content.examplesLabel}<ArrowDown size={15} aria-hidden="true" /></a>
        </div>
        <a href="#decision-pricing" className="cinema-price-link">{content.pricingLabel} <span aria-hidden="true">↗</span></a>
      </div>
      <div className="cinema-hero-caption"><span>{content.proofLabel}</span><p>{content.caption}</p><a href={hero.original.url} target="_blank" rel="noopener noreferrer">{ui.original} ↗</a></div>
    </section>
    <dl className="cinema-facts">{content.facts.map(fact => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl>
    <div className="cinema-onward">
      <Link href={decision.hero.secondaryCta.href} prefetch={false}>{decision.hero.secondaryCta.label} ↗</Link>
      {decision.hero.quickLinks.filter(link => link.href !== decision.hero.primaryCta.href).map(link => <Link key={link.href} href={link.href} prefetch={false}>{link.label} ↗</Link>)}
    </div>
    <ModelCinematicPrompt asset={hero} ui={ui} />
  </>;
}
