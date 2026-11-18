import { CinematicArrow } from './ModelCinematicMarks';
import { Suspense } from 'react';
import { Link } from '@/i18n/navigation';
import type { CinematicPresentation } from '../_lib/model-page-cinematic-data';
import type { ModelDecisionData } from '../_lib/model-page-decision-data';
import type { ModelExamplesViewModel } from '../_lib/model-page-examples-view-model';
import type { ModelPromptingViewModel } from '../_lib/model-page-prompting-view-model';
import type { ModelKeyframeDemoViewModel } from '../_lib/model-page-keyframe-demo';
import { ModelCinematicSpecialty } from './ModelCinematicSpecialty';
import { ModelCinematicHero } from './ModelCinematicHero';
import { ModelCinematicExamples } from './ModelCinematicExamples';
import { ModelCinematicPrompting } from './ModelCinematicPrompting';
import { ModelCinematicDetails, type CinematicDetailsProps } from './ModelCinematicDetails';
import { ModelCinematicWorkflowProofs } from './ModelCinematicWorkflowProofs';

/** Independent composition. Legacy model sections are deliberately not its visual primitives. */
export function ModelCinematicPage({ presentation, decision, examples, hasRenderedVideos, prompting, details, keyframeDemo }: {
  keyframeDemo?: ModelKeyframeDemoViewModel | null;
  presentation: CinematicPresentation; decision: ModelDecisionData;
  examples: ModelExamplesViewModel; hasRenderedVideos: boolean;
  prompting: ModelPromptingViewModel; details: CinematicDetailsProps;
}) {
  const { content } = presentation;
  return <div className={`model-cinematic-page model-cinematic-page--${content.variant}`}>
    <ModelCinematicHero presentation={presentation} decision={decision} />
    <nav className="cinema-nav" aria-label={content.overviewLabel}>
      <div className="cinema-wrap cinema-nav-inner">
        <a href="#top" className="cinema-nav-model">{content.titleLines.join(' ')}</a>
        <div className="cinema-nav-links"><a href="#overview">{content.overviewLabel}</a><a href="#examples">{content.examplesLabel}</a>
          {presentation.examples.gallery ? <a href="#rendered-examples">{presentation.examples.gallery.navLabel}</a> : null}
          <a href="#prompting">{content.promptingLabel}</a><a href="#specs">{content.detailsLabel}</a><a href="#decision-pricing">{content.pricingLabel}</a><a href="#faq">FAQ</a></div>
        <Link href={decision.hero.primaryCta.href} prefetch={false} className="cinema-button" data-analytics-event="cta_click" data-analytics-cta-name="open_workspace" data-analytics-cta-location="model_nav" data-analytics-target-family="workspace">{content.primaryLabel}<CinematicArrow disc /></Link>
      </div>
    </nav>
    {content.workflows ? <ModelCinematicWorkflowProofs presentation={presentation} workspaceHref={decision.hero.primaryCta.href} /> : <ModelCinematicExamples presentation={presentation} viewModel={examples} hasRenderedVideos={hasRenderedVideos} />}
    {content.specialty ? <ModelCinematicSpecialty presentation={presentation} demo={keyframeDemo} /> : null}
    {content.workflows && (hasRenderedVideos || presentation.examples.gallery) ? <ModelCinematicExamples presentation={presentation} viewModel={examples} hasRenderedVideos={hasRenderedVideos} excludedJobId={keyframeDemo?.recipe.jobId} galleryOnly /> : null}
    <ModelCinematicPrompting viewModel={prompting} presentation={presentation} />
    {content.variant === 'video' ? <Suspense fallback={<div className="cinema-wrap cinema-details-pending" role="status"><p>{content.detailsLabel}</p><Link href={decision.pricing.cta.href} prefetch={false}>{decision.pricing.cta.label} ↗</Link></div>}><ModelCinematicDetails {...details} presentation={presentation} /></Suspense> : <ModelCinematicDetails {...details} presentation={presentation} />}
  </div>;
}
