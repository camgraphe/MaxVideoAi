'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Check, Clapperboard, GalleryHorizontalEnd, MonitorUp } from 'lucide-react';
import type { ModelCinematicContent } from '../_lib/model-page-cinematic-content';
import type { CinematicPresentation } from '../_lib/model-page-cinematic-data';
import { CinematicArrow, CinematicPlus } from './ModelCinematicMarks';

const stepIcons = [Clapperboard, GalleryHorizontalEnd, MonitorUp];

/** An illustrated route through Create/Library, not a fabricated resolution test. */
export function ModelCinematicDraftWorkflow({ copy, href, visual }: {
  copy: NonNullable<ModelCinematicContent['specialty']>; href: string;
  visual: NonNullable<CinematicPresentation['draftVisual']>;
}) {
  const [resolution, setResolution] = useState<'1080p' | '4K'>('1080p');
  const [selectedId, setSelectedId] = useState(visual.selectedAngleId);
  const labels = copy.draftPreview;
  if (!labels) return null;
  const selected = visual.angles.find(angle => angle.id === selectedId)!;
  const selectedCopy = labels.angles.find(angle => angle.id === selectedId)!;
  return <section id="model-workflow" className="cinema-specialty cinema-draft-workflow cinema-section" aria-labelledby="cinema-specialty-title">
    <div className="cinema-wrap">
      <div className="cinema-draft-composition" data-media-kind="workflow-illustration">
      <header className="cinema-draft-heading">
        <div><p className="cinema-eyebrow">{copy.eyebrow}</p><h2 id="cinema-specialty-title">{copy.title}</h2></div>
        <p>{copy.intro}</p>
      </header>
        <div className="cinema-draft-preview">
          <div className="cinema-draft-stage-label"><span>{labels.draftLocation}</span><strong>{labels.draftLabel}</strong></div>
          <div className="cinema-draft-angles" role="group" aria-label={labels.selectionLabel}>
            {visual.angles.map(angle => {
              const angleCopy = labels.angles.find(item => item.id === angle.id)!;
              const active = selectedId === angle.id;
              return <button key={angle.id} type="button" className="cinema-draft-angle" aria-pressed={active} aria-controls="cinema-draft-final-preview" onClick={() => setSelectedId(angle.id)}>
                <span className="cinema-draft-angle-image"><Image src={angle.url} width={angle.width} height={angle.height} alt="" sizes="(min-width: 1200px) 190px, (min-width: 768px) 16vw, 30vw" loading="lazy" />
                  {active ? <span className="cinema-draft-check" aria-hidden="true"><Check size={15} strokeWidth={2.5} /></span> : null}
                </span>
                <span className="cinema-draft-angle-label">{angleCopy.label}</span>
              </button>;
            })}
          </div>
          <p>{labels.draftHint}</p>
        </div>
        <div className="cinema-draft-connector" aria-hidden="true"><CinematicArrow /></div>
        <figure className="cinema-draft-final">
          <div className="cinema-draft-final-top"><span>{labels.finalLocation}</span>
            <div className="cinema-draft-resolutions" role="group" aria-label={labels.resolutionLabel}>
              {(['1080p', '4K'] as const).map(value => <button key={value} type="button" aria-pressed={resolution === value} onClick={() => setResolution(value)}>{value}</button>)}
            </div>
          </div>
          <div id="cinema-draft-final-preview" className="cinema-draft-image" data-selected-angle={selectedId}>
            <Image src={selected.url} width={selected.width} height={selected.height} alt={`${labels.imageAlt} ${selectedCopy.label}.`} sizes="(min-width: 1100px) 720px, (min-width: 768px) 50vw, 92vw" loading="lazy" />
            <span className="cinema-draft-resolution-label" aria-live="polite">{labels.finalLabel} <strong>{resolution}</strong>{' '}<span>10-bit HEVC</span></span>
          </div>
          <figcaption className="cinema-draft-selected-note" aria-live="polite"><Check size={16} aria-hidden="true" /><span><strong>{labels.selectedLabel} · {selectedCopy.label}</strong>{selectedCopy.description}</span></figcaption>
        </figure>
        <p className="cinema-draft-provenance">{labels.illustration}</p>
      </div>
      <ol className="cinema-draft-steps" aria-label={copy.eyebrow}>{copy.steps.map((step, index) => {
        const StepIcon = stepIcons[index];
        return <li key={step.label}><StepIcon size={28} strokeWidth={1.4} aria-hidden="true" /><div><h3>{step.label}</h3><p>{step.body}</p></div></li>;
      })}</ol>
      <div className="cinema-draft-bottom">
        <div className="cinema-draft-action"><a href={href} className="cinema-button" data-analytics-event="cta_click" data-analytics-cta-name="open_workspace" data-analytics-cta-location="model_specialty" data-analytics-target-family="workspace">{copy.action}<CinematicArrow disc /></a><p>{labels.quoteNote}</p></div>
        <details className="cinema-draft-details"><summary>{labels.detailsLabel}<CinematicPlus /></summary><p>{copy.note}</p><a className="cinema-source-link" href={copy.source.href} target="_blank" rel="noopener noreferrer">{copy.source.label}<CinematicArrow direction="external" /></a></details>
      </div>
    </div>
  </section>;
}
