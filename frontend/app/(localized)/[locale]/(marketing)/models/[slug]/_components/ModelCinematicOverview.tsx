import { Link } from '@/i18n/navigation';
import { getModelExamplesUiCopy } from '../_lib/model-page-examples-ui-copy';
import { CinematicArrow } from './ModelCinematicMarks';
import type { CinematicPresentation } from '../_lib/model-page-cinematic-data';
import { ModelCinematicVideoPrompt } from './ModelCinematicVideoPrompt.client';
import { ModelCinematicPrompt } from './ModelCinematicAsset';

/** Keep the opening visual's original prompt attached to that visual. */
export function ModelCinematicOverview({ presentation }: { presentation: CinematicPresentation }) {
  const { content, hero, ui, examples } = presentation;
  if (!hero) return null;
  if (hero.videoCreation) return <div className="cinema-hero-evidence" title={ui.heroPrompt}><ModelCinematicVideoPrompt
    title={hero.title} prompt={hero.prompt} note={hero.metadataLabel} imageDetailsLabel={ui.sourcePrompt}
    ui={ui} triggerLabel={ui.heroPrompt} creation={hero.videoCreation}
    details={hero.watchHref ? <Link href={hero.watchHref} prefetch={false} className="cinema-source-link">{getModelExamplesUiCopy(presentation.locale).renderLabel}<CinematicArrow /></Link> : undefined} /></div>;
  return <div className="cinema-hero-evidence" title={ui.heroPrompt}>
    <ModelCinematicPrompt asset={hero} ui={ui} label={ui.heroPrompt}>
      <p>{examples.provenance}</p>
      {content.overview ? <a className="cinema-overview-source" href={content.overview.source.href} target="_blank" rel="noopener noreferrer">{content.overview.source.label}<CinematicArrow direction="external" /></a> : null}
    </ModelCinematicPrompt>
  </div>;
}
