import { ModelCinematicFilm } from './ModelCinematicFilm.client';
import type { CinematicVideoMedia } from '../_lib/model-page-cinematic-media';
import { Link } from '@/i18n/navigation';
import type { CinematicAsset, CinematicPresentation } from '../_lib/model-page-cinematic-data';
import { cinematicWorkflowHref, cinematicVideoPromptLinks } from '../_lib/model-page-workflow-proofs';
import { CinematicArrow } from './ModelCinematicMarks';
import { ModelCinematicVideoPrompt } from './ModelCinematicVideoPrompt.client';
import { ModelCinematicWorkflowFocus } from './ModelCinematicWorkflowFocus';

type Workflows = NonNullable<CinematicPresentation['content']['workflows']>;
type Panel = CinematicPresentation['examples']['panels'][number];

/** Actual reviewed film in the approved editorial composition. */
export function ModelCinematicCreateProof({ item, panel, asset, focusAsset, workflows, ui, workspaceHref, promptBaseHref, media }: {
  item: Workflows['items'][number]; panel: Panel; asset: CinematicAsset; focusAsset?: CinematicAsset;
  workflows: Workflows; ui: CinematicPresentation['ui']; workspaceHref: string; promptBaseHref: string;
  media: CinematicVideoMedia;
}) {
  return <article id="proof-create" className="cinema-workflow-proof cinema-workflow-proof--create" aria-labelledby="cinema-create">
    <div className="cinema-wrap">
      <div className="cinema-create-editorial">
        <header className="cinema-create-heading">
          <p className="cinema-eyebrow">{panel.eyebrow}</p>
          <h2 id="cinema-create">{panel.title}</h2>
        </header>
        <figure className="cinema-create-visual">
          <ModelCinematicFilm video={media.create.src} poster={media.create.poster} title={asset.title} ui={ui} />
          <figcaption><span>{item.proofLabel}</span><p>{item.inspect}</p></figcaption>
        </figure>
        <div className="cinema-create-description">
          <p className="cinema-workflow-intro">{panel.body}</p>
          <p className="cinema-create-facts">{item.compactFacts}</p>
        </div>
        <div className="cinema-create-actions">
          <Link href={cinematicWorkflowHref(workspaceHref, 'create')} prefetch={false} className="cinema-button" data-analytics-event="cta_click" data-analytics-cta-name="open_workspace" data-analytics-cta-location="model_workflow" data-analytics-target-family="workspace">{item.action}<CinematicArrow disc /></Link>
          <ModelCinematicVideoPrompt title={panel.title} prompt={item.prompt} note={item.proofNote ?? workflows.promptNote} imageDetailsLabel={workflows.imageDetailsLabel} ui={{ ...ui, videoPrompt: ui.prompt }} asset={asset.videoCreation ? undefined : asset} triggerLabel={item.promptLabel} creation={asset.videoCreation ?? cinematicVideoPromptLinks(promptBaseHref, item.id)}
            details={<div key="settings" className="cinema-create-settings"><dl className="cinema-workflow-limits" aria-label={workflows.limitsLabel}>{item.limits.map(limit => <div key={limit.label}><dt>{limit.label}</dt><dd>{limit.value}</dd></div>)}</dl><p>{panel.note}</p></div>} />
        </div>
      </div>
      {item.focus && focusAsset ? <ModelCinematicWorkflowFocus focus={item.focus} ui={ui} workspaceHref={promptBaseHref} media={media.focuses[item.focus.id]} /> : null}
    </div>
  </article>;
}
