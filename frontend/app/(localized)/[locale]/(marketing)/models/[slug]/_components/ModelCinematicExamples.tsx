import type { CinematicPresentation } from '../_lib/model-page-cinematic-data';
import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { CinematicArrow } from './ModelCinematicMarks';
import type { ModelExamplesViewModel } from '../_lib/model-page-examples-view-model';
import { ModelCinematicAsset, ModelCinematicPrompt } from './ModelCinematicAsset';
import { ModelCinematicCompare, ModelCinematicCutout } from './ModelCinematicCompare.client';
import { ModelCinematicGallery } from './ModelCinematicGallery.client';
import { buildCinematicGalleryItems } from '../_lib/model-page-cinematic-gallery';
import { ModelCinematicDetailCrop } from './ModelCinematicZoom.client';

export function ModelCinematicExamples({ presentation, viewModel, hasRenderedVideos, galleryOnly = false }: {
  presentation: CinematicPresentation; viewModel: ModelExamplesViewModel; hasRenderedVideos: boolean; galleryOnly?: boolean;
}) {
  const { assets, examples, ui } = presentation;
  const preview = galleryOnly && !hasRenderedVideos && examples.gallery ? assets.find(asset => asset.id === examples.gallery!.previewAssetId) : null;
  const proofPanels = galleryOnly ? [] : examples.panels.filter(panel => !panel.placement || panel.placement === 'examples');
  return <section id={galleryOnly ? 'rendered-examples' : 'examples'} className="cinema-examples" aria-label={examples.title ?? viewModel.section.title}>
    {!galleryOnly && viewModel.anchorId !== 'examples' ? <span id={viewModel.anchorId} /> : null}
    {preview && examples.gallery ? <div className="cinema-gallery-bridge"><div className="cinema-wrap cinema-gallery-bridge-inner">
      <figure><Image src={preview.display.url} width={preview.display.width} height={preview.display.height} alt={preview.title} sizes="(min-width: 768px) 200px, 35vw" loading="lazy" /><figcaption>{examples.gallery.previewLabel}</figcaption></figure>
      <div><p className="cinema-eyebrow">{examples.gallery.navLabel}</p><h2>{examples.gallery.title}</h2><p>{examples.gallery.intro}</p>
        {viewModel.decision.examplesLinkHref ? <Link href={viewModel.decision.examplesLinkHref} prefetch={false} className="cinema-source-link" data-analytics-event="cta_click" data-analytics-cta-name="see_examples" data-analytics-cta-location="model_related" data-analytics-target-family="examples">{examples.gallery.linkLabel}<CinematicArrow /></Link> : null}
      </div>
    </div></div> : null}
    {hasRenderedVideos ? <ModelCinematicGallery title={viewModel.section.title}
      items={buildCinematicGalleryItems(viewModel.decision.items, presentation.content.modelSlug, presentation.locale)} ui={ui}
      examplesHref={viewModel.decision.examplesLinkHref} examplesLabel={viewModel.decision.viewAllLabel} /> : null}
    {proofPanels.map((panel, index) => {
      const selected = panel.assetIds.map(id => assets.find(asset => asset.id === id)!);
      const portrait = panel.layout === 'feature' && selected.length === 1 && selected[0].display.height > selected[0].display.width;
      return <article id={`proof-${panel.id}`} key={panel.id} className={`cinema-panel cinema-panel--${panel.layout}${index === 0 && !hasRenderedVideos ? ' cinema-panel--opening' : ''}${portrait ? ' cinema-panel--portrait' : ''}${index % 2 === 1 && panel.layout !== 'cutout' ? ' cinema-panel--quiet' : ''}`} aria-labelledby={`cinema-${panel.id}`}><div className="cinema-wrap cinema-panel-inner">
        <header className="cinema-panel-heading"><div><p className="cinema-eyebrow">{panel.eyebrow}</p><h2 id={`cinema-${panel.id}`}>{panel.title}</h2></div><p>{panel.body}</p></header>
        <div className="cinema-panel-media">
          {panel.layout === 'edit' ? <ModelCinematicCompare assets={selected} ui={ui} note={panel.note} />
            : panel.layout === 'cutout' ? <><ModelCinematicCutout asset={selected[0]} ui={ui} /><ModelCinematicPrompt asset={selected[0]} ui={ui} /></>
            : <div className={selected.length > 1 ? 'cinema-media-grid' : undefined}>{selected.map(asset => <ModelCinematicAsset key={asset.id} asset={asset} ui={ui} compact={selected.length > 1 || portrait} inspect={portrait}
              plan={examples.shotPlans?.find(plan => plan.assetId === asset.id)} />)}</div>}
        </div>
        {portrait ? <div className="cinema-portrait-inspection"><ModelCinematicDetailCrop asset={selected[0]} ui={ui} /><p className="cinema-panel-note">{panel.note}</p></div> : panel.layout !== 'edit' ? <p className="cinema-panel-note">{panel.note}</p> : null}
      </div></article>;
    })}
  </section>;
}
