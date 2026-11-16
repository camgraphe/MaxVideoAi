import { CinematicArrow } from './ModelCinematicMarks';
import Image from 'next/image';
import { resolveCinematicHeroDisplay } from '../_lib/model-page-cinematic-hero-display';
import { Link } from '@/i18n/navigation';
import type { CinematicPresentation } from '../_lib/model-page-cinematic-data';
import type { ModelDecisionData } from '../_lib/model-page-decision-data';
import { ModelCinematicBenefits } from './ModelCinematicBenefits';
import { ModelCinematicHighlights } from './ModelCinematicHighlights';
import { ModelCinematicWorkflowNav } from './ModelCinematicWorkflowNav';

/** Full-bleed opening owned by the opt-in cinematic template. */
export function ModelCinematicHero({ presentation, decision }: {
  presentation: CinematicPresentation; decision: ModelDecisionData;
}) {
  const { content, hero } = presentation;
  const display = resolveCinematicHeroDisplay(hero);
  const isVideo = content.variant === 'video';
  const overview = content.overview;
  // The landscape Flash poster covers a tall mobile opening; choose its prepared 1280 px copy.
  const mobileSizes = isVideo ? '1200px' : '100vw';
  return <section id="top" className={`cinema-hero cinema-hero--${content.variant} cinema-hero--with-overview`} aria-labelledby="cinema-model-title">
    <link rel="preload" as="image" type="image/avif" media="(max-width: 767px)" imageSrcSet={display.mobile} imageSizes={mobileSizes} fetchPriority="high" />
    <link rel="preload" as="image" type="image/avif" media="(min-width: 768px)" imageSrcSet={display.desktop} imageSizes="100vw" fetchPriority="high" />
    <div className="cinema-hero-art"><picture>
      <source media="(max-width: 767px)" type="image/avif" srcSet={display.mobile} sizes={mobileSizes} />
      <source media="(min-width: 768px)" type="image/avif" srcSet={display.desktop} sizes="100vw" />
      <Image src={hero.display.url} width={hero.display.width} height={hero.display.height} alt={hero.title}
        loading="eager" fetchPriority="high" sizes="100vw" className="cinema-hero-image" />
    </picture></div>
    <div id="overview" className="cinema-wrap cinema-hero-content">
      <p className="cinema-byline">{content.byline}</p>
      <h1 id="cinema-model-title">{content.titleLines.map((line, index) => <span key={line}>{index ? ' ' : ''}{line}</span>)}</h1>
      <p className="cinema-hero-subtitle">{overview ? overview.titleLines.join(' ') : content.subtitle}</p>
      <p className="cinema-hero-intro">{content.intro}</p>
      <div className="cinema-hero-bottom">
        <div className="cinema-actions">
          <Link href={decision.hero.primaryCta.href} prefetch={false} className="cinema-button" data-analytics-event="cta_click" data-analytics-cta-name="open_workspace" data-analytics-cta-location="model_hero" data-analytics-target-family="workspace">{content.primaryLabel}<CinematicArrow disc /></Link>
          <a href="#examples" className="cinema-text-link">{content.examplesLabel}<CinematicArrow direction="down" /></a>
        </div>
      </div>
      {content.highlights ? <ModelCinematicHighlights items={content.highlights} /> : content.workflows ? <ModelCinematicWorkflowNav workflows={content.workflows} /> : overview ? <ModelCinematicBenefits overview={overview} /> : <dl className="cinema-hero-facts">{content.facts.map(fact => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl>}
    </div>
  </section>;
}
