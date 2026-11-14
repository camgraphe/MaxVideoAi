import Image from 'next/image';
import { resolveCinematicHeroDisplay } from '../_lib/model-page-cinematic-hero-display';
import { Link } from '@/i18n/navigation';
import type { CinematicPresentation } from '../_lib/model-page-cinematic-data';
import type { ModelDecisionData } from '../_lib/model-page-decision-data';

/** Full-bleed opening owned by the opt-in cinematic template. */
export function ModelCinematicHero({ presentation: { content, hero, ui }, decision }: {
  presentation: CinematicPresentation; decision: ModelDecisionData;
}) {
  const display = resolveCinematicHeroDisplay(hero);
  return <section id="top" className={`cinema-hero cinema-hero--${content.variant}`} aria-labelledby="cinema-model-title">
    <link rel="preload" as="image" type="image/avif" media="(max-width: 767px)" imageSrcSet={display.mobile} imageSizes="100vw" fetchPriority="high" />
    <link rel="preload" as="image" type="image/avif" media="(min-width: 768px)" imageSrcSet={display.desktop} imageSizes="100vw" fetchPriority="high" />
    <div className="cinema-hero-art"><picture>
      <source media="(max-width: 767px)" type="image/avif" srcSet={display.mobile} sizes="100vw" />
      <source media="(min-width: 768px)" type="image/avif" srcSet={display.desktop} sizes="100vw" />
      <Image src={hero.display.url} width={hero.display.width} height={hero.display.height} alt={hero.title}
        loading="eager" fetchPriority="high" sizes="100vw" className="cinema-hero-image" />
    </picture></div>
    <div className="cinema-wrap cinema-hero-content">
      <p className="cinema-byline">{content.byline}</p>
      <h1 id="cinema-model-title">{content.titleLines.map((line, index) => <span key={line}>{index ? ' ' : ''}{line}</span>)}</h1>
      <p className="cinema-hero-subtitle">{content.subtitle}</p>
      <div className="cinema-hero-bottom">
        <div className="cinema-actions">
          <Link href={decision.hero.primaryCta.href} prefetch={false} className="cinema-button">{content.primaryLabel}<span aria-hidden="true">↗</span></Link>
          <a href="#examples" className="cinema-text-link">{content.examplesLabel}<span aria-hidden="true">↓</span></a>
        </div>
        <div className="cinema-hero-caption"><p>{content.caption}</p><a href={hero.original.url} target="_blank" rel="noopener noreferrer">{ui.original} ↗</a></div>
      </div>
    </div>
  </section>;
}
