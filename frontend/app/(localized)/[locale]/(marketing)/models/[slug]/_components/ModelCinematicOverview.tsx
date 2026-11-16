import { CinematicArrow } from './ModelCinematicMarks';
import type { CinematicPresentation } from '../_lib/model-page-cinematic-data';
import { ModelCinematicPrompt } from './ModelCinematicAsset';

/** Supplementary hero evidence lives with the technical details, outside the visual sequence. */
export function ModelCinematicOverview({ presentation }: { presentation: CinematicPresentation }) {
  const { content, hero, ui, examples } = presentation;
  return <div className="cinema-hero-evidence">
    <ModelCinematicPrompt asset={hero} ui={ui} label={ui.heroPrompt}>
      <p>{examples.provenance}</p>
      {content.overview ? <a className="cinema-overview-source" href={content.overview.source.href} target="_blank" rel="noopener noreferrer">{content.overview.source.label}<CinematicArrow direction="external" /></a> : null}
    </ModelCinematicPrompt>
  </div>;
}
