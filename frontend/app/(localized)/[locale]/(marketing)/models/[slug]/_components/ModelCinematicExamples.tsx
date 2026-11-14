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
    <header className="cinema-section-heading"><p className="cinema-eyebrow">{presentation.content.proofLabel}</p>
      <h2>{viewModel.section.title}</h2><p>{viewModel.section.intro}</p>
    </header>
    <p className="cinema-provenance">{examples.provenance}</p>
    {hasRenderedVideos ? <ModelDecisionExamplesGallery title={viewModel.section.title} intro={viewModel.section.intro}
      filters={viewModel.filters} items={viewModel.decision.items} examplesLinkHref={viewModel.decision.examplesLinkHref}
      viewAllLabel={viewModel.decision.viewAllLabel} renderLinkLabel={viewModel.decision.renderLinkLabel}
      emptyLabel={viewModel.decision.emptyLabel} noPreviewLabel={viewModel.decision.noPreviewLabel} /> : null}
    {examples.panels.map((panel, index) => {
      const selected = panel.assetIds.map(id => assets.find(asset => asset.id === id)!);
      const portrait = panel.layout === 'feature' && selected.length === 1 && selected[0].display.height > selected[0].display.width;
      return <article key={panel.id} className={`cinema-panel cinema-panel--${panel.layout}${portrait ? ' cinema-panel--portrait' : ''}`} aria-labelledby={`cinema-${panel.id}`}>
        <header className="cinema-panel-heading"><p className="cinema-eyebrow">{String(index + 1).padStart(2, '0')} / {panel.eyebrow}</p>
          <h3 id={`cinema-${panel.id}`}>{panel.title}</h3><p>{panel.body}</p>
        </header>
        <div className="cinema-panel-media">
          {panel.layout === 'edit' ? <><ModelCinematicCompare assets={selected} ui={ui} />{selected.map(asset => <ModelCinematicPrompt key={asset.id} asset={asset} ui={ui} />)}</>
            : panel.layout === 'cutout' ? <><ModelCinematicCutout asset={selected[0]} ui={ui} /><ModelCinematicPrompt asset={selected[0]} ui={ui} /></>
            : <div className={selected.length > 1 ? 'cinema-media-grid' : undefined}>{selected.map(asset => <ModelCinematicAsset key={asset.id} asset={asset} ui={ui} compact={selected.length > 1}
              plan={examples.shotPlans?.find(plan => plan.assetId === asset.id)} />)}</div>}
        </div>
        <p className="cinema-panel-note">{panel.note}</p>
      </article>;
    })}
  </section>;
}
