import Image, { getImageProps } from 'next/image';
import type { CinematicPresentation } from '../_lib/model-page-cinematic-data';
import type { ModelKeyframeDemoViewModel } from '../_lib/model-page-keyframe-demo';
import { ModelCinematicFilm } from './ModelCinematicFilm.client';
import { ModelCinematicVideoPrompt } from './ModelCinematicVideoPrompt.client';
import { CinematicArrow } from './ModelCinematicMarks';
import { ModelCinematicDraftWorkflow } from './ModelCinematicDraftWorkflow.client';

/** Evidence comes from the existing public recipe validator, never an invented keyframe result. */
export function ModelCinematicSpecialty({ presentation, demo }: {
  presentation: CinematicPresentation; demo?: ModelKeyframeDemoViewModel | null;
}) {
  const { content, ui } = presentation;
  const copy = content.specialty;
  if (!copy) return null;
  const entry = new URL(presentation.assistantHref, 'https://maxvideoai.com');
  entry.searchParams.delete('assistant'); entry.searchParams.delete('refine');
  entry.searchParams.set('mode', copy.mode);
  const href = entry.pathname + entry.search;
  if (copy.kind === 'draft' && copy.draftPreview && presentation.draftVisual) return <ModelCinematicDraftWorkflow copy={copy} href={href} visual={presentation.draftVisual} />;
  const preview = presentation.workspacePreview;
  const mobileImage = preview ? getImageProps({ width: preview.mobile.width, height: preview.mobile.height, alt: copy.workspacePreview.alt, src: preview.mobile.url, sizes: '92vw' }).props : undefined;
  const workspace = preview ? <figure className={`cinema-workspace-preview cinema-workspace-preview--${copy.kind}`}>
    <picture><source media="(max-width: 599px)" srcSet={mobileImage?.srcSet} sizes={mobileImage?.sizes} width={preview.mobile.width} height={preview.mobile.height} />
    <Image src={preview.url} width={preview.width} height={preview.height} alt={copy.workspacePreview.alt}
      sizes={copy.kind === 'draft' ? '(min-width: 1040px) 960px, 92vw' : '(min-width: 900px) 560px, 92vw'} loading="lazy" /></picture>
    <figcaption>{copy.workspacePreview.caption}</figcaption>
  </figure> : null;
  return <section id="model-workflow" className="cinema-specialty cinema-section" aria-labelledby="cinema-specialty-title"><div className="cinema-wrap">
    <header className="cinema-section-heading"><div><p className="cinema-eyebrow">{copy.eyebrow}</p><h2 id="cinema-specialty-title">{copy.title}</h2></div><p>{copy.intro}</p></header>
    {copy.kind === 'keyframes' && demo ? <div id="keyframe-example" className="cinema-keyframe-proof">
      <figure><ModelCinematicFilm video={demo.videoUrl} poster={demo.posterUrl} title={demo.copy.resultLabel} ui={ui} mask="frame" keyframes={demo} />
        <figcaption>{demo.copy.resultLabel} · {demo.recipe.durationSec}s · {demo.recipe.resolution}</figcaption>
        <ModelCinematicVideoPrompt title={demo.copy.title} prompt={demo.recipe.prompt} note={demo.copy.limitation} imageDetailsLabel={ui.sourcePrompt} ui={ui}
          creation={demo.recreateHref ? { href: `${demo.recreateHref}&lang=${presentation.locale}`, refineHref: `${demo.recreateHref}&lang=${presentation.locale}&assistant=milo&refine=example` } : undefined} />
      </figure>
    </div> : <>{workspace}<ol className="cinema-workflow-sequence" aria-label={copy.eyebrow}>{copy.steps.map((step, index) => <li key={step.label}>
      <span className="cinema-sequence-index" aria-hidden="true">0{index + 1}</span><strong>{step.label}</strong><p>{step.body}</p>{index < 2 ? <CinematicArrow /> : null}
    </li>)}</ol></>}
    <div className="cinema-specialty-footer"><div><p>{copy.note}</p><a className="cinema-source-link" href={copy.source.href} target="_blank" rel="noopener noreferrer">{copy.source.label}<CinematicArrow direction="external" /></a></div><a href={href} className="cinema-button" data-analytics-event="cta_click" data-analytics-cta-name="open_workspace" data-analytics-cta-location="model_specialty" data-analytics-target-family="workspace">{copy.action}<CinematicArrow disc /></a></div>
    {copy.details ? <div className="cinema-capability-notes">{copy.details.map(item => <article key={item.title}><h3>{item.title}</h3><p>{item.body}</p></article>)}</div> : null}
  </div></section>;
}
