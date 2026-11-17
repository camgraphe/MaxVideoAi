import Image from 'next/image';
import { Clock3, Scan, Video, Layers } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import type { CinematicPresentation } from '../_lib/model-page-cinematic-data';
import { cinematicWorkflowHref, cinematicVideoPromptLinks } from '../_lib/model-page-workflow-proofs';
import { ModelCinematicStoryboard } from './ModelCinematicStoryboard.client';
import { ModelCinematicVideoPrompt } from './ModelCinematicVideoPrompt.client';
import { CinematicArrow } from './ModelCinematicMarks';
import { ModelCinematicCreateProof } from './ModelCinematicCreateProof';
import { ModelCinematicMotionPair } from './ModelCinematicMotionPair.client';

/** One visible, server-rendered demonstration per workspace action. */
export function ModelCinematicWorkflowProofs({ presentation, workspaceHref }: { presentation: CinematicPresentation; workspaceHref: string }) {
  const { content, examples, assets, ui, media } = presentation;
  const workflows = content.workflows;
  if (!workflows) return null;
  if (!media) throw new Error('Video workflows need reviewed model media');
  return <section id="examples" className="cinema-workflow-proofs" aria-label={examples.title}>
    {workflows.items.map(item => {
      const panel = examples.panels.find(panel => panel.id === item.id)!;
      const asset = assets.find(asset => asset.id === panel.assetIds[0])!;
      const board = media.boards.find(board => board.id === item.id);
      const focusAsset = item.focus ? assets.find(asset => asset.id === item.focus!.assetId) : undefined;
      if (item.id === 'create') return <ModelCinematicCreateProof key={item.id} item={item} panel={panel} asset={asset} focusAsset={focusAsset} workflows={workflows} ui={ui} workspaceHref={workspaceHref} promptBaseHref={presentation.assistantHref} media={media} capabilities={presentation.capabilities} />;
      const heading = <header className="cinema-workflow-heading"><p className="cinema-eyebrow">{panel.eyebrow}</p><h2 id={`cinema-${item.id}`}>{panel.title}</h2></header>;
      const limits = <dl className="cinema-workflow-limits cinema-workflow-facts" aria-label={workflows.limitsLabel}>{item.limits.map((limit, index) => {
        const Icon = index === 0 ? item.id === 'modify' ? Video : Layers : index === 1 ? Clock3 : Scan;
        return <div key={limit.label}><Icon size={22} strokeWidth={1.5} aria-hidden="true" /><dt>{limit.label}</dt><dd>{limit.value}</dd></div>;
      })}</dl>;
      const prompt = <ModelCinematicVideoPrompt title={panel.title} prompt={item.prompt} note={item.proofNote ?? workflows.promptNote} imageDetailsLabel={workflows.imageDetailsLabel} ui={ui}
        creation={cinematicVideoPromptLinks(presentation.assistantHref, item.id, item.id)} details={<p key={`${item.id}-note`} className="cinema-workflow-note">{panel.note}</p>} />;
      return <article key={item.id} id={`proof-${item.id}`} className={`cinema-workflow-proof cinema-workflow-proof--${item.id} cinema-workflow-editorial`} aria-labelledby={`cinema-${item.id}`}><div className="cinema-wrap">
        {item.id === 'extend' ? <>{heading}<p className="cinema-workflow-intro cinema-extend-intro">{panel.body}</p></> : null}
        <div className="cinema-workflow-composition">
          <div className="cinema-workflow-visual">
            {item.id === 'modify' && media.modify ? <figure className="cinema-storyboard cinema-storyboard--modify">
              <ModelCinematicMotionPair source={media.modify.source} result={media.modify.result} sourceLabel={item.input} resultLabel={item.output} ui={ui} layout="reveal" />
              <figcaption>{item.proofLabel}</figcaption>
            </figure> : board ? <ModelCinematicStoryboard board={board.display} before={item.input} after={item.output} concept={workflows.conceptLabel} compare={ui.compare} kind={item.id} timeline={item.timeline} /> : <figure className="cinema-workflow-frame"><Image src={asset.display.url} width={asset.display.width} height={asset.display.height} alt={asset.title} sizes="(min-width: 768px) 60vw, 90vw" loading="lazy" /><figcaption>{workflows.conceptLabel}</figcaption></figure>}
            {item.id === 'modify' ? <p className="cinema-workflow-inspect">{item.inspect}</p> : null}
          </div>
          <div className="cinema-workflow-copy">
            {item.id === 'modify' ? <>{heading}<p className="cinema-workflow-intro">{panel.body}</p>
              <div className="cinema-edit-brief"><p className="cinema-eyebrow">{workflows.briefLabel}</p><p>{item.promptSummary ?? item.prompt.split('. ')[0] + '.'}</p>{prompt}</div></>
              : <div className="cinema-workflow-evidence"><h3>{workflows.inspectLabel}</h3><p>{item.inspect}</p></div>}
            {limits}
            <div className="cinema-workflow-actions"><Link href={cinematicWorkflowHref(workspaceHref, item.id)} prefetch={false} className="cinema-button" data-analytics-event="cta_click" data-analytics-cta-name="open_workspace" data-analytics-cta-location="model_workflow" data-analytics-target-family="workspace">{item.action}<CinematicArrow disc /></Link></div>
            {item.id === 'extend' ? prompt : null}
          </div>
        </div>
      </div></article>;
    })}
    {!examples.gallery ? <div className="cinema-workflow-source cinema-wrap"><a href={workflows.source.href} target="_blank" rel="noopener noreferrer">{workflows.source.label}<CinematicArrow direction="external" /></a></div> : null}
  </section>;
}
