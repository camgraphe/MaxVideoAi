import Image from 'next/image';
import type { ModelCinematicContent } from '../_lib/model-page-cinematic-content';
import type { CinematicPresentation } from '../_lib/model-page-cinematic-data';
import type { CinematicMotionProof } from '../_lib/model-page-cinematic-media';
import { ModelDecisionCopyButton } from './ModelDecisionCopyButton.client';
import { cinematicVideoPromptLinks } from '../_lib/model-page-workflow-proofs';
import { ModelCinematicVideoPrompt } from './ModelCinematicVideoPrompt.client';
import { ModelCinematicMotionPair } from './ModelCinematicMotionPair.client';

type Focus = NonNullable<NonNullable<ModelCinematicContent['workflows']>['items'][number]['focus']>;

/** Registered character and unretimed source/result pair for the selected model. */
export function ModelCinematicWorkflowFocus({ focus, ui, workspaceHref, media }: {
  focus: Focus; ui: CinematicPresentation['ui']; workspaceHref: string; media: CinematicMotionProof;
}) {
  const caption = focus.caption;
  return <aside id={focus.id} className="cinema-workflow-focus" aria-labelledby={`${focus.id}-title`}>
    <figure className="cinema-focus-character">
      <div className="cinema-editorial-media cinema-editorial-media--character">
        <Image src={media.character.display} width={media.character.width} height={media.character.height} alt={focus.imageLabel} sizes="(min-width: 768px) 42vw, 90vw" loading="lazy" />
      </div>
      <figcaption>{focus.imageLabel}</figcaption>
    </figure>
    <div className="cinema-focus-copy">
      <p className="cinema-eyebrow">{focus.eyebrow}</p>
      <h3 id={`${focus.id}-title`}>{focus.title}</h3>
      <p>{focus.body}</p>
      <ModelCinematicMotionPair source={media.source} result={media.result} sourceLabel={focus.referenceLabel} resultLabel={focus.resultLabel} ui={ui} />
      <p className="cinema-focus-caption">{caption}</p>
      <div className="cinema-focus-actions">
        <ModelDecisionCopyButton copyText={focus.prompt} label={ui.copy} copiedLabel={ui.copied} analyticsLocation="model_workflow" />
        <ModelCinematicVideoPrompt title={focus.title} prompt={focus.prompt} note={focus.promptNote ?? caption} imageDetailsLabel={focus.imageLabel} ui={{ ...ui, videoPrompt: ui.prompt }} triggerLabel={focus.promptLabel} creation={cinematicVideoPromptLinks(workspaceHref, focus.id.replace(/^focus-/, ''))} />
      </div>
    </div>
  </aside>;
}
