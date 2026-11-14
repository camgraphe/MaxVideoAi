import { Suspense } from 'react';
import { Link } from '@/i18n/navigation';
import type { CinematicPresentation } from '../_lib/model-page-cinematic-data';
import type { ModelDecisionData } from '../_lib/model-page-decision-data';
import type { ModelExamplesViewModel } from '../_lib/model-page-examples-view-model';
import type { ModelPromptingViewModel } from '../_lib/model-page-prompting-view-model';
import { ModelCinematicHero } from './ModelCinematicHero';
import { ModelCinematicExamples } from './ModelCinematicExamples';
import { ModelCinematicPrompt } from './ModelCinematicAsset';
import { ModelCinematicPrompting } from './ModelCinematicPrompting';
import { ModelCinematicDetails, type CinematicDetailsProps } from './ModelCinematicDetails';

/** Independent composition. Legacy model sections are deliberately not its visual primitives. */
export function ModelCinematicPage({ presentation, decision, examples, hasRenderedVideos, prompting, details }: {
  presentation: CinematicPresentation; decision: ModelDecisionData;
  examples: ModelExamplesViewModel; hasRenderedVideos: boolean;
  prompting: ModelPromptingViewModel; details: CinematicDetailsProps;
}) {
  const { content, hero, ui } = presentation;
  return <div className={`model-cinematic-page model-cinematic-page--${content.variant}`}>
    <ModelCinematicHero presentation={presentation} decision={decision} />
    <nav className="cinema-nav" aria-label={content.overviewLabel}>
      <div className="cinema-wrap cinema-nav-inner">
        <a href="#top" className="cinema-nav-model">{content.titleLines.join(' ')}</a>
        <div className="cinema-nav-links"><a href="#overview">{content.overviewLabel}</a><a href="#examples">{content.examplesLabel}</a>
          <a href="#prompting">{content.promptingLabel}</a><a href="#specs">{content.detailsLabel}</a><a href="#decision-pricing">{content.pricingLabel}</a><a href="#faq">FAQ</a></div>
        <Link href={decision.hero.primaryCta.href} prefetch={false} className="cinema-button">{content.primaryLabel}<span aria-hidden="true">↗</span></Link>
      </div>
    </nav>
    <section id="overview" className="cinema-wrap cinema-overview">
      <div className="cinema-overview-copy"><p className="cinema-eyebrow">{content.proofLabel}</p><p className="cinema-intro">{content.intro}</p></div>
      <dl className="cinema-facts">{content.facts.map(fact => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl>
      <ModelCinematicPrompt asset={hero} ui={ui} />
    </section>
    <ModelCinematicExamples presentation={presentation} viewModel={examples} hasRenderedVideos={hasRenderedVideos} />
    <ModelCinematicPrompting viewModel={prompting} assets={presentation.assets} label={content.promptingLabel} />
    <Suspense fallback={<div aria-hidden="true" className="cinema-details-pending" />}><ModelCinematicDetails {...details} /></Suspense>
    <section className="cinema-close"><div className="cinema-wrap">
      <p className="cinema-eyebrow">MaxVideoAI / {content.titleLines.join(' ')}</p><h2>{content.subtitle}</h2>
      <Link href={decision.hero.primaryCta.href} prefetch={false} className="cinema-button">{content.primaryLabel}<span aria-hidden="true">↗</span></Link>
    </div></section>
  </div>;
}
