import type { CinematicPresentation } from '../_lib/model-page-cinematic-data';
import type { ModelExamplesViewModel } from '../_lib/model-page-examples-view-model';
import { ModelCinematicAsset, ModelCinematicPrompt } from './ModelCinematicAsset';
import { ModelCinematicCompare, ModelCinematicCutout } from './ModelCinematicCompare.client';
import { ModelDecisionExamplesGallery } from './ModelDecisionExamplesGallery.client';

export function ModelCinematicExamples({ presentation, viewModel, hasRenderedVideos }: {
  presentation: CinematicPresentation; viewModel: ModelExamplesViewModel; hasRenderedVideos: boolean;
}) {
  const { assets, examples, ui } = presentation;
  return <section id="examples" className="cinema-examples">
    {viewModel.anchorId !== 'examples' ? <span id={viewModel.anchorId} /> : null}
    <header className="cinema-wrap cinema-examples-heading"><h2>{examples.title ?? viewModel.section.title}</h2></header>
    {hasRenderedVideos ? <div className="cinema-wrap"><ModelDecisionExamplesGallery title={viewModel.section.title} intro={viewModel.section.intro}
      filters={viewModel.filters} items={viewModel.decision.items} examplesLinkHref={viewModel.decision.examplesLinkHref}
      viewAllLabel={viewModel.decision.viewAllLabel} renderLinkLabel={viewModel.decision.renderLinkLabel}
      emptyLabel={viewModel.decision.emptyLabel} noPreviewLabel={viewModel.decision.noPreviewLabel} /></div> : null}
    {examples.panels.map((panel, index) => {
      const selected = panel.assetIds.map(id => assets.find(asset => asset.id === id)!);
      const portrait = panel.layout === 'feature' && selected.length === 1 && selected[0].display.height > selected[0].display.width;
      return <article id={`proof-${panel.id}`} key={panel.id} className={`cinema-panel cinema-panel--${panel.layout}${portrait ? ' cinema-panel--portrait' : ''}`} aria-labelledby={`cinema-${panel.id}`}><div className="cinema-wrap cinema-panel-inner">
        <header className="cinema-panel-heading"><div><p className="cinema-eyebrow">{String(index + 1).padStart(2, '0')} / {panel.eyebrow}</p><h3 id={`cinema-${panel.id}`}>{panel.title}</h3></div><p>{panel.body}</p></header>
        <div className="cinema-panel-media">
          {panel.layout === 'edit' ? <ModelCinematicCompare assets={selected} ui={ui} />
            : panel.layout === 'cutout' ? <><ModelCinematicCutout asset={selected[0]} ui={ui} /><ModelCinematicPrompt asset={selected[0]} ui={ui} /></>
            : <div className={selected.length > 1 ? 'cinema-media-grid' : undefined}>{selected.map(asset => <ModelCinematicAsset key={asset.id} asset={asset} ui={ui} compact={selected.length > 1 || portrait} inspect={portrait}
              plan={examples.shotPlans?.find(plan => plan.assetId === asset.id)} />)}</div>}
        </div>
        <p className="cinema-panel-note">{panel.note}</p>
      </div></article>;
    })}
    <div className="cinema-wrap cinema-provenance"><details className="cinema-disclosure"><summary>{ui.aboutExamples}<span aria-hidden="true">+</span></summary><div><p>{examples.intro ?? viewModel.section.intro}</p><p>{examples.provenance}</p></div></details></div>
  </section>;
}
