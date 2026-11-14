import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import type { CinematicPresentation } from '../_lib/model-page-cinematic-data';
import { ModelCinematicPrompt } from './ModelCinematicAsset';

export function ModelCinematicOverview({ presentation }: { presentation: CinematicPresentation }) {
  const { content, hero, ui } = presentation;
  const overview = content.overview;
  if (!overview) return <section id="overview" className="cinema-wrap cinema-overview">
    <div className="cinema-overview-copy"><p className="cinema-eyebrow">{content.proofLabel}</p><p className="cinema-intro">{content.intro}</p></div>
    <dl className="cinema-facts">{content.facts.map(fact => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl>
    <ModelCinematicPrompt asset={hero} ui={ui} />
  </section>;

  return <section id="overview" className="cinema-overview-band" aria-labelledby="cinema-overview-title"><div className="cinema-wrap">
    <header className="cinema-overview-heading">
      <div><p className="cinema-eyebrow">{content.proofLabel}</p><h2 id="cinema-overview-title">{overview.titleLines.map(line => <span key={line}>{line}</span>)}</h2></div>
      <p className="cinema-overview-intro">{content.intro}</p>
    </header>
    <ul className="cinema-benefits">{overview.benefits.map((benefit, index) => <li key={benefit.panelId}>
      <a href={`#proof-${benefit.panelId}`}>
        <span className="cinema-benefit-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}<ArrowDownRight size={18} strokeWidth={1.5} /></span>
        <h3>{benefit.title}</h3><p>{benefit.body}</p>
      </a>
    </li>)}</ul>
    <div className="cinema-overview-foot"><ModelCinematicPrompt asset={hero} ui={ui} />
      <a className="cinema-overview-source" href={overview.source.href} target="_blank" rel="noopener noreferrer">{overview.source.label}<ArrowUpRight size={13} aria-hidden="true" /></a>
    </div>
  </div></section>;
}
